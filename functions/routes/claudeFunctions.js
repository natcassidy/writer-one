const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const { UnprocessableEntityError } = require("@anthropic-ai/sdk/error");
const firebaseFunctions = require("./firebaseFunctions");
// const pino = require('pino');
// const path = require('path');

// const logger = pino({
//   transport: {
//     target: "pino-pretty",
//     options: {
//       ignore: "pid,hostname",
//       destination: path.join(__dirname, 'logger-output.log'),
//       colorize: false
//     }
//   }
// })

//Next steps are to figure out how to pass the right info into the section generation and have the right info come
const generateAmazonSectionClaude = async (
  sectionHeader,
  keyWord,
  context,
  tone,
  pointOfView,
  finetunePromise
) => {
  console.log("Entering generateAmazonSectionClaude");
  let fineTuneData = "";

  try {
    fineTuneData = await finetunePromise;
  } catch (e) {
    console.log("Error caught on finetune generating claude section:", e);
  }

  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const toolsForNow = `
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
    `;

  const includeFinetune =
    fineTuneData && fineTuneData.instructions
      ? `
        ---------------------------
        Follow the below instructions wrapped in <styleOfWriting></styleOfWriting> tags to capture the style and tone desired.
        <styleOfWriting>
        ${fineTuneData.instructions}
        </styleOfWriting>
        ---------------------------
        `
      : "";

  const includeTone = tone
    ? `Ensure you write with the following tone: ${tone}\n`
    : "";
  const includePointOfView = pointOfView
    ? `Please write this section using the following point of view: ${pointOfView}\n`
    : "";
  const prompt = `
        Generate an word overview of this product: ${keyWord} for a section titled: ${sectionHeader}, DO NOT ADD HEADERS.  
        ${includeFinetune}
        Here is relevant context wrapped in <context></context>  tags, to help you with facts and information when writing from the amazon product pages.  Within the context tags are <review></review> tags with individual reviews on the product. 
        <context>
        ${context}. 
        </context>
        You can use the reviews to shape the paragraph, but do not specifically mention that it was a review that your opinion came from.  ENSURE YOU DO NOT REFERENCE THE REVIEW DIRECTLY.  As in stating something like "After reading this review here's a con about the product" 
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includePointOfView}
        Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section. 
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INCLUDE ANY TEXT BEFORE OR AFTER THE JSON RESPONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.
        overviewOfProduct: should be 150 words and offer a preview/intro of the product.
        pros: should be 4 items
        cons: should be 4 items
        bottomLine: should be minimum 300 words and provide the user with an summary of the information regarding the product.
        `;

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_API_MODEL,
    max_tokens: 4000,
    temperature: 0.4,
    system: "You are a helpful assistant designed to output JSON.",
    messages: [{ role: "user", content: prompt }],
  });

  console.log("Finished generateAmazonSectionClaude");
  return response;
};

const generateSectionClaude = async (
  outline,
  keyWord,
  context,
  tone,
  pointOfView,
  citeSources,
  finetune,
  sectionWordCount,
  internalUrlContext
) => {
  let fineTuneData = "";
  let internalUrlData;
  try {
    fineTuneData = await finetune;
  } catch (e) {
    console.log("Error caught on finetune generating claude section:", e);
  }

  try {
    internalUrlData = await internalUrlContext;
  } catch (e) {
    console.log("Error caught on internalUrl generating claude section:", e);
  }

  console.log("Entering generateSectionClaude");
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  let listOfSections = "";
  outline.forEach((section) => {
    listOfSections += `${section.content}, `;
  });

  const toolsForNow = `{
        "paragraphs": [
            "string"
        ]
    }`;

  const notesForArticle = generateNotesForArticle(outline);

  const includeFinetune =
    fineTuneData && fineTuneData.instructions
      ? `
        ---------------------------
        Follow the below instructions wrapped in <styleOfWriting></styleOfWriting> tags to capture the style and tone desired.
        <styleOfWriting>
        ${fineTuneData.instructions}
        </styleOfWriting>
        ---------------------------
        `
      : "";
  const includeTone = tone
    ? `Ensure you write with the following tone: ${tone}\n`
    : "";
  const includeCitedSources = citeSources
    ? `If you choose to use data from the context please include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>.  Use it naturally in the article if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the a tag.\n`
    : "";
  const includePointOfView = pointOfView
    ? `Please write this section using the following point of view: ${pointOfView}\n`
    : "";
  const includeInternalUrl = internalUrlData
    ? `Here are some additional context that may be of note to cite. Please include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>. Use it naturally in the article if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the <a> tag.  Additional Context is wrapped in <additionalContext></additionalContext> tags below.\n<additionalContext>${internalUrlData}</additionalContext>\n`
    : "";
  const prompt = `
        Your job is to Generate paragraphs for each subsection provided on this topic wrapped in <topic></topic> tags: <topic>${keyWord}</topic> for the following sections: [${listOfSections}]. DO NOT ADD HEADERS.
        ${includeFinetune}  
        Here is relevant context wrapped in <context></context>  tags, to help you with facts and information when writing.
        <context>
        ${context}.
        </context>  
        ${includeCitedSources}
        ${includeInternalUrl}
        DO NOT INCLUDE A HEADER JUST WRITE A PARAGRAPH.
        ${includeTone}
        ${includePointOfView}
        ${notesForArticle}
        \n REMEMBER YOU MUST WRITE ${outline.length} sections. DO NOT INCLUDE THE HEADER ONLY THE PARAGRAPH.  If you do not provide an array of length ${outline.length}, for the sections titled: [${listOfSections}] -- EVERYTHING WILL BREAK.
        Paragraphs should each be ${sectionWordCount} words length each.  The sections should flow together nicely.
        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        Your paragraphs should not sound AI generated.  Ensure that you write in a way that is indistinguishable from a human.
        Don't use long sentences in your paragraphs, longer sentences tend to appear AI generated.
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INCLUDE ANY TEXT BEFORE OR AFTER THE JSON RESPONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.  REMEMBER IT IS CRITICAL THAT EACH PARAGRAPH SHOULD BE ATLEAST ${sectionWordCount} IN LENGTH.`;

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_API_MODEL,
    max_tokens: 4000,
    system: "You are a helpful assistant designed to output JSON.",
    messages: [{ role: "user", content: prompt }],
  });
  console.log("Finished generateSectionClaude");
  return response;
};

const generateNotesForArticle = (outline) => {
  let notes = "";

  for (let i = 0; i < outline.length; i++) {
    if (outline[i].notes) {
      notes += `For section #${
        i + 1
      }, here are some general notes to keep in mind when writing this section wrapped in <section${
        i + 1
      }></section${i + 1}> tags.\n <section${i + 1}>${
        outline[i].notes
      }</section${
        i + 1
      }> \n  DO NOT WRAP YOUR RESPONSE IN TAGS OR <section> tags!`;
    }

    if (outline[i].clientNotes) {
      notes += `Here are some additional notes to keep in mind when writing this section.\n${outline[i].clientNotes}\n`;
    }
  }

  return notes;
};

const saveFinetuneConfig = async (currentUser, urls, textInputs, name) => {
  console.log("Entering saveFinetuneConfig");
  try {
    if (name != "") {
      await firebaseFunctions.addFinetunetoFirebaseUser(
        currentUser,
        urls,
        name,
        textInputs
      );
    }
  } catch (error) {
    console.log("Error: ", error);
    throw new Error(error);
  }
  console.log("Finished saveFinetuneConfig");
};

// const generateFinetune = async (urls) => {
//   const scrapeConfig = createScrapeConfig("");

//   // Map each URL to a promise created by processUrlForFinetune
//   const scrapePromises = urls.map((url) =>
//     processUrlForFinetune(url, scrapeConfig)
//   );

//   // Promise.all waits for all promises in the array to resolve
//   const scrapedArticles = await Promise.all(scrapePromises);

//   // Once all promises resolve, concatenate their results
//   return scrapedArticles.map((article) => `${article.data} \n`).join("");
// };

const generateFinetune = (articles) => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Generating fineTune");
      const articlesJoined = articles
        .map(
          (article) => `
    <article>
    \n ${article}
    \n </article>`
        )
        .join("");

      const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY,
      });

      const toolsForNow = `{
        "instructions": 
            "string"
    }`;

      const prompt = `
        Your job is to analyze the below article(s) and determine how to immitate the writing style of them.  Articles are wrapped in <article></article> tags.

        ${articlesJoined}

        Analyze the provided example article(s) and create a detailed set of instructions for others to follow to imitate the author's writing style. Your analysis should focus on paragraph structure, sentence structure, word choice, tone, voice, and formatting. Include the following elements in your instructions:

        1. Paragraph Structure:
          - Explain how to vary paragraph length for dynamic flow and readability.
          - Provide guidance on crafting strong, attention-grabbing opening sentences.
          - Discuss the use of transitions between paragraphs to maintain coherence.

        2. Sentence Structure:
          - Advise on using a mix of simple, compound, and complex sentences for varied rhythm.
          - Demonstrate how to use short, declarative sentences for impact and emphasis.
          - Encourage the use of descriptive sentences with multiple clauses and adjectives.
          - Explain the effect of occasional sentence fragments and rhetorical questions.

        3. Word Choice:
          - Suggest ways to blend casual and formal language for a conversational yet authoritative tone.
          - Emphasize the importance of vivid adjectives, adverbs, and figurative language.
          - Encourage the use of specific, concrete nouns for authenticity.
          - Provide examples of humor, wit, and clever word play from the example article.

        4. Tone and Voice:
          - Advise on maintaining a conversational, engaging tone that speaks directly to the reader.
          - Stress the importance of injecting passion and enthusiasm into the writing.
          - Encourage the use of self-deprecating humor and honest reflections for relatability.
          - Suggest incorporating pop culture references, historical events, and personal experiences for context and engagement.

        5. Formatting:
          - Explain how to use italics for emphasis, quotes, or internal thoughts.
          - Encourage the use of short, one-line paragraphs for dramatic effect or highlighting quotes.
          - Advise on using em dashes to insert additional thoughts or details within sentences.

        Best practices:
        1. Provide specific examples from the example article to illustrate each point in your instructions.
        2. Encourage the AI model to find a balance between detailed instructions and concise explanations to maintain reader engagement.
        3. Advise the AI model to emphasize the importance of personal anecdotes, humor, and pop culture references in creating a strong connection with the reader.
        4. Remind the AI model to stress the significance of maintaining a conversational tone while still delivering informative and engaging content.
        5. Encourage the AI model to recommend experimenting with different techniques and finding a unique voice that resonates with the reader.

        ENSURE your response is in the following JSON format:\n ${toolsForNow} \n
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INCLUDE ANY TEXT BEFORE OR AFTER THE JSON RESPONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.`;

      anthropic.messages
        .create({
          model: process.env.CLAUDE_API_MODEL,
          max_tokens: 4000,
          system: "You are a helpful assistant designed to output JSON.",
          messages: [{ role: "user", content: prompt }],
        })
        .then((response) => {
          console.log("Finished finetune");
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const generateFineTuneService = (articles) => {
  return generateFinetune(articles)
    .then((completion) => {
      const extractedJSON = extractJsonFromString(completion.content[0].text);
      const sanitizedJSON = sanitizeJSON(extractedJSON);
      let response = "";
      try {
        response = JSON.parse(sanitizedJSON);
      } catch (e) {
        console.log("Exception: ", e);
        console.log("With Sanitized Json of : \n", sanitizedJSON);
        throw new Error(e);
      }
      return response.instructions;
    })
    .catch((error) => {
      console.error("Error generating sections:", error);
      throw new Error(error);
    });
};

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

async function processUrlForFinetune(url, scrapeConfig) {
  try {
    const response = await axios.get(url, scrapeConfig);
    let body = stripToText(response.data);
    body = body.replace(/\s+/g, " "); // Assign the result back to body
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

  //remove html comments
  $("*")
    .contents()
    .each(function () {
      if (this.nodeType === 8) {
        $(this).remove();
      }
    });

  // return $('body').prop('innerText');
  // return $('body').prop('innerHTML');
  return $("body").prop("textContent");
}

async function generateOutlineClaude(keyword, wordRange, context) {
  console.log("Entering generateOutlineClaude");
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const sectionsCount = determineSectionCount(wordRange);

  const toolsForNow = `
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
        `;

  const message = `Generate an outline for the keyword: ${keyword}.  Here is some context and info on the topic: ${context}.\n Ensure you response in the json format below: ${toolsForNow}. \n The wordCount for the article is in the range of ${wordRange}.  Each subsection will be roughly 200-400 words worth of content so please ensure that you keep in mind the size of the section when determining how many to create.  DO NOT include the word count in your response or function call, only use it to keep track of yourself. You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Here are is some relevent research on the topic you can use to construct it.  Please include notes in the subsections as to ensure the article flows smoothly from one section to the next.  Notes should simply be a little more info on what this section needs to cover.  Do not include generate placeholders like Brand A, Team A etc in your headers.  Remember you MUST have ${sectionsCount} included in your outline.  And there must be atleast 1 h3 per h2 included.  You can have multiple subsections (tagName: h3) per tagName: h2.  You don't need to include an introduction or conclusion.`;

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_API_MODEL,
    max_tokens: 4000,
    system: "You are a helpful assistant designed to output JSON.",
    messages: [{ role: "user", content: message }],
  });
  console.log("Finished generateOutlineClaude");
  return response;
}

const determineSectionCount = (wordRange) => {
  if (wordRange === "500-1000 words") {
    return 2;
  } else if (wordRange === "1000-2000 words") {
    return 4;
  } else {
    return 7;
  }
};

const summarizeContentClaude = async (content, keyWord) => {
  console.log("Entering summarizeContentClaude");
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const toolsForNow = `{
        "keyPoints": "string"
    }`;

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_HAIKU_MODEL,
    max_tokens: 4000,
    system: "You are a helpful assistant designed to output JSON.",
    messages: [
      {
        role: "user",
        content: `Extract the most important info and data from the content provided.  Only extract relevent data that might help someone else writing an article on the same topic.  Keep your points concise and include statitics or data where possible.  Do not include unnecssary filler word material, simply list out all the most import parts of the content. Your job is NOT to summarize, only to extract the most important data from the article, like hard stats, and data. Here is the supplied content: ${content}.\n  Ensure your format your response in json and only in json.  Make sure to adheres ot this format. ${toolsForNow}.\n Try to keep your notes relevent to this topic: ${keyWord}.  Get as much relevent data as possible in your extraction.`,
      },
    ],
  });

  console.log("Finished summarizeContentClaude");
  return response;
};

function sanitizeJSON(jsonString) {
  return jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

function extractJsonFromString(str) {
  const regex = /{.*}/s;
  const match = str.match(regex);

  if (match && match.length > 0) {
    try {
      return match[0];
    } catch (error) {
      console.error("Error parsing JSON:", error);
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
  saveFinetuneConfig,
  generateFineTuneService,
};
