const axios = require('axios');
require('dotenv').config()

// const testScraper = async () => {
//     // set up the request parameters
//     const params = {
//         api_key: process.env.ASIN_API_KEY,
//         type: "search",
//         amazon_domain: "amazon.com",
//         search_term: "memory cards"
//     }

//     // make the http GET request to ASIN Data API
//     axios.get('https://api.asindataapi.com/request', { params })
//         .then(response => {

//             // print the JSON response from ASIN Data API
//             console.log(JSON.stringify(response.data, 0, 2));

//         }).catch(error => {
//             // catch and print the error
//             console.log(error);
//         })
// }

const getReview = async (asin, associateId) => {
    const params = {
        api_key: process.env.ASIN_API_KEY,
        type: "reviews",
        amazon_domain: "amazon.com",
        asin,
        reviewer_type: "verified_purchase",
        review_media_type: "media_reviews_only",
        sort_by: "most_recent",
        associate_id: associateId ? associateId : ""
    };

    try {
        const response = await axios.get('https://api.asindataapi.com/request', { params });
        // Assuming response.data contains the reviews
        return response.data; // Adjust based on actual structure of response.data
    } catch (error) {
        console.error(error);
        return null; // Return null or an appropriate error response
    }
};

const performSearch = async (searchTerm, domain = "amazon.com", resultCount = 5, affiliateID = "") => {
    const params = {
        api_key: process.env.ASIN_API_KEY,
        type: "search",
        amazon_domain: domain,
        search_term: searchTerm,
        sort_by: "featured",
        exclude_sponsored: "true",
        associate_id: affiliateID
    };

    try {
        const response = await axios.get('https://api.asindataapi.com/request', { params });
        let searchResults = response.data.search_results;

        // Limit the searchResults to the specified resultCount
        searchResults = searchResults.slice(0, resultCount);

        const resultProductArray = await Promise.all(searchResults.map(async (result) => {
            const reviewsData = await getReview(result.asin, affiliateID);
            let reviews = []; // Default to an empty array if no reviews are found

            // Check if reviewsData is not null and has a 'reviews' property before accessing it
            if (reviewsData && reviewsData.reviews) {
                reviews = reviewsData.reviews;
            }

            return {
                title: result.title,
                description: result.description,
                image: result.image,
                link: result.link,
                price: result.price,
                rating: result.rating,
                asin: result.asin,
                reviews: reviews // Now safely set to either an empty array or the actual reviews
            };
        }));

        return resultProductArray;
    } catch (error) {
        console.error(error);
        return []; // Return an empty array or appropriate error handling
    }
};

module.exports = {
    performSearch
};