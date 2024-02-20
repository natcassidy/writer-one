function checkerString(obj){
    Object.keys(obj).forEach((item) => {
      if(typeof obj[item] == "string" && !obj[item])
        obj[item] = null
    })
    return obj
  }
  
  let junkRegex = /([:\u200F\u200E\f\n\r\t\v]| {2,})/g;
  let details = [];
  
  $('#detailBullets_feature_div li').toArray().forEach(e=>{
      const key = $(e).find('.a-list-item > span.a-text-bold').text().replace(junkRegex, '').trim();
      const value = $(e).find('.a-list-item > span:not([class])').text().replace(junkRegex, '').trim();
      if (key)
          details.push({ key, value });
  });
  
  $('#productOverview_feature_div tbody > tr').toArray().forEach(e=>{
      const key = $(e).find('.a-span3 > span').text().replace(junkRegex, '').trim();
      const value = $(e).find('.a-span9 > span').text();
      if (key)
          details.push({ key, value });
  });
  
  $('[id^="productDetails_detailBullets_sections"] tbody > tr:has(td.prodDetAttrValue)').toArray().forEach(e=>{
      const key = $(e).find('.prodDetSectionEntry').text().replace(junkRegex, '').trim();
      const value = $(e).find('.prodDetAttrValue').text().replace(junkRegex, '').trim();
      if (key)
          details.push({ key, value });
  });
  
  $('#prodDetails  .prodDetTable tr').toArray().forEach(e=>{
      const key = $(e).find('th').text().replace(junkRegex, '').trim();
      const value = $(e).find('td').text().replace(junkRegex, '').trim();
      if (key)
          details.push({ key, value });
  });
  
  function getDetailByName(name, inclusive = false) {
      let detail;
      if (inclusive) {
          detail = details.find(e=>(String(e.key).toLowerCase().includes(String(name).toLowerCase())));
      } else {
          detail = details.find(e=>(String(e.key).toLowerCase() == String(name).toLowerCase()));
      }
      return detail ? detail.value : null;
  };
  
  let productSpecs = details?.map(e=>({title: e.key, value: e.value }));
  
  let ASIN = (location.href)?.replace(/.*\/dp\/([^\/?]*)(\?.*|\/.*|$)/, '$1')
      || $('[rel="canonical"]').attr('href')?.replace(/.*\/dp\/([^\/]*)(\/.*|$)/, '$1')
      || getDetailByName('ASIN')
      || null;
  
  let title = $('#productTitle').text().trim() || null;
  
  let initialPrice = +(( ''
      || $('#centerCol [data-a-strike="true"] .a-offscreen').eq(0).text().trim()
      || $('#gsod_singleOfferDisplay_Desktop').find('#booksAdditionalPriceInfoContainer .a-text-strike').eq(0).text().trim()
  )?.replace(/(\.|,)(\d{3})/g, '$2').replace(/(\.|,)(\d{2}\D*)$/, '.' + '$2').replace(/[^0-9.]/g, '').trim())
      || null;
  
  let finalPrice = +( ''
      || $('#buybox #offerDisplayGroup .a-tab-content:not(.a-hidden) ').find(
          '#buyBoxAccordion .a-accordion-active' + ',' + 
          '[id^="gsod_singleOfferDisplay"] #qualifiedBuybox'
      ).find('#corePrice_feature_div .a-offscreen').eq(0).text()
      || $('#buyBoxAccordion .a-accordion-active').find('#corePrice_feature_div .a-offscreen, .a-color-price').eq(0).text()
      || $('[id^="gsod_singleOfferDisplay"] #qualifiedBuybox').find('#corePrice_feature_div .a-offscreen').eq(0).text()
      || $('#tmmSwatches .swatchElement.selected .a-color-base').eq(0).text().trim()
      || $('#kindle-price').eq(0).text().trim()
      || $('#priceblock_ourprice').eq(0).text().trim()                   // may be legacy code
      || $('#priceblock_dealprice').eq(0).text().trim()                  // may be legacy code
      || $('#priceblock_saleprice').eq(0).text().trim()                  // may be legacy code
      || $('[data-automation-id*="tvod_purchase"]').eq(0).text()         // may be legacy code
  )?.replace(/(\.|,)(\d{3})/g, '$2').replace(/(\.|,)(\d{2}\D*)$/, '.' + '$2').replace(/[^0-9.]/g, '').trim()
      || null;
  
  let image = null
      || $('#imgTagWrapperId img').eq(0).attr('src')
      || $('#img-canvas > img').eq(0).attr('src')
      || $('#ebooksImgBlkFront').eq(0).attr('src')
      || $('#ebooks-img-canvas > img').eq(0).attr('src')
      || null;    
  if (image)
      image = new Image( (new URL(image, location.href)).href );
  
  let reviewsCount = +$('#acrCustomerReviewText').eq(0).text().replace(/\D/g, '').trim()
      || +$('[data-hook="total-review-count"]').eq(0).text().replace(/\D/g, '').trim()
      || 0;
  
  let rating = +$('#averageCustomerReviews a > span.a-color-base').eq(0).text().trim()
      || +$('#centerCol #acrPopover[title]').attr('title')?.replace(/([0-9.,]{1,3})( |\u00a0).*/g, '$1').replace(/,/g, '.')
      || +$('[data-hook="average-star-rating"]').text().trim()?.replace(/([0-9.,]{1,3})( |\u00a0).*/g, '$1').replace(/,/g, '.')
      || 0;
  
  function getCurrency(url) {
      let countryCode = (new URL(url || location.href)).origin
          .replace(/https:\/\/www\.amazon\.(com?\.)?(.*)/g, '$2').replace('com', 'us');
      let res = 'USD';
      switch (countryCode) {
          case 'uk': res = 'GPB'; break;
          case 'au': res = 'AUD'; break;
          case 'in': res = 'INR'; break;
          case 'mx': res = 'MXD'; break;        
          case 'jp': res = 'JPY'; break;
          case 'cn': res = 'CNY'; break;
          case 'ca': res = 'CAD'; break;
          case 'eg': res = 'EGP'; break;
          case 'br': res = 'BRL'; break;
          case 'sa': res = 'SAR'; break;
          case 'sg': res = 'SGD'; break;
          case 'tr': res = 'TRY'; break;
          case 'ae': res = 'AED'; break;
          case 'se': res = 'SEK'; break;       
          case 'pl': res = 'PLN'; break;      
          case 'be': case 'de': case 'fr': case 'it': case 'es': case 'nl':
             res = 'EUR';
          break;  
          case 'com': case 'us': default: 
             res = 'USD';         
      }
      return res;
  };
  let currency = getCurrency();
  
  let data = {
      ASIN,
      title,
      initialPrice: (initialPrice || (initialPrice === 0)) ? new Money(initialPrice, currency) : null,        
      finalPrice: (finalPrice || (finalPrice === 0)) ? new Money(finalPrice, currency) : null,
      image,
      reviewsCount,
      rating,
      productSpecs,
  };
  
  data = checkerString(data);
  return data;