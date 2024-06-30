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
const gemini = require("./gemini");
const firebaseFunctions = require("./firebaseFunctions");
const bulkMiscFunctions = require("./bulkMiscFunctions");
const fs = require("node:fs");
const { P } = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf");

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
    sectionCount,
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
    internalUrls,
    includeIntroduction,
    includeConclusion,
  } = req.body;

  const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(
    currentUser
  );

  if (!isWithinArticleCount) {
    return res.status(500).send("Article Count Limit Hit");
  }

  if (sectionCount > 6) {
    return res.status(500).send("Error Generating Article");
  }

  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  const articleType = "blog";

  let finetune;
  let internalUrlContext;

  if (outline.length != 0) {
    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline generated");

    if (
      finetuneChosen.textInputs &&
      finetuneChosen.textInputs.length != 0 &&
      finetuneChosen.textInputs[0].body != ""
    ) {
      try {
        finetune = gemini.generateFineTuneService(finetuneChosen.textInputs);
      } catch (error) {
        console.log("Error generating finetune ", error);
      }
    }
    if (internalUrls && internalUrls.length > 0) {
      internalUrlContext = misc.doInternalUrlResearch(internalUrls, keyWord);
    }

    context = await misc.doSerpResearch(keyWord, "");

    outline = misc.htmlListToJson(outline);
  } else {
    if (
      finetuneChosen.textInputs &&
      finetuneChosen.textInputs.length != 0 &&
      finetuneChosen.textInputs[0].body != ""
    ) {
      try {
        finetune = gemini.generateFineTuneService(finetuneChosen.textInputs);
      } catch (error) {
        console.log("Error generating finetune ", error);
      }
    }

    if (internalUrls && internalUrls.length > 0) {
      internalUrlContext = misc.doInternalUrlResearch(internalUrls, keyWord);
    }

    context = await misc.doSerpResearch(keyWord, "");

    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "context",
      context,
      articleType
    );

    const outlineFlat = await misc.generateOutline(
      keyWord,
      sectionCount,
      context,
      includeIntroduction,
      includeConclusion
    );

    outline = misc.htmlListToJson(outlineFlat);

    jobId = await firebaseFunctions.updateFirebaseJob(
      currentUser,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline: \n", outline);
  }

  console.log("generating article");
  let article = "";
  try {
    article = await misc.generateArticle(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      citeSources,
      finetune,
      internalUrlContext,
      internalUrls
    );
  } catch (error) {
    return res.status(500).send("Error generating article: " + error);
  }

  const updatedArticleCount = await firebaseFunctions.decrementUserArticleCount(
    currentUser
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "article",
    article
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "title",
    keyWord
  );
  //Outline will now contain each section filled in with data
  console.log("Exiting processing of Blog Post");

  res
    .status(200)
    .send({ article, updatedArticleCount, title: keyWord, id: jobId });
});

router.post("/processFreeTrial", extractIpMiddleware, async (req, res) => {
  let clientIp = req.clientIp;

  console.log("Entering processing of Blog Post");
  let {
    keyWord,
    internalUrl,
    sectionCount,
    tone,
    pointOfView,
    realTimeResearch,
    citeSources,
    includeFAQs,
    generatedImages,
    generateOutline,
    outline,
    jobId,
    finetuneChosen,
    internalUrls,
  } = req.body;

  let context = "";
  let internalUrlContext = "";
  if (!jobId) {
    jobId = -1;
  }

  let hasFreeArticle = false;

  try {
    hasFreeArticle = await firebaseFunctions.validateIpHasFreeArticle(clientIp);
  } catch (e) {
    return res.status(500).send("Error retrieving data");
  }

  if (!hasFreeArticle) {
    return res.status(500).send("No Free Article Remaining!");
  }

  if (sectionCount > 2) {
    return res.status(500).send("Error Generating Article");
  }

  const articleType = "blog";
  let finetune = "";

  if (outline.length != 0) {
    jobId = await firebaseFunctions.updateFirebaseJobByIp(
      clientIp,
      jobId,
      "outline",
      outline,
      articleType
    );
    console.log("outline generated");

    if (
      finetuneChosen.textInputs &&
      finetuneChosen.textInputs.length != 0 &&
      finetuneChosen.textInputs[0].body != ""
    ) {
      try {
        finetune = gemini.generateFineTuneService(finetuneChosen.textInputs);
      } catch (error) {
        console.log("Error generating finetune ", error);
      }
    }

    if (internalUrls && internalUrls.length > 0) {
      internalUrlContext = misc.doInternalUrlResearch(internalUrls, keyWord);
    }

    context = await misc.doSerpResearch(keyWord, "");

    outline = misc.htmlListToJson(outline);
  } else {
    if (
      finetuneChosen.textInputs &&
      finetuneChosen.textInputs.length != 0 &&
      finetuneChosen.textInputs[0].body != ""
    ) {
      try {
        finetune = gemini.generateFineTuneService(finetuneChosen.textInputs);
      } catch (error) {
        console.log("Error generating finetune ", error);
      }
    }

    if (internalUrls && internalUrls.length > 0) {
      internalUrlContext = misc.doInternalUrlResearch(internalUrls, keyWord);
    }

    context = await misc.doSerpResearch(keyWord, "");
    jobId = await firebaseFunctions.updateFirebaseJobByIp(
      clientIp,
      jobId,
      "context",
      context,
      articleType
    );
    const outlineFlat = await misc.generateOutline(
      keyWord,
      sectionCount,
      context,
      includeIntroduction,
      includeConclusion
    );

    outline = misc.htmlListToJson(outlineFlat);

    jobId = await firebaseFunctions.updateFirebaseJobByIp(
      clientIp,
      jobId,
      "outline",
      outline,
      articleType
    );
  }

  console.log("generating article");
  let updatedOutline;
  try {
    updatedOutline = await misc.generateArticle(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      citeSources,
      finetune,
      internalUrls
    );
  } catch (error) {
    return res.status(500).send("Error generating article: ", error);
  }

  jobId = await firebaseFunctions.updateFirebaseJobByIp(
    clientIp,
    jobId,
    "article",
    article
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    clientIp,
    jobId,
    "title",
    keyWord
  );
  //Outline will now contain each section filled in with data
  console.log("Exiting processing of Blog Post");

  await firebaseFunctions.updateIpFreeArticle(clientIp);

  res.status(200).send({ article, title: keyWord, id: jobId });
});

router.post("/processBulk", async (req, res) => {
  let {
    keyWord,
    internalUrls,
    tone,
    pointOfView,
    includeFAQs,
    currentUser,
    finetuneChosen,
    sectionCount,
    citeSources,
    isAmazonArticle,
    amazonUrl,
    affiliate,
    numberOfProducts,
    includeIntroduction,
    includeConclusion,
  } = req.body;

  console.log("Processing bulk blog, adding to queue");
  const keyWordList = misc.parseKeyWords(keyWord);

  if (sectionCount > 6) {
    return res.status(500).send("Error Generating Article");
  }

  console.log("List: ", keyWordList);
  try {
    keyWordList.forEach((keyWord) => {
      firebaseFunctions.addToQueue(
        keyWord,
        internalUrls,
        tone,
        pointOfView,
        includeFAQs,
        currentUser,
        finetuneChosen,
        sectionCount,
        citeSources,
        isAmazonArticle,
        amazonUrl,
        affiliate,
        numberOfProducts,
        includeIntroduction,
        includeConclusion
      );
    });
  } catch (e) {
    console.log("Error adding to queue: ", e);
    return res.status(500).send({ error: e });
  }

  console.log("Processing bulk blog, finished adding to queue");
  res.status(200).send({ success: keyWordList });
});

router.post("/manuallyTriggerBulkQueue", async (req, res) => {
  console.log("Entering manuallyTriggerBulkQueue");
  try {
    await bulkMiscFunctions.processNextItem();
  } catch (e) {
    console.log("Error logged at top: ", e);
    return res.status(500).send({ error: e });
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
  const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(
    currentUser
  );

  if (!isWithinArticleCount) {
    return res.status(500).send("Word Count Limit Hit");
  }

  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  const articleType = "amazon";
  let finetune = "";
  if (
    finetuneChosen.textInputs &&
    finetuneChosen.textInputs.length != 0 &&
    finetuneChosen.textInputs[0].body != "" &&
    finetuneChosen.textInputs[0].body != ""
  ) {
    try {
      finetune = gemini.generateFineTuneService(finetuneChosen.textInputs);
    } catch (error) {
      console.log("Error generating finetune ", error);
    }
  }

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

  console.log("generating article");

  let finishedArticle = "";
  try {
    finishedArticle = await amazon.generateAmazonArticle(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      finetune
    );
  } catch (e) {
    console.log("Error: ", e);
    return res.status(500).send({ error: e });
  }
  const updatedArticleCount = await firebaseFunctions.decrementUserArticleCount(
    currentUser
  );
  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "article",
    finishedArticle,
    articleType
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "title",
    keyWord,
    articleType
  );
  console.log("word count: ", updatedArticleCount);
  //Outline will now contain each section filled in with data
  console.log("finished article:\n", finishedArticle);
  res.status(200).send({
    article: finishedArticle,
    updatedArticleCount,
    title: keyWord,
    id: jobId,
  });
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

  let hasFreeArticle = false;

  try {
    hasFreeArticle = await firebaseFunctions.validateIpHasFreeArticle(clientIp);
  } catch (e) {
    return res.status(500).send("Error retrieving data");
  }

  if (!hasFreeArticle) {
    return res.status(500).send("No Free Article Remaining!");
  }

  const articleType = "amazon";
  let finetune = "";
  if (
    finetuneChosen.textInputs &&
    finetuneChosen.textInputs.length != 0 &&
    finetuneChosen.textInputs[0].body != "" &&
    finetuneChosen.textInputs[0].body != ""
  ) {
    try {
      finetune = gemini.generateFineTuneService(finetuneChosen.textInputs);
    } catch (error) {
      console.log("Error generating finetune ", error);
    }
  }

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

  console.log("generating article");

  let finishedArticle = "";
  try {
    finishedArticle = await amazon.generateAmazonArticle(
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
    "article",
    finishedArticle,
    articleType
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    clientIp,
    jobId,
    "title",
    keyWord,
    articleType
  );

  await firebaseFunctions.updateIpFreeArticle(clientIp);

  res.status(200).send({ article: finishedArticle, title: keyWord, id: jobId });
});

// Route handler
router.post("/outline", async (req, res) => {
  let { keyWord, sectionCount, currentUser } = req.body;

  let context = "";
  let jobId = -1;

  const articleType = "blog";

  try {
    context = await misc.doSerpResearch(keyWord, "");
    if (currentUser) {
      jobId = await firebaseFunctions.updateFirebaseJob(
        currentUser,
        jobId,
        "context",
        context,
        articleType
      );
    }

    const responseMessage = await misc.generateOutline(
      keyWord,
      sectionCount,
      context
    );

    if (currentUser) {
      jobId = await firebaseFunctions.updateFirebaseJob(
        currentUser,
        jobId,
        "outline",
        responseMessage,
        articleType
      );
    }

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
    "2",
    ""
  );
  res.status(200).send(data);
});

router.get("/debug-sentry", (req, res) => {
  throw new Error("My first Sentry error!");
});

router.post("/addArticleToNewUser", async (req, res) => {
  let { user } = req.body;

  await firebaseFunctions.addArticleFieldToUserDocument(user);

  res.status(200).send("Success");
});

router.put("/saveArticle", async (req, res) => {
  let { user, id, article } = req.body;

  console.log("Saving article");
  try {
    await firebaseFunctions.updateFirebaseJob(user, id, "article", article);
  } catch (error) {
    res.status(500).send("Error saving article");
  }

  res.status(200).send("Success");
});

router.get("/testIP", extractIpMiddleware, (req, res) => {
  res.status(200).send(req.clientIp);
});

router.get("/isFreeArticleAvailable", extractIpMiddleware, async (req, res) => {
  let ipAddress = req.clientIp;
  let isFreeArticleAvailable;
  try {
    isFreeArticleAvailable = await firebaseFunctions.validateIpHasFreeArticle(
      ipAddress
    );
  } catch (e) {
    return res.status(500).send("Error retrieving data");
  }

  res.status(200).send({ isFreeArticleAvailable: isFreeArticleAvailable });
});

router.get("/testOpenai", extractIpMiddleware, async (req, res) => {
  const heartBeat = await openai.healthCheck();
  res.status(200).send({ isAlive: heartBeat });
});

router.post("/testFinetune", async (req, res) => {
  const results = await gemini.generateFineTuneService(req.body.articles);
  res.status(200).send({ results });
});

router.post("/testGemini", async (req, res) => {
  const results = await gemini.testGemini();
  res.status(200).send({ results });
});

router.post("/processRewrite", async (req, res) => {
  const targetSection = req.body.text;
  const instructions = req.body.modelInstructions;

  try {
    const response = await gemini.processRewrite(targetSection, instructions);
    console.log("Response: \n", response);
    res.status(200).send({ rewrittenText: response });
  } catch (e) {
    res.status(500).send("Error rewriting article");
  }
});

function extractIpMiddleware(req, res, next) {
  req.clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  next();
}

module.exports = router;
