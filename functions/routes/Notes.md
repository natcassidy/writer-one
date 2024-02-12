
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

---------------
--- Logging ---
---------------
FIXME: implement logging
Grafana * Prometheus would basically be the gold standard for this
- It's very funny that copilot keeps suggesting completions that say this would be difficult to set up
- ...is it actually difficult? compared to just having db records for logs anything else might be difficult
- ...fly.io offers fully managed grafana and prometheus

- What would be the most dead simple, cross-platform logging system?
- Having a db table for logs and just updating it with every function call would be very simple
- ...would that hit the db really hard? would it be expensive?

- I could just make a very simple CRUD app with elixir/phoenix on fly.io that just takes in logs and writes them to SQLite
- This would give me an opportunity to try fly.io and some other platforms
    - Pheonix will wrap up your app into a dockerfile/container automagically, so deploying everywhere would be crazy simple
    - I could test Litestream and LiteFS in anger, It would definitely be worth seeing if that's as robust as they seem

The big issue with moving everything over to Pheonix and/or fly.io is that there'd be a lot of stuff to learn
The advantage is that it sounds like an amazing platform with far, far less overall complexity than GCP and/or Firebase
...at least in the long run

I think trying the logging there would probably be a solid way to bang out a simple fix for a real problem and gather info
at the same time. Win-win.
- TODO: Definitely confirm with Nathaniel that he's on board with this experiment before doing it


FIXME: we should probably have every article we generate supported by some amount of data from wikipedia
- we should probably also have some way to check whether the wikipedia page is a good source for the article

How to identify the most relevant wikipedia pages?
- google search of wikipedia? (how should we make that work, in particular for multiple languages?)
How to ensure we aren't getting a disambiguation page?
- check for the "disambiguation" string in the title?
How to ensure we aren't getting a page that's too general?
- check for the "may refer to" string in the title?
How to ensure the page isn't on something else with an offhand reference to our subject?
- Wikipedia will have all kinds of articles on things that are only tangentially related to our subject
    that are still very likely to come up in search results

Use google to identify which wikipedia pages to pull
Use wikipedia/wikimedia API to pull the content

Can we come up with an automated wikimedia query generator?

--- multi-language considerations ---
English wikipedia is by far the largest