const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// ------ Dev Dep ------
const fs = require("node:fs");

router.get('/health', (req, res) => {
    res.status(200).send("I'm alive ai")
});

/*

These routes are accessible on the local emulator at:
http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai/routes


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

TODO: Determine approximately how many words articles of each length are supposed to be
TODO: Figure out how to ensure citations happen properly
TODO: What needs to happen for the image generation to work properly?
TODO: internalURL will need some kind of sitemap - what did Nathaniel mention for that?
  - this isn't what I thought it was, but I think I remember something about linking 
    across posts on the rest of the blog, so we'd need to figure that out

TODO: Figure out how to do the web scraping and SERP fetching for realTimeResearch to work
  - allow specifying an array of pages to scrape manually?
  - do we want all scraping to be done after a web search, or do we want to search 
    amazon directly for some things?
  - Axios to fetch
  - Cheerio to extract body and anything else required to pass to model
  - TODO: will this be expensive to do on firebase functions?
  - Do we want to take advantage of Brightdata's proxies and let people do auto SERP in their local region? 

TODO: Figure out some way to use a small model as a basic moderator to ensure we don't 
  send bannable data to OpenAI, etc.
  - use small model (maybe gpt-3.5 turbo for now, but maybe something cheaper in the future) to verify the 
    blurb below each link in the SERP results is relevant and inoffensive

TODO: research output quality with GPT-4 at different token lengths

TODO: interactive blog post generation/tinkering

TODO: support geotargetting at either the country or the city/area level
  - BrightData supports:
    - a country code list in their examples. it MIGHT just be the country code sublist from below link
    - https://developers.google.com/google-ads/api/data/geotargets
      - the country codes here just track ISO 3166-1 alpha-2 (is subject to change, so we should have this automatically update)
      - if we do set this up to update itself we should make a cheap api people can use that keeps these up-to-date for extra money

TODO: Bulk article creation UI
  - article templates

FIXME: complete the catch() methods in case something fails
FIXME: setup logging, probably by adding logs to the db or using some firebase hosted service or something
*/

router.post('/process', (req, res) => {

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

  console.log(req.body);
  let countryCode;
  if (req.body.countryCode) {
    countryCode = req.body.countryCode;
  } else {
    countryCode = "";
  }

  console.log(req.body.mainKeyword);
  console.log(countryCode);

  // fetch SERP results from /serp endpoint
  // maybe wrap this into a single function later, but for now it's easier to watch it from here

  const axiosConfig = {
    baseURL: "http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai", // FIXME: local emulator url
    maxRedirects: 5,
    paramsSerializer: function (params) {
      // qs does a number of things, stringify just does what we need here by default
      // https://www.npmjs.com/package/qs
      return qs.stringify(params, {arrayFormat: 'brackets'})
    },
    params: {
      query: req.body.mainKeyword,
      countryCode: countryCode
    }
  };

  axios.get('/serp', axiosConfig)
    .then(function(axiosResponse){ 
      console.log(Object.keys(axiosResponse));
      res.status(200).send(axiosResponse.data);
    })
    .catch( /* 
    put request in a loop and just set a failed flag of some kind to true in here. 
    finally() can break out of loop if it worked 

    maybe I could do something sort of clever by increasing the loop limit as a 
    natural retry counter & method for forcing a retry
    */ function(err){ 
      res.status(500).send(err);

  })
    .finally();

  
});

// This is required for the scraping to work through the proxy
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

router.get('/serp', (req,res) => {

  // FIXME: put brightdata credentials in the .env file
  const query = req.query.query;
  let countryCode;
  if (req.query.countryCode) {
    countryCode = req.query.countryCode;
  } else {
    countryCode = ""; // can be blank if no specific country is required
  }

  const serpConfig = {
    rejectUnauthorized: false,
    paramsSerializer: function (params) {
      // qs does a number of things, stringify just does what we need here by default
      // https://www.npmjs.com/package/qs
      return qs.stringify(params, {arrayFormat: 'brackets'})
    },
    params: {
      q: query,
      brd_json: 1
    },
    proxy: {
      host: 'brd.superproxy.io',
      port: '22225',
      auth: {
        username: `brd-customer-hl_0c420d11-zone-serp_api1${countryCode}`,
        password: '75tc7jsaumj2'
      }
    }
  }

  const scrapeConfig = {
    rejectUnauthorized: false,
    proxy: {
      host: 'brd.superproxy.io',
      port: '22225',
      auth: {
        username: `brd-customer-hl_0c420d11-zone-data_center${countryCode}`,
        password: 'bcqii8i01fc7'
      }
    }
  }

  let trimmed = [];

  axios.get(`http://www.google.com/search`, serpConfig)
  .then(axiosResponse => {
    /* 
      the BrightData response object refers to itself internally 
      JSON.stringify (called inside send()) cannot handle circular data structures
    */
    axiosResponse.data.organic.forEach(async (element) => {

      // FIXME: scraping currently fails with a TLS error saying the cert doesn't match the domain. 
      // the proxy doesn't seem to be working
      await axios.get(element.link, scrapeConfig)
        .then(data => {

          if (false) {
            console.log("-----scrape successful-----")
            console.log(element.link)
            // FIXME: BLURB FROM SERP
            console.log("------------end----------")
          }
          trimmed.push({
            link: element.link,
            page: data
          });
          console.log(trimmed.length);
        })
        .catch(err => {
          console.log("err");
          if (false) {
            console.log("-----------------------------start error--------------------------------")
            console.log(element.link)
            console.log(err.code);
            console.log(err.name);
            console.log(err.message);
            console.log(err.response);
            console.log("------------------------------end error---------------------------------")
          }
          return err;
        })
    })
  })
  .then(() => {
    // FIXME: returns early. is the solution to use async/await or some setup with promise.all(), or something else?
    console.log("trimmed output: " + trimmed);
    res.status(200).send(trimmed);
  });
    
});

router.get('/routes', (req, res) => {
  // test page for local dev

  const baseURL = "http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai";  // FIXME: local emulator url

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

module.exports = router;

