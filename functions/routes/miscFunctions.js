const cheerio = require('cheerio');

const stripEscapeChars = (string) => {
    // return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
    string = string.replace(/\.{4,}/g, '...');
    return string.replace(/[\.\s]{5,}/g, '... ');
}

function stripToText(html) {
    if (!html) {
      return "";
    }
    const $ = cheerio.load(html);
    $('script').remove();
    $('noscript').remove();
    $('style').remove();
    $('svg').remove();
    $('img').remove();
    $('nav').remove();
    $('iframe').remove();
    $('form').remove();
    $('input').remove();
    $('button').remove();
    $('select').remove();
    $('textarea').remove();
    $('audio').remove();
    $('video').remove();
    $('canvas').remove();
    $('embed').remove();

    //remove html comments
    $('*').contents().each(function() {
      if (this.nodeType === 8) {
        $(this).remove();
      }
    });

    // return $('body').prop('innerText');
    // return $('body').prop('innerHTML');
    return $('body').prop('textContent');
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
    return
}

const stripDotDotDotItems = (string) => {
    // return string.replace(/\.{3}[A-z]{,25}\.{3}/g, '...');
    return
}

const removeKnownGremlins = (string) => {
    string = string.replace(/’/g, "'");
    string = string.replace(/–/g, "-");
    string = string.replace(/[“”]/g, '"');
    string = string.replace(/⁄/g, '/');
    return string;
}

function flattenJsonToHtmlList(json) {
    // Initialize the result array and a variable to keep track of ids
    const resultList = [];
    let idCounter = 1;
  
    // Function to add items to the result list
    const addItem = (tagName, content) => {
      resultList.push({ id: idCounter.toString(), tagName, content });
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
            addItem("h3", subsection.name);
          });
        }
      });
    }
  
    return resultList;
  }
  
  
  // Example JSON input
  const jsonInput = {
    "title": "Best cat breeds",
    "sections": [
      {
        "name": "Top 5 Popular Breeds",
        "subsections": [
          {"name": "Siamese"},
          {"name": "Maine Coon"},
          {"name": "Persian"},
          {"name": "Ragdoll"},
          {"name": "Bengal"}
        ]
      },
      {
        "name": "Unique and Rare Breeds",
        "subsections": [
          {"name": "Sphynx"},
          {"name": "Scottish Fold"},
          {"name": "Norwegian Forest Cat"},
          {"name": "Tonkinese"},
          {"name": "Burmese"}
        ]
      }
    ]
  };
  
  // Convert the input JSON to the desired flatmap format
  const flatList = flattenJsonToHtmlList(jsonInput);
  
  // Log the result to the console
  console.log(flatList);
  

module.exports = {
    stripEscapeChars,
    stripToText,
    checkIfStore,
    removeKnownGremlins,
    stripDotDotDotItems,
    flattenJsonToHtmlList
};