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

        try {
            const customerRef = await admin.firestore().collection("customers").where("stripeId", "==", customer).get()
            customerRef.forEach((doc) => {
                doc.ref.update({
                    words: 15000
                })
            })
            return res.status(200).send({ message: 'Token count updated' });
        } catch (e) {
            return res.status(400).send({ error: 'Payment failed' });
        }

    } else {
        return res.status(400).send({ error: 'Payment failed' });
    }
});

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

