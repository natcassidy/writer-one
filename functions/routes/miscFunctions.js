const cheerio = require('cheerio');

const stripEscapeChars = (string) => {
    // return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
    string = string.replace(/\.{4,}/g, '...');
    return string.replace(/[\.\s]{5,}/g, '... ');
}

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

const checkIfStore = (string) => {
    lString = string.toLowerCase();
    if (lString.includes("add to cart")) {
        return true;
    } else if (lString.includes("free shipping on orders over")) {
        return true;
    } else {
        return false;
    }
}

module.exports = {
    stripEscapeChars,
    stripToText,
    checkIfStore,
};