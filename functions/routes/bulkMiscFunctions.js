const firebaseFunctions = require("./firebaseFunctions");
const misc = require("./miscFunctions");
const amazon = require("./amazonScraperFunctions");
const claude = require("./claudeFunctions");

const processBlogArticleFromBulk = async (
  keyWord,
  internalUrls,
  tone,
  pointOfView,
  includeFAQs,
  currentUser,
  finetuneChosen,
  sectionCount,
  citeSources,
  includeIntroduction,
  includeConclusion
) => {
  const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(
    currentUser
  );

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  }

  if (sectionCount > 6) {
    throw new Error("Error Generating Article");
  }

  let jobId;
  let context = "";
  if (!jobId) {
    jobId = -1;
  }

  const articleType = "blog";

  let finetune;
  let internalUrlContext;

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

  console.log("generating article");
  let article;
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
  } catch (e) {
    throw new Error(e);
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
  //Outline will now contain each section filled in with data
  return article;
};

const processAmazonArticleFromBulk = async (
  keyWord,
  internalUrl,
  tone,
  pointOfView,
  includeFAQs,
  currentUser,
  finetuneChosen,
  sectionCount,
  citeSources,
  itemId,
  isAmazonArticle,
  amazonUrl,
  affiliate,
  numberOfProducts
) => {
  const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(
    currentUser
  );

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  }

  let jobId;
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
    throw new Error(e);
  }

  const updatedArticleCount = await firebaseFunctions.decrementUserArticleCount(
    currentUser
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "outline",
    outline,
    articleType
  );
  //Outline will now contain each section filled in with data
  console.log("outline:\n", outline);
  return outline;
};

const processNextItem = async () => {
  let itemIdProcess;

  try {
    const {
      keyWord,
      internalUrls,
      tone,
      pointOfView,
      includeFAQs,
      currentUser,
      finetuneChosen,
      sectionCount,
      citeSources,
      itemId,
      isAmazonArticle,
      amazonUrl,
      affiliate,
      numberOfProducts,
    } = await firebaseFunctions.getNextItemFirebase();
    firebaseFunctions.markItemInProgress(itemId);
    itemIdProcess = itemId;

    if (isAmazonArticle) {
      const article = await processAmazonArticleFromBulk(
        keyWord,
        internalUrls,
        tone,
        pointOfView,
        includeFAQs,
        currentUser,
        finetuneChosen,
        sectionCount,
        citeSources,
        itemId,
        isAmazonArticle,
        amazonUrl,
        affiliate,
        numberOfProducts
      );
    } else {
      const article = await processBlogArticleFromBulk(
        keyWord,
        internalUrls,
        tone,
        pointOfView,
        includeFAQs,
        currentUser,
        finetuneChosen,
        sectionCount,
        citeSources
      );
    }

    await firebaseFunctions.markItemCompleted(itemId);
  } catch (e) {
    console.log("Error processing bulk Article: ", e);
    await firebaseFunctions.markItemInError(itemIdProcess);
    throw new Error(e);
  }
};

module.exports = {
  processNextItem,
};
