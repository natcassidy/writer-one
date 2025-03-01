import * as misc from "./miscFunctions";
import * as gemini from "./gemini";
import * as firebaseFunctions from "./firebaseFunctions";
import * as firebaseFunctionsNotSignedIn from "./firebaseFunctions";
import {updateFirebaseJobByIp} from "./firebaseFunctionsNotSignedIn";
import {updateFirebaseJob} from "./firebaseFunctions";
import {htmlListToJson} from "./miscFunctions";

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

const processFreeTrial = (data) => {
  data.currentUser = data.clientIp;

  let hasFreeArticle = true;

  if (!hasFreeArticle) {
    throw Error("No Free Article Remaining!");
  }

  if (data.sectionCount > 2) {
    throw Error("Error Generating Article");
  }

  return processArticle(true, data)
}

const processArticle = async (isFreeTrial, data) => {
  console.log("processing article now");
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
    internalUrlContext = await misc.doInternalUrlResearch(internalUrls, keyWord);
  }

  context = await misc.doSerpResearch(keyWord, "");

  if(outline.length == 0) {
    try {
      outline = await misc.generateOutline(keyWord,sectionCount,context);
    } catch (e) {
      throw new Error(e);
    }
  }

  outline = htmlListToJson(outline);

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

  if(isFreeTrial) {
    await updateFirebaseJobByIp(currentUser,jobId,"context",context, "blog")
    await updateFirebaseJobByIp(currentUser,jobId,"outline",outline, "blog");
    await updateFirebaseJobByIp(currentUser,jobId,"article",article, "blog");
    await updateFirebaseJobByIp(currentUser,jobId,"title",keyWord, "blog");
  } else {
    await updateFirebaseJob(currentUser,jobId,"context",context, "blog")
    await updateFirebaseJob(currentUser,jobId,"outline",outline, "blog");
    await updateFirebaseJob(currentUser,jobId,"article",article, "blog");
    await updateFirebaseJob(currentUser,jobId,"title",keyWord, "blog");
  }

  return { article, updatedArticleCount, title: keyWord, id: jobId };
};

export { processArticle };
export { processFreeTrial };