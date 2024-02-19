const cheerio = require('cheerio');
const admin = require('firebase-admin');
require('dotenv').config()
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const stripEscapeChars = (string) => {
    // return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
    string = string.replace(/\.{4,}/g, '...');
    return string.replace(/[\.\s]{5,}/g, '... ');
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

    // Function to add items to the result list
    const addItem = (tagName, content) => {
        resultList.push({ id: idCounter.toString(), tagName, content });
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
                    addItem("h3", subsection.name);
                });
            }
        });
    }

    return resultList;
}

const updateFirebaseJob = async (currentUser, jobId, fieldName, data) => {
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

        if (jobId === -1) {
            // Create a new job
            // Ensure you generate or define a new jobId if required
            const newJobId = Date.now(); // Example of generating a new jobId, adjust as necessary
            const newJob = { jobId: newJobId, [fieldName]: data };

            // Add the new job to the jobs array
            jobs.push(newJob);
            console.log("New job created");
        } else {
            // Find the index of the job you want to update.
            const jobIndex = jobs.findIndex(job => job.jobId === jobId);
            if (jobIndex === -1) {
                console.log("Job not found");
                return;
            }

            // Update the specific field for this job.
            jobs[jobIndex][fieldName] = data;
            console.log("Job updated successfully");
        }

        // Update the user document with the modified jobs array.
        await userRef.update({ jobs: jobs });

    } catch (error) {
        console.error("Error updating job:", error);
    }
};

const doesUserHaveEnoughWords = async (currentUser, articleLength) => {
    if (!currentUser) {
        throw new Error('No user defined')
    }
    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    let words = 0
    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return;
        }

        // Assuming 'jobs' is an array of job objects.
        words = doc.data().words;

    } catch (error) {
        console.error("Error updating job:", error);
    }

    if (words >= articleLength) {
        return true
    } else {
        return false
    }
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
async function generateOutlineWithAI(keyword) {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "generateOutline",
                "description": "Generate an outline for the given keyword using the structure provided.  The title section should be the introduction",
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
                                                }
                                            },
                                            "required": ["name"]
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

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Generate an outline for the keyword: ${keyword}` }
        ],
        tools: toolsForNow,
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" }
    });
}

const generateOutline = async (keyWord) => {
    const completion = await generateOutlineWithAI(keyWord);
    let responseMessage = completion.choices[0].message.tool_calls[0].function.arguments;
    return processAIResponseToHtml(responseMessage);
}

const generateReleventQuestions = async (outline) => {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "generateQuestions",
                "description": "Generate questions that are relevent to the creation of this article that would be useful to know before writing the article.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "questions": {
                                "type": "string"
                            }
                        }
                    },
                    "required": ["questions"]
                }
            }
        }]

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Generate relevent questions to consider before writing an article with the following outline: ${keyword}` }
        ],
        tools: toolsForNow,
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" }
    });
}

const generateSection = async (sectionHeader, keyWord, context) => {
    const toolsForNow =
        [{
            "type": "function",
            "function": {
                "name": "generateSections",
                "description": "Generate a 300 word paragraph based on the information provided.",
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

    return await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a helpful assistant designed to output JSON." },
            { role: "user", content: `Generate a 300 word paragragh on this topic: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  Here is relevent context ${context}.  REMEMBER NO MORE THAN 300 WORDS AND DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.` }
        ],
        tools: toolsForNow,
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" }
    });
}

const generateArticle = async (outline, keyWord) => {
    const promises = [];

    for (const section of outline) {
        if (section.tagName == 'h3') {
            const promise = generateSection(section.content, keyWord, "").then(completion => {
                let responseMessage = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments);
                return responseMessage.paragraph; 
            });
            promises.push(promise);
        }
    }

    const completedSections = await Promise.all(promises);
    return completedSections;
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
    generateArticle
};