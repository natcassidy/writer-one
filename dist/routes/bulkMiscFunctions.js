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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processNextItem = void 0;
const firebaseFunctions = __importStar(require("./firebaseFunctions"));
const misc = __importStar(require("./miscFunctions"));
const amazon = __importStar(require("./amazonScraperFunctions"));
const gemini_1 = require("./gemini");
const processBlogArticleFromBulk = async (keyWord, internalUrls, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources) => {
    const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(currentUser);
    if (!isWithinArticleCount) {
        throw new Error("Article Count Limit Hit");
    }
    if (sectionCount > 6) {
        throw new Error("Error Generating Article");
    }
    let jobId = "";
    let context = "";
    if (!jobId) {
        jobId = "-1";
    }
    const articleType = "blog";
    let finetune;
    if (finetuneChosen.textInputs &&
        finetuneChosen.textInputs.length != 0 &&
        finetuneChosen.textInputs[0].body != "") {
        try {
            finetune = (0, gemini_1.generateFineTuneService)(finetuneChosen.textInputs);
        }
        catch (error) {
            console.log("Error generating finetune ", error);
        }
    }
    context = await misc.doSerpResearch(keyWord, "");
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType);
    const outlineFlat = await misc.generateOutline(keyWord, sectionCount, context);
    const outline = misc.htmlListToJson(outlineFlat);
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType);
    console.log("outline: \n", outline);
    console.log("generating article");
    let article;
    try {
        article = await misc.generateArticle(outline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls);
    }
    catch (e) {
        throw new Error(e);
    }
    const updatedArticleCount = await firebaseFunctions.decrementUserArticleCount(currentUser);
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "article", article, "blog");
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "title", keyWord, "blog");
    //Outline will now contain each section filled in with data
    return article;
};
const processAmazonArticleFromBulk = async (keyWord, internalUrl, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources, itemId, isAmazonArticle, amazonUrl, affiliate, numberOfProducts) => {
    const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(currentUser);
    if (!isWithinArticleCount) {
        throw new Error("Article Count Limit Hit");
    }
    let jobId;
    let context;
    if (!jobId) {
        jobId = "-1";
    }
    const articleType = "amazon";
    let finetune;
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
    context = await amazon.performSearch(keyWord, amazonUrl, numberOfProducts, affiliate);
    // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
    const outline = await amazon.generateOutlineAmazon(keyWord, context);
    // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    console.log("outline generated");
    console.log("generating article");
    let finishedArticle = "";
    try {
        finishedArticle = await amazon.generateAmazonArticle(outline, keyWord, context, tone, pointOfView, finetune);
    }
    catch (e) {
        throw new Error(e);
    }
    const updatedArticleCount = await firebaseFunctions.decrementUserArticleCount(currentUser);
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "article", finishedArticle, articleType);
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "title", keyWord, articleType);
    return finishedArticle;
};
const processNextItem = async () => {
    let itemIdProcess;
    try {
        const { keyWord, internalUrls, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources, itemId, isAmazonArticle, amazonUrl, affiliate, numberOfProducts, } = (await firebaseFunctions.getNextItemFirebase());
        firebaseFunctions.markItemInProgress(itemId);
        itemIdProcess = itemId;
        if (isAmazonArticle) {
            const article = await processAmazonArticleFromBulk(keyWord, internalUrls, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources, itemId, isAmazonArticle, amazonUrl, affiliate, numberOfProducts);
        }
        else {
            const article = await processBlogArticleFromBulk(keyWord, internalUrls, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, sectionCount, citeSources);
        }
        await firebaseFunctions.markItemCompleted(itemId);
    }
    catch (e) {
        console.log("Error processing bulk Article: ", e);
        await firebaseFunctions.markItemInError(itemIdProcess);
        throw new Error(e);
    }
};
exports.processNextItem = processNextItem;
//# sourceMappingURL=bulkMiscFunctions.js.map