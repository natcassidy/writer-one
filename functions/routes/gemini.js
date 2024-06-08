const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const firebaseFunctions = require("./firebaseFunctions");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const testGemini = async () => {
  const prompt = "Write a story about a magic backpack.";

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

const generateAmazonSection = async (
  sectionHeader,
  keyWord,
  context,
  tone,
  pointOfView,
  finetunePromise
) => {
  console.log("Entering generateAmazonSection");
  let fineTuneData = "";

  try {
    fineTuneData = await finetunePromise;
  } catch (e) {
    console.log("Error caught on finetune generating gemini section:", e);
  }

  const generationConfig = {
    max_output_tokens: 8000,
    temperature: 0.9,
    top_p: 0.1,
    top_k: 16,
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-001",
    generationConfig,
  });

  const includeFinetune =
    fineTuneData && fineTuneData.instructions
      ? `
          * Style of Writing To Use:
          ${fineTuneData.instructions}

        `
      : "";

  const includeTone = tone
    ? `  * Ensure you write with the following tone: ${tone}\n`
    : "";
  const includePointOfView = pointOfView
    ? `  * Please write this article using the following point of view: ${pointOfView}`
    : "";
  const prompt = `
        ### System Instruction: You are an expert article writer specializing in generating high-quality, informative content on various topics. You can follow detailed instructions precisely.

        ### Task: Generate an word overview of this product: ${keyWord} for a section titled: ${sectionHeader}.
        * Length: Strive to write 500-1000 words.
        * Style: Write in a clear, concise, and engaging style.
        * Flow: Natural flow, avoiding repetitive phrases and sentence structure.
        * Structure: Structure your section in the following way:
          - Overview of product
          - Pro's List
          - Con's List 
          - Closing thoughts on product
        ${includeFinetune}
        ${includeTone}
        ${includePointOfView}

        ### Relevent Context on product To Use For writing section: 
        _______________________
        ${context}
        _______________________

        ### Additional Notes on Instructions:
        * You can use the reviews to shape the paragraph, but do not specifically mention that it was a review that your opinion came from.  ENSURE YOU DO NOT REFERENCE THE REVIEW DIRECTLY.  As in stating something like "After reading this review here's a con about the product" 
        * Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section. 
        `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  console.log("________________________");
  console.log("prompt: \n", prompt);
  console.log("________________________");
  console.log("Sections: \n", response);
  console.log("________________________");
  console.log("Sections: \n", text);
  return text;
};

const generateSection = async (
  outline,
  keyWord,
  context,
  tone,
  pointOfView,
  citeSources,
  finetune,
  internalUrlContext
) => {
  let fineTuneData = "";
  let internalUrlData;
  try {
    fineTuneData = await finetune;
  } catch (e) {
    console.log("Error caught on finetune generating  section:", e);
  }

  try {
    internalUrlData = await internalUrlContext;
  } catch (e) {
    console.log("Error caught on internalUrl generating  section:", e);
  }

  console.log("Entering generateSection");

  const generationConfig = {
    max_output_tokens: 8000,
    temperature: 0.9,
    top_p: 0.1,
    top_k: 16,
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-001",
    generationConfig,
  });

  const includeFinetune =
    fineTuneData && fineTuneData.instructions
      ? `
          * Style of Writing To Use:
          ${fineTuneData.instructions}

        `
      : "";
  const includeTone = tone
    ? `  * Ensure you write with the following tone: ${tone}\n`
    : "";
  const includeCitedSources = citeSources
    ? `  * Link to articles from the context provided.  You should write this article with the intention of linking to other sites throughout it.  Use links naturally in the paragraphs if it's appropriate, do not place all of the links at the end.
         * Include at least 1 link in this markdown format: [Link Text](URL)
      `
    : "";
  const includePointOfView = pointOfView
    ? `  * Please write this article using the following point of view: ${pointOfView}`
    : "";
  const includeInternalUrl = internalUrlData
    ? `### Primary Source citing instructions: Please include a source cited in 1 of your sections from the following context. Use it naturally in the article if it's appropriate, do not place all of the sources at the end. 
       Source citing context: \n ${internalUrlData}`
    : "";
  const prompt = `
### System Instruction: You are an expert article writer specializing in generating high-quality, informative content on various topics. You can follow detailed instructions precisely.

### Task: Generate an article on this topic: ${keyWord}. Ensure it adheres to the following guidelines:
* Length: Each header section and it's subsections should have 1000 words.
* Style: Write in a clear, concise, and engaging style.
* Flow: Natural flow, avoiding repetitive phrases and sentence structure.
* Structure: Follow the outline provided.  You can use it as a reference to structure your article with

### Outline

${JSON.stringify(outline, null, 2)}

### Relevant Task Instructions: 
${includeTone}
${includePointOfView}
${includeCitedSources}
${includeInternalUrl}
* Don't repeat the section name or title at the beginning of the paragraph.

${includeFinetune}  

### Relevent Context To Use For Article: 
_______________________
${context}
_______________________

### Extremely important to remember:
* Each h2 section should have a minumum of 1000 words.
* Each heading from the outline when you write the article should have 500 words each, h1, h2, h3's
* Respond in Markdown.
${
  citeSources &&
  `
  * Ensure you cite atleast one source from the context provided.  The more sources cited the better.
  * Cite the source(s), in this markdown format: [Link Text](URL).  Include the link naturally in your article, preferably in a sentence.
  `
}
`;

  console.log("Finished generateSection");
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  console.log("________________________");
  console.log("prompt: \n", prompt);
  console.log("________________________");
  console.log("Sections: \n", response);
  console.log("________________________");
  console.log("Sections: \n", text);
  return text;
};

const articleLengthCalculator = (listOfSections) => {
  let wordCount = 0;

  for (let i = 0; i < listOfSections.length; i++) {
    // Add asterisk, section name, and colon
    if (listOfSections[i].tagName == "h2") {
      wordCount += 1000;
    }
  }

  // Remove trailing newline
  return wordCount;
};

const generateNotesForArticle = (outline) => {
  let notes = "\nAdditional Notes For Article Structure:\n\n"; // Changed initial text

  for (let i = 0; i < outline.length; i++) {
    const sectionIndex = i + 1; // Store for readability

    if (outline[i].notes) {
      // Improved formatting for section notes
      notes += `### Section ${sectionIndex} Notes:\n${outline[i].notes}\n`;
    }

    if (outline[i].clientNotes) {
      // Improved formatting for client notes
      notes += `### Section ${sectionIndex} Client Notes:\n${outline[i].clientNotes}\n`;
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

      const toolsForNow = `{
        "instructions": 
            "string"
      }`;

      const generateFinetune = [
        {
          name: "generateFinetune",
          description: `Generate instructions for immitating the style and tone of the articles provided.`,

          parameters: {
            type: "object",
            properties: {
              instructions: {
                type: "string",
              },
            },
            required: ["instructions"],
          },
        },
      ];

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
        YOUR ENTIRE RESPONSE MUST BE IN THE JSON FORMAT ABOVE.  DO NOT INCLUDE ANY TEXT BEFORE OR AFTER THE JSON RESPONSE.  IF IT IS NOT IN THE JSON FORMAT ABOVE IT WILL BREAK.
        Please ensure your response is 1000+ words.  Strive to be as detailed as possible.`;

      const tools = [
        {
          function_declarations: [generateFinetune],
        },
      ];

      const toolConfig = {
        function_calling_config: {
          mode: "ANY",
        },
      };

      const generationConfig = {
        maxOutputTokens: 4000,
        temperature: 0.9,
      };

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-latest",
        tools,
        toolConfig,
      });

      const chat = model.startChat({
        history: [],
        generationConfig,
      });

      chat
        .sendMessage(prompt)
        .then((response) => {
          console.log("Finished finetune");
          resolve(
            response.response.candidates[0].content.parts[0].functionCall.args
          );
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
    .then((response) => {
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

async function generateOutline(
  keyword,
  sectionCount,
  context,
  includeIntroduction,
  includeConclusion
) {
  console.log("Entering generateOutline");

  const generateOutlineFunction = {
    name: "generateOutline",
    description:
      "Generate an outline for the given keyword using the structure provided. The title section should be the introduction.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        notesForIntroduction: {
          type: "string",
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              notes: {
                type: "string",
              },
              subsections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                    },
                    notes: {
                      type: "string",
                    },
                  },
                  required: ["name", "notes"],
                },
              },
            },
            required: ["name", "subsections", "notes"],
          },
        },
      },
      required: ["title", "sections", "notesForIntroduction"],
    },
  };

  const tools = [
    {
      function_declarations: [generateOutlineFunction],
    },
  ];

  const toolConfig = {
    function_calling_config: {
      mode: "ANY",
    },
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    tools,
    toolConfig,
  });

  let numberOfSections = sectionCount;

  if (includeIntroduction) {
    numberOfSections++;
  }

  if (includeConclusion) {
    numberOfSections++;
  }

  const prompt = `Generate an outline for the keyword: ${keyword}.  Outline should be insightful and make sense to a reader.  Avoid using generic placeholders for sections or subsections like Brand 1 or Question 1.  Ensure that there are NO MORE THAN ${numberOfSections} sections total. Here is some context and info on the topic: 
  ${context}.  You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Your subsection names should be consise and to the point.  notesForIntroduction should include a general guideline for writing an introduction to the article that the outline is for.  Ensure you include notes for the introd. Sections and subsections notes should go in their corresponding notes fields to help direct what the content should be about and ensure flow. DO NOT include markup or xml formatting or prefixes in your json response, only string characters.  DO NOT prefix the fields in your response either.  EACH section must have ATLEAST 1 subsection.  DO NOT INCLUDE a section titled introduction.  The title in the outline serves as the introduction section. Max of 2-3 subsections per section.`;

  if (includeIntroduction) {
    prompt += " Include an introduction as one of the sections. ";
  }

  if (includeConclusion) {
    numberOfSections++;
    prompt += " Include a conclusion as one of the sections. ";
  }

  const chat = model.startChat();
  const result = await chat.sendMessage(prompt);

  try {
    let response = await result.response.candidates[0].content.parts[0]
      .functionCall.args;

    console.log(response);
    return response;
  } catch (e) {
    console.log("Exception Outline: ", e);
    throw new Error(e);
  }
}

const summarizeContent = async (content, keyWord) => {
  const now = new Date();
  console.log(now.toLocaleString());
  console.log("Summarizing content");
  const generationConfig = {
    max_output_tokens: 8000,
    temperature: 0.9,
    top_p: 0.1,
    top_k: 16,
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-001",
    generationConfig,
  });

  const prompt = `
  Extract the most important and specific information from the provided content that is directly related to the subject: ${keyWord}. Include key details such as:

  Specific brand names, product names, companies, features, ingredients, etc.
  Precise statistics and data points. Format data as percentages, ratios, rankings, or other concrete metrics where possible.
  Noteworthy facts, findings, or conclusions from studies or expert sources
        
  Organize the extracted information into clear categories or sections based on the content.
  Aim for a high level of accuracy and avoid any generalizations or filler content. The extracted information will be used as source material for an article, so it's critical that the details are correct and not misleading.
  For example, if the article is reviewing the best cat foods, the extracted information should include the specific top brands recommended, key features of each food, and any statistics like "70% of vets recommend Brand X".
  Here is the content to extract information from: 
  
  Article Content:
  ${content}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const now2 = new Date();
  console.log(now2.toLocaleString());
  console.log("Finished Summarizing content");
  return response.text();
};

const processRewrite = async (targetSection, instructions) => {
  const generationConfig = {
    max_output_tokens: 8000,
    temperature: 0.9,
    top_p: 0.1,
    top_k: 16,
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-001",
    generationConfig,
  });

  const prompt = `
  ### System Prompt: You are the world's foremost article writer, able to handle complex instructions.
  
  ### Task: Rewrite the following text based on the user's instructions.

  ### User Instructions: ${instructions} 

  ### Target text to rewrite: 
  ${targetSection}

  ### Additional Instructions:
  * Only respond with the rewritten text, don't prefix your response with anything.
  * Strive to keep the same structure of markdown as the original text UNLESS the *** User Instructions *** specify otherwise.
  * If no *** User Instructions *** provided, then simply rewrite the provided text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("Rewrite text: \n", text);
    return text;
  } catch (e) {
    throw new Error(e);
  }
};

module.exports = {
  generateFinetune,
  generateAmazonSection,
  generateSection,
  generateOutline,
  saveFinetuneConfig,
  generateFineTuneService,
  testGemini,
  summarizeContent,
  processRewrite,
};
