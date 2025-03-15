import * as misc from "./miscFunctions";
import * as gemini from "./gemini";
import * as firebaseFunctions from "./firebaseFunctions";
import {updateFirebaseJobByIp} from "./firebaseFunctionsNotSignedIn";
import {updateFirebaseJob} from "./firebaseFunctions";
import {htmlListToJson, StructuredOutline, UnStructuredSection} from "./miscFunctions";

interface Article {
  article: string,
  updatedArticleCount: number,
  title: string,
  id: number
}

export interface ArticleParams {
  keyWord: string,
  sectionCount: number,
  tone: string,
  pointOfView: string,
  citeSources: boolean,
  outline: UnStructuredSection[],
  currentUser: string,
  jobId: number,
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
    jobId = -1,
    finetuneChosen,
    internalUrls,
  } = data;

  let context: string = "",
    finetune: Promise<string>,
    article: string = "";

  const isWithinArticleCount: boolean = await misc.doesUserHaveEnoughArticles(currentUser);

  if (!isWithinArticleCount) {
    throw new Error("Article Count Limit Hit");
  } else if (sectionCount > 6) {
    throw new Error("Error Generating Article");
  }

  finetune = generateFinetune(finetuneChosen);

  context = await misc.doSerpResearch(keyWord, "");

  if(outline.length == 0) {
    try {
      outline = await misc.generateOutline(keyWord,sectionCount,context);
    } catch (e) {
      throw new Error(e);
    }
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

  const updatedArticleCount: number =
      await firebaseFunctions.decrementUserArticleCount(currentUser);

  if(isFreeTrial) {
    await updateFirebaseJobByIp(currentUser,jobId,"context",context, "blog")
    await updateFirebaseJobByIp(currentUser,jobId,"outline",modifiedOutline, "blog");
    await updateFirebaseJobByIp(currentUser,jobId,"article",article, "blog");
    await updateFirebaseJobByIp(currentUser,jobId,"title",keyWord, "blog");
  } else {
    await updateFirebaseJob(currentUser,jobId,"context",context, "blog")
    await updateFirebaseJob(currentUser,jobId,"outline",modifiedOutline, "blog");
    await updateFirebaseJob(currentUser,jobId,"article",article, "blog");
    await updateFirebaseJob(currentUser,jobId,"title",keyWord, "blog");
  }

  return { article, updatedArticleCount, title: keyWord, id: jobId };
};

export { processArticle };
export { processFreeTrial };