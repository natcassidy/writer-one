const express = require("express");
const app = express();
const cors = require("cors");
const functions = require("firebase-functions");
const aiRoutes = require("./routes/aiRoutes");
const gptRoutes = require("./routes/gptRoutes");
const adminRoutes = require("./routes/adminRoutes");
require("dotenv").config();
const bulMiscFunctions = require("./routes/bulkMiscFunctions");
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

const corsOptions = {
  origin: [
    "https://chat.openai.com",
    "http://localhost:3000",
    "https://writer-one-frontend.vercel.app",
    "https://writer-one-frontend.vercel.app/",
    "https://www.writer-one.com",
    "https://www.writer-one.com/",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use("/ai", aiRoutes);
app.use("/gpt", gptRoutes);
app.use("/admin", adminRoutes);
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.use(Sentry.Handlers.errorHandler());
app.set("trust proxy", true);

exports.plugin = functions
  .runWith({ timeoutSeconds: 360, memory: "1GB" })
  .https.onRequest(app);
exports.processQueue = functions
  .runWith({ timeoutSeconds: 360 })
  .pubsub.schedule("every 1 minutes")
  .onRun(async (context) => {
    await bulMiscFunctions.processNextItem();
    return null;
  });
