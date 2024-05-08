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

Sentry.init({
  dsn: "https://9f7a30c7c86d183a065533c692431141@o4507031402840064.ingest.us.sentry.io/4507031404806144",
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

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
  .runWith({ timeoutSeconds: 360 })
  .https.onRequest(app);
exports.processQueue = functions
  .runWith({ timeoutSeconds: 360 })
  .pubsub.schedule("every 1 minutes")
  .onRun(async (context) => {
    await bulMiscFunctions.processNextItem();
    return null;
  });
