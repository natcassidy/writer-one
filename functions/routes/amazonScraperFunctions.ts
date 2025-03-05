import axios from 'axios'; // Changed from require
import 'dotenv/config'; // Changed from require and adjusted for ESM
import * as gemini from './gemini'; // Changed from require
import * as misc from './miscFunctions'; // Changed from require

interface AmazonProducts {
  title: string,
  description: string,
  image: string,
  link: string,
  price: string,
  rating: string,
  asin: string,
  reviews: any[],
}

interface AmazonOutline {
  id: string,
  tagName: string,
  content: string,
  link: string,
  imageUrl: string,
  price: string,
  rating: string,
  asin: string,
  reviews: any[],
  description: string,
}

const getProduct = async (asin) => {
  const params = {
    api_key: process.env.ASIN_API_KEY,
    type: "product",
    amazon_domain: "amazon.com",
    asin,
  };

  try {
    const response = await axios.get("https://api.asindataapi.com/request", {
      params,
    });
    // Assuming response.data contains the reviews
    return response.data; // Adjust based on actual structure of response.data
  } catch (error) {
    console.error(error);
    return null; // Return null or an appropriate error response
  }
};

const performSearch = async (
  searchTerm,
  domain = "amazon.com",
  resultCount = 5,
  affiliateID = ""
): Promise<AmazonProducts[]> => {
  const params = {
    api_key: process.env.ASIN_API_KEY,
    type: "search",
    amazon_domain: domain,
    search_term: searchTerm,
    sort_by: "featured",
    exclude_sponsored: "true",
    associate_id: affiliateID,
  };

  try {
    const response = await axios.get("https://api.asindataapi.com/request", {
      params,
    });
    let searchResults = response.data.search_results;

    // Limit the searchResults to the specified resultCount
    searchResults = searchResults.slice(0, resultCount);

    const resultProductArray = await Promise.all(
      searchResults.map(async (result) => {
        const productData = await getProduct(result.asin);
        // let reviews = []; // Default to an empty array if no reviews are found

        let imageUrl;
        let reviews = [];
        if (productData && productData.product.main_image.link) {
          imageUrl = productData.product.main_image.link;
        }

        if (productData && productData.product.top_reviews) {
          reviews = productData.product.top_reviews;
        }
        // // Check if reviewsData is not null and has a 'reviews' property before accessing it
        // if (reviewsData && reviewsData.reviews) {
        //   reviews = reviewsData.reviews;
        // }

        return {
          title: result.title,
          description: result.description,
          image: imageUrl,
          link: result.link,
          price: result.price,
          rating: result.rating,
          asin: result.asin,
          reviews: reviews, // Now safely set to either an empty array or the actual reviews
        };
      })
    );

    return resultProductArray;
  } catch (error) {
    console.error(error);
    return []; // Return an empty array or appropriate error handling
  }
};

const generateOutlineAmazon = async (keyWord: string, context: AmazonProducts[]): Promise<AmazonOutline[]> => {
  // const completion = await generateOutlineWithAI(keyWord);
  // const fetchedTitle = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments)
  // const title = fetchedTitle.title
  const reviewOutline = [
    {
      id: "1",
      tagName: "h1",
      content: keyWord,
      link: "",
      imageUrl: "",
      price: "",
      rating: "",
      asin: "",
      reviews: [],
      description: "",
    },
  ];

  for (let i = 0; i < context.length; i++) {
    reviewOutline.push({
      id: String(i + 2),
      tagName: "h2",
      content: context[i].title,
      link: context[i].link,
      imageUrl: context[i].image,
      price: context[i].price,
      rating: context[i].rating,
      asin: context[i].asin,
      reviews: context[i].reviews,
      description: context[i].description,
    });
  }

  return reviewOutline;
};

const generateAmazonArticle = async (
  outline: AmazonOutline[],
  keyWord: string,
  context: AmazonProducts[],
  tone: string,
  pointOfView: string,
  finetune: string
) => {
  const promises: Promise<void>[] = [];
  try {
    let introContextString: string = "";
    for (const section of outline) {
      if (section.tagName == "h2") {
        introContextString += misc.generateContextStringAmazonIntro(section);
      }
    }

    for (const section of outline) {
      let contextString: string = "";
      let sectionType: string = "";
      let promise: Promise<void>;
      if (section.tagName == "h1") {
        sectionType = "intro";
        promise = generateSectionWithRetry(
          section,
          keyWord,
          introContextString,
          tone,
          pointOfView,
          finetune,
          sectionType
        );
      } else if (section.tagName == "h2") {
        contextString = misc.generateContextStringAmazon(section);
        sectionType = "section";
        promise = generateSectionWithRetry(
          section,
          keyWord,
          contextString,
          tone,
          pointOfView,
          finetune,
          sectionType
        );
      } else {
        sectionType = "conclusion";
      }
      promises.push(promise);
    }

    await Promise.all(promises);

    const markdownArticle = generateMarkDown(outline);

    return markdownArticle;
  } catch (e) {
    console.log("Error: ", e);
    throw new Error(e);
  }
};

const generateMarkDown = (resolvedSections) => {
  let finalArticle = "";
  for (const section of resolvedSections) {
    if (section.tagName == "h1") {
      finalArticle += `# ${section.content}\n`;
      finalArticle += `${section.summary}\n`;
    } else if (section.tagName == "h2") {
      finalArticle += `![${section.content}](${section.imageUrl} '${section.content}')\n`;
      finalArticle += `[${section.content}](${section.link})\n`;
      finalArticle += `${section.summary}\n`;
    }
  }

  return finalArticle;
};

const generateSectionWithRetry = async (
  section,
  keyWord,
  contextString,
  tone,
  pointOfView,
  finetune,
  sectionType
): Promise<void> => {
  let attempt: number = 0;
  while (attempt < 3) {
    try {
      if (sectionType === "intro") {
        const completion: string = await gemini.generateAmazonIntro(
          section.content,
          keyWord,
          contextString,
          tone,
          pointOfView,
          finetune
        );
        section.summary = completion;
        return; // Exit the function if successful
      } else if (sectionType === "section") {
        const completion: string = await gemini.generateAmazonSection(
          section.content,
          keyWord,
          contextString,
          tone,
          pointOfView,
          finetune
        );
        section.summary = completion;
        return; // Exit the function if successful
      } else {
        // const completion = await gemini.generateAmazonConclusion(
        //   section.content,
        //   keyWord,
        //   contextString,
        //   tone,
        //   pointOfView,
        //   finetune
        // );
        // section.summary = completion;
        return; // Exit the function if successful
      }
    } catch (error) {
      attempt++;
      if (attempt >= 3) {
        console.error("Failed to generate section after 3 attempts:", error);
        throw new Error("Failed to generate Amazon article section");
      }
    }
  }
};

export { performSearch };
export { generateOutlineAmazon };
export { generateAmazonArticle };
