const express = require("express");
const router = express.Router();
// FIXME: in 6~ months (May, June, in there somewhere) when node 22 is out
// see about node 22 on firebase functions & weigh up axios vs the new
// node fetch() api. might save $/memory/second at least
const axios = require("axios");
const qs = require("qs");
require("dotenv").config();
// const pino = require('pino');
// const path = require('path');
const misc = require("./miscFunctions");
const vertex = require("./vertexAiFunctions");
const amazon = require("./amazonScraperFunctions");
const claude = require("./claudeFunctions");
const openai = require("./openai");
const firebaseFunctions = require("./firebaseFunctions");
const bulkMiscFunctions = require("./bulkMiscFunctions");
const fs = require("node:fs");

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

router.post("/process", async (req, res) => {
  console.log("Entering processing of Blog Post");
  let {
    keyWord,
    internalUrl,
    wordRange,
    tone,
    pointOfView,
    realTimeResearch,
    citeSources,
    includeFAQs,
    generatedImages,
    generateOutline,
    outline,
    currentUser,
    jobId,
    finetuneChosen,
  } = req.body;

  const isWithinWordCount = await misc.doesUserHaveEnoughWords(
    currentUser,
    wordRange
  );

  if (!isWithinWordCount) {
    res.status(500).send("Word Count Limit Hit");
  }

  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  const articleType = "blog";

  if (outline.length != 0) {
    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline generated");
  } else {
    context = await misc.doSerpResearch(keyWord, "");
    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "context",
      context,
      articleType
    );
    outline = await amazon.generateOutlineClaude(keyWord, wordRange, context);
    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline: \n", outline);
  }

  let finetune = "";

  finetuneChosen.textInputs.forEach((input) => {
    finetune += input.body;
  });

  try {
    finetune += await claude.generateFinetune(finetuneChosen.urls);
  } catch (error) {
    console.log("Error generating finetune ", error);
  }
  // context = await misc.getContextFromDb(currentUser, jobId)

  console.log("generating article");
  let updatedOutline;
  try {
    updatedOutline = await amazon.generateArticleClaude(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      citeSources,
      finetune
    );
  } catch (error) {
    return res.status(500).send("Error generating article: " + error);
  }

  console.log("article generated now doing gemini article");

  console.log("gemini article generated");
  const wordCount = misc.countWords(updatedOutline);
  const updatedWordCount = await firebaseFunctions.decrementUserWordCount(
    currentUser,
    wordCount
  );
  console.log("word count: ", wordCount);
  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "outline",
    updatedOutline
  );
  //Outline will now contain each section filled in with data
  console.log("Exiting processing of Blog Post");

  res.status(200).send({ article: updatedOutline, updatedWordCount });
});

router.post("/processFreeTrial", extractIpMiddleware, async (req, res) => {
  let clientIp = req.clientIp;

  console.log("Entering processing of Blog Post");
  let {
    keyWord,
    internalUrl,
    wordRange,
    tone,
    pointOfView,
    realTimeResearch,
    citeSources,
    includeFAQs,
    generatedImages,
    generateOutline,
    outline,
    currentUser,
    jobId,
    finetuneChosen,
  } = req.body;

  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  const hasFreeArticle = await firebaseFunctions.validateIpHasFreeArticle(
    clientIp
  );

  if (!hasFreeArticle) {
    return res.status(500).send("No Free Article Remaining!");
  }

  const articleType = "blog";

  if (outline.length != 0) {
    jobId = await firebaseFunctions.updateFirebaseJobByIp(
      clientIp,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline generated");
  } else {
    context = await misc.doSerpResearch(keyWord, "");
    jobId = await firebaseFunctions.updateFirebaseJobByIp(
      clientIp,
      jobId,
      "context",
      context,
      articleType
    );
    outline = await amazon.generateOutlineClaude(keyWord, wordRange, context);
    jobId = await firebaseFunctions.updateFirebaseJobByIp(
      clientIp,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline: \n", outline);
  }

  let finetune = "";

  finetuneChosen.textInputs.forEach((input) => {
    finetune += input.body;
  });

  try {
    finetune += await claude.generateFinetune(finetuneChosen.urls);
  } catch (error) {
    console.log("Error generating finetune ", error);
  }
  // context = await misc.getContextFromDb(currentUser, jobId)

  console.log("generating article");
  let updatedOutline;
  try {
    updatedOutline = await amazon.generateArticleClaude(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      citeSources,
      finetune
    );
  } catch (error) {
    return res.status(500).send("Error generating article: ", error);
  }

  jobId = await firebaseFunctions.updateFirebaseJobByIp(
    clientIp,
    jobId,
    "outline",
    updatedOutline
  );
  //Outline will now contain each section filled in with data
  console.log("Exiting processing of Blog Post");

  await firebaseFunctions.updateIpFreeArticle(clientIp);

  res.status(200).send({ article: updatedOutline });
});

router.post("/processBulk", async (req, res) => {
  let {
    keyWord,
    internalUrl,
    tone,
    pointOfView,
    includeFAQs,
    currentUser,
    finetuneChosen,
    wordRange,
    citeSources,
    isAmazonArticle,
    amazonUrl,
    affiliate,
    numberOfProducts,
  } = req.body;

  const keyWordList = misc.parseKeyWords(keyWord);

  console.log("List: ", keyWordList);
  try {
    keyWordList.forEach((keyWord) => {
      firebaseFunctions.addToQueue(
        keyWord,
        internalUrl,
        tone,
        pointOfView,
        includeFAQs,
        currentUser,
        finetuneChosen,
        wordRange,
        citeSources,
        isAmazonArticle,
        amazonUrl,
        affiliate,
        numberOfProducts
      );
    });
  } catch (e) {
    return res.status(500).send({ error: e });
  }

  res.status(200).send({ success: keyWordList });
});

router.post("/manuallyTriggerBulkQueue", async (req, res) => {
  console.log("Entering manuallyTriggerBulkQueue");
  try {
    await bulkMiscFunctions.processNextItem();
  } catch (e) {
    console.log("Error logged at top: ", e);
    res.status(500).send({ error: e });
  }

  console.log("Leaving manuallyTriggerBulkQueue");
  res.status(200).send("success");
});

router.post("/processAmazon", async (req, res) => {
  let {
    keyWord,
    internalUrl,
    tone,
    numberOfProducts,
    pointOfView,
    includeFAQs,
    generatedImages,
    outline,
    currentUser,
    jobId,
    amazonUrl,
    affiliate,
    finetuneChosen,
  } = req.body;

  const length = amazon.determineArticleLength(numberOfProducts);
  const isWithinWordCount = await misc.doesUserHaveEnoughWordsAmazon(
    currentUser,
    length
  );

  if (!isWithinWordCount) {
    return res.status(500).send("Word Count Limit Hit");
  }

  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  const articleType = "amazon";

  context = await amazon.performSearch(
    keyWord,
    amazonUrl,
    numberOfProducts,
    affiliate
  );
  // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
  outline = await amazon.generateOutlineAmazon(keyWord, context);
  // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
  console.log("outline generated");

  let finetune = "";

  finetuneChosen.textInputs.forEach((input) => {
    finetune += input.body;
  });

  try {
    finetune += await claude.generateFinetune(finetuneChosen.urls);
  } catch (error) {
    console.log("Error generating finetune ", error);
  }

  console.log("generating article");

  try {
    await amazon.generateAmazonArticle(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      finetune
    );
  } catch (e) {
    return res.status(500).send("Error generating article: ", error);
  }

  // console.log('article generated now doing gemini article')
  // const geminiOutline = structuredClone(outline);
  // await vertex.generateArticleGemini(geminiOutline)

  // console.log('gemini article generated')
  const wordCount = amazon.countWordsClaudeAmazon(outline);
  const updatedWordCount = await firebaseFunctions.decrementUserWordCount(
    currentUser,
    wordCount
  );
  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "outline",
    outline,
    articleType
  );
  console.log("word count: ", wordCount);
  //Outline will now contain each section filled in with data
  console.log("outline:\n", outline);
  res.status(200).send({ article: outline, updatedWordCount });
});

router.post("/processAmazonFreeTrial", async (req, res) => {
  let {
    keyWord,
    internalUrl,
    tone,
    numberOfProducts,
    pointOfView,
    includeFAQs,
    generatedImages,
    outline,
    currentUser,
    jobId,
    amazonUrl,
    affiliate,
    finetuneChosen,
  } = req.body;

  let clientIp = req.clientIp;

  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  //UPDATE THIS TO USE req.clientIp
  const hasFreeArticle = await firebaseFunctions.validateIpHasFreeArticle(
    clientIp
  );

  if (!hasFreeArticle) {
    return res.status(500).send("No Free Article Remaining!");
  }

  const articleType = "amazon";

  context = await amazon.performSearch(
    keyWord,
    amazonUrl,
    numberOfProducts,
    affiliate
  );
  // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
  outline = await amazon.generateOutlineAmazon(keyWord, context);
  // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
  console.log("outline generated");

  let finetune = "";

  finetuneChosen.textInputs.forEach((input) => {
    finetune += input.body;
  });

  try {
    finetune += await claude.generateFinetune(finetuneChosen.urls);
  } catch (error) {
    console.log("Error generating finetune ", error);
  }

  console.log("generating article");

  try {
    await amazon.generateAmazonArticle(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      finetune
    );
  } catch (e) {
    return res.status(500).send("Error generating article: ", error);
  }

  jobId = await firebaseFunctions.updateFirebaseJobByIp(
    clientIp,
    jobId,
    "outline",
    outline,
    articleType
  );
  await firebaseFunctions.updateIpFreeArticle(clientIp);

  res.status(200).send({ article: outline });
});

// Route handler
router.post("/outline", async (req, res) => {
  let { keyWord, wordRange, currentUser } = req.body;

  let context = "";
  let jobId = -1;

  const articleType = "blog";

  try {
    context = await misc.doSerpResearch(keyWord, "");
    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "context",
      context,
      articleType
    );
    const responseMessage = await amazon.generateOutlineClaude(
      keyWord,
      wordRange,
      context
    );
    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "outline",
      responseMessage,
      articleType
    );
    res.status(200).send({ responseMessage, jobId });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send(error.message || "An error occurred");
  }
});

router.post("/finetune", async (req, res) => {
  try {
    await claude.saveFinetuneConfig(
      req.body.currentUser,
      req.body.urls,
      req.body.textInputs,
      req.body.name
    );
    res.status(200).send("Successfully added finetune to db");
  } catch (error) {
    res.status(500).send(`Error: ${error}`);
  }
});

router.get("/testGemini", async (req, res) => {
  const data = await vertex.healthCheckGemini();
  res.status(200).send(data.candidates[0].content.parts[0].text);
});

router.get("/testAmazonScraper", async (req, res) => {
  const data = await amazon.performSearch("Memory Cards", "amazon.com", 1);
  res.status(200).send(data);
});

router.get("/testClaude", async (req, res) => {
  const data = await amazon.testClaude();
  res.status(200).send(data.content[0].text);
});

router.get("/testClaudeOutline", async (req, res) => {
  const data = await amazon.generateOutlineClaude(
    "Best ways to lose weight 2024",
    "2000-2500 words",
    ""
  );
  res.status(200).send(data);
});

router.get("/debug-sentry", (req, res) => {
  throw new Error("My first Sentry error!");
});

router.get("/testIP", extractIpMiddleware, (req, res) => {
  res.status(200).send(req.clientIp);
});

router.get("/isFreeArticleAvailable", extractIpMiddleware, async (req, res) => {
  let ipAddress = req.clientIp;
  const isFreeArticleAvailable =
    await firebaseFunctions.validateIpHasFreeArticle(ipAddress);
  res.status(200).send({ isFreeArticleAvailable: isFreeArticleAvailable });
});

router.get("/testOpenai", extractIpMiddleware, async (req, res) => {
  const heartBeat = await openai.healthCheck();
  res.status(200).send({ isAlive: heartBeat });
});

function extractIpMiddleware(req, res, next) {
  req.clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  next();
}

module.exports = router;
