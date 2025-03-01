import * as miscModule  from "../miscFunctions";
import {processArticle, processFreeTrial} from "../process";
import * as geminiModule from "../gemini";
import * as firebaseModule from "../firebaseFunctions"
import * as firebaseModuleIP from "../firebaseFunctionsNotSignedIn";

jest.mock("../miscFunctions", () => {
    const original = jest.requireActual("../miscFunctions")

    return {
        __esModule: true,
        ...original,
        doesUserHaveEnoughArticles: jest.fn(),
        doSerpResearch: jest.fn(),
        generateOutline: jest.fn(),
        generateArticle: jest.fn(),
    }
});

jest.mock("../gemini", () => ({
    generateFinetune: jest.fn(),
}));

jest.mock("../firebaseFunctions", () => ({
    decrementUserArticleCount: jest.fn(),
    updateFirebaseJob:jest.fn(),
}));

jest.mock("../firebaseFunctionsNotSignedIn", () => ({
    updateFirebaseJobByIp: jest.fn(),
}));

test('Call process article', () => {
    let data = {
        keyWord: "test",
        sectionCount: 2,
        tone: "",
        pointOfView: "",
        citeSources: "",
        outline: "",
        currentUser: "test",
        jobId: -1,
        finetuneChosen: "",
        internalUrls: "",
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
            clientNotes: ""
        }
    ]
    console.log("mockedDoesUserHaveEnoughArticles:", mockedDoesUserHaveEnoughArticles);
    mockedDoesUserHaveEnoughArticles.mockReturnValue(Promise.resolve(true));
    mockDoSerpResearch.mockReturnValue(Promise.resolve(""));
    mockGenerateOutline.mockReturnValue(Promise.resolve(testList));
    mockGenerateArticle.mockReturnValue(Promise.resolve(""));
    mockGenerateFinetune.mockReturnValue(Promise.resolve(""))
    mockUpdateFirebaseJobByIp.mockReturnValue(Promise.resolve(true));
    mockDecrment.mockReturnValue(Promise.resolve(""));
    mockJobUpdate.mockReturnValue(Promise.resolve(""));
    // miscModule.doesUserHaveEnoughArticles  <---- this method doesn't exist on the object'

    let processArticle1 = processArticle(false, data);

    expect(processArticle1).toBeDefined();

})