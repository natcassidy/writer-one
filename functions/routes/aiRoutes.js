const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).send("I'm alive ai")
})

/*

These routes are accessible on the local emulator at:
http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai/routes


Here's the body to expect from the client

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
  - Axios to fetch
  - Cheerio to extract body and anything else required to pass to model
  - TODO: will this be expensive to do on firebase functions?

TODO: 

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

  console.log(req.body)
  console.log(req.body.mainKeyword)

  res.status(200).send("Yummy blog posts for my tummy.")
});

router.get('/routes', (req, res) => {
  // test page for local dev

  const baseURL = "http://127.0.0.1:5001/writeeasy-675b2/us-central1/plugin/ai"

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
    `)
})

module.exports = router;

