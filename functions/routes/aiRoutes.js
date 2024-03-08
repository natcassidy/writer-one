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
const amazon = require('./amazonScraperFunctions')


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
    generatedImages, generateOutline, outline, currentUser, jobId } = req.body

  // const isWithinWordCount = await misc.doesUserHaveEnoughWords(currentUser, wordRange)

  // if (!isWithinWordCount) {
  //   res.status(500).send("Word Count Limit Hit")
  // }

  let context = ""
  if (!jobId) {
    jobId = -1
  }

  if (outline.length != 0) {
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
    console.log('outline generated')
  } else {
    context = await misc.doSerpResearch(keyWord, "")
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", context)
    outline = await amazon.generateOutlineClaude(keyWord, wordRange, context)
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
    console.log('outline generated')
  }

  // context = await misc.getContextFromDb(currentUser, jobId)

  console.log('generating article')
  const updatedOutline = await amazon.generateArticleClaude(outline, keyWord, context, tone, pointOfView, citeSources);

  console.log('article generated now doing gemini article')

  console.log('gemini article generated')
  const wordCount = misc.countWords(updatedOutline)
  const updatedWordCount = await misc.decrementUserWordCount(currentUser, wordCount)
  console.log('word count: ', wordCount)
  // jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
  //Outline will now contain each section filled in with data
  res.status(200).send({ "article": updatedOutline, updatedWordCount})
});

router.post('/processAmazon', async (req, res) => {
  let { keyWord, internalUrl, tone, numberOfProducts,
    pointOfView, includeFAQs,
    generatedImages, outline, currentUser, jobId, amazonUrl, affiliate } = req.body

  const length = amazon.determineArticleLength(numberOfProducts)
  const isWithinWordCount = await misc.doesUserHaveEnoughWordsAmazon(currentUser, length)

  if (!isWithinWordCount) {
    res.status(500).send("Word Count Limit Hit")
  }

  let context = ""
  if (!jobId) {
    jobId = -1
  }

  context = await amazon.performSearch(keyWord, amazonUrl, numberOfProducts, affiliate)
  // jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", context)
  outline = await amazon.generateOutlineAmazon(keyWord, context)
  // jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
  console.log('outline generated')

  console.log('generating article')
  await amazon.generateAmazonArticle(outline, keyWord, context, tone, pointOfView);

  // console.log('article generated now doing gemini article')
  // const geminiOutline = structuredClone(outline);
  // await vertex.generateArticleGemini(geminiOutline)

  // console.log('gemini article generated')
  const wordCount = amazon.countWordsClaudeBlog(outline)
  // const updatedWordCount = await misc.decrementUserWordCount(currentUser, wordCount)
  // jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
  // console.log('word count: ', wordCount)
  //Outline will now contain each section filled in with data
  res.status(200).send({ "article": outline, wordCount})
});

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

  let context = ""
  let jobId = -1
  try {
    context = await misc.doSerpResearch(keyWord, "")
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "context", context)
    const responseMessage = await misc.generateOutline(keyWord, wordRange, context)
    jobId = await misc.updateFirebaseJob(currentUser, jobId, "outline", outline)
    res.status(200).send({ responseMessage, jobId });
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

router.get("/testAmazonScraper", async (req, res) => {
  const data = await amazon.performSearch("Memory Cards", "amazon.com", 1)
  res.status(200).send(data)
})

router.get("/testClaude", async (req, res) => {
  const data = await amazon.testClaude()
  res.status(200).send(data.content[0].text)
})


router.get("/testClaudeOutline", async (req, res) => {
  const data = await amazon.generateOutlineClaude("Best ways to lose weight 2024", '2000-2500 words', "")
  res.status(200).send(data)
})

module.exports = router;

