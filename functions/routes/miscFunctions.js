const cheerio = require('cheerio');

const stripEscapeChars = (string) => {
    // TODO: Check this regex to make sure it doesn't break anything.
    // I got it from the BrightData scraper and it clearly filters out 
    // junk but I'm not sure if it'll cause a problem.
    let junkRegex = /([:\u200F\u200E\f\n\r\t\v]| {2,})/g;
    string = string.replace(junkRegex, '');
    // return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // why was I dumb enough to replace the dumb stuff with .'s when I 
    // could have used something I wouldn't have to worry about confusing
    // with the actual data?

    // TODO: check the use of <?> instead of . later to make sure it fixes the problem
    // what is something else I could use that would be even less problematic?
    string = string.replace(/[\x00-\x1F\x7F-\x9F]/g, '<?>');
    // string = string.replace(/<?>{4,}/g, '<?>'); // FIXME: make sure this works
    // return string.replace(/[<?>\s]{5,}/g, '<?> '); // FIXME: make sure this works
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

module.exports = {
    stripEscapeChars,
    stripToText,
    checkIfStore,
    removeKnownGremlins,
    stripDotDotDotItems,
};