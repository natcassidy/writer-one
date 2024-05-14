const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
require("dotenv").config();
const stripe = Stripe(process.env.STRIPE_KEY);
const admin = require("firebase-admin");

router.get("/health", (req, res) => {
  res.status(200).send("I'm alive admin");
});

router.post("/webhooks", async (req, res) => {
  const paymentIntent = req.body.data.object.id;
  const customer = req.body.data.object.customer;

  // Confirm the payment status using the Stripe API
  const payment = await stripe.paymentIntents.retrieve(paymentIntent);

  if (payment.status === "succeeded") {
    console.log("payment status succeeded");

    const invoiceId = payment.invoice;
    let stripePricing = await getPricingFromStripe(invoiceId);
    let articleCount = 0;

    if (stripePricing === process.env.PRICE_10_PRICE) {
      articleCount = 10;
    } else if (stripePricing === process.env.PRICE_30_PRICE) {
      articleCount = 30;
    } else if (stripePricing === process.env.PRICE_100_PRICE) {
      articleCount = 100;
    } else if (stripePricing === process.env.PRICE_300_PRICE) {
      articleCount = 300;
    }

    let oldPlanId = await getOldPlanId(customer);
    //Must do some sort of lookup to find out old info
    let isPlanUpdradeOrDowngradeStatus = isPlanUpgradeOrDowngrade(
      stripePricing,
      oldPlanId
    );
    let isAppendApplied = isAppendAppliedCheck(isPlanUpdradeOrDowngradeStatus);

    if (
      isPlanUpdradeOrDowngradeStatus === "Upgrade" ||
      isPlanUpdradeOrDowngradeStatus === "Downgrade"
    ) {
      let subscription = await getSubscriptionData(customer);
      cancelResponse = await cancelSubscription(subscription, oldPlanId);
    }

    console.log("plan status: ", isPlanUpdradeOrDowngradeStatus);

    let planInfoStatus = await updateFirebasePlanInfo(
      isAppendApplied,
      articleCount,
      stripePricing,
      customer
    );

    if (planInfoStatus === "Success") {
      return res.status(200).send({ message: "Plan updated Successfully" });
    } else {
      return res.status(500).send({ message: "Payment failed" });
    }
  } else {
    return res.status(500).send({ error: "Payment failed" });
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

const updateFirebasePlanInfo = async (
  isAppendApplied,
  articleCount,
  stripePricing,
  customer
) => {
  try {
    const customerRef = await admin
      .firestore()
      .collection("customers")
      .where("stripeId", "==", customer)
      .get();

    await Promise.all(
      customerRef.docs.map(async (doc) => {
        if (isAppendApplied) {
          // Retrieve the current words count and add the new wordCount to it
          const currentArticles = doc.data().articles || 0; // Fallback to 0 if 'words' field is not present
          await doc.ref.update({
            articles: currentArticles + articleCount,
            plan: stripePricing ? stripePricing : 0,
          });
        } else {
          // Replace the existing words value with the new wordCount
          await doc.ref.update({
            articles: articleCount,
            plan: stripePricing ? stripePricing : 0,
          });
        }
      })
    );

    return "Success";
  } catch (e) {
    return "Error";
  }
};

const isPlanUpgradeOrDowngrade = (newPlanId, oldPlanId) => {
  const currentPlansInOrderOfPrice = [
    {
      planId: process.env.PRICE_10_PRICE,
      price: 19,
    },
    {
      planId: process.env.PRICE_30_PRICE,
      price: 49,
    },
    {
      planId: process.env.PRICE_100_PRICE,
      price: 159,
    },
    {
      planId: process.env.PRICE_300_PRICE,
      price: 469,
    },
  ];

  // Check if both plan IDs are the same
  if (newPlanId === oldPlanId || oldPlanId == null) {
    return "Same Plan";
  }

  let newPlanIdPosition = currentPlansInOrderOfPrice.findIndex(
    (plan) => plan.planId === newPlanId
  );
  let oldPlanIdPosition = currentPlansInOrderOfPrice.findIndex(
    (plan) => plan.planId === oldPlanId
  );

  // Check if either plan ID is not found in the list
  if (newPlanIdPosition === -1 || oldPlanIdPosition === -1) {
    throw new Error("One or both plan IDs are not found in the current plans.");
  }

  return newPlanIdPosition > oldPlanIdPosition ? "Upgrade" : "Downgrade";
};

const getOldPlanId = async (customer) => {
  try {
    // Query Firestore for the customer document
    const customerRef = await admin
      .firestore()
      .collection("customers")
      .where("stripeId", "==", customer)
      .get();

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
  if (
    isPlanUpdradeOrDowngradeStatus === "Upgrade" ||
    isPlanUpdradeOrDowngradeStatus === "Downgrade"
  ) {
    return true;
  } else {
    return false;
  }
};

const getSubscriptionData = async (customerId) => {
  let sub = await stripe.subscriptions.list({
    customer: customerId,
  });

  return sub;
};

const cancelSubscription = async (subscriptions, oldPlanId) => {
  const subscriptionIdToUpgrade = findOldSubscriptionId(
    subscriptions,
    oldPlanId
  );

  const subscription = await stripe.subscriptions.cancel(
    subscriptionIdToUpgrade
  );

  return 1;
};

const findOldSubscriptionId = (subscriptions, oldPlanId) => {
  //find the subscription with the oldPrice to cancel
  let subscriptionIdToUpgrade = null;

  // Loop through each subscription
  for (const subscription of subscriptions.data) {
    // Loop through each item in the subscription
    for (const item of subscription.items.data) {
      // Check if the item's price matches the oldPlanId
      if (item.price.id === oldPlanId) {
        // If match is found, store the subscription ID and break the loop
        subscriptionIdToUpgrade = subscription.id;
        break;
      }
    }
    // Break the outer loop if we have found the subscription ID
    if (subscriptionIdToUpgrade) break;
  }

  return subscriptionIdToUpgrade;
};

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
    })
    .catch((error) => {
      console.log("Error getting document:", error);
      validationResult = false;
    });
  return validationResult;
};

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
