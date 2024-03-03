const cheerio = require('cheerio');
const admin = require('firebase-admin');
const axios = require('axios');
const qs = require('qs');
require('dotenv').config()
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const stripEscapeChars = (string) => {
    // TODO: Check this regex to make sure it doesn't break anything.
    // I got it from the BrightData scraper and it clearly filters out 
    // junk but I'm not sure if it'll cause a problem.
    let junkRegex = /([:\u200F\u200E\f\n\r\t\v]| {2,})/g;
    string = string.replace(junkRegex, '');
    // return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // why was I dumb enough to replace the dumb stuff with .'s when I 
    // could have used something I wouldn't have to worry about confusing
    // with the actual data?

    // TODO: check the use of <?> instead of . later to make sure it fixes the problem
    // what is something else I could use that would be even less problematic?
    string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, '<?>');
    // string = string.replace(/<?>{4,}/g, '<?>'); // FIXME: make sure this works
    // return string.replace(/[<?>\s]{5,}/g, '<?> '); // FIXME: make sure this works
}

function stripToText(html) {
    if (!html) {
        return "";
    }
    const $ = cheerio.load(html);
    $('script').remove();
    $('noscript').remove();
    $('style').remove();
    $('svg').remove();
    $('img').remove();
    $('nav').remove();
    $('iframe').remove();
    $('form').remove();
    $('input').remove();
    $('button').remove();
    $('select').remove();
    $('textarea').remove();
    $('audio').remove();
    $('video').remove();
    $('canvas').remove();
    $('embed').remove();

    //remove html comments
    $('*').contents().each(function () {
        if (this.nodeType === 8) {
            $(this).remove();
        }
    });

    // return $('body').prop('innerText');
    // return $('body').prop('innerHTML');
    return $('body').prop('textContent');
}

const checkIfStore = (string) => {
    lString = string.toLowerCase();
    if (lString.includes("add to cart")) {
        return true;
    } else if (lString.includes("free shipping on orders over")) {
        return true;
    } else {
        return false;
    }
}

const removeBadTagsRegex = (string) => {
    string = string.replace(/<img[^>]*>/g, ""); // images
    string = string.replace(/<script[^>]*>/g, ""); // script
    string = string.replace(/<style[^>]*>/g, ""); // style
    string = string.replace(/<svg[^>]*>/g, ""); // svg
    string = string.replace(/<iframe[^>]*>/g, ""); // iframe
    string = string.replace(/<form[^>]*>/g, ""); // form
    string = string.replace(/<input[^>]*>/g, ""); // input
    string = string.replace(/<button[^>]*>/g, ""); // button
    string = string.replace(/<select[^>]*>/g, ""); // select
    string = string.replace(/<textarea[^>]*>/g, ""); // textarea
    string = string.replace(/<audio[^>]*>/g, ""); // audio
    string = string.replace(/<video[^>]*>/g, ""); // video
    string = string.replace(/<canvas[^>]*>/g, ""); // canvas
    string = string.replace(/<embed[^>]*>/g, ""); // embed
    string = string.replace(/<!--[^>]*-->/g, ""); // html comments
    return
}

const stripDotDotDotItems = (string) => {
    // return string.replace(/\.{3}[A-z]{,25}\.{3}/g, '...');
    return
}

const removeKnownGremlins = (string) => {
    string = string.replace(/’/g, "'");
    string = string.replace(/–/g, "-");
    string = string.replace(/[“”]/g, '"');
    string = string.replace(/⁄/g, '/');
    return string;
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
    if (Array.isArray(json.sections)) {
        json.sections.forEach((section) => {
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

const updateFirebaseJob = async (currentUser, jobId, fieldName, data) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const jobsCollection = admin.firestore().collection("jobs");

    try {
        if (jobId === -1) {
            // Let Firebase generate the jobId
            const newJobData = { [fieldName]: data };
            const newDocRef = await jobsCollection.add(newJobData);

            console.log("New job created with ID:", newDocRef.id);
            await addJobIdToUserFirebase(currentUser, newDocRef.id);

            return newDocRef.id;
        } else {
            const jobRef = jobsCollection.doc(jobId.toString());

            if (fieldName === "context") {
                // Fetch the current document to check if it exists and get the current context
                const doc = await jobRef.get();
                if (doc.exists && doc.data().context) {
                    // If the document and context field exist, concatenate the new data
                    const updatedContext = doc.data().context + data;
                    await jobRef.update({ [fieldName]: updatedContext });
                } else {
                    // If the document or context field does not exist, set it as new
                    await jobRef.set({ [fieldName]: data }, { merge: true });
                }
            } else {
                // For other fields, just set (or merge) the data normally
                await jobRef.set({ [fieldName]: data }, { merge: true });
            }

            console.log("Job updated successfully");
            await addJobIdToUserFirebase(currentUser, jobId);

            return jobId;
        }
    } catch (error) {
        console.error("Error updating job:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
};

const getContextFromDb = async (currentUser, jobId) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const jobsCollection = admin.firestore().collection("jobs");

    let context = ""

    try {
        const jobRef = jobsCollection.doc(jobId.toString());
        // Fetch the current document to check if it exists and get the current context
        const doc = await jobRef.get();
        if (doc.exists && doc.data().context) {
            // If the document and context field exist, concatenate the new data
            context = doc.data().context
        }

        console.log("Context retrieved successfully");

        return context;
    } catch (error) {
        console.error("Error finding data:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
};

const addJobIdToUserFirebase = async (currentUser, jobId) => {
    if (!currentUser) {
        throw new Error('No user defined')
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return;
        }

        // Assuming 'jobs' is an array of job objects.
        const userData = doc.data();
        let jobs = userData.jobs || [];

        // Find the index of the job you want to update.
        const jobIndex = jobs.findIndex(job => job === jobId);
        if (jobIndex === -1) {
            jobs.push(jobId)
            await userRef.update({ jobs: jobs });
        } else {
            console.log('Job already exists on user object')
        }

    } catch (error) {
        console.error("Error updating job:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
}

const doesUserHaveEnoughWords = async (currentUser, articleLength) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return false; // Assuming the function should return false if the document doesn't exist.
        }

        const userWords = doc.data().words;

        // Extract the maximum word count requirement from the articleLength string.
        const maxRequiredWords = parseInt(articleLength.split('-').pop());

        // Check if the user has enough words.
        return userWords >= maxRequiredWords;

    } catch (error) {
        console.error("Error fetching user data:", error);
        throw error; // Consider handling or rethrowing the error as appropriate for your application.
    }
};

const doesUserHaveEnoughWordsAmazon = async (currentUser, articleLength) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return false; // Assuming the function should return false if the document doesn't exist.
        }

        const userWords = doc.data().words;

        // Check if the user has enough words.
        return userWords >= articleLength;

    } catch (error) {
        console.error("Error fetching user data:", error);
        throw error; // Consider handling or rethrowing the error as appropriate for your application.
    }
};

const decrementUserWordCount = async (currentUser, amountToDecrement) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    let newWordCount = 0;
    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return;
        }

        // Correctly retrieve and decrement the word count
        const currentWordCount = doc.data().words;
        newWordCount = currentWordCount - amountToDecrement;

        // Check for negative values
        if (newWordCount < 0) {
            console.log("Word count cannot be negative.");
            newWordCount = 0;
        }

        // Update the document with the new word count
        await userRef.update({ words: newWordCount });
    } catch (error) {
        console.error("Error updating word count:", error);
        throw error; // Rethrowing the error is a good practice for error handling
    }

    return newWordCount;
};


// Function to process AI response and convert to HTML list
function processAIResponseToHtml(responseMessage) {
    try {
        const jsonObject = JSON.parse(responseMessage);
        return flattenJsonToHtmlList(jsonObject);
    } catch (error) {
        throw new Error('Failed to process AI response');
    }
}

// AI tool call function
async function generateOutlineWithAI(keyword, wordRange, context) {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "generateOutline",
                "description": "Generate an outline for the given keyword using the structure provided.  The title section should be the introduction.  You provide notes for the subsections to ensure the flow is similar from one section to the next.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string"
                        },
                        "sections": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {
                                        "type": "string"
                                    },
                                    "subsections": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "name": {
                                                    "type": "string"
                                                },
                                                "notes": {
                                                    "type": "string"
                                                }
                                            },
                                            "required": ["name", "notes"]
                                        }
                                    }
                                },
                                "required": ["name", "subsections"]
                            }
                        }
                    },
                    "required": ["title", "sections"]
                }
            }
        }]

    const sectionsCount = determineSectionCount(wordRange)

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Generate an outline for the keyword: ${keyword}.  Outline should be insightful and make sense to a reader.  Avoid using generic placeholders for headers like Brand 1 or Question 1.  Ensure that there are NO MORE THAN ${sectionsCount} sections total. 1 of the sections MUST be the introduction.  The wordCount for the article is in the range of ${wordRange}.  Each subsection will be roughly 200-300 words worth of content so please ensure that you keep in mind the size of the section when determining how many to create.  DO NOT include the word count in your response or function call, only use it to keep track of yourself. You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Here are is some relevent research on the topic you can use to construct it.  Please include notes in the subsections as to ensure the article flows smoothly from one section to the next.  Notes should simply be a little more info on what this section needs to cover.` }
        ],
        tools: toolsForNow,
        model: "gpt-4-0125-preview",
        response_format: { type: "json_object" }
    });
}

const generateOutline = async (keyWord, wordRange, context) => {
    const completion = await generateOutlineWithAI(keyWord, wordRange, context);
    let responseMessage = completion.choices[0].message.tool_calls[0].function.arguments;
    return processAIResponseToHtml(responseMessage);
}

const determineSectionCount = (wordRange) => {
    if (wordRange === '500-800 words') {
        return 2
    } else if (wordRange === '800-1200 words') {
        return 3
    } else if (wordRange === '1200-1600 words') {
        return 4
    } else if (wordRange === '1600-2000 words') {
        return 5
    } else if (wordRange === '2000-2500 words') {
        return 6
    } else {
        return 7
    }
}

const generateReleventQuestions = async (outline, keyWord) => {
    const toolsForNow = [{
        "type": "function",
        "function": {
            "name": "provideQuestions",
            "description": "Provide a list of questions to this function for further analysis on the topic",
            "parameters": {
                "type": "object",
                "properties": {
                    "questions": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": ["questions"]
            }
        }
    }];

    const outlineToString = generateOutlineString(outline)

    try {
        return await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant designed to output JSON." },
                { role: "user", content: `Generate 5 relevent questions to consider before writing an article on the following topic: ${keyWord} with the following outline: ${outlineToString}.  These 5 questions you generate will be designed to pass into a function called provideQuestions.` }
            ],
            tools: toolsForNow,
            model: "gpt-3.5-turbo-1106",
            response_format: { type: "json_object" }
        });
    } catch (e) {
        console.log('Exception: ', e)
    }
}

const generateOutlineString = (outline) => {
    let outlineString = ""

    outline.forEach(section => {
        outlineString += ` Section tag:${section.tagName} Section Name: ${section.content} \n`
    })

    return outlineString
}

const generateContextString = (title, link, data) => {

    let contextString = ` Article Title:${title} \n
                           Article URL: ${link} \n
                           Article Context: ${data} \n`

    return contextString
}

const generateSection = async (sectionHeader, keyWord, context, tone, pointOfView, citeSources, notes) => {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "generateSections",
                "description": "Generate a 200-300 word paragraph based on the information provided.",
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
    const includeCitedSources = citeSources ? `If you choose to use data from the context please include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>.  Use it naturally in the article if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the a tag.\n` : '';
    const includePointOfView = pointOfView ? `Please write this section using the following point of view: ${pointOfView}\n` : '';
    const prompt = `
        Generate a 200-300 word paragraph on this topic: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  
        Here is relevant context from researched sites : ${context}.  
        REMEMBER NO MORE THAN 300 WORDS AND NO LESS THAN 200 WORDS. DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includeCitedSources}
        ${includePointOfView}
        Here are some additional notes and guidelines to follow to help you generate this section.
        ${notes}
        Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section.
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

const generateReleventKeyWordForQuestions = async (questions, context, keyWord) => {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "determineAdditionalInformation",
                "description": "Come up with a question for further research based on the outline of the article and the context.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "searchQuery": {
                            "type": "string"
                        }
                    },
                    "required": ["searchQuery"]
                }
            }
        }]

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Analyze the following content researched for the keyword: ${keyWord} \n.  Here is the content pulled from relevent sites: ${context}\n.  Now determine whether the following questions are adequetly answered by the content provided: ${questions}\n.  Come up with one searchQuery that will be used to address the most relevent gap in the context.` }
        ],
        tools: toolsForNow,
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" }
    });
}


const summarizeContent = async (content) => {

    const toolsForNow = [{
        "type": "function",
        "function": {
            "name": "provideAnalysis",
            "description": "Extract the most valuable insights from the content provided, include any relevent or necessary data in the provided content, keep sucinct.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyPoints": {
                        "type": "string"
                    }
                },
                "required": ["keyPoints"]
            }
        }
    }]


    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Extract the most important info and data from the content provided.  Only extract relevent data that might help someone else writing an article on the same topic.  Keep your points concise and include statitics or data where possible.  Do not include unnecssary filler word material, simply list out all the most import parts of the content. Your job is NOT to summarize, only to extract the most important data from the article. Here is the supplied content: ${content}` }
        ],
        tools: toolsForNow,
        model: "gpt-4-0125-preview",
        response_format: { type: "json_object" }
    });
}

const generateArticle = async (outline, keyWord, context, tone, pointOfView, citeSources) => {
    const promises = [];

    for (const section of outline) {
        if (section.tagName == 'h3') {
            const promise = generateSection(section.content, keyWord, context, tone, pointOfView, citeSources, section.notes).then(completion => {
                let responseMessage = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments);
                section.sectionContent = responseMessage.paragraph; // Correctly assign to each section
            });
            promises.push(promise);
        }
    }

    return await Promise.all(promises);
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


const generateContextQuestions = async (outline, keyWord) => {
    try {
        const completion = await generateReleventQuestions(outline, keyWord)
        let responseMessage = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments);
        return responseMessage.questions;
    } catch (e) {
        console.log('Exception thrown: ', e)
        throw e
    }
}

const determineIfMoreDataNeeded = async (questions, context, keyWord) => {
    try {
        const completion = await generateReleventKeyWordForQuestions(questions, context, keyWord)
        let responseMessage = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments);
        return responseMessage;
    } catch (e) {
        console.log('Exception thrown: ', e)
        throw e
    }
}

const doSerpResearch = async (keyWord, countryCode) => {
    let context = ""
    const params = {
        query: keyWord,
        countryCode: countryCode ? countryCode : ""
    }

    try {
        context = await findGoodData(params)
        // const furtherKeyWordResearch = await misc.determineIfMoreDataNeeded(questions, context, keyWord)

        // params.query = furtherKeyWordResearch.searchQuery
        // const additionalData = await getSerpResuts(params);
        // const slicedAdditionalData = additionalData.slice(0,2)
        // newContext = misc.generateContextString(slicedAdditionalData)
        // context += newContext
        // jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", newContext)

    }
    catch (e) {
        throw e
    }

    return context
}

async function findGoodData(params) {
    const data = await getSerpResults(params); // Assume this returns an array of objects
    console.log('serp results returned with size: ', data.length);

    // Use map to transform data items into an array of promises
    const promises = data.map(item => {
        // Return a new promise for each item
        return new Promise(async (resolve) => {
            if (item.status === "good") {
                try {
                    const returnedSummary = await summarizeContent(item.data);
                    if (returnedSummary) {
                        let responseMessage = JSON.parse(returnedSummary.choices[0].message.tool_calls[0].function.arguments);
                        let newContext = generateContextString(item.title, item.link, responseMessage.keyPoints)
                        resolve(newContext); // Resolve with the summary if successful
                    } else {
                        resolve(); // Resolve with undefined if no summary returned
                    }
                } catch (e) {
                    console.log('Error retrieving data summary', e);
                    resolve(); // Resolve with undefined in case of error
                }
            } else {
                resolve(); // Resolve with undefined if the status is not good
            }
        });
    });

    // Wait for all promises to resolve
    const results = await Promise.all(promises);
    // Filter out undefined results (if any)
    const contextArray = results.filter(result => result !== undefined);

    let contextString = ""
    contextArray.forEach(context => {
        contextString += context
    })

    return contextString; // This will be an array of summaries or empty if no good data is found
}

// This is required for the scraping to work through the proxy
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// TODO: label each of these as these doNotScrape or tryBetterProxy or something
// TODO: add known stores as discovered
// TODO: prevent stores with blogs from getting forbidden...just only scrape the blog
const forbiddenDomains = [
    "youtube.com",
    "pizzahut.com",
    "blazepizza.com",
    "dominos.com",
    "littlecaesars.com",
    "doi.gov", //setup alternate scraper

    /* FIXME: move these to apiAbleDomains once they can be handled specially */
    // "amazon.com",
    // "amazon.ca",
    // "usatoday.com",
    // "consumerreports.org",

    "all-clad.com", // store
    "calphalon.com", // store
    "cuisinart.com", // store
    "walmart.com", // store
    "target.com", // store
    "walgreens.com", // store

];
const apiAbleDomains = [
    "wikipedia.",
    //"wikimedia.",
];

const getCountryCode = (query) => query.countryCode || "";
const createParamsSerializer = () => (params) => qs.stringify(params, { arrayFormat: 'brackets' });

const createSerpConfig = (query, countryCode) => ({
    rejectUnauthorized: false,
    paramsSerializer: createParamsSerializer(),
    params: {
        q: query.query,
        brd_json: 1
    },
    proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
            username: `${process.env.BRIGHTDATA_SERP_USERNAME}${countryCode}`,
            password: process.env.BRIGHTDATA_SERP_PASSWORD
        }
    }
});

const createScrapeConfig = (countryCode) => ({
    rejectUnauthorized: false,
    proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
            username: `${process.env.BRIGHTDATA_DC_USERNAME}${countryCode}`,
            password: process.env.BRIGHTDATA_DC_PASSWORD
        }
    }
});

const getSerpResults = async (data) => {
    const query = data;
    const countryCode = query.countryCode || ""; // Simplify country code determination

    const serpConfig = createSerpConfig(query, countryCode);
    const scrapeConfig = createScrapeConfig(countryCode);

    try {
        const axiosResponse = await axios.get(`https://www.google.com/search`, serpConfig);
        let promises = axiosResponse.data.organic.map(el => {
            return processElement(el, scrapeConfig); // Refactor processing into a separate function
        });

        const settledPromises = await Promise.allSettled(promises);
        const trimmed = settledPromises.map(item => item.status === "fulfilled" ? item.value : item.reason);

        // Improved logging for debugging
        console.log(`Processed ${trimmed.length} items.`);
        return trimmed;
    } catch (err) {
        console.error("Error in getSerpResults:", err.message);
        // Log more detailed error information if necessary
        return []; // Return an empty array or appropriate error response
    }
};

async function processElement(el, scrapeConfig) {
    if (forbiddenDomains.some(domain => el.link.includes(domain))) {
        return {
            status: "not scraped - forbidden",
            link: el.link,
            title: el.title,
            description: el.description || "" // Use || operator for defaults
        };
    } else if (apiAbleDomains.some(domain => el.link.includes(domain))) {
        const filteredDomain = apiAbleDomains.find(domain => el.link.includes(domain));
        switch (filteredDomain) {
            case "wikipedia.":
                return apiFunctions.fetchWikipedia(el);
            default:
                console.error(`Unhandled domain: ${filteredDomain} - ${el.link}`);
                return {
                    status: "API not accessed - unhandled domain",
                    link: el.link,
                    title: el.title,
                    description: el.description || ""
                };
        }
    } else {
        try {
            const response = await axios.get(el.link, scrapeConfig);
            let body = stripToText(response.data);
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
        } catch (err) {
            console.error("Error scraping:", el.link, err.message);
            return { status: "bad", type: "scraped", link: el.link, error: err.message };
        }
    }
}

module.exports = {
    stripEscapeChars,
    stripToText,
    checkIfStore,
    removeKnownGremlins,
    stripDotDotDotItems,
    flattenJsonToHtmlList,
    updateFirebaseJob,
    processAIResponseToHtml,
    generateOutlineWithAI,
    generateOutline,
    doesUserHaveEnoughWords,
    generateReleventQuestions,
    generateArticle,
    generateContextQuestions,
    generateContextString,
    determineIfMoreDataNeeded,
    countWords,
    decrementUserWordCount,
    summarizeContent,
    doSerpResearch,
    getContextFromDb,
    doesUserHaveEnoughWordsAmazon
};