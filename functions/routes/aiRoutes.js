const express = require('express');
const router = express.Router();
// FIXME: in 6~ months (May, June, in there somewhere) when node 22 is out 
// see about node 22 on firebase functions & weigh up axios vs the new 
// node fetch() api. might save $/memory/second at least
const axios = require('axios');
const qs = require('qs');
require('dotenv').config()


// ------ Helper .js Deps ------
const apiFunctions = require('./apiFunctions');
const misc = require('./miscFunctions');
const vertex = require('./vertexAiFunctions')
const amazon = require('./amazonScraperFunctions')
const claude = require('./claudeFunctions')
const firebaseFunctions = require('./firebaseFunctions')


// ------ Dev Dep ------
const fs = require("node:fs");

router.post('/process', async (req, res) => {
  let { keyWord, internalUrl, wordRange, tone,
    pointOfView, realTimeResearch, citeSources, includeFAQs,
    generatedImages, generateOutline, outline, currentUser, jobId, finetuneChosen } = req.body

  // const isWithinWordCount = await misc.doesUserHaveEnoughWords(currentUser, wordRange)

  // if (!isWithinWordCount) {
  //   res.status(500).send("Word Count Limit Hit")
  // }

  let context = ""
  if (!jobId) {
    jobId = -1
  }

  const articleType = "blog"

  if (outline.length != 0) {
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    console.log('outline generated')
  } else {
    context = await misc.doSerpResearch(keyWord, "")
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
    outline = await amazon.generateOutlineClaude(keyWord, wordRange, context)
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    console.log('outline: \n', outline)
  }

  let finetune = ""
  //Finetuning requested on the article is true
  if(finetuneChosen) {
    finetune = await firebaseFunctions.findFinetuneInFirebase(currentUser, finetuneChosen.urls, finetuneChosen.title)
    if(!finetune || !finetune.length > 100) {
      try {
        finetune = await claude.generateFinetune(req.body.currentUser, req.body.urls, req.body.title)
      } catch (error) {
        console.log('Error generating finetune ', error)
        finetune = ""
      }
    }
  }

  // context = await misc.getContextFromDb(currentUser, jobId)

  console.log('generating article')
  const updatedOutline = await amazon.generateArticleClaude(outline, keyWord, context, tone, pointOfView, citeSources, finetune);

  console.log('article generated now doing gemini article')

  console.log('gemini article generated')
  const wordCount = misc.countWords(updatedOutline)
  const updatedWordCount = await firebaseFunctions.decrementUserWordCount(currentUser, wordCount)
  console.log('word count: ', wordCount)
  jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", updatedOutline)
  //Outline will now contain each section filled in with data
  res.status(200).send({ "article": updatedOutline, updatedWordCount})
});

router.post('/processAmazon', async (req, res) => {
  let { keyWord, internalUrl, tone, numberOfProducts,
    pointOfView, includeFAQs,
    generatedImages, outline, currentUser, jobId, amazonUrl, affiliate } = req.body

  const length = amazon.determineArticleLength(numberOfProducts)
  const isWithinWordCount = await misc.doesUserHaveEnoughWordsAmazon(currentUser, length)

  if (!isWithinWordCount) {
    res.status(500).send("Word Count Limit Hit")
  }

  let context = ""
  if (!jobId) {
    jobId = -1
  }

  const articleType = "amazon"

  context = await amazon.performSearch(keyWord, amazonUrl, numberOfProducts, affiliate)
  // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
  outline = await amazon.generateOutlineAmazon(keyWord, context)
  // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
  console.log('outline generated')

  console.log('generating article')
  await amazon.generateAmazonArticle(outline, keyWord, context, tone, pointOfView);

  // console.log('article generated now doing gemini article')
  // const geminiOutline = structuredClone(outline);
  // await vertex.generateArticleGemini(geminiOutline)

  // console.log('gemini article generated')
  const wordCount = amazon.countWordsClaudeBlog(outline)
  // const updatedWordCount = await firebaseFunctions.decrementUserWordCount(currentUser, wordCount)
  jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
  console.log('word count: ', wordCount)
  //Outline will now contain each section filled in with data
  console.log('outline:\n', outline)
  res.status(200).send({ "article": outline, wordCount})
});

// Route handler
router.post("/outline", async (req, res) => {
  let { keyWord, internalUrl, articleLength, wordRange, tone,
    pointOfView, realTimeResearch, citeSources, includeFAQs,
    generatedImages, generateOutline, outline, currentUser } = req.body

  let context = ""
  let jobId = -1

  const articleType = "blog"

  try {
    context = await misc.doSerpResearch(keyWord, "")
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
    const responseMessage = await misc.generateOutline(keyWord, wordRange, context)
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    res.status(200).send({ responseMessage, jobId });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(error.message || 'An error occurred');
  }
});

router.post("/finetune", async (req, res) => {
  try {
    await claude.generateFinetune(req.body.currentUser, req.body.urls, req.body.title)
  } catch (error) {
    res.status(500).send("Error: ", error)
  }
  
  res.status(200).send("Successfully added finetune to db")
})

router.get("/testGemini", async (req, res) => {
  const data = await vertex.healthCheckGemini()
  res.status(200).send(data.candidates[0].content.parts[0].text)
})

router.get("/testAmazonScraper", async (req, res) => {
  const data = await amazon.performSearch("Memory Cards", "amazon.com", 1)
  res.status(200).send(data)
})

router.get("/testClaude", async (req, res) => {
  const data = await amazon.testClaude()
  res.status(200).send(data.content[0].text)
})


router.get("/testClaudeOutline", async (req, res) => {
  const data = await amazon.generateOutlineClaude("Best ways to lose weight 2024", '2000-2500 words', "")
  res.status(200).send(data)
})

module.exports = router;

