const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).send("I'm alive")
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

