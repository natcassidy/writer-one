import 'dotenv/config'; // Changed from require and adjusted for ESM
import {
  ChatSession,
  EnhancedGenerateContentResponse,
  FunctionCallingMode,
  FunctionDeclarationSchemaType,
  GenerateContentResult,
  GoogleGenerativeAI
} from '@google/generative-ai'; // Changed from require and kept destructuring
import * as firebaseFunctions from './firebaseFunctions.js';
import {OutlineUnstructured, StructuredOutline} from "./miscFunctions.js"; // Changed from require and added .mjs extension, assuming firebaseFunctions.js was renamed to firebaseFunctions.ts

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

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
    model: process.env.GEMINI_MODEL,
    generationConfig,
  });

  const includeFinetune =
    fineTuneData && fineTuneData != ""
      ? `
          * Style of Writing To Use:
          ${fineTuneData}

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

        ### Task: Generate an overview of this product: ${keyWord} for a section titled: ${sectionHeader}.
        * Length: Strive to write 1000 words.
        * Style: Write in a clear, concise, and engaging style.
        * Flow: Natural flow, avoiding repetitive phrases and sentence structure.
        * Structure: Structure your section in the following way:
          - Detailed overview of product
          - Pro's List
          - Con's List 
          - Detailed closing thoughts on product based on pro's and con's
        ${includeFinetune}
        ${includeTone}
        ${includePointOfView}

        ### Relevent Context on product To Use For writing section: 
        _______________________
        ${context}
        _______________________

        ### Here is an example article, only pay attention to the structure and formatting, not the topic.  This is here to show you how to structure your output:

        ***
        The Amazon Basics Two-Door, Hard-Sided Pet Travel Carrier is a practical and affordable option for pet owners seeking a reliable carrier for vet visits, travel, or other outings.  This model, in particular, is a gray and blue carrier with dimensions of 22.8"L x 15.0"W x 13.0"H.  The hard-sided design offers several advantages over soft-sided carriers, particularly in terms of security, durability, and ease of cleaning. 

        ### Pro's List
        * **Durable Construction:**  The carrier is constructed from sturdy, hard plastic that can withstand scratching, clawing, and moderate impacts. 
        * **Dual-Door Design:**  The two-door design, with both front and top entry points, provides convenient access for placing pets inside and taking them out.  This is especially helpful for cats who may be hesitant to enter through a front-facing door. 
        * **Secure Locking Mechanism:** The carrier features a secure locking mechanism on both doors, ensuring that pets cannot escape during transit. 
        * **Easy to Clean:** The hard plastic surfaces of the carrier can be easily wiped down with soap and water, making it simple to maintain hygiene and remove any accidents. 
        * **Good Ventilation:**  The carrier is designed with ventilation slits that allow for adequate airflow, preventing pets from overheating or feeling suffocated. 
        * **Spacious Interior:**  The carrier offers ample space for most cats or small dogs to comfortably stand up, turn around, and lie down. 
        * **Affordable Price Point:**  The Amazon Basics carrier is competitively priced, making it an attractive option for budget-conscious pet owners. 

        ### Con's List
        * **Handle Durability:**  While the handle is generally adequate for carrying the carrier, some users have expressed concerns about its long-term durability, particularly when transporting heavier pets. 
        * **Potential for Noise:**  The locking mechanisms on the doors can be a bit noisy, which might startle some pets. 
        * **Lack of Seatbelt Strap:**  The carrier does not come equipped with a built-in seatbelt strap for securing it in a vehicle. 

        The Amazon Basics Two-Door, Hard-Sided Pet Travel Carrier offers a compelling combination of practicality, affordability, and essential features, making it a solid choice for pet owners.  While there are a few minor drawbacks, the carrier's strengths outweigh its weaknesses, making it a worthwhile investment for ensuring the safe and comfortable transport of your furry companion. 

        ***

        ### Additional Notes on Instructions:
        * You can use the reviews to shape the paragraph, but do not specifically mention that it was a review that your opinion came from.  ENSURE YOU DO NOT REFERENCE THE REVIEW DIRECTLY.  As in stating something like "After reading this review here's a con about the product" 
        * Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section. 
        * Use Markdown for format the bullet points
        * Don't include an h1 or h2 at the beginning with the name of the product, simply start your section off in a paragraph.  Like the example provided above.
        `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text;
};

const generateAmazonIntro = async (
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
    model: process.env.GEMINI_MODEL,
    generationConfig,
  });

  const includeFinetune =
    fineTuneData && fineTuneData != ""
      ? `
          * Style of Writing To Use:
          ${fineTuneData}

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

        ### Task: Generate an introduction for an article review this product: ${keyWord}
        * Length: Strive to write 500-1000 words.
        * Style: Write in a clear, concise, and engaging style.
        * Flow: Natural flow, avoiding repetitive phrases and sentence structure.
        ${includeFinetune}
        ${includeTone}
        ${includePointOfView}

        ### Relevent Context on product To Use For writing the introduction: 
        _______________________
        ${context}
        _______________________

        ### Additional Notes on Instructions:
        * You can use the reviews to shape the paragraph, but do not specifically mention that it was a review that your opinion came from.  ENSURE YOU DO NOT REFERENCE THE REVIEW DIRECTLY.  As in stating something like "After reading this review here's a con about the product" 
        * Make sure your opening sentence to the section is unique and doesn't just reiterate the primary keyword.  Avoid using closing statements at the end of the section. 
        * Use Markdown for format the bullet points if you choose to include bullet points (you don't have to)
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
  outline: StructuredOutline,
  keyWord: string,
  context: string,
  tone: string,
  pointOfView: string,
  citeSources: boolean,
  finetune: Promise<string>,
  internalUrls: string
): Promise<string> => {

  let fineTuneData: string = "";
  let internalUrlData: string;

  try {
    fineTuneData = await finetune;
  } catch (e) {
    console.log("Error caught on finetune generating  section:", e);
  }

  if (internalUrls && internalUrls != "" && !internalUrlData) {
    internalUrlData = `
    ${internalUrls}
    Try to determine a title or name for the url(s) above and reference the name when linking to it.
    \n`;
  }

  console.log("Entering generateSection");

  const generationConfig = {
    max_output_tokens: 8000,
    temperature: 0.9,
    top_p: 0.1,
    top_k: 16,
  };

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL,
    generationConfig,
  });

  const includeFinetune: string =
    fineTuneData && fineTuneData != ""
      ? `
          * Style of Writing To Use:
          ${fineTuneData}

        `
      : "";
  const includeTone: string = tone
    ? `  * Ensure you write with the following tone: ${tone}\n`
    : "";
  const includeCitedSources: string = citeSources
    ? `  * Link to articles from the context provided.  You should write this article with the intention of linking to other sites throughout it.  Use links naturally in the paragraphs if it's appropriate, do not place all of the links at the end.
         * Include at least 1 link in this markdown format: [Link Text](URL)
      `
    : "";
  const includePointOfView: string = pointOfView
    ? `  * Please write this article using the following point of view: ${pointOfView}`
    : "";
  const includeInternalUrl: string = internalUrlData
    ? `### Primary Source linking instructions: You MUST include a link in 1 of your sections from the following context. Use it naturally in the article if it's appropriate, DO NOT ADD LINKS TO THE END OF THE ARTICLE. 
       Link context: \n ${internalUrlData}
       
       Here is an example of how you should include the link below. Only pay attention to the structure and natural inclusion of the link.  Pay close attention to how the links aren't placed at the end of the sections, but included naturally in the paragraphs.
       
       * Example 1:
       Prince Edward Island (PEI), Canada's smallest province, is a haven of rich cultural experiences, natural beauty, and historic charm. Visitors can immerse themselves in the island's stunning landscapes, with opportunities to explore the red sandstone cliffs and pristine beaches of the PEI National Park. For history enthusiasts, a visit to the Anne of Green Gables Museum offers a nostalgic glimpse into the world of Lucy Maud Montgomery's beloved character. Outdoor adventurers will find the Confederation Trail, a scenic path perfect for cycling and hiking, stretching across the island. Food lovers can indulge in PEI's renowned culinary scene, sampling fresh seafood at one of the many coastal eateries. From serene coastal drives to lively cultural festivals, there is no shortage of activities to enjoy on PEI. For a comprehensive guide to these and other activities, check out the [Tourism PEI website](https://www.tourismpei.com/what-to-do), which provides detailed information on the best things to do on the island.
       
       * Example 2: 
       ### Saving the Climate: Actions for a Sustainable Future

       Tackling climate change is essential as the impacts of rising temperatures and extreme weather events become increasingly severe. A critical step is reducing greenhouse gas emissions by transitioning from fossil fuels to renewable energy sources like wind and solar. Countries such as Germany have made significant strides through their "Energiewende" (energy transition), investing heavily in renewable infrastructure and setting ambitious emission reduction targets [Energiewende Blog](https://energiewende.eu/).

       Another vital strategy is enhancing energy efficiency. Simple actions, like using LED lighting and improving building insulation, can substantially lower energy consumption and emissions. Denmark’s focus on energy efficiency has led to one of the lowest per capita energy consumption rates among industrialized nations [Danish Ministry of Climate, Energy and Utilities](https://en.kefm.dk/).

       Additionally, preserving natural ecosystems plays a crucial role in absorbing CO2. Initiatives like the [Trillion Trees](https://www.trilliontrees.org/) project aim to restore one trillion trees worldwide, demonstrating the potential of nature-based solutions in combating climate change.

       For more insights and practical steps on climate action, organizations like the [United Nations Framework Convention on Climate Change (UNFCCC)](https://unfccc.int/) provide valuable resources.
        
       
       ### Remember you must link to ATLEAST 1 if not more of these url(s): [${internalUrls}], AND MUST LINK THEM THROUGHOUT THE ARTICLE USING THE MARKDOWN FORMAT.`
    : "";
  const prompt: string = `
    ### System Instruction: You are an expert article writer specializing in generating high-quality, informative content on various topics. You can follow detailed instructions precisely.

    ### Task: Generate an article on this topic: ${keyWord}. Ensure it adheres to the following guidelines:
    * Length: Each header section and it's subsections should have 1000 words.
    * Style: Write in a clear, concise, and engaging style.
    * Flow: Natural flow, avoiding repetitive phrases and sentence structure.
    * Structure: Follow the outline provided.  You can use it as a reference to structure your article with. 
    * The notes in the outline are only meant as a reference to help you determine key info to include in the sections that you must write.

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
    * Each h2 section and subsections should have a minumum of 1000 words.
    * Each heading from the outline when you write the article should have 500 words each, h1, h2, h3's
    * Respond in Markdown.
    * DO NOT MAKE LISTS, always prefer a paragraph.
    * Strive to write larger more complete paragraphs and sections, avoiding smaller sections.
    * 1000 words per h2 section and subsections.
    * THE NOTES IN THE OUTLINE ARE MEANT TO BE A REFERENCE AND GUIDELINE FOR WRITING THE SECTION(S).  YOU MUST WRITE YOUR OWN VERSION OF THE SECTION(S).
    * ONLY USE THE SECTIONS IN THE OUTLINE, DO NOT ADD ADDITIONAL HEADERS OR SECTIONS.
    * DO NOT ADD A TITLE UNLESS THERE IS AN INTRO SECTION IN THE OUTLINE
    ${
      internalUrls &&
      internalUrls != "" &&
      `
      * Remember you MUST link to these url(s): ${internalUrls}
      `
  }
    `;
  const result: GenerateContentResult = await model.generateContent(prompt);
  const response: EnhancedGenerateContentResponse = await result.response;
  return response.text();
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

const generateFinetune = async (articles): Promise<String> => {
  try {
    console.log("Generating fineTune");
    const articlesJoined: string = articles
      .map(
        (article) =>
          `
        ### Article to analyze for style and voice: 
        \n ${article.body}
        \n`
      )
      .join("");

    const prompt = `
      ### System Prompt: You are an expert ghost writer capable of capturing another authors voice, style, tone of writing.

      ### User Request:  Your job is to analyze the below article(s) and determine how to immitate the writing style of them.

      ${articlesJoined}

      Analyze the provided example article(s) and create a detailed set of instructions for others to follow to imitate the author's writing style. Your analysis should focus on paragraph structure, sentence structure, word choice, tone, voice, and formatting. Include the following elements in your instructions:

      1. Paragraph Structure:
        * Explain how to vary paragraph length for dynamic flow and readability.
        * Provide guidance on crafting strong, attention-grabbing opening sentences.
        * Discuss the use of transitions between paragraphs to maintain coherence.

      2. Sentence Structure:
        * Advise on using a mix of simple, compound, and complex sentences for varied rhythm.
        * Demonstrate how to use short, declarative sentences for impact and emphasis.
        * Encourage the use of descriptive sentences with multiple clauses and adjectives.
        * Explain the effect of occasional sentence fragments and rhetorical questions.

      3. Word Choice:
        * Suggest ways to blend casual and formal language for a conversational yet authoritative tone.
        * Emphasize the importance of vivid adjectives, adverbs, and figurative language.
        * Encourage the use of specific, concrete nouns for authenticity.
        * Provide examples of humor, wit, and clever word play from the example article.

      4. Tone and Voice:
        * Advise on maintaining a conversational, engaging tone that speaks directly to the reader.
        * Stress the importance of injecting passion and enthusiasm into the writing.
        * Encourage the use of self-deprecating humor and honest reflections for relatability.
        * Suggest incorporating pop culture references, historical events, and personal experiences for context and engagement.

      5. Formatting:
        * Explain how to use italics for emphasis, quotes, or internal thoughts.
        * Encourage the use of short, one-line paragraphs for dramatic effect or highlighting quotes.
        * Advise on using em dashes to insert additional thoughts or details within sentences.

      ### Best practices:
      1. Provide specific examples from the example article to illustrate each point in your instructions.
      2. Encourage the AI model to find a balance between detailed instructions and concise explanations to maintain reader engagement.
      3. Advise the AI model to emphasize the importance of personal anecdotes, humor, and pop culture references in creating a strong connection with the reader.
      4. Remind the AI model to stress the significance of maintaining a conversational tone while still delivering informative and engaging content.
      5. Encourage the AI model to recommend experimenting with different techniques and finding a unique voice that resonates with the reader.

      Please ensure your response is 1000+ words.  Strive to be as detailed as possible.`;

    const generationConfig = {
      max_output_tokens: 8000,
      temperature: 0.9,
      top_p: 0.1,
      top_k: 16,
    };

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL,
      generationConfig,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("Prompt finetune: \n", prompt);
    return text;
  } catch (error) {
    console.error("Error in generateFinetune:", error);
    throw error;
  }
};

const generateFineTuneService = (articles): Promise<string> => {
  return generateFinetune(articles)
    .then((response: string) => {
      return response;
    })
    .catch((error) => {
      console.error("Error generating sections:", error);
      throw new Error(error);
    });
};

async function generateOutline(
  keyword: string,
  sectionCount: number,
  context: string
): Promise<OutlineUnstructured> {
  console.log("Entering generateOutline");

  const generateOutlineFunction = {
    name: "generateOutline",
    description:
        "Generate an outline for the given keyword using the structure provided. The title section should be the introduction.",
    parameters: {
      type: "object" as FunctionDeclarationSchemaType, // Type assertion here
      properties: {
        title: {
          type: "string" as FunctionDeclarationSchemaType, // Type assertion here
        },
        notesForIntroduction: {
          type: "string" as FunctionDeclarationSchemaType, // Type assertion here
        },
        sections: {
          type: "array" as FunctionDeclarationSchemaType, // Type assertion here
          items: {
            type: "object" as FunctionDeclarationSchemaType, // Type assertion here
            properties: {
              name: {
                type: "string" as FunctionDeclarationSchemaType, // Type assertion here
              },
              notes: {
                type: "string" as FunctionDeclarationSchemaType, // Type assertion here
              },
              subsections: {
                type: "array" as FunctionDeclarationSchemaType, // Type assertion here
                items: {
                  type: "object" as FunctionDeclarationSchemaType, // Type assertion here
                  properties: {
                    name: {
                      type: "string" as FunctionDeclarationSchemaType, // Type assertion here
                    },
                    notes: {
                      type: "string" as FunctionDeclarationSchemaType, // Type assertion here
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
      functionDeclarations: [generateOutlineFunction],
    },
  ];

  const toolConfig = {
    functionCallingConfig: {
      mode: FunctionCallingMode.ANY, // Use AUTO instead of ANY if ANY is not a valid member
    },
  };

  // @ts-ignore
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL_PRO,
    tools,
    toolConfig,
  });

  const prompt = `
  ### System Prompt: You are an expert at analyzing data and producing well-formatted JSON responses for generating article outlines.

  ### User Prompt: Generate an outline for the keyword: ${keyword}.
  
  ### Additional Instructions:
  * Use specific, informative names for sections and subsections.
  * Ensure there are EXACTLY ${sectionCount} sections in the outline (excluding the introduction).
  * Each section must have at least 1 subsection (max of 2-3).
  * The 'title' field serves as the introduction.
  * 'notesForIntroduction' should guide writing the introduction.
  * Section and subsection 'notes' should guide the content.

  ### Additional Context:
  ${context}

  ### JSON Response Format:
  {
    "title": "...", 
    "notesForIntroduction": "...",
    "sections": [
      { "name": "...", "notes": "...", "subsections": [
        { "name": "...", "notes": "..." }, 
        // ... (up to 2 more subsections)
      ]},
      // ... (more sections)
    ]
  }
  `;

  const chat: ChatSession = model.startChat();
  const result: GenerateContentResult = await chat.sendMessage(prompt);

  try {
    let response: object = result.response.candidates[0].content.parts[0]
      .functionCall.args;

    console.log(response);
    return response as OutlineUnstructured;
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
    model: process.env.GEMINI_MODEL_FLASH,
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
    model: process.env.GEMINI_MODEL,
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

export { generateFinetune };
export { generateAmazonSection };
export { generateAmazonIntro };
export { generateSection };
export { generateOutline };
export { saveFinetuneConfig };
export { generateFineTuneService };
export { summarizeContent };
export { processRewrite };