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
exports.processFreeTrial = exports.processArticle = void 0;
const misc = __importStar(require("./miscFunctions"));
const gemini = __importStar(require("./gemini"));
const firebaseFunctions = __importStar(require("./firebaseFunctions"));
const firebaseFunctionsNotSignedIn_1 = require("./firebaseFunctionsNotSignedIn");
const firebaseFunctions_1 = require("./firebaseFunctions");
const miscFunctions_1 = require("./miscFunctions");
function generateFinetune(finetuneParams) {
    if (finetuneParams.textInputs &&
        finetuneParams.textInputs.length != 0 &&
        finetuneParams.textInputs[0].body != "") {
        let finetune;
        try {
            finetune = gemini.generateFineTuneService(finetuneParams.textInputs);
        }
        catch (error) {
            console.log("Error generating finetune ", error);
        }
        return finetune;
    }
    else {
        return Promise.resolve("");
    }
}
const processFreeTrial = (data) => {
    data.currentUser = data.clientIp;
    let hasFreeArticle = true;
    if (!hasFreeArticle) {
        throw Error("No Free Article Remaining!");
    }
    if (data.sectionCount > 2) {
        throw Error("Error Generating Article");
    }
    return processArticle(true, data);
};
exports.processFreeTrial = processFreeTrial;
const processArticle = async (isFreeTrial, data) => {
    console.log("processing article now");
    let { keyWord, sectionCount, tone, pointOfView, citeSources, outline, currentUser, jobId = -1, finetuneChosen, internalUrls, } = data;
    let context = "", finetune, article = "";
    const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(currentUser);
    if (!isWithinArticleCount) {
        throw new Error("Article Count Limit Hit");
    }
    else if (sectionCount > 6) {
        throw new Error("Error Generating Article");
    }
    finetune = generateFinetune(finetuneChosen);
    context = await misc.doSerpResearch(keyWord, "");
    if (outline.length == 0) {
        try {
            outline = await misc.generateOutline(keyWord, sectionCount, context);
        }
        catch (e) {
            throw new Error(e);
        }
    }
    let modifiedOutline = (0, miscFunctions_1.htmlListToJson)(outline);
    try {
        article = await misc.generateArticle(modifiedOutline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls);
    }
    catch (error) {
        throw new Error(error);
    }
    const updatedArticleCount = await firebaseFunctions.decrementUserArticleCount(currentUser);
    if (isFreeTrial) {
        await (0, firebaseFunctionsNotSignedIn_1.updateFirebaseJobByIp)(currentUser, jobId, "context", context, "blog");
        await (0, firebaseFunctionsNotSignedIn_1.updateFirebaseJobByIp)(currentUser, jobId, "outline", modifiedOutline, "blog");
        await (0, firebaseFunctionsNotSignedIn_1.updateFirebaseJobByIp)(currentUser, jobId, "article", article, "blog");
        await (0, firebaseFunctionsNotSignedIn_1.updateFirebaseJobByIp)(currentUser, jobId, "title", keyWord, "blog");
    }
    else {
        await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "context", context, "blog");
        await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "outline", modifiedOutline, "blog");
        await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "article", article, "blog");
        await (0, firebaseFunctions_1.updateFirebaseJob)(currentUser, jobId, "title", keyWord, "blog");
    }
    return { article, updatedArticleCount, title: keyWord, id: jobId };
};
exports.processArticle = processArticle;
//# sourceMappingURL=process.js.map