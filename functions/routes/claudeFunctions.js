const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk');
const { UnprocessableEntityError } = require('@anthropic-ai/sdk/error');

const firebaseFunctions = require('./firebaseFunctions')

//Next steps are to figure out how to pass the right info into the section generation and have the right info come
const generateAmazonSectionClaude = async (sectionHeader, keyWord, context, tone, pointOfView, finetune) => {
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

    const includeFinetune = finetune != "" ? `
        ---------------------------
        Here are some articles you should strive to immitate the writing style of below:
        ${finetune}
        ---------------------------
        ` : ''

    const includeTone = tone ? `Ensure you write with the following tone: ${tone}\n` : '';
    const includePointOfView = pointOfView ? `Please write this section using the following point of view: ${pointOfView}\n` : '';
    const prompt = `
        Generate an word overview of this product: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  
        ${includeFinetune}
        Here is relevant context from the amazon product page: ${context}. 
        You can use the reviews to shape the paragragh, but do not specifically mention that it was a review that your opinion came from.  ENSURE YOU DO NOT REFERENCE THE REVIEW DIRECTLY.  As in stating something like "After reading this review here's a con about the product" 
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includePointOfView}
        Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section. 
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INLUDE ANY TEXT BEFORE OR AFTER THE JSON RESONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.
        overviewOfProduct: should be 150 words and offer a preview/intro of the product.
        pros: should be 4 items
        cons: should be 4 items
        bottomLine: should be minumum 300 words and provide the user with an summary of the information regarding the product.
        `;

    return await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": prompt },
        ]
    });
}

const generateSectionClaude = async (outline, keyWord, context, tone, pointOfView, citeSources, finetune) => {
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

    const notesForArticle = generateNotesForArticle(outline)

    const includeFinetune = finetune != "" ? `
        ---------------------------
        Here are some articles you should strive to immitate the writing style of below:
        ${finetune}
        ---------------------------
        ` : ''
    const includeTone = tone ? `Ensure you write with the following tone: ${tone}\n` : '';
    const includeCitedSources = citeSources ? `If you choose to use data from the context please include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>.  Use it naturally in the article if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the a tag.\n` : '';
    const includePointOfView = pointOfView ? `Please write this section using the following point of view: ${pointOfView}\n` : '';
    const prompt = `
        Your job is to Generate paragraphs for each subsection provided on this topic: ${keyWord} for the following sections: [${listOfSections}]. DO NOT ADD HEADERS.
        ${includeFinetune}
        Generate paragraphs for each subsection provided on this topic: ${keyWord} for the following sections: [${listOfSections}]. DO NOT ADD HEADERS.  
        Here is relevant context ${context}.  
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includeCitedSources}
        ${includePointOfView}
        ${notesForArticle}
        \n REMEMBER YOU MUST WRITE ${outline.length} sections. DO NOT INCLUDE THE HEADER ONLY THE PARAGRAGH.  If you do not provide an array of length ${outline.length}, for the sections titled: [${listOfSections}] -- EVERYTHING WILL BREAK.
        Paragraphs should each be between 300-500 words length each.  The sections should flow together nicely.
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INLUDE ANY TEXT BEFORE OR AFTER THE JSON RESONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.  REMEMBER IT IS CRITICAL THAT EACH PARAGRAGH SHOULD BE OVER 300 WORDS IN LENGTH.  AND CLOSER TO 500 WORDS FOR EACH PARAGRAPH.`;

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": prompt },
        ]
    });
}

const generateNotesForArticle = (outline) => {
    let notes = ""

    for (let i = 0; i < outline.length; i++) {
        if (outline[i].notes) {
            notes += `For section #${i + 1}, here are some general notes to keep in mind when writing this section.\n ${outline[i].notes} \n`
        }

        if (outline[i].clientNotes) {
            notes += `Here are some additional notes to keep in mind when writing this section.\n${outline[i].clientNotes}\n`
        }
    }

    return notes
}

const saveFinetuneConfig = async (currentUser, urls, textInputs, name) => {
    try {
        if (name != "") {
            await firebaseFunctions.addFinetunetoFirebaseUser(currentUser, urls, name, textInputs)
        }
    } catch (error) {
        console.log('Error: ', error)
        throw new Error(error)
    }
}

const generateFinetune = async (urls) => {
    const scrapeConfig = createScrapeConfig("");

    // Map each URL to a promise created by processUrlForFinetune
    const scrapePromises = urls.map(url => processUrlForFinetune(url, scrapeConfig));

    // Promise.all waits for all promises in the array to resolve
    const scrapedArticles = await Promise.all(scrapePromises);

    // Once all promises resolve, concatenate their results
    return scrapedArticles.map(article => `${article.data} \n`).join('');
};


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

async function processUrlForFinetune(url, scrapeConfig) {
    try {
        const response = await axios.get(url, scrapeConfig);
        let body = stripToText(response.data);
        body = body.replace(/\s+/g, ' '); // Assign the result back to body
        if (body.length > 10000) {
            // Truncate the text to 10,000 characters
            body = body.substring(0, 10000);
        }
        return {
            status: "good",
            link: url,
            data: body,
        };
    } catch (err) {
        console.error("Error scraping:", url, err.message);
        return { status: "bad", type: "scraped", link: url, error: err.message };
    }
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

async function generateOutlineClaude(keyword, wordRange, context) {

    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });

    const sectionsCount = determineSectionCount(wordRange)

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

        Ensure your response is in json in the json format above.  You can have multiple subsections within sections.  Include notes to help structure what content should be touched on in the subsections.
        Ensure that there are no more than ${sectionsCount} h2's in your outline if you include more than ${sectionsCount} h2's, everything will break.  
        `

    const message = `Generate an outline for the keyword: ${keyword}.  Here is some context and info on the topic: ${context}.\n Ensure you response in the json format below: ${toolsForNow}. \n The wordCount for the article is in the range of ${wordRange}.  Each subsection will be roughly 200-400 words worth of content so please ensure that you keep in mind the size of the section when determining how many to create.  DO NOT include the word count in your response or function call, only use it to keep track of yourself. You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Here are is some relevent research on the topic you can use to construct it.  Please include notes in the subsections as to ensure the article flows smoothly from one section to the next.  Notes should simply be a little more info on what this section needs to cover.  Do not include generate placeholders like Brand A, Team A etc in your headers.  Remember no more than ${sectionsCount} h2's are allowed to be included in your outline.  You can have multiple subsections (tagName: h3) per tagName: h2.  You don't need to include an introduction or conclusion.`
    
    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": message },
        ]
    });
}

const determineSectionCount = (wordRange) => {
    if (wordRange === '500-1000 words') {
        return 2
    } else if (wordRange === '1000-2000 words') {
        return 4
    } else {
        return 6
    }
}

const summarizeContentClaude = async (content, keyWord) => {
    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });

    const toolsForNow =
        `{
        "keyPoints": "string"
    }`

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": `Extract the most important info and data from the content provided.  Only extract relevent data that might help someone else writing an article on the same topic.  Keep your points concise and include statitics or data where possible.  Do not include unnecssary filler word material, simply list out all the most import parts of the content. Your job is NOT to summarize, only to extract the most important data from the article, like hard stats, and data. Here is the supplied content: ${content}.\n  Ensure your format your response in json and only in json.  Make sure to adheres ot this format. ${toolsForNow}.\n Try to keep your notes relevent to this topic: ${keyWord}.  Get as much relevent data as possible in your extraction.` },
        ]
    });
}

function sanitizeJSON(jsonString) {
    return jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

function extractJsonFromString(str) {
    const regex = /{.*}/s;
    const match = str.match(regex);

    if (match && match.length > 0) {
        try {
            return match[0];
        } catch (error) {
            console.error('Error parsing JSON:', error);
            return null;
        }
    }

    return null;
}

module.exports = {
    generateFinetune,
    generateAmazonSectionClaude,
    generateSectionClaude,
    generateOutlineClaude,
    summarizeContentClaude,
    saveFinetuneConfig
};