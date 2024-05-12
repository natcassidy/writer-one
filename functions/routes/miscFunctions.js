const cheerio = require("cheerio");
const axios = require("axios");
const qs = require("qs");
const admin = require("firebase-admin");
require("dotenv").config();
const claude = require("./claudeFunctions");
const openai = require("./openai");
// const pino = require('pino');
// const path = require('path');

// const logger = pino({
//     transport: {
//         target: "pino-pretty",
//         options: {
//             ignore: "pid,hostname",
//             destination: path.join(__dirname, 'logger-output.log'),
//             colorize: false
//         }
//     }
// })

const stripEscapeChars = (string) => {
  // TODO: Check this regex to make sure it doesn't break anything.
  // I got it from the BrightData scraper and it clearly filters out
  // junk but I'm not sure if it'll cause a problem.
  let junkRegex = /([:\u200F\u200E\f\n\r\t\v]| {2,})/g;
  string = string.replace(junkRegex, "");
  // return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // why was I dumb enough to replace the dumb stuff with .'s when I
  // could have used something I wouldn't have to worry about confusing
  // with the actual data?

  // TODO: check the use of <?> instead of . later to make sure it fixes the problem
  // what is something else I could use that would be even less problematic?
  string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, "<?>");
  // string = string.replace(/<?>{4,}/g, '<?>'); // FIXME: make sure this works
  // return string.replace(/[<?>\s]{5,}/g, '<?> '); // FIXME: make sure this works
};

function stripToText(html) {
  if (!html) {
    return "";
  }
  const $ = cheerio.load(html);
  $("script").remove();
  $("noscript").remove();
  $("style").remove();
  $("svg").remove();
  $("img").remove();
  $("nav").remove();
  $("iframe").remove();
  $("form").remove();
  $("input").remove();
  $("button").remove();
  $("select").remove();
  $("textarea").remove();
  $("audio").remove();
  $("video").remove();
  $("canvas").remove();
  $("embed").remove();

  //remove html comments
  $("*")
    .contents()
    .each(function () {
      if (this.nodeType === 8) {
        $(this).remove();
      }
    });

  // return $('body').prop('innerText');
  // return $('body').prop('innerHTML');
  return $("body").prop("textContent");
}

const checkIfStore = (string) => {
  lString = string.toLowerCase();
  if (lString.includes("add to cart")) {
    return true;
  } else if (lString.includes("free shipping on orders over")) {
    return true;
  } else {
    return false;
  }
};

const removeBadTagsRegex = (string) => {
  string = string.replace(/<img[^>]*>/g, ""); // images
  string = string.replace(/<script[^>]*>/g, ""); // script
  string = string.replace(/<style[^>]*>/g, ""); // style
  string = string.replace(/<svg[^>]*>/g, ""); // svg
  string = string.replace(/<iframe[^>]*>/g, ""); // iframe
  string = string.replace(/<form[^>]*>/g, ""); // form
  string = string.replace(/<input[^>]*>/g, ""); // input
  string = string.replace(/<button[^>]*>/g, ""); // button
  string = string.replace(/<select[^>]*>/g, ""); // select
  string = string.replace(/<textarea[^>]*>/g, ""); // textarea
  string = string.replace(/<audio[^>]*>/g, ""); // audio
  string = string.replace(/<video[^>]*>/g, ""); // video
  string = string.replace(/<canvas[^>]*>/g, ""); // canvas
  string = string.replace(/<embed[^>]*>/g, ""); // embed
  string = string.replace(/<!--[^>]*-->/g, ""); // html comments
  return;
};

const stripDotDotDotItems = (string) => {
  // return string.replace(/\.{3}[A-z]{,25}\.{3}/g, '...');
  return;
};

const removeKnownGremlins = (string) => {
  string = string.replace(/’/g, "'");
  string = string.replace(/–/g, "-");
  string = string.replace(/[“”]/g, '"');
  string = string.replace(/⁄/g, "/");
  return string;
};

function flattenJsonToHtmlList(json) {
  // Initialize the result array and a variable to keep track of ids
  const resultList = [];
  let idCounter = 1;

  const addItem = (tagName, content) => {
    resultList.push({ id: idCounter.toString(), tagName, content });
    idCounter++;
  };

  const addItemWithNotes = (tagName, content, notes) => {
    resultList.push({ id: idCounter.toString(), tagName, content, notes });
    idCounter++;
  };

  // Add the title as an h1 tag
  addItem("h1", json.title);

  // Check if sections exist and is an array before iterating
  if (Array.isArray(json.sections)) {
    json.sections.forEach((section) => {
      // Add each section name as an h2 tag
      addItem("h2", section.name);

      // Check if subsections exist and is an array before iterating
      if (Array.isArray(section.subsections)) {
        section.subsections.forEach((subsection) => {
          // Add each subsection name as an h3 tag
          addItemWithNotes("h3", subsection.name, subsection.notes);
        });
      }
    });
  }

  return resultList;
}

const doesUserHaveEnoughArticles = async (currentUser) => {
  if (!currentUser) {
    throw new Error("No user defined");
  }

  const userRef = admin
    .firestore()
    .collection("customers")
    .doc(currentUser.uid);

  try {
    const doc = await userRef.get();

    if (!doc.exists) {
      console.log("No such document!");
      return false; // Assuming the function should return false if the document doesn't exist.
    }

    const userArticles = doc.data().articles;

    // Check if the user has enough words.
    return userArticles >= 1;
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error; // Consider handling or rethrowing the error as appropriate for your application.
  }
};

// Function to process AI response and convert to HTML list
function processAIResponseToHtml(responseMessage) {
  try {
    const jsonObject = JSON.parse(responseMessage);
    return flattenJsonToHtmlList(jsonObject);
  } catch (error) {
    throw new Error("Failed to process AI response");
  }
}

const doSerpResearch = async (keyWord, countryCode) => {
  let context = "";
  const params = {
    query: keyWord,
    countryCode: countryCode ? countryCode : "",
  };

  try {
    context = await findGoodData(params);
    // const furtherKeyWordResearch = await misc.determineIfMoreDataNeeded(questions, context, keyWord)

    // params.query = furtherKeyWordResearch.searchQuery
    // const additionalData = await getSerpResuts(params);
    // const slicedAdditionalData = additionalData.slice(0,2)
    // newContext = misc.generateContextString(slicedAdditionalData)
    // context += newContext
    // jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", newContext)
  } catch (e) {
    throw e;
  }

  return context;
};

const doInternalUrlResearch = async (internalUrls, title) => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await getSerpResultsForInternalUrls(internalUrls);
      console.log("serp results returned with size: ", data.length);
      const results = [];
      const chunkSize = 10;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const promises = chunk.map(async (item) => {
          if (item.status === "good") {
            try {
              const returnedSummary = await openai.summarizeContent(
                item.data,
                title
              );
              if (returnedSummary) {
                const extractedJSON = extractJsonFromString(
                  returnedSummary.choices[0].message.tool_calls[0].function
                    .arguments
                );
                const sanitizedJSON = sanitizeJSON(extractedJSON);
                const responseMessage = JSON.parse(sanitizedJSON);
                let newContext = generateContextStringBlog(
                  item.title,
                  item.link,
                  responseMessage.keyPoints
                );
                return newContext;
              }
            } catch (e) {
              console.log("Error retrieving data summary", e);
            }
          }
          return null;
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults.filter((result) => result !== null));

        // Check if the results array has reached 5 items
        if (results.length >= 6) {
          break; // Exit the loop early
        }

        // Wait for the current batch of promises to resolve before proceeding
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      resolve(results.join("\n\n")); // Resolve the Promise with the final result
    } catch (error) {
      reject(error); // Reject the Promise if an error occurs
    }
  });
};

const getSerpResultsForInternalUrls = async (internalUrls) => {
  console.log("Entering getSerpResultsForInternalUrls");
  const countryCode = ""; // Simplify country code determination
  const scrapeConfig = createScrapeConfig(countryCode);
  try {
    const promises = internalUrls.map((url) => {
      const element = {
        link: url,
        title: "",
        description: "",
      };
      return processElement(element, scrapeConfig); // Refactor processing into a separate function
    });
    const settledPromises = await Promise.allSettled(promises);
    const trimmed = settledPromises.map((item) =>
      item.status === "fulfilled" ? item.value : item.reason
    );
    // Improved logging for debugging
    console.log(`Processed ${trimmed.length} items.`);
    console.log("Finished getSerpResultsForInternalUrls");
    return trimmed;
  } catch (err) {
    console.error("Error in getSerpResultsForInternalUrls:", err.message);
    // Log more detailed error information if necessary
    return []; // Return an empty array or appropriate error response
  }
};

async function findGoodData(params, keyWord) {
  const data = await getSerpResults(params);
  console.log("serp results returned with size: ", data.length);
  const results = [];
  const chunkSize = 10;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const promises = chunk.map(async (item) => {
      if (item.status === "good") {
        try {
          const returnedSummary = await openai.summarizeContent(
            item.data,
            params.query
          );
          if (returnedSummary) {
            const extractedJSON = extractJsonFromString(
              returnedSummary.choices[0].message.tool_calls[0].function
                .arguments
            );
            const sanitizedJSON = sanitizeJSON(extractedJSON);
            const responseMessage = JSON.parse(sanitizedJSON);
            let newContext = generateContextStringBlog(
              item.title,
              item.link,
              responseMessage.keyPoints
            );
            return newContext;
          }
        } catch (e) {
          console.log("Error retrieving data summary", e);
        }
      }
      return null;
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults.filter((result) => result !== null));

    // Check if the results array has reached 5 items
    if (results.length >= 6) {
      break; // Exit the loop early
    }

    // Wait for the current batch of promises to resolve before proceeding
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return results.join("\n\n"); // Join the results array into a single string with newline separators
}

const generateContextStringAmazon = (section) => {
  let contextString = `Product description: ${section.content}\n`;

  const maxLoops = 10;
  const reviewCount = Math.min(section.reviews.length, maxLoops);

  for (let i = 0; i < reviewCount; i++) {
    contextString += `<review ${i + 1}> ${section.reviews[i].body}</review ${
      i + 1
    }>\n`;
  }

  return contextString;
};

const generateContextStringBlog = (title, link, keyPoints) => {
  let contextString = ` Article Title:${title} \n
                           Article URL: ${link} \n
                           Article Context: ${keyPoints} \n`;

  return contextString;
};

const determineSectionCount = (wordRange) => {
  if (wordRange === "500-800 words") {
    return 2;
  } else if (wordRange === "800-1200 words") {
    return 3;
  } else if (wordRange === "1200-1600 words") {
    return 4;
  } else if (wordRange === "1600-2000 words") {
    return 5;
  } else if (wordRange === "2000-2500 words") {
    return 6;
  } else {
    return 7;
  }
};

// This is required for the scraping to work through the proxy
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// TODO: label each of these as these doNotScrape or tryBetterProxy or something
// TODO: add known stores as discovered
// TODO: prevent stores with blogs from getting forbidden...just only scrape the blog
const forbiddenDomains = [
  "youtube.com",
  "pizzahut.com",
  "blazepizza.com",
  "dominos.com",
  "littlecaesars.com",
  "doi.gov", //setup alternate scraper

  /* FIXME: move these to apiAbleDomains once they can be handled specially */
  // "amazon.com",
  // "amazon.ca",
  // "usatoday.com",
  // "consumerreports.org",

  "all-clad.com", // store
  "calphalon.com", // store
  "cuisinart.com", // store
  "walmart.com", // store
  "target.com", // store
  "walgreens.com", // store
];
const apiAbleDomains = [
  "wikipedia.",
  //"wikimedia.",
];

const getCountryCode = (query) => query.countryCode || "";
const createParamsSerializer = () => (params) =>
  qs.stringify(params, { arrayFormat: "brackets" });

const createSerpConfig = (query, countryCode) => ({
  rejectUnauthorized: false,
  paramsSerializer: createParamsSerializer(),
  params: {
    q: query.query,
    brd_json: 1,
  },
  proxy: {
    host: "brd.superproxy.io",
    port: "22225",
    auth: {
      username: `${process.env.BRIGHTDATA_SERP_USERNAME}${countryCode}`,
      password: process.env.BRIGHTDATA_SERP_PASSWORD,
    },
  },
});

const createScrapeConfig = (countryCode) => ({
  rejectUnauthorized: false,
  proxy: {
    host: "brd.superproxy.io",
    port: "22225",
    auth: {
      username: `${process.env.BRIGHTDATA_DC_USERNAME}${countryCode}`,
      password: process.env.BRIGHTDATA_DC_PASSWORD,
    },
  },
});

const getSerpResults = async (data) => {
  console.log("Entering getSerpResults");
  const query = data;
  const countryCode = query.countryCode || ""; // Simplify country code determination
  const serpConfig = createSerpConfig(query, countryCode);
  const scrapeConfig = createScrapeConfig(countryCode);
  try {
    const axiosResponse = await axios.get(
      `https://www.google.com/search`,
      serpConfig
    );
    const promises = axiosResponse.data.organic.map((el) => {
      return processElement(el, scrapeConfig); // Refactor processing into a separate function
    });
    const settledPromises = await Promise.allSettled(promises);
    const trimmed = settledPromises.map((item) =>
      item.status === "fulfilled" ? item.value : item.reason
    );
    // Improved logging for debugging
    console.log(`Processed ${trimmed.length} items.`);
    console.log("Finished getSerpResults");
    return trimmed;
  } catch (err) {
    console.error("Error in getSerpResults:", err.message);
    // Log more detailed error information if necessary
    return []; // Return an empty array or appropriate error response
  }
};

async function processElement(el, scrapeConfig) {
  if (forbiddenDomains.some((domain) => el.link.includes(domain))) {
    return {
      status: "not scraped - forbidden",
      link: el.link,
      title: el.title,
      description: el.description || "", // Use || operator for defaults
    };
  } else if (apiAbleDomains.some((domain) => el.link.includes(domain))) {
    const filteredDomain = apiAbleDomains.find((domain) =>
      el.link.includes(domain)
    );
    switch (filteredDomain) {
      case "wikipedia.":
        return apiFunctions.fetchWikipedia(el);
      default:
        console.error(`Unhandled domain: ${filteredDomain} - ${el.link}`);
        return {
          status: "API not accessed - unhandled domain",
          link: el.link,
          title: el.title,
          description: el.description || "",
        };
    }
  } else {
    try {
      const response = await axios.get(el.link, scrapeConfig);
      let body = stripToText(response.data);
      body = body.replace(/\s+/g, " "); // Assign the result back to body
      if (body.length > 10000) {
        // Truncate the text to 10,000 characters
        body = body.substring(0, 10000);
      }
      const description = stripToText(el.description);
      let type = "scraped";
      if (checkIfStore(body)) {
        type = "scraped - store";
      }
      return {
        status: "good",
        type: type,
        link: el.link,
        title: el.title,
        description: description,
        data: body,
      };
    } catch (err) {
      console.error("Error scraping:", el.link, err.message);
      return {
        status: "bad",
        type: "scraped",
        link: el.link,
        error: err.message,
      };
    }
  }
}

function sanitizeJSON(jsonString) {
  return jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

function extractJsonFromString(str) {
  const regex = /{.*}/s;
  const match = str.match(regex);

  if (match && match.length > 0) {
    try {
      return match[0];
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
    }
  }

  return null;
}

const parseKeyWords = (keyWords) => {
  const keyWordList = keyWords.split(",");

  return keyWordList;
};

const parseIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",").shift() ||
    req.socket?.remoteAddress
  );
};

const wordLengthCalculator = (wordRange, outline) => {
  let sectionLength = 300;
  let numH3 = 0;
  for (const section of outline) {
    if (section.tagName === "h3") {
      numH3++;
    }
  }

  if (numH3 != 0) {
    if (wordRange === "500-1000 words") {
      sectionLength = Math.ceil(1000 / numH3 / 100) * 100;
    } else if (wordRange === "1000-2000 words") {
      sectionLength = Math.ceil(2000 / numH3 / 100) * 100;
    } else {
      sectionLength = Math.ceil(3000 / numH3 / 100) * 100;
    }
  }

  return sectionLength;
};

module.exports = {
  stripEscapeChars,
  stripToText,
  checkIfStore,
  removeKnownGremlins,
  stripDotDotDotItems,
  flattenJsonToHtmlList,
  processAIResponseToHtml,
  doesUserHaveEnoughArticles,
  doSerpResearch,
  determineSectionCount,
  generateContextStringAmazon,
  parseKeyWords,
  parseIp,
  wordLengthCalculator,
  doInternalUrlResearch,
};
