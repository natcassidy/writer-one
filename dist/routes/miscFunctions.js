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
exports.generateArticle = exports.generateOutline = exports.doInternalUrlResearch = exports.parseIp = exports.parseKeyWords = exports.generateContextStringAmazonIntro = exports.generateContextStringAmazon = exports.doSerpResearch = exports.doesUserHaveEnoughArticles = exports.stripEscapeChars = void 0;
exports.htmlListToJson = htmlListToJson;
const cheerio_1 = __importDefault(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
require("dotenv/config");
const gemini = __importStar(require("./gemini"));
const stripEscapeChars = (string) => {
    let junkRegex = /([:\u200F\u200E\f\n\r\t\v]| {2,})/g;
    string = string.replace(junkRegex, "");
    string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, "<?>");
};
exports.stripEscapeChars = stripEscapeChars;
function stripToText(html) {
    if (!html) {
        return "";
    }
    const $ = cheerio_1.default.load(html);
    $("script").remove();
    $("noscript").remove();
    $("style").remove();
    $("svg").remove();
    $("img").remove();
    $("nav").remove();
    $("iframe").remove();
    $("form").remove();
    $("input").remove();
    $("button").remove();
    $("select").remove();
    $("textarea").remove();
    $("audio").remove();
    $("video").remove();
    $("canvas").remove();
    $("embed").remove();
    $("*")
        .contents()
        .each(function () {
        if (this.nodeType === 8) {
            $(this).remove();
        }
    });
    return $("body").prop("textContent");
}
function flattenJsonToHtmlList(json) {
    // Initialize the result array and a variable to keep track of ids
    const resultList = [];
    let idCounter = 1;
    const addItem = (tagName, content, notes) => {
        resultList.push({ id: idCounter.toString(), tagName, content, notes });
        idCounter++;
    };
    // Add the title as an h1 tag
    addItem("h1", json.title, json.notesForIntroduction);
    // Check if sections exist and is an array before iterating
    if (Array.isArray(json.sections)) {
        json.sections.forEach((section) => {
            // Add each section name as an h2 tag
            addItem("h2", section.name, section.notes);
            // Check if subsections exist and is an array before iterating
            if (Array.isArray(section.subsections)) {
                section.subsections.forEach((subsection) => {
                    // Add each subsection name as an h3 tag
                    addItem("h3", subsection.name, subsection.notes);
                });
            }
        });
    }
    return resultList;
}
function htmlListToJson(flatList) {
    const result = {
        sections: [],
        title: "",
        notesForIntroduction: "",
        clientNotes: "",
    };
    let currentSection = null;
    flatList.forEach((item) => {
        const { tagName, content, notes, clientNotes } = item;
        if (tagName === "h1") {
            result.title = content;
            result.notesForIntroduction = notes;
            result.clientNotes = clientNotes;
        }
        else if (tagName === "h2") {
            if (currentSection) {
                result.sections.push(currentSection);
            }
            currentSection = {
                name: content,
                notes: notes,
                clientNotes: clientNotes,
                subsections: [],
            };
        }
        else if (tagName === "h3") {
            if (currentSection) {
                currentSection.subsections.push({
                    name: content,
                    notes: notes,
                    clientNotes: clientNotes,
                });
            }
            else {
                console.error("Found h3 tag without a parent h2 tag");
            }
        }
    });
    // Push the last section if it exists
    if (currentSection) {
        result.sections.push(currentSection);
    }
    return result;
}
const doesUserHaveEnoughArticles = async (currentUser) => {
    if (!currentUser) {
        throw new Error("No user defined");
    }
    const userRef = firebase_admin_1.default
        .firestore()
        .collection("customers")
        .doc(currentUser.uid);
    try {
        const doc = await userRef.get();
        if (!doc.exists) {
            console.log("No such document!");
            return false; // Assuming the function should return false if the document doesn't exist.
        }
        const userArticles = doc.data().articles;
        // Check if the user has enough words.
        return userArticles >= 1;
    }
    catch (error) {
        console.error("Error fetching user data:", error);
        throw error; // Consider handling or rethrowing the error as appropriate for your application.
    }
};
exports.doesUserHaveEnoughArticles = doesUserHaveEnoughArticles;
// Function to process AI response and convert to HTML list
function processAIResponseToHtml(responseMessage) {
    try {
        return flattenJsonToHtmlList(responseMessage);
    }
    catch (error) {
        console.log("Error: ", error);
        throw new Error("Failed to process AI response");
    }
}
const doSerpResearch = async (keyWord, countryCode) => {
    let context = "";
    const params = {
        query: keyWord,
        countryCode: countryCode ? countryCode : "",
    };
    try {
        context = await findGoodData(params);
    }
    catch (e) {
        throw e;
    }
    return context;
};
exports.doSerpResearch = doSerpResearch;
const doInternalUrlResearch = async (internalUrls, title) => {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await getSerpResultsForInternalUrls(internalUrls);
            console.log("serp results returned with size: ", data.length);
            const results = []; // Explicitly type results as string[]
            const chunkSize = 10;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                const promises = chunk.map(async (item) => {
                    if (item.status === "good") {
                        try {
                            const returnedSummary = await gemini.summarizeContent(item.data, title);
                            if (returnedSummary) {
                                let newContext = generateContextStringBlog(// Explicitly type newContext as string
                                item.title, item.link, returnedSummary);
                                return newContext;
                            }
                        }
                        catch (e) {
                            console.log("Error retrieving data summary for internalUrl", e);
                        }
                    }
                    return null; // Still return null, but the filter will handle it
                });
                const chunkResults = await Promise.all(promises);
                results.push(...chunkResults.filter((result) => result !== null)); // Type assertion after filter
                // ... rest of your code ...
            }
            resolve(results.join("\n\n")); // Resolve the Promise with the final result
        }
        catch (error) {
            reject(error); // Reject the Promise if an error occurs
        }
    });
};
exports.doInternalUrlResearch = doInternalUrlResearch;
const getSerpResultsForInternalUrls = async (internalUrls) => {
    console.log("Entering getSerpResultsForInternalUrls");
    const countryCode = ""; // Simplify country code determination
    const scrapeConfig = createScrapeConfig(countryCode);
    try {
        const promises = internalUrls.map((url) => {
            const element = {
                link: url,
                title: "",
                description: "",
            };
            return processElement(element, scrapeConfig); // Refactor processing into a separate function
        });
        const settledPromises = await Promise.allSettled(promises);
        const trimmed = settledPromises.map((item) => item.status === "fulfilled" ? item.value : item.reason);
        // Improved logging for debugging
        return trimmed;
    }
    catch (err) {
        console.error("Error in getSerpResultsForInternalUrls:", err.message);
        return []; // Return an empty array or appropriate error response
    }
};
async function findGoodData(params) {
    const data = await getSerpResults(params);
    console.log("serp results returned with size: ", data.length);
    const results = [];
    const chunkSize = 10;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const promises = chunk.map(async (item) => {
            if (item.status === "good") {
                try {
                    const returnedSummary = await gemini.summarizeContent(item.data, params.query);
                    if (returnedSummary) {
                        let newContext = generateContextStringBlog(item.title, item.link, returnedSummary);
                        return newContext;
                    }
                }
                catch (e) {
                    console.log("Error retrieving data summary", e);
                }
            }
            return null;
        });
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults.filter((result) => result !== null));
        // Check if the results array has reached 5 items
        if (results.length >= 6) {
            break; // Exit the loop early
        }
        // Wait for the current batch of promises to resolve before proceeding
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return results.join("\n\n"); // Join the results array into a single string with newline separators
}
const generateContextStringAmazon = (section) => {
    let contextString = `Product description: ${section.content}\n`;
    const maxLoops = 10;
    const reviewCount = Math.min(section.reviews.length, maxLoops);
    for (let i = 0; i < reviewCount; i++) {
        contextString += `* Review ${i + 1}: ${section.reviews[i].body}\n`;
    }
    return contextString;
};
exports.generateContextStringAmazon = generateContextStringAmazon;
const generateContextStringAmazonIntro = (section) => {
    let contextString = `Product description: ${section.content}\n`;
    const maxLoops = 3;
    const reviewCount = Math.min(section.reviews.length, maxLoops);
    for (let i = 0; i < reviewCount; i++) {
        contextString += `* Review ${i + 1}: ${section.reviews[i].body}\n`;
    }
    return contextString;
};
exports.generateContextStringAmazonIntro = generateContextStringAmazonIntro;
const generateContextStringBlog = (title, link, keyPoints) => {
    let contextString = `
  * Context:
    - Article Title:${title}
    - Article URL: ${link}
    - Article Context: ${keyPoints}
  `;
    return contextString;
};
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const forbiddenDomains = [
    "youtube.com",
    "pizzahut.com",
    "blazepizza.com",
    "dominos.com",
    "littlecaesars.com",
    "doi.gov",
    "all-clad.com",
    "calphalon.com",
    "cuisinart.com",
    "walmart.com",
    "target.com",
    "walgreens.com",
];
const apiAbleDomains = ["wikipedia."];
const createParamsSerializer = () => (params) => qs_1.default.stringify(params, { arrayFormat: "brackets" });
const createSerpConfig = (query, countryCode) => ({
    rejectUnauthorized: false,
    paramsSerializer: createParamsSerializer(),
    params: {
        q: query.query,
        brd_json: 1,
    },
    proxy: {
        host: "brd.superproxy.io",
        port: 22225,
        auth: {
            username: `${process.env.BRIGHTDATA_SERP_USERNAME}${countryCode}`,
            password: process.env.BRIGHTDATA_SERP_PASSWORD,
        },
    },
});
const createScrapeConfig = (countryCode) => ({
    rejectUnauthorized: false,
    proxy: {
        host: "brd.superproxy.io",
        port: "22225",
        auth: {
            username: `${process.env.BRIGHTDATA_DC_USERNAME}${countryCode}`,
            password: process.env.BRIGHTDATA_DC_PASSWORD,
        },
    },
});
const getSerpResults = async (data) => {
    console.log("Entering getSerpResults");
    const query = data;
    const countryCode = query.countryCode || ""; // Simplify country code determination
    const serpConfig = createSerpConfig(query, countryCode);
    const scrapeConfig = createScrapeConfig(countryCode);
    try {
        const axiosResponse = await axios_1.default.get(`https://www.google.com/search`, serpConfig);
        const promises = axiosResponse.data.organic.map((el) => {
            return processElement(el, scrapeConfig); // Refactor processing into a separate function
        });
        const settledPromises = await Promise.allSettled(promises);
        const trimmed = settledPromises.map((item) => item.status === "fulfilled" ? item.value : item.reason);
        // Improved logging for debugging
        console.log(`Processed ${trimmed.length} items.`);
        console.log("Finished getSerpResults");
        return trimmed;
    }
    catch (err) {
        console.error("Error in getSerpResults:", err.message);
        // Log more detailed error information if necessary
        return []; // Return an empty array or appropriate error response
    }
};
async function processElement(el, scrapeConfig) {
    if (forbiddenDomains.some((domain) => el.link.includes(domain))) {
        return {
            status: "not scraped - forbidden",
            link: el.link,
            title: el.title,
            description: el.description || "", // Use || operator for defaults
        };
    }
    else if (apiAbleDomains.some((domain) => el.link.includes(domain))) {
        const filteredDomain = apiAbleDomains.find((domain) => el.link.includes(domain));
        switch (filteredDomain) {
            case "wikipedia.":
                return fetchWikipedia(el);
            default:
                console.error(`Unhandled domain: ${filteredDomain} - ${el.link}`);
                return {
                    status: "API not accessed - unhandled domain",
                    link: el.link,
                    title: el.title,
                    description: el.description || "",
                };
        }
    }
    else {
        try {
            const response = await axios_1.default.get(el.link, scrapeConfig);
            let body = stripToText(response.data);
            body = body.replace(/\s+/g, " "); // Assign the result back to body
            if (body.length > 10000) {
                // Truncate the text to 10,000 characters
                body = body.substring(0, 10000);
            }
            const description = stripToText(el.description);
            let type = "scraped";
            if (checkIfStore(body)) {
                type = "scraped - store";
            }
            return {
                status: "good",
                type: type,
                link: el.link,
                title: el.title,
                description: description,
                data: body,
            };
        }
        catch (err) {
            console.error("Error scraping:", el.link, err.message);
            return {
                status: "bad",
                type: "scraped",
                link: el.link,
                error: err.message,
            };
        }
    }
}
const checkIfStore = (string) => {
    let lString = string.toLowerCase();
    if (lString.includes("add to cart")) {
        return true;
    }
    else if (lString.includes("free shipping on orders over")) {
        return true;
    }
    else {
        return false;
    }
};
const fetchWikipedia = (el) => {
    /*
      Should be a language-independent way to pull arbitrary page data from wikipedia
    */
    const language = el.link.split(".")[0].split("//")[1];
    const title = el.title.split(" -")[0];
    const url = `https://${language}.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&origin=*&titles=${title}`;
    fetch(url)
        .then((response) => {
        if (!response.ok) {
            throw new Error("wikipedia fetch failed!" +
                response.status +
                " - " +
                response.statusText);
        }
        return response.json(); // Parse the response body as JSON
    })
        .then((data) => {
        // FIXME: getting the contents of data into the returned object isn't done
        // Process the JSON data
        const pages = data.query.pages;
        const page = pages[Object.keys(pages)[0]]; // Get the first page in the response
        const content = page.extract; // Extract the content of the page
        return {
            status: "good",
            type: "wikipedia",
            link: el.link,
            title: el.title,
            description: el.description ? el.description : "",
            data: stripEscapeChars(content),
        };
    })
        .catch((err) => {
        console.error("Failed to fetch data:", err);
        return { status: "bad", err: err, headers: err.headers };
    });
};
const parseKeyWords = (keyWords) => {
    const keyWordList = keyWords.split(",");
    return keyWordList;
};
exports.parseKeyWords = parseKeyWords;
const parseIp = (req) => {
    return (req.headers["x-forwarded-for"]?.split(",").shift() ||
        req.socket?.remoteAddress);
};
exports.parseIp = parseIp;
const generateOutline = async (keyWord, sectionCount, context) => {
    const maxAttempts = 3;
    let attempt = 0;
    let response;
    while (attempt < maxAttempts) {
        try {
            response = await gemini.generateOutline(keyWord, sectionCount, context);
            break; // Exit the loop if the request is successful
        }
        catch (error) {
            attempt++;
            if (attempt < maxAttempts) {
                console.warn(`Attempt ${attempt} failed. Retrying...`);
            }
            else {
                console.error("Failed to generate sections after 3 attempts:", error);
                throw error;
            }
        }
    }
    if (!response) {
        throw new Error("Failed to generate a valid response.");
    }
    return processAIResponseToHtml(response);
};
exports.generateOutline = generateOutline;
const generateSectionsWithRetry = async (piecesOfOutline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls) => {
    const maxAttempts = 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
        try {
            console.log("Attempt #: ", attempt + 1);
            const article = await generateSectionsOfArticle(piecesOfOutline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls);
            return article;
        }
        catch (error) {
            attempt++;
            if (attempt < maxAttempts) {
                console.warn(`Attempt ${attempt} failed. Retrying...`);
            }
            else {
                console.error("Failed to generate sections after 3 attempts:", error);
                throw error;
            }
        }
    }
};
const generateSectionsOfArticle = async (piecesOfOutline, keyWord, context, tone, pointOfView, citeSources, finetunePromise, internalUrls) => {
    const outlineCopy = structuredClone(piecesOfOutline);
    try {
        const response = await gemini.generateSection(outlineCopy, keyWord, context, tone, pointOfView, citeSources, finetunePromise, internalUrls);
        return response;
    }
    catch (error) {
        console.error("Error generating sections:", error);
        throw new Error(error);
    }
};
const generateSections = async (section, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls) => {
    try {
        return await generateSectionsWithRetry(section, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls);
    }
    catch (error) {
        console.error(`Failed to generate section content for section: ${section}`, error);
        throw error;
    }
};
const generateArticle = async (outline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls) => {
    try {
        if (!outline || !outline.sections || outline.sections.length === 0) {
            throw new Error("Invalid outline provided");
        }
        let sections = outline.sections;
        let sectionPromises = [];
        if (sections.length <= 3) {
            // Include all sections in a single call with the full outline
            sectionPromises.push(generateSections(outline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls));
        }
        else {
            // Split the outline into two parts
            let firstThreeSectionsOutline = {
                ...outline,
                sections: sections.slice(0, 3),
            };
            let remainingSections = {
                ...outline,
                sections: sections.slice(3),
            };
            sectionPromises.push(generateSections(firstThreeSectionsOutline, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls));
            sectionPromises.push(generateSections(remainingSections, keyWord, context, tone, pointOfView, citeSources, finetune, internalUrls));
        }
        let resolvedSections = await Promise.all(sectionPromises);
        return resolvedSections.join("\n");
    }
    catch (error) {
        console.error("Failed to generate article correctly:", error);
        throw new Error("Failed to generate article correctly");
    }
};
exports.generateArticle = generateArticle;
//# sourceMappingURL=miscFunctions.js.map