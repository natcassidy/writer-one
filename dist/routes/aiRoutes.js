"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
require("dotenv/config");
const miscFunctions_1 = require("./miscFunctions");
const firebaseFunctions_1 = require("./firebaseFunctions");
const bulkMiscFunctions_1 = require("./bulkMiscFunctions");
const gemini_1 = require("./gemini");
const amazonScraperFunctions_1 = require("./amazonScraperFunctions");
const process_1 = require("./process");
const firebaseFunctionsNotSignedIn_1 = require("./firebaseFunctionsNotSignedIn"); // Changed from require and adjusted for ESM, assuming dotenv version 16+
router.post("/process", async (req, res) => {
    console.log("Route handler /process hit");
    try {
        const { article, updatedArticleCount, title, id } = // Use const for variables that aren't reassigned
         await (0, process_1.processArticle)(false, req.body);
        res.status(200).send({ article, updatedArticleCount, title, id }); // No return here
    }
    catch (e) {
        res.status(500).send("Error generating article: " + e); // No return here
    }
});
router.post("/processFreeTrial", extractIpMiddleware, async (req, res) => {
    try {
        const { article, updatedArticleCount, title, id } = await (0, process_1.processFreeTrial)(req.body);
        res.status(200).send({ article, title, id: id, updatedArticleCount });
    }
    catch (e) {
        res.status(500).send("Error generating article: " + e);
    }
});
router.post("/processBulk", async (req, res) => {
    let { keyWord, internalUrls, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources, isAmazonArticle, amazonUrl, affiliate, numberOfProducts, includeIntroduction, includeConclusion, } = req.body;
    console.log("Processing bulk blog, adding to queue");
    const keyWordList = (0, miscFunctions_1.parseKeyWords)(keyWord);
    if (sectionCount > 6) {
        res.status(500).send("Error Generating Article");
    }
    console.log("List: ", keyWordList);
    try {
        keyWordList.forEach((keyWord) => {
            (0, firebaseFunctions_1.addToQueue)(keyWord, internalUrls, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources, isAmazonArticle, amazonUrl, affiliate, numberOfProducts, includeIntroduction, includeConclusion);
        });
    }
    catch (e) {
        console.log("Error adding to queue: ", e);
        res.status(500).send({ error: e });
    }
    console.log("Processing bulk blog, finished adding to queue");
    res.status(200).send({ success: keyWordList });
});
router.post("/manuallyTriggerBulkQueue", async (req, res) => {
    console.log("Entering manuallyTriggerBulkQueue");
    try {
        await (0, bulkMiscFunctions_1.processNextItem)();
    }
    catch (e) {
        console.log("Error logged at top: ", e);
        res.status(500).send({ error: e });
    }
    console.log("Leaving manuallyTriggerBulkQueue");
    res.status(200).send("success");
});
router.post("/processAmazon", async (req, res) => {
    let { keyWord, tone, numberOfProducts, pointOfView, outline, currentUser, jobId, amazonUrl, affiliate, finetuneChosen, } = req.body;
    const isWithinArticleCount = await (0, miscFunctions_1.doesUserHaveEnoughArticles)(currentUser);
    if (!isWithinArticleCount) {
        res.status(500).send("Word Count Limit Hit");
    }
    let context;
    if (!jobId) {
        jobId = -1;
    }
    const articleType = "amazon";
    let finetune = "";
    if (finetuneChosen.textInputs &&
        finetuneChosen.textInputs.length != 0 &&
        finetuneChosen.textInputs[0].body != "" &&
        finetuneChosen.textInputs[0].body != "") {
        try {
            finetune = await (0, gemini_1.generateFineTuneService)(finetuneChosen.textInputs);
        }
        catch (error) {
            console.log("Error generating finetune ", error);
        }
    }
    context = await (0, amazonScraperFunctions_1.performSearch)(keyWord, amazonUrl, numberOfProducts, affiliate);
    outline = await (0, amazonScraperFunctions_1.generateOutlineAmazon)(keyWord, context);
    let finishedArticle = "";
    try {
        finishedArticle = await (0, amazonScraperFunctions_1.generateAmazonArticle)(outline, keyWord, context, tone, pointOfView, finetune);
    }
    catch (e) {
        console.log("Error: ", e);
        res.status(500).send({ error: e });
    }
    const updatedArticleCount = await (0, firebaseFunctions_1.decrementUserArticleCount)(currentUser);
    try {
        jobId = await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "article", finishedArticle, articleType);
    }
    catch (error) {
        res.status(500).send("Error generating article: " + error);
    }
    try {
        jobId = await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "title", keyWord, articleType);
    }
    catch (error) {
        res.status(500).send("Error generating article: " + error);
    }
    res.status(200).send({
        article: finishedArticle,
        updatedArticleCount,
        title: keyWord,
        id: jobId,
    });
});
router.post("/processAmazonFreeTrial", async (req, res) => {
    let { keyWord, tone, numberOfProducts, pointOfView, outline, jobId, amazonUrl, affiliate, finetuneChosen, } = req.body;
    let clientIp = req.clientIp;
    let context;
    if (!jobId) {
        jobId = -1;
    }
    let hasFreeArticle = false;
    try {
        hasFreeArticle = await (0, firebaseFunctions_1.validateIpHasFreeArticle)(clientIp);
    }
    catch (e) {
        res.status(500).send("Error retrieving data");
    }
    if (!hasFreeArticle) {
        res.status(500).send("No Free Article Remaining!");
    }
    const articleType = "amazon";
    let finetune = "";
    if (finetuneChosen.textInputs &&
        finetuneChosen.textInputs.length != 0 &&
        finetuneChosen.textInputs[0].body != "" &&
        finetuneChosen.textInputs[0].body != "") {
        try {
            finetune = await (0, gemini_1.generateFineTuneService)(finetuneChosen.textInputs);
        }
        catch (error) {
            console.log("Error generating finetune ", error);
        }
    }
    context = await (0, amazonScraperFunctions_1.performSearch)(keyWord, amazonUrl, numberOfProducts, affiliate);
    outline = await (0, amazonScraperFunctions_1.generateOutlineAmazon)(keyWord, context);
    let finishedArticle = "";
    try {
        finishedArticle = await (0, amazonScraperFunctions_1.generateAmazonArticle)(outline, keyWord, context, tone, pointOfView, finetune);
    }
    catch (e) {
        res.status(500).send("Error generating article: " + e);
    }
    try {
        jobId = await (0, firebaseFunctions_1.updateFirebaseJob)(clientIp, jobId, "article", finishedArticle, articleType);
    }
    catch (error) {
        res.status(500).send("Error generating article: " + error);
    }
    try {
        jobId = await (0, firebaseFunctionsNotSignedIn_1.updateFirebaseJobByIp)(clientIp, jobId, "title", keyWord, articleType);
    }
    catch (error) {
        res.status(500).send("Error generating article: " + error);
    }
    await (0, firebaseFunctions_1.updateIpFreeArticle)(clientIp);
    res.status(200).send({ article: finishedArticle, title: keyWord, id: jobId });
});
router.post("/outline", async (req, res) => {
    let { keyWord, sectionCount, currentUser } = req.body;
    let context = "";
    let jobId = "-1";
    const articleType = "blog";
    try {
        context = await (0, miscFunctions_1.doSerpResearch)(keyWord, "");
        if (currentUser) {
            jobId = await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "context", context, articleType);
        }
        const responseMessage = await (0, gemini_1.generateOutline)(keyWord, sectionCount, context);
        if (currentUser) {
            jobId = await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "outline", responseMessage, articleType);
        }
        res.status(200).send({ responseMessage, jobId });
    }
    catch (error) {
        console.error("Error:", error);
        res.status(500).send(error.message || "An error occurred");
    }
});
router.post("/addArticleToNewUser", async (req, res) => {
    let { user } = req.body;
    await (0, firebaseFunctions_1.addArticleFieldToUserDocument)(user);
    res.status(200).send("Success");
});
router.put("/saveArticle", async (req, res) => {
    let { user, id, article } = req.body;
    console.log("Saving article");
    try {
        await (0, firebaseFunctions_1.updateFirebaseJob)(user, id, "article", article, "blog");
    }
    catch (error) {
        res.status(500).send("Error saving article");
    }
    res.status(200).send("Success");
});
router.get("/testIP", extractIpMiddleware, (req, res) => {
    res.status(200).send(req.clientIp);
});
router.get("/isFreeArticleAvailable", extractIpMiddleware, async (req, res) => {
    let ipAddress = req.clientIp;
    let isFreeArticleAvailable;
    try {
        isFreeArticleAvailable = await (0, firebaseFunctions_1.validateIpHasFreeArticle)(ipAddress);
    }
    catch (e) {
        res.status(500).send("Error retrieving data");
    }
    res.status(200).send({ isFreeArticleAvailable: true });
});
router.post("/processRewrite", async (req, res) => {
    const targetSection = req.body.text;
    const instructions = req.body.modelInstructions;
    try {
        const response = await (0, gemini_1.processRewrite)(targetSection, instructions);
        console.log("Response: \n", response);
        res.status(200).send({ rewrittenText: response });
    }
    catch (e) {
        res.status(500).send("Error rewriting article");
    }
});
function extractIpMiddleware(req, res, next) {
    req.clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    next();
}
exports.default = router;
//# sourceMappingURL=aiRoutes.js.map