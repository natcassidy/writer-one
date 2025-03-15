"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express")); // Changed from require
const app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors")); // Changed from require
const functions = __importStar(require("firebase-functions")); // Changed from require, Firebase Functions are often imported as a namespace
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes")); // Changed from require
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes")); // Changed from require
const bulkMiscFunctions = __importStar(require("./routes/bulkMiscFunctions"));
require("dotenv/config"); // Changed from require and adjusted for ESM
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
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use("/ai", aiRoutes_1.default);
app.use("/admin", adminRoutes_1.default);
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
//# sourceMappingURL=index.js.map