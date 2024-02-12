const express = require('express');
const router = express.Router();
// FIXME: in 6~ months (May, June, in there somewhere) when node 22 is out 
// see about node 22 on firebase functions & weigh up zxios vs the new 
// node fetch() api. might save $/memory/second at least
const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');
require('dotenv').config()
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// ------ Dev Dep ------
const fs = require("node:fs");

// FIXME: make this its own endpoint in a different folder somewhere...probably
function stripToText(html, source) {
  if (!html) {
    return "";
  }
  const $ = cheerio.load(html);

  // if (source.include(".wikipedia.")) {
    // TODO: consider checking an api for wikipedia mebe
  //   // has had this id for their main content since at least 2013
  //   // may still need to update it in the future though
    
  // }

  // $('script').remove();
  // $('style').remove();
  // $('svg').remove();
  // $('img').remove();
  // return $('body').text();
  return $('body').prop('innerText');
}

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
  }catch (e) {
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

TODO: --- Job System ---
  - setup job template
  - setup function triggers based on db additions, changes, etc.
  - look into firebase pub/sub
  - if one of the advantages is not having complex state flow (in functions passing everything to downstream functions),
    or having complex manager functions that track the overall state and call simpler individual functions similar to 
    main() or an event loop architecture...does going this route as an alternative risk just making the triggering system 
    in the database *be* the complex main() or event loop instead? is that any better?
      - using the db as the manager/triggering system thing would probably lock us into firebase much more
        - is that a problem though? is migrating to something else a goal?
        - if we designed each job to use a single master script that held the "recipe" for the *whole* job, then whenever 
          a change to the job record came in (instead of changes to the individual records inside the job document) then that
          would fix the lock-in problem since that would be very easy to port to any other platform that we could use as an 
          event loop
            - a potential issue is that the logic could get complicated in that one file
            - the other side of the coin, though, is that if all that complexity has to be there in the job anyway...
              do you really want it scattered around in a bunch of different places?
            - having a single master recipe file would definitely make it much easier to use different recipes for different
              things, and that would make the architecture much more flexible on the whole without having to add complexity
              - unless I'm missing something?
  - {
    jobId: randomUniqueID,
    formData: { formFields },
    serpResults: {
      started: bool,
      completed: bool,
      [arrayOfLinks, etc.],
    },

    outline: [arrayOfSectionObjects],
  }

  TODO: have some way to automatically notify *us* when a page we have special rules for (like wikipedia) changes 
  how they format their content and potentially breaks our scraper
    - if the rules for the page involve finding a specific dom element that has now gone missing, just skip that rule

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
  const axiosConfig = {
    baseURL: url,
    maxRedirects: 5,
    paramsSerializer: function (params) {
      // qs does a number of things, stringify just does what we need here by default
      // https://www.npmjs.com/package/qs
      return qs.stringify(params, { arrayFormat: 'brackets' });
    },
    params: {
      query: req.body.mainKeyword,
      countryCode: countryCode
    }
  };

  axios.get('/serp', axiosConfig)
    .then(function(axiosResponse){
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
});

// This is required for the scraping to work through the proxy
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

router.get('/serp', (req,res) => {

  // TODO: label each of these as these doNotScrape or tryBetterProxy or something
  const forbiddenDomains = [
    "youtube.com",
    "pizzahut.com",
    "blazepizza.com",
    "dominos.com",
    "littlecaesars.com",
    "doi.gov", //setup alternate scraper
    ];

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
        username: `${process.env.BRIGHTDATA_SERP_USERNAME}${countryCode}`,
        password: process.env.BRIGHTDATA_SERP_PASSWORD
      }
    }
  }

  const scrapeConfig = {
    rejectUnauthorized: false,
    proxy: {
      host: 'brd.superproxy.io',
      port: '22225',
      auth: {
        username: `${process.env.BRIGHTDATA_DC_USERNAME}${countryCode}`,
        password: process.env.BRIGHTDATA_DC_PASSWORD
      }
    }
  }

  // -------------------------------
  // ---------WIKIPEDIA API---------
  // -------------------------------
  // URL for the Wikipedia API call to get the content of the "Python (programming language)" page
  const url = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&origin=*&titles=Python_(programming_language)";

  // Make the GET request using the Fetch API
  fetch(url)
    .then(response => {
      // Check if the request was successful
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      return response.json(); // Parse the response body as JSON
    })
    .then(data => {
      // Process the JSON data
      const pages = data.query.pages;
      const page = pages[Object.keys(pages)[0]]; // Get the first page in the response
      const content = page.extract; // Extract the content of the page

      // Output the content to the console or handle as needed
      console.log(content);
    })
    .catch(error => {
      // Handle any errors that occurred during the fetch
      console.error('Failed to fetch data:', error);
    });
  // -------------------------------
  // -------END WIKIPEDIA API-------
  // -------------------------------

  axios.get(`http://www.google.com/search`, serpConfig)
    .then(axiosResponse => {
      // Map each element to a Promise created by the axios call
      // TODO: add some way to check whether we've successfully scraped at least some minimum number of pages
      // and if we haven't continue on page two of the SERP

      // TODO: is there some way to figure out whether we're getting business home pages in the search results 
      // other than to just send the whole thing to the model and see what it thinks?
      let promises = axiosResponse.data.organic.map(el => {
        if (forbiddenDomains.some(domain => el.link.includes(domain))) {
          return { 
            status: "not scraped - forbidden", 
            link: el.link, 
            title: el.title, 
            description: el.description ? el.description : "" // TODO: figure out a way to strip out svg's
          };
        } else {
          return axios.get(el.link, scrapeConfig)
            .then(response => {
              /* 
              FIXME: FIXME: figure out match/case/switch/whatever setup for handling different sites via API, etc.
              TODO: decide for sure on how to handle specific, problem sites
                - youtube : eventually do something with video, audio, and transcript
                - wikipedia : has a *lot* of page formatting that can be skipped by jumping to #mw-content-text
              */
              const body = stripToText(response.data, el.link);
              const description = stripToText(el.description);
              return {
                status: "good",
                link: el.link,
                title: el.title,
                description: description, 
                data: body
              };
            })
            .catch(err => {
              console.log("\nscrape error")
              console.log(new Error("err: " + err));
              console.log(new Error("err keys: " + Object.keys(err)) + "\n");
              return { status: "bad", err: err, headers: err.headers };
            });
        }
      });

      // Return a Promise that resolves when all axios calls are complete
      return Promise.allSettled(promises);
    })
    .catch(err => {
      console.log("\nearly err: " + err);
    })
    .then(trimmedPromises => {
      // "trimmed" because most of the data from axios and brightdata have been discarded
      trimmed = trimmedPromises.map(item => {
        if (item.status === "fulfilled"){
          return item.value;
        } else {
          return item;
        }
      });
      res.status(200).send(trimmed);
    })
    .catch(err => {
      console.log("\n--- FINAL ERR OUTPUT ---")
      console.log(Object.keys(err));
      console.log("error message: " + err);
      console.log("------------------------\n")
    });
    
});

router.get('/routes', (req, res) => {
  // test page for local dev

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

module.exports = router;

