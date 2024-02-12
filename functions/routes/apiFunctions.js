const misc = require('./miscFunctions');

const fetchWikipedia = (el) => {
  /*
    Should be a language-independent way to pull arbitrary page data from wikipedia
  */
  const language = el.link.split(".")[0].split("//")[1];
  const title = el.title.split(" -")[0];
  const url = `https://${language}.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&origin=*&titles=${title}`;
  fetch(url)
    .then(response => {
      if (!response.ok) {
          throw new Error('wikipedia fetch failed!' + response.status + " - " + response.statusText);
      }
      return response.json(); // Parse the response body as JSON
    })
    .then(data => { // FIXME: getting the contents of data into the returned object isn't done
      // Process the JSON data
      const pages = data.query.pages;
      const page = pages[Object.keys(pages)[0]]; // Get the first page in the response
      const content = page.extract; // Extract the content of the page

      // console.log(Object.keys(data.query.pages));
      // console.log(content);
  
      return { 
        status: "good", 
        type: "wikipedia", 
        link: el.link, 
        title: el.title, 
        description: el.description ? el.description : "", 
        data: misc.stripEscapeChars(content),
      };
    })
    .catch(err => {
      console.error('Failed to fetch data:', err);
  
      return { status: "bad", err: err, headers: err.headers };
    });
}

module.exports = { 
  fetchWikipedia
};