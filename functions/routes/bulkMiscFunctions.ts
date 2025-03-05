import * as firebaseFunctions from "./firebaseFunctions";
import * as misc from './miscFunctions';
import * as amazon from "./amazonScraperFunctions";
import {generateFineTuneService} from "./gemini";
import {StructuredOutline, UnStructuredSection} from "./miscFunctions";

const processBlogArticleFromBulk = async (
  keyWord,
  internalUrls,
  tone,
  pointOfView,
  includeFAQs,
  currentUser,
  finetuneChosen,
  sectionCount,
  citeSources
): Promise<string> => {
  const isWithinArticleCount: boolean = await misc.doesUserHaveEnoughArticles(
    currentUser
  );

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  }

  if (sectionCount > 6) {
    throw new Error("Error Generating Article");
  }

  let jobId: string;
  let context: string = "";

  if (!jobId) {
    jobId = "-1"";
  }

  const articleType: string = "blog";

  let finetune:  Promise<string>;

  if (
    finetuneChosen.textInputs &&
    finetuneChosen.textInputs.length != 0 &&
    finetuneChosen.textInputs[0].body != ""
  ) {
    try {
      finetune = generateFineTuneService(finetuneChosen.textInputs);
    } catch (error) {
      console.log("Error generating finetune ", error);
    }
  }

  context = await misc.doSerpResearch(keyWord, "");

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "context",
    context,
    articleType
  );

  const outlineFlat: UnStructuredSection[] = await misc.generateOutline(
    keyWord,
    sectionCount,
    context
  );

  const outline: StructuredOutline = misc.htmlListToJson(outlineFlat);

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "outline",
    outline,
    articleType
  );
  console.log("outline: \n", outline);

  console.log("generating article");
  let article: string;
  try {
    article = await misc.generateArticle(
      outline,
      keyWord,
      context,
      tone,
      pointOfView,
      citeSources,
      finetune,
      internalUrls
    );
  } catch (e) {
    throw new Error(e);
  }

  const updatedArticleCount: number = await firebaseFunctions.decrementUserArticleCount(
    currentUser
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "article",
    article,
    "blog"
  );

  jobId = await firebaseFunctions.updateFirebaseJob(
    currentUser,
    jobId,
    "title",
    keyWord,
    "blog"
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
): Promise<string> => {
  const isWithinArticleCount: boolean = await misc.doesUserHaveEnoughArticles(
    currentUser
  );

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  }

  let jobId: string;
  let context: string;
  if (!jobId) {
    jobId = "-1";
  }

  const articleType: string = "amazon";

  let finetune: string;
  if (
    finetuneChosen.textInputs &&
    finetuneChosen.textInputs.length != 0 &&
    finetuneChosen.textInputs[0].body != "" &&
    finetuneChosen.textInputs[0].body != ""
  ) {
    try {
      finetune = await generateFineTuneService(finetuneChosen.textInputs);
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
  const outline = await amazon.generateOutlineAmazon(keyWord, context);
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
    throw new Error(e);
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

  return finishedArticle;
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
    } = (await firebaseFunctions.getNextItemFirebase()) as any;
    firebaseFunctions.markItemInProgress(itemId);
    itemIdProcess = itemId;

    if (isAmazonArticle) {
      const article: string = await processAmazonArticleFromBulk(
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

export { processNextItem };
