require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const summarizeContent = async (content, keyWord) => {
  const toolsForNow = [
    {
      type: "function",
      function: {
        name: "provideAnalysis",
        description:
          "Extract the most valuable information and points from the content provided, include any relevent or necessary data in the provided content, keep sucinct.",
        parameters: {
          type: "object",
          properties: {
            keyPoints: {
              type: "string",
            },
          },
          required: ["keyPoints"],
        },
      },
    },
  ];

  return await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant designed to output JSON.",
      },
      {
        role: "user",
        content: `Extract the most important and specific information from the provided content that is directly related to the subject: ${keyWord}. Include key details such as:

        Specific brand names, product names, companies, features, ingredients, etc.
        Precise statistics and data points. Format data as percentages, ratios, rankings, or other concrete metrics where possible.
        Noteworthy facts, findings, or conclusions from studies or expert sources
        
        Organize the extracted information into clear categories or sections based on the content.
        Aim for a high level of accuracy and avoid any generalizations or filler content. The extracted information will be used as source material for an article, so it's critical that the details are correct and not misleading.
        For example, if the article is reviewing the best cat foods, the extracted information should include the specific top brands recommended, key features of each food, and any statistics like "70% of vets recommend Brand X".
        Here is the content to extract information from: ${content}`,
      },
    ],
    tools: toolsForNow,
    model: "gpt-4-turbo-2024-04-09",
    response_format: { type: "json_object" },
  });
};

const healthCheck = async (content) => {
  return await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant",
      },
      {
        role: "user",
        content: `What is todays date`,
      },
    ],
    model: "gpt-4-turbo-2024-04-09",
  });
};

// AI tool call function
// async function generateOutlineWithAI(keyword, wordRange, context) {
//     const toolsForNow =
//         [{
//             "type": "function",
//             "function": {
//                 "name": "generateOutline",
//                 "description": "Generate an outline for the given keyword using the structure provided.  The title section should be the introduction.  You provide notes for the subsections to ensure the flow is similar from one section to the next.",
//                 "parameters": {
//                     "type": "object",
//                     "properties": {
//                         "title": {
//                             "type": "string"
//                         },
//                         "sections": {
//                             "type": "array",
//                             "items": {
//                                 "type": "object",
//                                 "properties": {
//                                     "name": {
//                                         "type": "string"
//                                     },
//                                     "subsections": {
//                                         "type": "array",
//                                         "items": {
//                                             "type": "object",
//                                             "properties": {
//                                                 "name": {
//                                                     "type": "string"
//                                                 },
//                                                 "notes": {
//                                                     "type": "string"
//                                                 }
//                                             },
//                                             "required": ["name", "notes"]
//                                         }
//                                     }
//                                 },
//                                 "required": ["name", "subsections"]
//                             }
//                         }
//                     },
//                     "required": ["title", "sections"]
//                 }
//             }
//         }]

//     const sectionsCount = determineSectionCount(wordRange)

//     return await openai.chat.completions.create({
//         messages: [
//             { role: "system", content: "You are a helpful assistant designed to output JSON." },
//             { role: "user", content: `Generate an outline for the keyword: ${keyword}.  Outline should be insightful and make sense to a reader.  Avoid using generic placeholders for headers like Brand 1 or Question 1.  Ensure that there are NO MORE THAN ${sectionsCount} sections total. 1 of the sections MUST be the introduction.  The wordCount for the article is in the range of ${wordRange}.  Each subsection will be roughly 200-300 words worth of content so please ensure that you keep in mind the size of the section when determining how many to create.  DO NOT include the word count in your response or function call, only use it to keep track of yourself. You DO NOT NEED TO HAVE MULTIPLE SUBSECTIONS PER SECTION.  Here are is some relevent research on the topic you can use to construct it.  Please include notes in the subsections as to ensure the article flows smoothly from one section to the next.  Notes should simply be a little more info on what this section needs to cover.` }
//         ],
//         tools: toolsForNow,
//         model: "gpt-4-0125-preview",
//         response_format: { type: "json_object" }
//     });
// }

module.exports = {
  summarizeContent,
  healthCheck,
};
