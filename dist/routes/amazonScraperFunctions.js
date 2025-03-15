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
exports.generateAmazonArticle = exports.generateOutlineAmazon = exports.performSearch = void 0;
const axios_1 = __importDefault(require("axios")); // Changed from require
require("dotenv/config"); // Changed from require and adjusted for ESM
const gemini = __importStar(require("./gemini")); // Changed from require
const misc = __importStar(require("./miscFunctions")); // Changed from require
const getProduct = async (asin) => {
    const params = {
        api_key: process.env.ASIN_API_KEY,
        type: "product",
        amazon_domain: "amazon.com",
        asin,
    };
    try {
        const response = await axios_1.default.get("https://api.asindataapi.com/request", {
            params,
        });
        // Assuming response.data contains the reviews
        return response.data; // Adjust based on actual structure of response.data
    }
    catch (error) {
        console.error(error);
        return null; // Return null or an appropriate error response
    }
};
const performSearch = async (searchTerm, domain = "amazon.com", resultCount = 5, affiliateID = "") => {
    const params = {
        api_key: process.env.ASIN_API_KEY,
        type: "search",
        amazon_domain: domain,
        search_term: searchTerm,
        sort_by: "featured",
        exclude_sponsored: "true",
        associate_id: affiliateID,
    };
    try {
        const response = await axios_1.default.get("https://api.asindataapi.com/request", {
            params,
        });
        let searchResults = response.data.search_results;
        // Limit the searchResults to the specified resultCount
        searchResults = searchResults.slice(0, resultCount);
        const resultProductArray = await Promise.all(searchResults.map(async (result) => {
            const productData = await getProduct(result.asin);
            // let reviews = []; // Default to an empty array if no reviews are found
            let imageUrl;
            let reviews = [];
            if (productData && productData.product.main_image.link) {
                imageUrl = productData.product.main_image.link;
            }
            if (productData && productData.product.top_reviews) {
                reviews = productData.product.top_reviews;
            }
            // // Check if reviewsData is not null and has a 'reviews' property before accessing it
            // if (reviewsData && reviewsData.reviews) {
            //   reviews = reviewsData.reviews;
            // }
            return {
                title: result.title,
                description: result.description,
                image: imageUrl,
                link: result.link,
                price: result.price,
                rating: result.rating,
                asin: result.asin,
                reviews: reviews, // Now safely set to either an empty array or the actual reviews
            };
        }));
        return resultProductArray;
    }
    catch (error) {
        console.error(error);
        return []; // Return an empty array or appropriate error handling
    }
};
exports.performSearch = performSearch;
const generateOutlineAmazon = async (keyWord, context) => {
    // const completion = await generateOutlineWithAI(keyWord);
    // const fetchedTitle = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments)
    // const title = fetchedTitle.title
    const reviewOutline = [
        {
            id: "1",
            tagName: "h1",
            content: keyWord,
            link: "",
            imageUrl: "",
            price: "",
            rating: "",
            asin: "",
            reviews: [],
            description: "",
        },
    ];
    for (let i = 0; i < context.length; i++) {
        reviewOutline.push({
            id: String(i + 2),
            tagName: "h2",
            content: context[i].title,
            link: context[i].link,
            imageUrl: context[i].image,
            price: context[i].price,
            rating: context[i].rating,
            asin: context[i].asin,
            reviews: context[i].reviews,
            description: context[i].description,
        });
    }
    return reviewOutline;
};
exports.generateOutlineAmazon = generateOutlineAmazon;
const generateAmazonArticle = async (outline, keyWord, context, tone, pointOfView, finetune) => {
    const promises = [];
    try {
        let introContextString = "";
        for (const section of outline) {
            if (section.tagName == "h2") {
                introContextString += misc.generateContextStringAmazonIntro(section);
            }
        }
        for (const section of outline) {
            let contextString = "";
            let sectionType = "";
            let promise;
            if (section.tagName == "h1") {
                sectionType = "intro";
                promise = generateSectionWithRetry(section, keyWord, introContextString, tone, pointOfView, finetune, sectionType);
            }
            else if (section.tagName == "h2") {
                contextString = misc.generateContextStringAmazon(section);
                sectionType = "section";
                promise = generateSectionWithRetry(section, keyWord, contextString, tone, pointOfView, finetune, sectionType);
            }
            else {
                sectionType = "conclusion";
            }
            promises.push(promise);
        }
        await Promise.all(promises);
        const markdownArticle = generateMarkDown(outline);
        return markdownArticle;
    }
    catch (e) {
        console.log("Error: ", e);
        throw new Error(e);
    }
};
exports.generateAmazonArticle = generateAmazonArticle;
const generateMarkDown = (resolvedSections) => {
    let finalArticle = "";
    for (const section of resolvedSections) {
        if (section.tagName == "h1") {
            finalArticle += `# ${section.content}\n`;
            finalArticle += `${section.summary}\n`;
        }
        else if (section.tagName == "h2") {
            finalArticle += `![${section.content}](${section.imageUrl} '${section.content}')\n`;
            finalArticle += `[${section.content}](${section.link})\n`;
            finalArticle += `${section.summary}\n`;
        }
    }
    return finalArticle;
};
const generateSectionWithRetry = async (section, keyWord, contextString, tone, pointOfView, finetune, sectionType) => {
    let attempt = 0;
    while (attempt < 3) {
        try {
            if (sectionType === "intro") {
                const completion = await gemini.generateAmazonIntro(section.content, keyWord, contextString, tone, pointOfView, finetune);
                section.summary = completion;
                return; // Exit the function if successful
            }
            else if (sectionType === "section") {
                const completion = await gemini.generateAmazonSection(section.content, keyWord, contextString, tone, pointOfView, finetune);
                section.summary = completion;
                return; // Exit the function if successful
            }
            else {
                // const completion = await gemini.generateAmazonConclusion(
                //   section.content,
                //   keyWord,
                //   contextString,
                //   tone,
                //   pointOfView,
                //   finetune
                // );
                // section.summary = completion;
                return; // Exit the function if successful
            }
        }
        catch (error) {
            attempt++;
            if (attempt >= 3) {
                console.error("Failed to generate section after 3 attempts:", error);
                throw new Error("Failed to generate Amazon article section");
            }
        }
    }
};
//# sourceMappingURL=amazonScraperFunctions.js.map