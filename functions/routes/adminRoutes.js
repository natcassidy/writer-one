const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe('sk_test_51MWVWpIW3HzLJAuw5UVhKj2Cnd6SbmjPmux3mEeXgudPczWwJGmLxq6Ald38sZvdQUG9sDAahxsfJnSwjAhdCyf700QXuT9dIk');
// const firestore = require("firebase/firestore");
// const { doc, setDoc, getDoc } = firestore;
// const firebase = require('./firebase');
const admin = require('firebase-admin');

router.get('/health', (req, res) => {
    res.status(200).send("I'm alive admin")
})

router.post('/webhooks', async (req, res) => {
    const paymentIntent = req.body.data.object.id
    const customer = req.body.data.object.customer

    // Confirm the payment status using the Stripe API
    const payment = await stripe.paymentIntents.retrieve(paymentIntent);

    if (payment.status === 'succeeded') {
        console.log('payment status succeeded')

        const invoiceId = payment.invoice;
        let stripePricing = await getPricingFromStripe(invoiceId)
        let wordCount = 0
        

        if(stripePricing === 'price_1OdG7VIW3HzLJAuwyZiBwJ6m') {
            wordCount = 15000
        } else if(stripePricing === 'price_1OdG7VIW3HzLJAuwNX7hfEL5') {
            wordCount = 40000
        }
        
        let oldPlanId = await getOldPlanId(customer)
        //Must do some sort of lookup to find out old info
        let isPlanUpdradeOrDowngradeStatus = isPlanUpgradeOrDowngrade(stripePricing, oldPlanId)
        let isAppendApplied = isAppendAppliedCheck(isPlanUpdradeOrDowngradeStatus)

        console.log('plan status: ', isPlanUpdradeOrDowngradeStatus)

        let planInfoStatus = await updateFirebasePlanInfo(isAppendApplied, wordCount, stripePricing, customer)

        if(planInfoStatus === "Success") {
            return res.status(200).send({ message: 'Plan updated Successfully'})
        } else {
            return res.status(500).send({ message: 'Payment failed'})
        }

    } else {
        return res.status(500).send({ error: 'Payment failed' });
    }
});

const getPricingFromStripe = async (invoiceId) => {
    if (invoiceId) {
        try {
            // Retrieve the invoice using the Stripe API
            const invoice = await stripe.invoices.retrieve(invoiceId);

            // Check if there are any line items in the invoice
            if (invoice.lines.data.length > 0) {
                const lineItem = invoice.lines.data[0]; // Get the first line item
                console.log(lineItem.description); // Product description
                console.log(lineItem.price.id); // Price ID

                return lineItem.price.id; // Return the price ID
            } else {
                console.log("No line items found in the invoice.");
                return 0;
            }
        } catch (error) {
            console.error("Error retrieving invoice:", error);
            return 0;
        }
    } else {
        console.log("No invoice ID provided.");
        return 0;
    }
};

const updateFirebasePlanInfo = async (isAppendApplied, wordCount, stripePricing, customer) => {
    try {
        const customerRef = await admin.firestore().collection("customers").where("stripeId", "==", customer).get();

        await Promise.all(customerRef.docs.map(async (doc) => {
            if (isAppendApplied) {
                // Retrieve the current words count and add the new wordCount to it
                const currentWords = doc.data().words || 0; // Fallback to 0 if 'words' field is not present
                await doc.ref.update({
                    words: currentWords + wordCount,
                    plan: (stripePricing ? stripePricing : 0)
                });
            } else {
                // Replace the existing words value with the new wordCount
                await doc.ref.update({
                    words: wordCount,
                    plan: (stripePricing ? stripePricing : 0)
                });
            }
        }));
        
        return "Success"
    } catch (e) {
        return "Error"
    }
};

const isPlanUpgradeOrDowngrade = (newPlanId, oldPlanId) => {
    const currentPlansInOrderOfPrice = [
        {
            planId: 'price_1OdG7VIW3HzLJAuwyZiBwJ6m',
            price: 9
        },
        {
            planId: 'price_1OdG7VIW3HzLJAuwNX7hfEL5',
            price: 19
        },
    ];

    // Check if both plan IDs are the same
    if (newPlanId === oldPlanId) {
        return "Same Plan";
    }

    let newPlanIdPosition = currentPlansInOrderOfPrice.findIndex(plan => plan.planId === newPlanId);
    let oldPlanIdPosition = currentPlansInOrderOfPrice.findIndex(plan => plan.planId === oldPlanId);

    // Check if either plan ID is not found in the list
    if (newPlanIdPosition === -1 || oldPlanIdPosition === -1) {
        throw new Error("One or both plan IDs are not found in the current plans.");
    }

    return newPlanIdPosition > oldPlanIdPosition ? 'Upgrade' : 'Downgrade';
};

const getOldPlanId = async (customer) => {
    try {
        // Query Firestore for the customer document
        const customerRef = await admin.firestore().collection("customers").where("stripeId", "==", customer).get();

        // Check if any documents are found
        if (customerRef.empty) {
            console.log("No matching customer found.");
            return null;
        }

        // Assuming there's only one document per customer
        const customerDoc = customerRef.docs[0];
        const customerData = customerDoc.data();

        // Return the plan ID
        return customerData.plan || null;
    } catch (e) {
        console.error("Error retrieving old plan ID:", e);
        return null;
    }
};

const isAppendAppliedCheck = (isPlanUpdradeOrDowngradeStatus) => {
    if(isPlanUpdradeOrDowngradeStatus === 'Upgrade') {
        return true
    } else {
        return false
    }
}


// HTTP-triggered Cloud Function to add tokens
// router.get('/addTokens', cors(), async (req, res) => {

//     const userId = req.query.userId

//     if (!userId) {
//         res.status(400).send('User ID is required');
//         return;
//     }

//     addTokens(userId)
// });

// // Callable Cloud Function to schedule token addition using Cloud Tasks
// router.post('/scheduleTokenAddition', cors(), async (req, res) => {
//     const { userId } = req.body;

//     if (!userId) {
//         throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
//     }

//     addTokens(userId)

//     const projectId = process.env.PROJECT_ID;
//     const queueName = 'token-addition-queue'; // The name of the queue you created
//     const location = 'northamerica-northeast1'; // The region where your queue is located
//     const url = `https://us-central1-trendscopeai.cloudfunctions.net/api/addTokens`;
//     const oneMonthInSeconds = 30 * 24 * 60 * 60;

//     const parent = tasksClient.queuePath(projectId, location, queueName);
//     const task = {
//         httpRequest: {
//             httpMethod: 'GET',
//             url: `${url}?userId=${userId}`,
//         },
//         scheduleTime: {
//             seconds: Math.floor(Date.now() / 1000) + oneMonthInSeconds
//         },
//     };

//     tasksClient.createTask({ parent, task })
//         .then((result) => {
//             console.log("schedule complete: ", result.data.message);
//         })
//         .catch((error) => {
//             console.error(`Error: ${error.code} - ${error.message}`);
//         });

//     console.log('success! Token addition scheduled successfully')

//     res.set({
//         'Access-Control-Allow-Origin': 'https://trendseerai.com'
//     });

//     return { message: 'Token addition scheduled successfully' };
// });

const validateTokens = async (currentUser) => {
    let validationResult;
    await admin
        .firestore()
        .collection("customers")
        .doc(currentUser.uid)
        .get()
        .then((doc) => {
            if (doc.exists) {
                if (doc.tokens <= 0) {
                    validationResult = false;
                } else {
                    validationResult = true;
                }
            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
        }).catch((error) => {
            console.log("Error getting document:", error);
            validationResult = false
        });
    return validationResult;
}

// const decrementTokenCountOnSuccess = async (currentUser) => {
//     let newTokenCount
//     try {
//         const customerDocRef = admin.firestore()
//             .collection("customers")
//             .doc(currentUser.uid);

//         const customerDoc = await customerDocRef.get();

//         if (customerDoc.exists) {
//             let tokenCount = customerDoc.data().tokens;
//             newTokenCount = tokenCount - 1
//             await customerDocRef.update({
//                 tokens: newTokenCount
//             });
//             return newTokenCount;
//         } else {
//             console.log("No such document!");
//         }
//     } catch (error) {
//         console.error("Error updating tokens: ", error);
//     }

//     return newTokenCount
// };

// const addToHistory = async (searchText, responseText, currentUser) => {
//     const currentDate = new Date();
//     await admin
//         .firestore()
//         .collection("customers")
//         .doc(currentUser.uid)
//         .collection("searches")
//         .doc()
//         .set({
//             text: responseText.content,
//             searchText: searchText,
//             created_at: currentDate
//         })
//         .then(() => {
//             console.log("New document added to Firestore");
//         })
//         .catch((error) => {
//             console.error("Error adding document to Firestore:", error);
//         });
// }


module.exports = router;

