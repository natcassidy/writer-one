const express = require('express');
const router = express.Router();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: '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',
});

router.get('/health', async (req, res) => {

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant designed to output JSON.",
        },
        { role: "user", content: "Who won the world series in 2020?" },
      ],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
    });
  } catch (e) {
    console.log('exception:, ', e)
  }


  res.status(200).send(completion.choices[0].message.content)
})

/*

Here's the body to expect from the client

{
  "mainKeyword": "String",
  "title": "String",
  "articleLength": {
    "type": "String",
    "enum": ["small", "medium", "large", "xLarge"]
  },
  "writingStyle": {
    "type": "String",
    "enum": ["light", "professional"]
  },
  "pointOfView": {
    "type": "String",
    "enum": ["firstPersonSingular", "firstPersonPlural", "thirdPerson", "neutral"]
  },
  "realTimeResearch": "Boolean",
  "citeSources": "Boolean",
  "includeFAQs": "Boolean",
  "generateImages": "Boolean",
  "internalUrl": "String"
}

*/
router.post('/processBlogPost', (req, res) => {
  res.status(200).send("Yummy blog posts for my tummy.")
});

module.exports = router;

