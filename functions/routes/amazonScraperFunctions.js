const axios = require('axios');
require('dotenv').config()
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// const testScraper = async () => {
//     // set up the request parameters
//     const params = {
//         api_key: process.env.ASIN_API_KEY,
//         type: "search",
//         amazon_domain: "amazon.com",
//         search_term: "memory cards"
//     }

//     // make the http GET request to ASIN Data API
//     axios.get('https://api.asindataapi.com/request', { params })
//         .then(response => {

//             // print the JSON response from ASIN Data API
//             console.log(JSON.stringify(response.data, 0, 2));

//         }).catch(error => {
//             // catch and print the error
//             console.log(error);
//         })
// }

const getReview = async (asin, associateId) => {
    const params = {
        api_key: process.env.ASIN_API_KEY,
        type: "reviews",
        amazon_domain: "amazon.com",
        asin,
        reviewer_type: "verified_purchase",
        review_media_type: "media_reviews_only",
        sort_by: "most_recent",
        associate_id: associateId ? associateId : ""
    };

    try {
        const response = await axios.get('https://api.asindataapi.com/request', { params });
        // Assuming response.data contains the reviews
        return response.data; // Adjust based on actual structure of response.data
    } catch (error) {
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
        associate_id: affiliateID
    };

    try {
        const response = await axios.get('https://api.asindataapi.com/request', { params });
        let searchResults = response.data.search_results;

        // Limit the searchResults to the specified resultCount
        searchResults = searchResults.slice(0, resultCount);

        const resultProductArray = await Promise.all(searchResults.map(async (result) => {
            const reviewsData = await getReview(result.asin, affiliateID);
            let reviews = []; // Default to an empty array if no reviews are found

            // Check if reviewsData is not null and has a 'reviews' property before accessing it
            if (reviewsData && reviewsData.reviews) {
                reviews = reviewsData.reviews;
            }

            return {
                title: result.title,
                description: result.description,
                image: result.image,
                link: result.link,
                price: result.price,
                rating: result.rating,
                asin: result.asin,
                reviews: reviews // Now safely set to either an empty array or the actual reviews
            };
        }));

        return resultProductArray;
    } catch (error) {
        console.error(error);
        return []; // Return an empty array or appropriate error handling
    }
};

async function generateOutlineWithAI(keyWord) {
    const toolsForNow = [{
        "type": "function",
        "function": {
            "name": "createTitle",
            "description": "Provide a title to this function for the creation of an Amazon products review Article",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string"
                    }
                },
                "required": ["title"]
            }
        }
    }];

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Generate a title for an amazon products reviews article on the topic of: ${keyWord}` }
        ],
        tools: toolsForNow,
        model: "gpt-4-0125-preview",
        response_format: { type: "json_object" }
    });
}


const generateOutlineAmazon = async (keyWord, context) => {
    const completion = await generateOutlineWithAI(keyWord);
    const fetchedTitle = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments)
    const title = fetchedTitle.title
    const reviewOutline = [{
        id: '1',
        tagName: 'h1',
        content: title
    }]

    for (let i = 0; i < context.length; i++) {
        reviewOutline.push({
            id: i + 2,
            tagName: 'h2',
            content: context[i].title,
            link: context[i].link,
            imageUrl: context[i].image,
            price: context[i].price,
            rating: context[i].rating,
            asin: context[i].asin,
            reviews: context[i].reviews,
            description: context[i].description
        })
    }

    return reviewOutline
}

const generateAmazonArticle = async (outline, keyWord, context, tone, pointOfView) => {
    const promises = [];

    for (const section of outline) {
        if (section.tagName == 'h2') {
            const contextString = generateContextString(section)
            const promise = generateAmazonSection(section.content, keyWord, contextString, tone, pointOfView).then(completion => {
                let responseMessage = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments);
                section.sectionContent = responseMessage.paragraph; // Correctly assign to each section
            });
            promises.push(promise);
        }
    }

    return await Promise.all(promises);
}
//Next steps are to figure out how to pass the right info into the section generation and have the right info come
const generateAmazonSection = async (sectionHeader, keyWord, context, tone, pointOfView) => {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "generateSections",
                "description": "Generate a 300 word paragraph based on the information provided for the amazon product.  Include a pro's and con's list.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "paragraph": {
                            "type": "string"
                        }
                    },
                    "required": ["paragraph"]
                }
            }
        }]


    const includeTone = tone ? `Ensure you write with the following tone: ${tone}\n` : '';
    const includePointOfView = pointOfView ? `Please write this section using the following point of view: ${pointOfView}\n` : '';
    const prompt = `
        Generate a 300 word paragraph on this topic: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  
        Here is relevant context from the amazon product page: ${context}.  
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includePointOfView}
        Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section.
        ENSURE YOU INCLUDE A PRO'S AND CON's list.
        `;

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: prompt }
        ],
        tools: toolsForNow,
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" }
    });
}

const generateContextString = (section) => {
    let contextString = `Product description: ${section.description}\n`

    for(let i = 0; i < section.reviews.length; i++) {
        contextString += `Review #${i}: ${section.reviews[i].body}\n`
    }

    return contextString
}

const determineArticleLength = (numProducts) => {
    return numProducts * 300
}

function countWords(data) {
    // Initialize a counter for the words
    let wordCount = 0;

    // Iterate through each item in the data
    data.forEach(item => {
        // Count words in 'content'
        if (item.content) {
            wordCount += item.content.split(/\s+/).filter(Boolean).length;
        }

        // Count words in 'sectionContent' if it exists
        if (item.sectionContent) {
            wordCount += item.sectionContent.split(/\s+/).filter(Boolean).length;
        }
    });

    // Return the total word count
    return wordCount;
}

module.exports = {
    performSearch,
    generateOutlineAmazon,
    generateAmazonArticle,
    determineArticleLength
};