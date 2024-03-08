const axios = require('axios');
require('dotenv').config()
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const Anthropic = require('@anthropic-ai/sdk');

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
    // const completion = await generateOutlineWithAI(keyWord);
    // const fetchedTitle = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments)
    // const title = fetchedTitle.title
    const reviewOutline = [{
        id: '1',
        tagName: 'h1',
        content: keyWord
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
            const promise = generateAmazonSectionClaude(section.content, keyWord, contextString, tone, pointOfView).then(completion => {
                let responseMessage = JSON.parse(completion.content[0].text);
                section.overviewOfProduct = responseMessage.bottomLine
                section.pros = responseMessage.pros
                section.cons = responseMessage.cons
                section.bottomLine = responseMessage.bottomLine; // Correctly assign to each section
            });
            promises.push(promise);
        }
    }

    return await Promise.all(promises);
}

//Next steps are to figure out how to pass the right info into the section generation and have the right info come
const generateAmazonSectionClaude = async (sectionHeader, keyWord, context, tone, pointOfView) => {
    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });

    const toolsForNow =
    `
    {
        "overviewOfProduct": "string",
        "pros": [
            {"point": "string"}
        ],
        "cons": [
            {"point": "string"}
        ],
        "bottomLine": "string"
    }
    `


    const includeTone = tone ? `Ensure you write with the following tone: ${tone}\n` : '';
    const includePointOfView = pointOfView ? `Please write this section using the following point of view: ${pointOfView}\n` : '';
    const prompt = `
        Generate a 500 word overview of this product: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  
        Here is relevant context from the amazon product page: ${context}.  
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includePointOfView}
        Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section.
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INLUDE ANY TEXT BEFORE OR AFTER THE JSON RESONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.  REMEMBER MUST BE 500 WORDS.
        `;

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system:"You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": prompt},
        ]
    });
}

const generateContextString = (section) => {
    let contextString = `Product description: ${section.content}\n`

    for (let i = 0; i < section.reviews.length; i++) {
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

function countWordsClaudeBlog(data) {
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

const testClaude = async () => {
    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });

    const message = `
    Title: The Importance of Living a Healthy Life: A Comprehensive Guide I. Introduction A. Definition of a healthy lifestyle B. Brief overview of the benefits of living a healthy life II. Physical Health A. Benefits of regular exercise 1. Improves cardiovascular health 2. Strengthens muscles and bones 3. Helps maintain a healthy weight 4. Boosts energy levels B. Importance of a balanced diet 1. Provides essential nutrients 2. Helps prevent chronic diseases 3. Supports healthy weight management C. Adequate sleep and rest 1. Promotes physical recovery and repair 2. Enhances cognitive function and mental well-being III. Mental Health A. Stress management techniques 1. Meditation and mindfulness 2. Time management and organization 3. Hobbies and leisure activities B. Importance of social connections 1. Building and maintaining relationships 2. Benefits of social support on mental health C. Seeking professional help when needed 1. Recognizing signs of mental health issues 2. Importance of therapy and counseling IV. Work-Life Balance A. Setting boundaries between work and personal life 1. Importance of disconnecting from work 2. Prioritizing personal time and self-care B. Pursuing personal growth and development 1. Lifelong learning and skill acquisition 2. Setting and achieving personal goals C. Cultivating a positive work environment 1. Building positive relationships with colleagues 2. Advocating for a healthy workplace culture V. Preventive Healthcare A. Regular check-ups and screenings 1. Identifying potential health issues early 2. Monitoring chronic conditions B. Immunizations and vaccinations 1. Protecting against preventable diseases 2. Importance of staying up-to-date with recommended vaccinations C. Dental and vision care 1. Maintaining oral health 2. Protecting eye health and vision VI. Overcoming Obstacles to a Healthy Lifestyle A. Time constraints and busy schedules 1. Prioritizing health and self-care 2. Finding efficient ways to incorporate healthy habits B. Financial limitations 1. Affordable ways to exercise and eat healthily 2. Utilizing community resources and support C. Lack of motivation and consistency 1. Setting realistic goals and expectations 2. Finding accountability partners or support groups VII. Long-Term Benefits of a Healthy Lifestyle A. Reduced risk of chronic diseases 1. Lower risk of heart disease, diabetes, and certain cancers 2. Improved overall quality of life B. Increased longevity and life expectancy 1. Healthy habits contributing to a longer lifespan 2. Maintaining independence and functionality in later years C. Positive impact on personal and professional life 1. Enhanced productivity and performance 2. Improved relationships and social well-being VIII. Conclusion A. Recap of the importance of living a healthy life B. Encouragement to prioritize health and well-being C. Call to action for readers to implement healthy lifestyle changes 

    Use the outline provided above to write a 3000 word article.
    `
    return await anthropic.messages.create({
        model: 'claude-2.1',
        max_tokens: 4000,
        messages: [
            { "role": "user", "content": "What's your name?"}
        ]
    });
}


async function generateOutlineWithClaudeAI(keyword, wordRange, context) {

    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });


    const toolsForNow =
        `
        {
            "outline": {
                "title": "string",
                "sections": [
                    {
                        "name": "string",
                        "subsections": [
                            {
                                "name": "string",
                                "notes": "string"
                            }
                        ]
                    }
                ]
            }
        }

        Ensure your response is in json in the json format above.  You can have multiple sections and multiple subsections within sections.  Include notes to help structure what content should be touched on in the subsections.
        `

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system:"You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": `Generate an outline for the keyword: ${keyword}.  Ensure you response in the json format below: ${toolsForNow}. \n The wordCount for the article is in the range of ${wordRange}.  Each subsection will be roughly 200-400 words worth of content so please ensure that you keep in mind the size of the section when determining how many to create.  DO NOT include the word count in your response or function call, only use it to keep track of yourself. You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Here are is some relevent research on the topic you can use to construct it.  Please include notes in the subsections as to ensure the article flows smoothly from one section to the next.  Notes should simply be a little more info on what this section needs to cover.`},
        ]
    });
}

const generateOutlineClaude = async (keyWord, wordRange, context) => {
    const completion = await generateOutlineWithClaudeAI(keyWord, wordRange, context);
    let responseMessage = completion.content[0].text;
    return processAIResponseToHtml(responseMessage);
}

function processAIResponseToHtml(responseMessage) {
    try {
        const jsonObject = JSON.parse(responseMessage);
        return flattenJsonToHtmlList(jsonObject);
    } catch (error) {
        throw new Error('Failed to process AI response');
    }
}

function flattenJsonToHtmlList(json) {
    // Initialize the result array and a variable to keep track of ids
    const resultList = [];
    let idCounter = 1;

    const addItem = (tagName, content) => {
        resultList.push({ id: idCounter.toString(), tagName, content });
        idCounter++;
    };

    const addItemWithNotes = (tagName, content, notes) => {
        resultList.push({ id: idCounter.toString(), tagName, content, notes });
        idCounter++;
    };

    // Add the title as an h1 tag
    addItem("h1", json.title);

    // Check if sections exist and is an array before iterating
    if (Array.isArray(json.outline.sections)) {
        json.outline.sections.forEach((section) => {
            // Add each section name as an h2 tag
            addItem("h2", section.name);

            // Check if subsections exist and is an array before iterating
            if (Array.isArray(section.subsections)) {
                section.subsections.forEach((subsection) => {
                    // Add each subsection name as an h3 tag
                    addItemWithNotes("h3", subsection.name, subsection.notes);
                });
            }
        });
    }

    return resultList;
}

const generateArticleClaude = async (outline, keyWord, context, tone, pointOfView, citeSources) => {
    let constructedSections = [];
    let piecesOfOutline = [];

    try {
        for (const section of outline) {
            if (section.tagName == 'h1' || section.tagName == 'h2') {
                if (piecesOfOutline.length > 0) {
                    const sections = await generateSectionsOfArticle(piecesOfOutline, keyWord, context, tone, pointOfView, citeSources);
                    constructedSections.push(...sections);
                    piecesOfOutline = []; // Reset for next sections
                }
                constructedSections.push(section); // Add the h1 or h2 section itself
            } else if (section.tagName == 'h3') {
                piecesOfOutline.push(section); // Collect h3 sections for processing
            }
        }

        // Handle any remaining pieces after loop
        if (piecesOfOutline.length > 0) {
            const sections = await generateSectionsOfArticle(piecesOfOutline, keyWord, context, tone, pointOfView, citeSources);
            constructedSections.push(...sections);
        }
    } catch (error) {
        console.error('Error generating article:', error);
        // Handle the error appropriately
    }

    return constructedSections;
}

const generateSectionsOfArticle = async (piecesOfOutline, keyWord, context, tone, pointOfView, citeSources) => {
    const outlineCopy = structuredClone(piecesOfOutline);
    try {
        const completion = await generateSection(outlineCopy, keyWord, context, tone, pointOfView, citeSources);
        const response = JSON.parse(completion.content[0].text);
        for (let i = 0; i < response.paragraphs.length; i++) {
            outlineCopy[i].sectionContent = response.paragraphs[i];
        }
    } catch (error) {
        console.error('Error generating sections:', error);
        // Handle the error appropriately
    }
    return outlineCopy;
}

const generateSection = async (outline, keyWord, context, tone, pointOfView, citeSources) => {
    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });
    
    let listOfSections = ""
    outline.forEach(section => {
        listOfSections += `${section.content}, `
    })
    
    const toolsForNow =
    `{
        "paragraphs": [
            "string"
        ]
    }`

    const includeTone = tone ? `Ensure you write with the following tone: ${tone}\n` : '';
    const includeCitedSources = citeSources ? `If you choose to use data from the context please include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>.  Use it naturally in the article if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the a tag.\n` : '';
    const includePointOfView = pointOfView ? `Please write this section using the following point of view: ${pointOfView}\n` : '';
    const prompt = `
        Generate paragraphs for each subsection provided on this topic: ${keyWord} for the following sections: [${listOfSections}]. DO NOT ADD HEADERS.  
        Here is relevant context ${context}.  
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includeCitedSources}
        ${includePointOfView}
        \n REMEMBER YOU MUST WRITE ${outline.length} sections. DO NOT INCLUDE THE HEADER ONLY THE PARAGRAGH.  If you do not provide an array of length ${outline.length}, for the sections titled: [${listOfSections}] -- EVERYTHING WILL BREAK.
        Paragraphs should each be between 200-500 words length each.  The sections should flow together nicely.
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INLUDE ANY TEXT BEFORE OR AFTER THE JSON RESONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.`;

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system:"You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": prompt},
        ]
    });
}


module.exports = {
    performSearch,
    generateOutlineAmazon,
    generateAmazonArticle,
    determineArticleLength,
    testClaude,
    generateOutlineClaude,
    generateArticleClaude,
    countWordsClaudeBlog,
    generateAmazonSectionClaude
};