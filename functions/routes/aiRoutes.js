const express = require('express');
const router = express.Router();
// FIXME: in 6~ months (May, June, in there somewhere) when node 22 is out 
// see about node 22 on firebase functions & weigh up axios vs the new 
// node fetch() api. might save $/memory/second at least
const axios = require('axios');
const qs = require('qs');
require('dotenv').config()
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------ Helper .js Deps ------
const apiFunctions = require('./apiFunctions');
const misc = require('./miscFunctions');

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

router.post('/process', async (req, res) => {

  /*
    - Do whatever processing needs to be done before passing data to LLM
      - stuff like fetching data, scraping, etc.
        - setup brightdata or whatever we end up using to get SERP results
    - Identify subset of req.body that the LLM will need then request article outline, 
      from model based on length provided
    - Submit each section from the article based on the outline to the model to generate, 
      along with whatever scraping data will be required
    - Build article out of components from the outline
    - Submit article to LLM for final review, along with the initial specification
  */

  // console.log(req.body);
  let countryCode;
  if (req.body.countryCode) {
    countryCode = req.body.countryCode;
  } else {
    countryCode = "";
  }

  // fetch SERP results from /serp endpoint
  // maybe wrap this into a single function later, but for now it's easier to watch it from here

  let url;
  if (process.env.FUNCTIONS_EMULATOR) {
    url = "http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai";
  } else {
    url = "https://us-central1-writeeasy-675b2.cloudfunctions.net/plugin/ai";
  }

  const params = {
    query: req.body.mainKeyword,
    countryCode: countryCode
  }

  try {
    const data = await getSerpResuts(params);
    res.status(200).send(data)
  }
  catch (e) {
    res.status(500).send("Failed")
  }
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


const getSerpResuts = async (data) => {


  const query = data
  let countryCode;
  if (query.countryCode) {
    countryCode = query.countryCode;
  } else {
    countryCode = ""; // can be blank if no specific country is required
  }

  const serpConfig = createSerpConfig(query, countryCode)
  const scrapeConfig = createScrapeConfig(countryCode)

  return await axios.get(`http://www.google.com/search`, serpConfig)
    .then(axiosResponse => {
      console.log('Inside response')
      // Map each element to a Promise created by the axios call
      // TODO: add some way to check whether we've successfully scraped at least some minimum number of pages
      // and if we haven't continue on page two of the SERP

      // TODO: is there some way to figure out whether we're getting business home pages in the search results 
      // other than to just send the whole thing to the model and see what it thinks?

      // switch statement for different types of pages?
      let promises = axiosResponse.data.organic.map(el => {

        // --- Forbidden Domain ---
        if (forbiddenDomains.some(domain => el.link.includes(domain))) {
          return {
            status: "not scraped - forbidden",
            link: el.link,
            title: el.title,
            description: el.description ? el.description : "" // TODO: figure out a way to strip out svg's
          };
        } else if (apiAbleDomains.some(domain => el.link.includes(domain))) { // --- API'able Domain ---
          const filteredDomain = apiAbleDomains.find(domain => el.link.includes(domain)); // This returns a single domain or undefined

          switch (filteredDomain) {
            case "wikipedia.":
              return apiFunctions.fetchWikipedia(el);
              break;
            default: // --- Unhandled Domain ---
              console.log("domain in apiAbleDomains but not handled: " + filteredDomain + " - " + el.link);
              return { status: "API not accessed - unhandled domain", type: "api - unknown", link: el.link, title: el.title, description: el.description ? el.description : "" };
              break;
          }
        } else { // --- Regular Domain ---
          return axios.get(el.link, scrapeConfig)
            .then(response => {
              /* 
              FIXME: FIXME: figure out match/case/switch/whatever setup for handling different sites via API, etc.
              TODO: decide for sure on how to handle specific, problem sites
                - youtube : eventually do something with video, audio, and transcript
                - wikipedia : has a *lot* of page formatting that can be skipped by jumping to #mw-content-text
              */
              let body = misc.stripToText(response.data);
              const description = misc.stripToText(el.description);

              console.log("type: " + typeof (body));

              // TODO: maybe filter these out later
              let type = "scraped";
              if (misc.checkIfStore(body)) {
                type = "scraped - store";
              }

              // strip out useless data
              // body = misc.removeImages(body);
              // body = misc.removeKnownGremlins(body);
              // body = misc.stripDotDotDotItems(body);
              body = misc.stripEscapeChars(body);

              return {
                status: "good",
                type: type,
                link: el.link,
                title: el.title,
                description: description,
                data: body,
              };
            })
            .catch(err => {
              console.log("\nscrape error")
              console.log(new Error("err: " + err));
              console.log(new Error("err keys: " + Object.keys(err)) + "\n");
              if (err.request) {
                console.log("err.request: " + err.request._header);
              }
              return { status: "bad", type: "scraped", err: err, headers: err.headers };
            });
        }
      });

      // Return a Promise that resolves when all axios calls are complete
      return Promise.allSettled(promises);
    })
    .catch(err => {
      console.log("\nInitial serp request err: " + err);
      console.log("\nInitial serp request err keys: " + Object.keys(err));
    })
    .then(trimmedPromises => {
      // "trimmed" because most of the data from axios and brightdata have been discarded
      const trimmed = trimmedPromises.map(item => {
        if (item.status === "fulfilled") {
          return item.value;
        } else {
          return item;
        }
      });
      return trimmed;
    })
    .catch(err => {
      console.log("\n--- FINAL ERR OUTPUT ---")
      console.log(Object.keys(err));
      console.log("error message: " + err);
      console.log("------------------------\n")
    });

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

router.post("/outline", async (req, res) => {
  let completion;
  let responseMessage;

  toolsForNow =
    [{
      "type": "function",
      "function": {
        "name": "generateOutline",
        "description": "Generate an outline for the given keyword using the structure provided.",
        "parameters": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string"
            },
            "sections": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "subsections": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string"
                        }
                      },
                      "required": ["name"]
                    }
                  }
                },
                "required": ["name", "subsections"]
              }
            }
          },
          "required": ["title", "sections"]
        }
      }
    }]

  try {
    completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant designed to output JSON. Your job is to provide a json object to call a fuction called generateOutline.  You will provide a JSON object in your response and ONLY a json object based on the fields specified.",
        },
        { role: "user", content: `Generate an outline for the keyword: ${req.body.keyWord}` },
      ],
      tools: toolsForNow,
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
    });
    responseMessage = completion.choices[0].message.tool_calls[0].function.arguments
  } catch (e) {
    console.log('exception:', e);
    return res.status(500).send(e); // Send error response
  }
  res.status(200).send(responseMessage)
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

module.exports = router;

