import * as miscModule  from "../miscFunctions";
import {FinetuneParam, processArticle, processFreeTrial} from "../process";
import * as geminiModule from "../gemini";
import * as firebaseModule from "../firebaseFunctions"
import * as firebaseModuleIP from "../firebaseFunctionsNotSignedIn";
import {OutlineUnstructured} from "../miscFunctions";

jest.mock("../miscFunctions", () => {
    const original = jest.requireActual("../miscFunctions")

    return {
        __esModule: true,
        ...original,
        doesUserHaveEnoughArticles: jest.fn(),
        doSerpResearch: jest.fn(),
        // generateOutline: jest.fn(),
        // generateArticle: jest.fn(),
    }
});

jest.mock("../gemini", () => ({
    generateFinetune: jest.fn(),
    generateOutline: jest.fn(),
}));

jest.mock("../firebaseFunctions", () => ({
    decrementUserArticleCount: jest.fn(),
    updateFirebaseJob:jest.fn(),
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
    }]

    let finetune: FinetuneParam = {
        textInputs: [{
            body: ""
        }]
    }

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
    }

    const mockedDoesUserHaveEnoughArticles = miscModule.doesUserHaveEnoughArticles as jest.MockedFunction<typeof miscModule.doesUserHaveEnoughArticles>;
    const mockDoSerpResearch = miscModule.doSerpResearch as jest.MockedFunction<typeof miscModule.doSerpResearch>;
    const mockGenerateOutline = miscModule.generateOutline as jest.MockedFunction<typeof miscModule.generateOutline>;
    const mockGenerateArticle = miscModule.generateArticle as jest.MockedFunction<typeof miscModule.generateArticle>;
    const mockGenerateFinetune = geminiModule.generateFinetune as jest.MockedFunction<typeof geminiModule.generateFinetune>;
    const mockUpdateFirebaseJobByIp = firebaseModuleIP.updateFirebaseJobByIp as jest.MockedFunction<typeof firebaseModuleIP.updateFirebaseJobByIp>;
    const mockDecrment = firebaseModule.decrementUserArticleCount as jest.MockedFunction<typeof firebaseModule.decrementUserArticleCount>;
    const mockJobUpdate = firebaseModule.updateFirebaseJob as jest.MockedFunction<typeof firebaseModule.updateFirebaseJob>;

    const testList = [
        {
            tagName: "",
            content: "",
            notes: "",
            id: ""
        }
    ]
    console.log("mockedDoesUserHaveEnoughArticles:", mockedDoesUserHaveEnoughArticles);
    mockedDoesUserHaveEnoughArticles.mockReturnValue(Promise.resolve(true));
    mockDoSerpResearch.mockReturnValue(Promise.resolve(""));
    mockGenerateOutline.mockReturnValue(Promise.resolve(testList));
    mockGenerateArticle.mockReturnValue(Promise.resolve(""));
    mockGenerateFinetune.mockReturnValue(Promise.resolve(""))
    mockUpdateFirebaseJobByIp.mockReturnValue(Promise.resolve(true));
    mockDecrment.mockReturnValue(Promise.resolve(1));
    mockJobUpdate.mockReturnValue(Promise.resolve(""));
    // miscModule.doesUserHaveEnoughArticles  <---- this method doesn't exist on the object'

    let processArticle1 = processArticle(false, data);

    expect(processArticle1).toBeDefined();

})

test('Call process article which mocks lower level mocks', () => {

    let finetune: FinetuneParam = {
        textInputs: [{
            body: ""
        }]
    }

    let outline: OutlineUnstructured = {
        title: "Test Article",
        notesForIntroduction: "Keep it short and consise",
        sections: [{
            name: "h1",
            notes: "Keep it short",
            subsections: [{
                name: "h3",
                notes: "test"
            }]
        }]
    }

    let data = {
        keyWord: "test",
        sectionCount: 2,
        tone: "",
        pointOfView: "",
        citeSources: false,
        outline: [],
        currentUser: "test",
        jobId: -1,
        finetuneChosen: finetune,
        internalUrls: "",
        clientIp: ""
    }

    const mockGenerateOutline = geminiModule.generateOutline as jest.MockedFunction<typeof geminiModule.generateOutline>;
    mockGenerateOutline.mockReturnValue(Promise.resolve(outline));
    const mockedDoesUserHaveEnoughArticles = miscModule.doesUserHaveEnoughArticles as jest.MockedFunction<typeof miscModule.doesUserHaveEnoughArticles>;
    const mockDoSerpResearch = miscModule.doSerpResearch as jest.MockedFunction<typeof miscModule.doSerpResearch>;

    console.log("mockedDoesUserHaveEnoughArticles:", mockedDoesUserHaveEnoughArticles);
    mockedDoesUserHaveEnoughArticles.mockReturnValue(Promise.resolve(true));
    mockDoSerpResearch.mockReturnValue(Promise.resolve(""));
    // miscModule.doesUserHaveEnoughArticles  <---- this method doesn't exist on the object'

    let processArticle1 = processArticle(false, data);

    expect(processArticle1).toBeDefined();

})