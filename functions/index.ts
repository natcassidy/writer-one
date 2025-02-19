import express from 'express'; // Changed from require
const app = express();
import cors from 'cors'; // Changed from require
import * as functions from 'firebase-functions'; // Changed from require, Firebase Functions are often imported as a namespace
import aiRoutes from './routes/aiRoutes'; // Changed from require
import adminRoutes from './routes/adminRoutes'; // Changed from require
import * as bulkMiscFunctions from './routes/bulkMiscFunctions';
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
app.set("trust proxy", true);

exports.plugin = functions
  .runWith({ timeoutSeconds: 360, memory: "1GB" })
  .https.onRequest(app);
exports.processQueue = functions
  .runWith({ timeoutSeconds: 360 })
  .pubsub.schedule("every 1 minutes")
  .onRun(async (context) => {
    await bulkMiscFunctions.processNextItem();
    return null;
  });
