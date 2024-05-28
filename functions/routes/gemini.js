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
        Follow the below instructions to capture the style and tone desired.
        Style of Writing: 
        ${fineTuneData.instructions}
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

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
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

  let listOfSections = "";
  outline.forEach((section) => {
    listOfSections += `${section.content}, `;
  });

  const generateSectionFunction = [
    {
      name: "generateSection",
      description: `Generate paragraphs based on the information provided for each subsection.  Ensure to include a paragragh for each section: ${listOfSections}.  When calling this function you MUST provide ${outline.length} number of elements in the array.`,

      parameters: {
        type: "object",
        properties: {
          paragraphs: {
            type: "array",
            items: {
              type: "string",
            },
          },
          scratchpad: {
            type: "string",
          },
        },
        required: ["paragraphs", "scratchpad"],
      },
    },
  ];

  const tools = [
    {
      function_declarations: [generateSectionFunction],
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

  const sectionList = generateSectionList(outline);

  const notesForArticle = generateNotesForArticle(outline);

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
    ? `  * If you choose to use data from the context the you must include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>.  Use it naturally in the paragraphs if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the a tag. 
         * Include at least 1 source. 
      `
    : "";
  const includePointOfView = pointOfView
    ? `  * Please write this section using the following point of view: ${pointOfView}`
    : "";
  const includeInternalUrl = internalUrlData
    ? `### Primary Source citing instructions: Please include a source cited in 1 of your sections from the following context. Please include the source in an <a> tag like this example: <a href="https://www.reuters.com/world/us/democratic-candidates-running-us-president-2024-2023-09-18/">Reuters</a>. Use it naturally in the article if it's appropriate, do not place all of the sources at the end.  Use it to link a specific word or set of words wrapped with the <a> tag.
       Source citing context: \n ${internalUrlData}`
    : "";
  const prompt = `
### System Instruction: You are an expert article writer specializing in generating high-quality, informative content on various topics. You are proficient in JSON formatting and can follow detailed instructions precisely.

### Task: Generate paragraphs for each subsection provided on this topic: ${keyWord}. Ensure each section adheres to the following guidelines:
* Length: 500-1000 words
* Structure: Begin with a topic sentence that is unique and engaging, provide supporting details and evidence, conclude with a summary or transition sentence unique to each section.
* Style: Write in a clear, concise, and engaging style.
* Flow: Natural flow, avoiding repetitive phrases and sentence structure.

### Sections:
${sectionList}

### Relevent Task Instructions: 
${includeTone}
${includePointOfView}
${includeCitedSources}
${includeInternalUrl}
* Use the scratchpad to think through the task and instructions before beginning writing.
* Don't repeat the section name or title at the beginning of the paragragh.
* Don't use markup tags or formatting in your paragragh responses.
* 1 paragragh per section for a total of ${outline.length} paragraghs.

${notesForArticle}

${includeFinetune}  

### Relevent Context To Use For Article: 
${context}

### Few-Shot Examples:

Example 1:
\`\`\`json
{
  "scratchpad": "Planned section about benefits of exercise: Cardiovascular health, mental well-being, strength building...",
  "paragraphs": [
    "Regular exercise offers a multitude of benefits for both physical and mental health. Cardiovascular health is significantly improved through activities like running, swimming, or cycling, which strengthen the heart and lungs. Exercise also plays a crucial role in mental well-being by reducing stress, anxiety, and depression. Additionally, it helps build and maintain muscle strength, improving overall physical function and quality of life."
  ]
}
\`\`\`

Example 2:
\`\`\`json
{
  "scratchpad": "Intro: AI's growing role. Section 1: AI in healthcare (diagnosis, drug discovery). Section 2: AI in business (automation, customer service)... Counterpoint: Ethical concerns...",
  "paragraphs": [
    "Artificial intelligence (AI) is rapidly transforming various sectors, with its applications becoming increasingly sophisticated and widespread. ",
    "In healthcare, AI is revolutionizing diagnostics through image analysis and pattern recognition, leading to faster and more accurate diagnoses. Moreover, AI-powered drug discovery platforms are accelerating the development of new treatments for diseases.",
    "The business world is also experiencing significant disruption due to AI. Automation is streamlining processes, improving efficiency, and reducing costs. AI-powered chatbots and virtual assistants are enhancing customer service interactions, providing quick and personalized responses."
  ]
}
\`\`\`

${
  includeCitedSources &&
  `
Example 3:
\`\`\`json
{
  "scratchpad": "Section 1: Climate change causes. Section 2: Impacts on ecosystems. Source: IPCC report...",
  "paragraphs": [
    "The primary cause of climate change is the increasing concentration of greenhouse gases in the atmosphere, mainly due to human activities like burning fossil fuels and deforestation. These gases trap heat, leading to a gradual warming of the planet.",
    "Climate change is already having a significant impact on ecosystems worldwide. According to the <a href=\"https://www.ipcc.ch/report/ar6/wg2/\">IPCC</a>, rising temperatures are causing shifts in plant and animal distributions, leading to changes in species interactions and potential extinctions."
  ]
}
\`\`\`
`
}

`;

  console.log("Finished generateSection");
  const chat = model.startChat({
    history: [],
    generationConfig,
  });
  const result = await chat.sendMessage(prompt);
  const response =
    result.response.candidates[0].content.parts[0].functionCall.args;
  console.log("response:\n", response);

  return response;
};

const generateSectionList = (listOfSections) => {
  let prompt = "\n";

  for (let i = 0; i < listOfSections.length; i++) {
    // Add asterisk, section name, and colon
    prompt += `* ${listOfSections[i]}\n`;
  }

  // Remove trailing newline
  return prompt.trimEnd();
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

  const prompt = `Generate an outline for the keyword: ${keyword}.  Outline should be insightful and make sense to a reader.  Avoid using generic placeholders for sections or subsections like Brand 1 or Question 1.  Ensure that there are NO MORE THAN ${numberOfSections} sections total. Here is some context and info on the topic: ${context}.  You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Your subsection names should be consise and to the point.  notesForIntroduction should include a general guideline for writing an introduction to the article that the outline is for.  Ensure you include notes for the introd. Sections and subsections notes should go in their corresponding notes fields to help direct what the content should be about and ensure flow. DO NOT include markup or xml formatting or prefixes in your json response, only string characters.  DO NOT prefix the fields in your response either.  EACH section must have ATLEAST 1 subsection.  DO NOT INCLUDE a section titled introduction.  The title in the outline serves as the introduction section. Max of 4 subsections per section.`;

  if (includeIntroduction) {
    prompt += " Include an introduction as one of the sections. ";
  }

  if (includeConclusion) {
    numberOfSections++;
    prompt += " Include a conclusion as one of the sections. ";
  }

  const chat = model.startChat();
  const result = await chat.sendMessage(prompt);

  const response = await result.response.candidates[0].content.parts[0]
    .functionCall.args;

  console.log(response);
  return response;
}

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
  generateAmazonSection,
  generateSection,
  generateOutline,
  saveFinetuneConfig,
  generateFineTuneService,
  testGemini,
};
