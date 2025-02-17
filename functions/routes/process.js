const misc = require("./miscFunctions");
const gemini = require("./gemini");

function generateFinetune(finetuneChosen, finetune) {
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
  return finetune;
}

const processFreeTrial = (firebaseFunctions, data) => {
  data.currentUser = data.clientIp;

  let hasFreeArticle = true;

  if (!hasFreeArticle) {
    return res.status(500).send("No Free Article Remaining!");
  }

  if (data.sectionCount > 2) {
    return res.status(500).send("Error Generating Article");
  }

  return process(firebaseFunctions, data)
}

const process = async (firebaseFunctions, data) => {
  let {
    keyWord,
    sectionCount,
    tone,
    pointOfView,
    citeSources,
    outline,
    currentUser,
    jobId = -1,
    finetuneChosen,
    internalUrls,
    includeIntroduction,
    includeConclusion,
  } = data;

  let context = "",
    finetune = "",
    internalUrlContext = "",
    article = "";

  const isWithinArticleCount = await misc.doesUserHaveEnoughArticles(currentUser);

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  } else if (sectionCount > 6) {
    throw new Error("Error Generating Article");
  }

  finetune = generateFinetune(finetuneChosen, finetune);

  if (internalUrls && internalUrls.length > 0) {
    internalUrlContext = misc.doInternalUrlResearch(internalUrls, keyWord);
  }

  context = await misc.doSerpResearch(keyWord, "");

  if(outline.length == 0) {
    try {
      await misc.generateOutline(keyWord,sectionCount,context,includeIntroduction,includeConclusion);
    } catch (e) {
      throw new Error(error);
    }
  }

  outline = misc.htmlListToJson(outlineFlat);

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
    throw new Error(error);
  }

  const updatedArticleCount =
      await firebaseFunctions.decrementUserArticleCount(currentUser);
  await firebaseFunctions.updateFirebaseJob(currentUser,jobId,"context",context, "blog")
  await firebaseFunctions.updateFirebaseJob(currentUser,jobId,"outline",outline, "blog");
  await firebaseFunctions.updateFirebaseJob(currentUser,jobId,"article",article, "blog");
  await firebaseFunctions.updateFirebaseJob(currentUser,jobId,"title",keyWord, "blog");

  return { article, updatedArticleCount, title: keyWord, id: jobId };
};

module.exports = {
  process,
  processFreeTrial
}
