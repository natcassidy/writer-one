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
const miscModule = __importStar(require("../miscFunctions"));
const process_1 = require("../process");
const geminiModule = __importStar(require("../gemini"));
const firebaseModule = __importStar(require("../firebaseFunctions"));
const firebaseModuleIP = __importStar(require("../firebaseFunctionsNotSignedIn"));
jest.mock("../miscFunctions", () => {
    const original = jest.requireActual("../miscFunctions");
    return {
        __esModule: true,
        ...original,
        doesUserHaveEnoughArticles: jest.fn(),
        doSerpResearch: jest.fn(),
        generateOutline: jest.fn(),
        generateArticle: jest.fn(),
    };
});
jest.mock("../gemini", () => ({
    generateFinetune: jest.fn(),
}));
jest.mock("../firebaseFunctions", () => ({
    decrementUserArticleCount: jest.fn(),
    updateFirebaseJob: jest.fn(),
}));
jest.mock("../firebaseFunctionsNotSignedIn", () => ({
    updateFirebaseJobByIp: jest.fn(),
}));
test('Call process article', () => {
    let section = [{
            id: "",
            tagName: "",
            content: "",
            notes: "string"
        }];
    let finetune = {
        textInputs: [{
                body: ""
            }]
    };
    let data = {
        keyWord: "test",
        sectionCount: 2,
        tone: "",
        pointOfView: "",
        citeSources: false,
        outline: section,
        currentUser: "test",
        jobId: -1,
        finetuneChosen: finetune,
        internalUrls: "",
        clientIp: ""
    };
    const mockedDoesUserHaveEnoughArticles = miscModule.doesUserHaveEnoughArticles;
    const mockDoSerpResearch = miscModule.doSerpResearch;
    const mockGenerateOutline = miscModule.generateOutline;
    const mockGenerateArticle = miscModule.generateArticle;
    const mockGenerateFinetune = geminiModule.generateFinetune;
    const mockUpdateFirebaseJobByIp = firebaseModuleIP.updateFirebaseJobByIp;
    const mockDecrment = firebaseModule.decrementUserArticleCount;
    const mockJobUpdate = firebaseModule.updateFirebaseJob;
    const testList = [
        {
            tagName: "",
            content: "",
            notes: "",
            id: ""
        }
    ];
    console.log("mockedDoesUserHaveEnoughArticles:", mockedDoesUserHaveEnoughArticles);
    mockedDoesUserHaveEnoughArticles.mockReturnValue(Promise.resolve(true));
    mockDoSerpResearch.mockReturnValue(Promise.resolve(""));
    mockGenerateOutline.mockReturnValue(Promise.resolve(testList));
    mockGenerateArticle.mockReturnValue(Promise.resolve(""));
    mockGenerateFinetune.mockReturnValue(Promise.resolve(""));
    mockUpdateFirebaseJobByIp.mockReturnValue(Promise.resolve(true));
    mockDecrment.mockReturnValue(Promise.resolve(1));
    mockJobUpdate.mockReturnValue(Promise.resolve(""));
    // miscModule.doesUserHaveEnoughArticles  <---- this method doesn't exist on the object'
    let processArticle1 = (0, process_1.processArticle)(false, data);
    expect(processArticle1).toBeDefined();
});
test('Call process article with mocks lower level mocks', () => {
    let section = [{
            id: "",
            tagName: "",
            content: "",
            notes: "string"
        }];
    let finetune = {
        textInputs: [{
                body: ""
            }]
    };
    let data = {
        keyWord: "test",
        sectionCount: 2,
        tone: "",
        pointOfView: "",
        citeSources: false,
        outline: section,
        currentUser: "test",
        jobId: -1,
        finetuneChosen: finetune,
        internalUrls: "",
        clientIp: ""
    };
    const mockedDoesUserHaveEnoughArticles = miscModule.doesUserHaveEnoughArticles;
    const mockDoSerpResearch = miscModule.doSerpResearch;
    const testList = [
        {
            tagName: "",
            content: "",
            notes: "",
            id: ""
        }
    ];
    console.log("mockedDoesUserHaveEnoughArticles:", mockedDoesUserHaveEnoughArticles);
    mockedDoesUserHaveEnoughArticles.mockReturnValue(Promise.resolve(true));
    mockDoSerpResearch.mockReturnValue(Promise.resolve(""));
    // miscModule.doesUserHaveEnoughArticles  <---- this method doesn't exist on the object'
    let processArticle1 = (0, process_1.processArticle)(false, data);
    expect(processArticle1).toBeDefined();
});
//# sourceMappingURL=process.test.js.map