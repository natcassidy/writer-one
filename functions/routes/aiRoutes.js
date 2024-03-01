const express = require('express');
const router = express.Router();
// FIXME: in 6~ months (May, June, in there somewhere) when node 22 is out 
// see about node 22 on firebase functions & weigh up axios vs the new 
// node fetch() api. might save $/memory/second at least
const axios = require('axios');
const qs = require('qs');
require('dotenv').config()


// ------ Helper .js Deps ------
const apiFunctions = require('./apiFunctions');
const misc = require('./miscFunctions');
const vertex = require('./vertexAiFunctions')

// ------ Dev Dep ------
const fs = require("node:fs");

router.get('/health', async (req, res) => {

  let completion;
  try {
    completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant designed to output JSON.",
        },
        { role: "user", content: "Who won the world series in 2020?" },
      ],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
    });
  } catch (e) {
    console.log('exception:', e);
    return res.status(500).send(e); // Send error response
  }

  if (completion && completion.choices && completion.choices.length > 0) {
    res.status(200).send(completion.choices[0].message.content);
  } else {
    res.status(500).send('No completion available');
  }
});

async function findGoodData(params) {
  const data = await getSerpResults(params); // Assume this returns an array of objects
  console.log('serp results returned with size: ', data.length);

  // Use map to transform data items into an array of promises
  const promises = data.map(item => {
    // Return a new promise for each item
    return new Promise(async (resolve) => {
      if (item.status === "good") {
        try {
          const returnedSummary = await misc.summarizeContent(item.data);
          if (returnedSummary) {
            let responseMessage = JSON.parse(returnedSummary.choices[0].message.tool_calls[0].function.arguments);
            let newContext = misc.generateContextString(item.title, item.link, responseMessage.keyPoints)
            resolve(newContext); // Resolve with the summary if successful
          } else {
            resolve(); // Resolve with undefined if no summary returned
          }
        } catch (e) {
          console.log('Error retrieving data summary', e);
          resolve(); // Resolve with undefined in case of error
        }
      } else {
        resolve(); // Resolve with undefined if the status is not good
      }
    });
  });

  // Wait for all promises to resolve
  const results = await Promise.all(promises);
  // Filter out undefined results (if any)
  const contextArray = results.filter(result => result !== undefined);

  let contextString = ""
  contextArray.forEach(context => {
    contextString += context
  })

  return contextString; // This will be an array of summaries or empty if no good data is found
}


/* ----- Main Notes -----

Here's the body to expect from the client submitting the form

{
  "mainKeyword": "String",
  "title": "String",
  "articleLength": {
    "type": "String",
    "enum": ["small", "medium", "large", "xLarge"]
  },
  "writingStyle": {
    "type": "String",
    "enum": ["light", "professional"]
  },
  "pointOfView": {
    "type": "String",
    "enum": ["firstPersonSingular", "firstPersonPlural", "thirdPerson", "neutral"]
  },
  "realTimeResearch": "Boolean",
  "citeSources": "Boolean",
  "includeFAQs": "Boolean",
  "generateImages": "Boolean",
  "internalUrl": "String"
}

*/

/*
const [formData, setFormData] = useState({
    keyWord: '',
    internalUrl: '',
    articleLength: 0,
    wordRange: wordRanges[0],
    tone: tone[0],
    pointOfView: pointOfView[0],
    realTimeResearch: false,
    citeSources: false,
    includeFAQs: false,
    generatedImages: false,
    generateOutline: false,
    outline: []
  });
  */
router.post('/process', async (req, res) => {
  let { keyWord, internalUrl, wordRange, tone,
    pointOfView, realTimeResearch, citeSources, includeFAQs,
    generatedImages, generateOutline, outline, currentUser } = req.body

  const isWithinWordCount = await misc.doesUserHaveEnoughWords(currentUser, wordRange)

  if (!isWithinWordCount) {
    res.status(500).send("Word Count Limit Hit")
  }

  let jobId = -1
  if (outline.length != 0) {
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
    console.log('outline generated')
  } else {
    outline = await misc.generateOutline(keyWord, wordRange)
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
    console.log('outline generated')
  }

  let context = ""
  let newContext = ""
  if (realTimeResearch) {
    // const questions = await misc.generateContextQuestions(outline, jobId, keyWord)
    // jobId = await misc.updateFirebaseJob(currentUser, jobId, "questions", questions)

    let countryCode;
    if (req.body.countryCode) {
      countryCode = req.body.countryCode;
    } else {
      countryCode = "";
    }

    const params = {
      query: keyWord,
      countryCode: countryCode
    }

    try {
      context = await findGoodData(params, currentUser, jobId)

      jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", context)
      // const furtherKeyWordResearch = await misc.determineIfMoreDataNeeded(questions, context, keyWord)

      // params.query = furtherKeyWordResearch.searchQuery
      // const additionalData = await getSerpResuts(params);
      // const slicedAdditionalData = additionalData.slice(0,2)
      // newContext = misc.generateContextString(slicedAdditionalData)
      // context += newContext
      // jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", newContext)

    }
    catch (e) {
      throw e
    }
  }
  console.log('generating article')
  await misc.generateArticle(outline, keyWord, context, tone, pointOfView, citeSources);

  console.log('article generated now doing gemini article')
  const geminiOutline = structuredClone(outline);
  await vertex.generateArticleGemini(geminiOutline)

  console.log('gemini article generated')
  const wordCount = misc.countWords(outline)
  const updatedWordCount = await misc.decrementUserWordCount(currentUser, wordCount)
  console.log('word count: ', wordCount)
  //Outline will now contain each section filled in with data
  res.status(200).send({ "article": outline, updatedWordCount, "geminiArticle": geminiOutline })
});

// This is required for the scraping to work through the proxy
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';



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
const createParamsSerializer = () => (params) => qs.stringify(params, { arrayFormat: 'brackets' });

const createSerpConfig = (query, countryCode) => ({
  rejectUnauthorized: false,
  paramsSerializer: createParamsSerializer(),
  params: {
    q: query.query,
    brd_json: 1
  },
  proxy: {
    host: 'brd.superproxy.io',
    port: '22225',
    auth: {
      username: `${process.env.BRIGHTDATA_SERP_USERNAME}${countryCode}`,
      password: process.env.BRIGHTDATA_SERP_PASSWORD
    }
  }
});

const createScrapeConfig = (countryCode) => ({
  rejectUnauthorized: false,
  proxy: {
    host: 'brd.superproxy.io',
    port: '22225',
    auth: {
      username: `${process.env.BRIGHTDATA_DC_USERNAME}${countryCode}`,
      password: process.env.BRIGHTDATA_DC_PASSWORD
    }
  }
});


const getSerpResults = async (data) => {
  const query = data;
  const countryCode = query.countryCode || ""; // Simplify country code determination

  const serpConfig = createSerpConfig(query, countryCode);
  const scrapeConfig = createScrapeConfig(countryCode);

  try {
    const axiosResponse = await axios.get(`https://www.google.com/search`, serpConfig);
    let promises = axiosResponse.data.organic.map(el => {
      return processElement(el, scrapeConfig); // Refactor processing into a separate function
    });

    const settledPromises = await Promise.allSettled(promises);
    const trimmed = settledPromises.map(item => item.status === "fulfilled" ? item.value : item.reason);

    // Improved logging for debugging
    console.log(`Processed ${trimmed.length} items.`);
    return trimmed;
  } catch (err) {
    console.error("Error in getSerpResults:", err.message);
    // Log more detailed error information if necessary
    return []; // Return an empty array or appropriate error response
  }
};

async function processElement(el, scrapeConfig) {
  if (forbiddenDomains.some(domain => el.link.includes(domain))) {
    return {
      status: "not scraped - forbidden",
      link: el.link,
      title: el.title,
      description: el.description || "" // Use || operator for defaults
    };
  } else if (apiAbleDomains.some(domain => el.link.includes(domain))) {
    const filteredDomain = apiAbleDomains.find(domain => el.link.includes(domain));
    switch (filteredDomain) {
      case "wikipedia.":
        return apiFunctions.fetchWikipedia(el);
      default:
        console.error(`Unhandled domain: ${filteredDomain} - ${el.link}`);
        return {
          status: "API not accessed - unhandled domain",
          link: el.link,
          title: el.title,
          description: el.description || ""
        };
    }
  } else {
    try {
      const response = await axios.get(el.link, scrapeConfig);
      let body = misc.stripToText(response.data);
      const description = misc.stripToText(el.description);

      let type = "scraped";
      if (misc.checkIfStore(body)) {
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
      return { status: "bad", type: "scraped", link: el.link, error: err.message };
    }
  }
}

router.post('prettyPrint', (req, res) => {
  let url;
  if (process.env.FUNCTIONS_EMULATOR) {
    url = "http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai";
  } else {
    url = "https://us-central1-writeeasy-675b2.cloudfunctions.net/plugin/ai";
  }
  axios.get(url + "/process", {
    rejectUnauthorized: false,
    paramsSerializer: function (params) {
      // qs does a number of things, stringify just does what we need here by default
      // https://www.npmjs.com/package/qs
      return qs.stringify(params, { arrayFormat: 'brackets' })
    }
  })
    .then(axiosResponse => {
      console.log("------- " + typeof (axiosResponse.data) + " -------");
      res.status(200).send(axiosResponse.data);
    })
});

router.get('/generalTest', (req, res) => {
  // test page for local dev

  let url;
  if (process.env.FUNCTIONS_EMULATOR) {
    url = "http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai";
  } else {
    url = "https://us-central1-writeeasy-675b2.cloudfunctions.net/plugin/ai";
  }
  const baseURL = url;

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <Title>Route Testing</Title>
    </head>
    <body>
      <h1>Route Testing</h1>
      <form action="${baseURL}/process" method="post">
        <div>
          <label for="mainKeyword">Main Keyword: </label>
          <input type="text" name="mainKeyword" id="mainKeyword" required />
        </div>
        <div>
          <label for="title">Title: </label>
          <input type="text" name="title" id="title" required />
        </div>
        <br/>

        <label for="articleLength">Article Length: </label>
        <select name="articleLength" id="articleLength" >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xLarge">Extra Large</option>
        </select>
        <br/>

        <label for="writingStyle">Writing Style: </label>
        <select name="writingStyle" id="writingStyle" >
          <option value="light">Light</option>
          <option value="professional">Professional</option>
        </select>
        <br/>

        <label for="pointOfView">Point Of View: </label>
        <select name="pointOfView" id="pointOfView" >
          <option value="firstPersonSingular">First Person Singular</option>
          <option value="firstPersonPlural">First Person Plural</option>
          <option value=thirdPerson">Third Person</option>
          <option value="neutral">Neutral</option>
        </select>
        <br/>
        <br/>

        <label for="realTimeResearch">Real Time Research</label>
        <select name="realTimeResearch" id="realTimeResearch" >
          <option value="false">No</option>
          <option value="true"><Yes</option>
        </select>
        <br/>
        
        <label for="citeSources">Cite Sources</label>
        <select name="citeSources" id="citeSources" >
          <option value="false">No</option>
          <option value="true"><Yes</option>
        </select>
        <br/>
        
        <label for="includeFAQs">Include FAQs</label>
        <select name="includeFAQs" id="includeFAQs" >
          <option value="false">No</option>
          <option value="true"><Yes</option>
        </select>
        <br/>

        <label for="generateImages">Generate Images</label>
        <select name="generateImages" id="generateImages" >
          <option value="false">No</option>
          <option value="true"><Yes</option>
        </select>
        <br/>

        <label for="internalURL">Internal URL</label>
        <select name="internalURL" id="internalURL" >
          <option value="false">No</option>
          <option value="true"><Yes</option>
        </select>
        <br/>
        <input type="submit" value="Submit" />
      </form>
    </body>
    `);
});

// Route handler
router.post("/outline", async (req, res) => {
  let { keyWord, internalUrl, articleLength, wordRange, tone,
    pointOfView, realTimeResearch, citeSources, includeFAQs,
    generatedImages, generateOutline, outline, currentUser } = req.body

  try {
    const responseMessage = await misc.generateOutline(keyWord, wordRange)
    res.status(200).send(responseMessage);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(error.message || 'An error occurred');
  }
});

router.get("/testWikipedia", (req, res) => {
  res.status(200).send(
    apiFunctions.fetchWikipedia({ link: "https://en.wikipedia.org/wiki/Miss_Meyers", title: "Miss Meyers - Wikipedia" })
  );
});

router.post("/testSerp", async (req, res) => {
  const serpConfig = {
    rejectUnauthorized: false,
    paramsSerializer: function (params) {
      // qs does a number of things, stringify just does what we need here by default
      // https://www.npmjs.com/package/qs
      return qs.stringify(params, { arrayFormat: 'brackets' })
    },
    params: {
      q: query,
      brd_json: 1
    },
    proxy: {
      host: 'brd.superproxy.io',
      port: '22225',
      auth: {
        username: `${process.env.BRIGHTDATA_SERP_USERNAME}${countryCode}`,
        password: process.env.BRIGHTDATA_SERP_PASSWORD
      }
    }
  };


  await axios.get(`http://www.google.com/search`, serpConfig)
    .then(data => {
      res.status(200).send(data)
    }).catch(e => res.status(500).send(e))
})

router.get("/testGemini", async (req, res) => {
  const data = await vertex.healthCheckGemini()
  res.status(200).send(data.candidates[0].content.parts[0].text)
})

module.exports = router;

