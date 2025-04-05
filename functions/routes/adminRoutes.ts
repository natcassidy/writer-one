import express, { Request, Response, Router } from "express";
// Import specific Firestore types needed
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import Stripe from "stripe";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const router: Router = express.Router();

const stripeKey = process.env.STRIPE_KEY as string;
const stripe = new Stripe(stripeKey);

router.get("/health", (req: Request, res: Response) => {
  res.status(200).send("I'm alive admin");
});

// Explicitly type the async handler's return as Promise<void> or Promise<Response>
// Promise<void> is often safer if you aren't intentionally returning the 'res' object itself.
router.post("/webhooks", async (req: Request, res: Response): Promise<void> => {
  try { // Wrap main logic in try/catch for async errors
    const paymentIntent = req.body.data.object.id;
    const customer = req.body.data.object.customer;

    console.log("Payment intent : ", paymentIntent);
    const payment: Stripe.PaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);

    if (payment.status === "succeeded") {
      console.log("payment status succeeded");

      const invoiceId: any = payment.invoice;
      let stripePricing: string | number = await getPricingFromStripe(invoiceId);
      let articleCount: number = 0;

      console.log(stripePricing);

      if (stripePricing === process.env.PRICE_10_PRICE) {
        articleCount = 10;
      } else if (stripePricing === process.env.PRICE_30_PRICE) {
        articleCount = 30;
      } else if (stripePricing === process.env.PRICE_100_PRICE) {
        articleCount = 100;
      } else if (stripePricing === process.env.PRICE_300_PRICE) {
        articleCount = 300;
      }

      let oldPlanId: string | null = await getOldPlanId(customer);
      let isPlanUpdradeOrDowngradeStatus = isPlanUpgradeOrDowngrade(
          stripePricing,
          oldPlanId
      );
      let isAppendApplied: boolean = isAppendAppliedCheck(
          isPlanUpdradeOrDowngradeStatus
      );

      if (
          isPlanUpdradeOrDowngradeStatus === "Upgrade" ||
          isPlanUpdradeOrDowngradeStatus === "Downgrade"
      ) {
        let subscription: Stripe.ApiList<Stripe.Subscription> = await getSubscriptionData(customer);
        let cancelResponse: number = await cancelSubscription(subscription, oldPlanId);
      }

      console.log("plan status: ", isPlanUpdradeOrDowngradeStatus);

      let planInfoStatus: "Success" | "Error" = await updateFirebasePlanInfo(
          isAppendApplied,
          articleCount,
          stripePricing,
          customer
      );

      if (planInfoStatus === "Success") {
        // No return needed here for Promise<void>
        res.status(200).send({ message: "Plan updated Successfully" });
        return; // Explicit return void
      } else {
        // No return needed here for Promise<void>
        res.status(500).send({ message: "Payment failed" });
        return; // Explicit return void
      }
    } else {
      // No return needed here for Promise<void>
      res.status(500).send({ error: "Payment failed" });
      return; // Explicit return void
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    // Ensure response is sent even on unexpected errors
    if (!res.headersSent) {
      res.status(500).send({ error: "Internal server error" });
    }
    // No explicit return needed, as function returns Promise<void>
  }
});


const getPricingFromStripe = async (invoiceId: any): Promise<string | number> => {
  if (invoiceId) {
    try {
      const invoice: Stripe.Invoice = await stripe.invoices.retrieve(invoiceId);

      if (invoice.lines.data.length > 0) {
        const lineItem = invoice.lines.data[0];
        console.log(lineItem.description);
        console.log(lineItem.price?.id);
        return lineItem.price?.id ?? 0;
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
    isAppendApplied: boolean,
    articleCount: number,
    stripePricing: string | number,
    customer: string
): Promise<"Success" | "Error"> => {
  try {
    const customerRef = await admin
        .firestore()
        .collection("customers")
        .where("stripeId", "==", customer)
        .get();

    await Promise.all(
        // Explicitly type 'doc' here
        customerRef.docs.map(async (doc: QueryDocumentSnapshot) => {
          if (isAppendApplied) {
            const currentArticles = doc.data().articles || 0;
            await doc.ref.update({
              articles: currentArticles + articleCount,
              plan: stripePricing ? stripePricing : 0,
            });
          } else {
            await doc.ref.update({
              articles: articleCount,
              plan: stripePricing ? stripePricing : 0,
            });
          }
        })
    );

    return "Success";
  } catch (e) {
    console.error("Error updating Firebase:", e);
    return "Error";
  }
};

const isPlanUpgradeOrDowngrade = (newPlanId: string | number | null, oldPlanId: string | null): string => {
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

  if (newPlanId === oldPlanId || oldPlanId == null) {
    return "Same Plan";
  }

  let newPlanIdPosition = currentPlansInOrderOfPrice.findIndex(
      (plan) => plan.planId === newPlanId
  );
  let oldPlanIdPosition = currentPlansInOrderOfPrice.findIndex(
      (plan) => plan.planId === oldPlanId
  );

  if (newPlanIdPosition === -1 || oldPlanIdPosition === -1) {
    throw new Error("One or both plan IDs are not found in the current plans.");
  }

  return newPlanIdPosition > oldPlanIdPosition ? "Upgrade" : "Downgrade";
};

const getOldPlanId = async (customer: string): Promise<string | null> => {
  try {
    const customerRef = await admin
        .firestore()
        .collection("customers")
        .where("stripeId", "==", customer)
        .get();

    if (customerRef.empty) {
      console.log("No matching customer found.");
      return null;
    }

    const customerDoc = customerRef.docs[0];
    const customerData = customerDoc.data();

    return typeof customerData.plan === 'string' ? customerData.plan : null;
  } catch (e) {
    console.error("Error retrieving old plan ID:", e);
    return null;
  }
};

const isAppendAppliedCheck = (isPlanUpdradeOrDowngradeStatus: string): boolean => {
  if (
      isPlanUpdradeOrDowngradeStatus === "Upgrade" ||
      isPlanUpdradeOrDowngradeStatus === "Downgrade"
  ) {
    return true;
  } else {
    return false;
  }
};

const getSubscriptionData = async (customerId: string): Promise<Stripe.ApiList<Stripe.Subscription>> => {
  let sub: Stripe.ApiList<Stripe.Subscription> = await stripe.subscriptions.list({
    customer: customerId,
  });
  return sub;
};

const cancelSubscription = async (subscriptions: Stripe.ApiList<Stripe.Subscription>, oldPlanId: string | null): Promise<number> => {
  const subscriptionIdToUpgrade: string | null = findOldSubscriptionId(
      subscriptions,
      oldPlanId
  );

  if (!subscriptionIdToUpgrade) {
    console.error("Could not find subscription to cancel for plan:", oldPlanId);
    return 0;
  }

  const subscription: Stripe.Subscription = await stripe.subscriptions.cancel(
      subscriptionIdToUpgrade
  );

  return 1;
};

const findOldSubscriptionId = (subscriptions: Stripe.ApiList<Stripe.Subscription>, oldPlanId: string | null): string | null => {
  let subscriptionIdToUpgrade: string | null = null;

  for (const subscription of subscriptions.data) {
    for (const item of subscription.items.data) {
      if (item.price?.id === oldPlanId) {
        subscriptionIdToUpgrade = subscription.id;
        break;
      }
    }
    if (subscriptionIdToUpgrade) break;
  }

  return subscriptionIdToUpgrade;
};

export default router;