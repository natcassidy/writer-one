import express from 'express'; // Changed from require
const app = express();
import cors from 'cors'; // Changed from require
import * as functions from 'firebase-functions'; // Changed from require, Firebase Functions are often imported as a namespace
import * as aiRoutes from './routes/aiRoutes.ts'; // Changed from require
import * as adminRoutes from './routes/adminRoutes.ts'; // Changed from require
import 'dotenv/config'; // Changed from require and adjusted for ESM

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
