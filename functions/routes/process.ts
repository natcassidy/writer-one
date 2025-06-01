import * as misc from "./miscFunctions.js";
import * as gemini from "./gemini.js";
import * as firebaseFunctions from "./firebaseFunctions.js";
import {updateFirebaseJobByIp} from "./firebaseFunctionsNotSignedIn.js";
import {updateFirebaseJob} from "./firebaseFunctions.js";
import {htmlListToJson, StructuredOutline, UnStructuredSection} from "./miscFunctions.js";

interface Article {
  article: string,
  updatedArticleCount: number,
  title: string,
  id: string
}

export interface ArticleParams {
  keyWord: string,
  sectionCount: number,
  tone: string,
  pointOfView: string,
  citeSources: boolean,
  outline: UnStructuredSection[],
  currentUser: string,
  jobId: string,
  finetuneChosen: FinetuneParam,
  internalUrls: string,
  clientIp: string
}

export interface FinetuneParam {
  textInputs: TextInput[];
}

interface TextInput {
  body: string
}

function generateFinetune(finetuneParams: FinetuneParam): Promise<string> {
  if (
      finetuneParams.textInputs &&
      finetuneParams.textInputs.length != 0 &&
      finetuneParams.textInputs[0].body != ""
  ) {
    let finetune: Promise<string>

    try {
      finetune = gemini.generateFineTuneService(finetuneParams.textInputs);
    } catch (error) {
      console.log("Error generating finetune ", error);
    }
    return finetune;
  } else {
    return Promise.resolve("")
  }
}

const processFreeTrial = (data: ArticleParams): Promise<Article> => {
  if(data.clientIp == "" || !data.clientIp) {
    data.clientIp = "127.0.0.1"
  }

  data.currentUser = data.clientIp;

  let hasFreeArticle: boolean = true;

  if (!hasFreeArticle) {
    throw Error("No Free Article Remaining!");
  }

  if (data.sectionCount > 2) {
    throw Error("Error Generating Article");
  }

  return processArticle(true, data)
}


const processArticle = async (isFreeTrial: boolean, data: ArticleParams): Promise<Article> => {
  console.log("processing article now");
  let {
    keyWord,
    sectionCount,
    tone,
    pointOfView,
    citeSources,
    outline,
    currentUser,
    jobId = "-1",
    finetuneChosen,
    internalUrls,
  } = data;

  if(jobId === "") {
    jobId = "-1";
  }

  let context: string = "",
    finetune: Promise<string>,
    article: string = "";

  let isWithinArticleCount: boolean = false;
  if(isFreeTrial) {
    isWithinArticleCount = await firebaseFunctions.validateIpHasFreeArticle(data.clientIp);
  } else {
    isWithinArticleCount = await misc.doesUserHaveEnoughArticles(currentUser);
  }

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  } else if (sectionCount > 6) {
    throw new Error("Error Generating Article");
  }

  finetune = generateFinetune(finetuneChosen);

  // context = await misc.doSerpResearch(keyWord, "");

  if(outline.length == 0) {
    try {
      outline = await misc.generateOutline(keyWord,sectionCount,context);
    } catch (e) {
      throw new Error(e);
    }
  }

  if(isFreeTrial) {
    jobId = await updateFirebaseJobByIp(
        data.clientIp,
        jobId,
        "outline",
        outline,
        "blog"
    );
  }

// This needs to simply be added to the above method
  let modifiedOutline: StructuredOutline = htmlListToJson(outline);

  try {
    article = await misc.generateArticle(
      modifiedOutline,
      keyWord,
      context,
      tone,
      pointOfView,
      citeSources,
      finetune,
      internalUrls
    );
  } catch (error) {
    throw new Error(error);
  }

  let updatedArticleCount: number = 0;

  if(isFreeTrial) {
    await updateFirebaseJobByIp(currentUser,jobId,"context",context, "blog")
    await updateFirebaseJobByIp(currentUser,jobId,"outline",modifiedOutline, "blog");
    await updateFirebaseJobByIp(currentUser,jobId,"article",article, "blog");
    await updateFirebaseJobByIp(currentUser,jobId,"title",keyWord, "blog");

    await firebaseFunctions.updateIpFreeArticle(data.clientIp);
  } else {
    updatedArticleCount =
        await firebaseFunctions.decrementUserArticleCount(currentUser);

    await updateFirebaseJob(currentUser,jobId,"context",context, "blog")
    await updateFirebaseJob(currentUser,jobId,"outline",modifiedOutline, "blog");
    await updateFirebaseJob(currentUser,jobId,"article",article, "blog");
    await updateFirebaseJob(currentUser,jobId,"title",keyWord, "blog");
  }

  return { article, updatedArticleCount, title: keyWord, id: jobId };
};

export { processArticle };
export { processFreeTrial };