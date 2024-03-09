const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk');
const { UnprocessableEntityError } = require('@anthropic-ai/sdk/error');

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
        Generate an word overview of this product: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  
        Here is relevant context from the amazon product page: ${context}.  
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
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": prompt },
        ]
    });
}

const generateFinetineClaude = async (articles) => {
    const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY
    });

    const toolsForNow =
        `{
        "summaryOfStyle": "string"
    }`

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": `Analyse the articles provided and come up with a comprehensive, thorough and descriptive description of the writing style. Here are the articles:${articles}\n Imagine you have to describe the writing style to someone so that they can imitate it and include all details in your response that would help someone do this. Make sure your response is over 500 words. Include phrases or notes that help capture the uniqueness of the style.  Remember the goal is to be able to describe the charistics and style of the writing so that someone else could imitate it extremely well based on your notes.  You must make it thorough!. YOU MUST RESPOND IN JSON IN THE FOLLOWING FORMAT: ${toolsForNow}. EVERYTHING IN YOUR RESPONSE MUST BE IN THAT JSON FORMAT.` },
        ]
    });
}

const generateSectionClaude = async (outline, keyWord, context, tone, pointOfView, citeSources) => {
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

    const fineTune = `
    The writing style in the provided articles can be characterized as analytical, engaging, and detailed. To imitate this style, consider the following key elements:

  1. Contextual and Background Details:
 The articles provide extensive context and background information to set the stage for the central topic. Relevant historical facts, statistics, and anecdotes are woven throughout to give readers a comprehensive understanding of the subject matter.
 Example phrases: "In 1975, author James Clavell published Shogun, a historical fiction novel set in feudal Japan.", "To say that the bestselling novel was a hit would be an understatement.", "In 1980, Shogun became an Emmy-winning TV miniseries that drew more viewers than any other miniseries to that point except for Roots."

  2. Quotations and Expert Insights:
  The writing style incorporates multiple perspectives and insights from relevant experts, creators, and industry professionals. Direct quotations are used extensively to support key points and provide authoritative voices.

 Example phrases: "'There's a silhouette [on the cover of] this book,' Marks says. 'And the silhouette is a guy who looks a lot like me wearing clothes that don't belong to his culture, and it's a problematic silhouette.'", "'One of our writer-producers, Caillin Puente, had to pull together a bible about 840 pages long that was like stereo instructions for how to make this show, and how not to make the show, as we began to learn from past mistakes,' Marks says."
  3. Descriptive and Engaging Language:
  The writing style employs vivid and descriptive language to paint a clear picture for the reader. Engaging metaphors, analogies, and turns of phrase are used to maintain the reader's interest and provide a more immersive experience.
  Example phrases: "As Blackthorne adapts to his new life in a foreign land, his fate becomes entangled with Toranaga's, as well as that of Toda Mariko (Anna Sawai), a Catholic noblewoman who is assigned to be his interpreter.", "Sanada's imposing performance as the regal Toranaga stands on its own."

  4. Analytical and Insightful Commentary:
  The articles offer in-depth analysis and insightful commentary on the subject matter. The writing style delves into the nuances, implications, and broader significance of the topics discussed.

  Example phrases: "While there's always going to be a limit to how much one can learn about Japan's real history from any work of fiction, this story became an entry point for many Americans who suddenly wanted to study the rise of the first shogun, Tokugawa Ieyasu, or learn more about the first Englishman to reach Japan and the ways of the samurai.", "It seems that with each iteration of Shogun, beginning with Clavell's novel in 1975, a step has been taken toward introducing Japanese culture and history to an American audience."

  5. Balanced and Objective Tone:
 While the writing style is engaging and descriptive, it maintains a balanced and objective tone. Multiple perspectives are presented, and criticisms or praise are supported with evidence and context.

  Example phrases: "Shogun is now being reborn into a world that has seen nearly half a century of change since the last TV version, including globalization and the advent of the internet, and the standards for authenticity are higher than ever.", "As Marks explains it, within the space of production and television, there are typically three meetings that precede every episode's production: tone, concept, and production. But during the creation of Shogun, a fourth meeting was added in between—the 'Shosa Meeting'—where the series creators got together with the directors, assistant directors, and Japanese keys from every department to go over all of the period elements that would help imbue that desired level of realism and authenticity."

  To effectively imitate this writing style, one should aim to incorporate extensive background information, expert insights through direct quotations, descriptive and engaging language, insightful analysis, and a balanced and objective tone throughout their writing.
    `

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
        ---------------------------
        Here are some notes now on the style to imitate:
        ${fineTune}
        ---------------------------
        \n REMEMBER YOU MUST WRITE ${outline.length} sections. DO NOT INCLUDE THE HEADER ONLY THE PARAGRAGH.  If you do not provide an array of length ${outline.length}, for the sections titled: [${listOfSections}] -- EVERYTHING WILL BREAK.
        Paragraphs should each be between 300-500 words length each.  The sections should flow together nicely.
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INLUDE ANY TEXT BEFORE OR AFTER THE JSON RESONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.  REMEMBER IT IS CRITICAL THAT EACH PARAGRAGH SHOULD BE OVER 300 WORDS IN LENGTH.`;

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": prompt },
        ]
    });
}

const generateFinetune = async (urls) => {
    const scrapeConfig = createScrapeConfig("");

    // Map each URL to a promise created by processUrlForFinetune
    const scrapePromises = urls.map(url => processUrlForFinetune(url, scrapeConfig));

    // Promise.all waits for all promises in the array to resolve
    const scrapedArticles = await Promise.all(scrapePromises);

    // Once all promises resolve, concatenate their results
    const combinedArticles = scrapedArticles.map(article => `${article.data} \n`).join('');

    // Once combinedArticles is obtained, you can use it as needed.
    const completion = await generateFinetineClaude(combinedArticles);
    const extractedJSON = extractJsonFromString(completion.content[0].text)
    const sanitizedJSON = sanitizeJSON(extractedJSON)
    return JSON.parse(sanitizedJSON);
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

        Ensure your response is in json in the json format above.  You can have multiple sections and multiple subsections within sections.  Include notes to help structure what content should be touched on in the subsections.
        Ensure that there are no more than ${sectionsCount}, h2's in your outline.  
        `

    return await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: "You are a helpful assistant designed to output JSON.",
        messages: [
            { "role": "user", "content": `Generate an outline for the keyword: ${keyword}.  Ensure you response in the json format below: ${toolsForNow}. \n The wordCount for the article is in the range of ${wordRange}.  Each subsection will be roughly 200-400 words worth of content so please ensure that you keep in mind the size of the section when determining how many to create.  DO NOT include the word count in your response or function call, only use it to keep track of yourself. You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Here are is some relevent research on the topic you can use to construct it.  Please include notes in the subsections as to ensure the article flows smoothly from one section to the next.  Notes should simply be a little more info on what this section needs to cover.` },
        ]
    });
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
    summarizeContentClaude
};