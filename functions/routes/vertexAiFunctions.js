const axios = require('axios');
const { VertexAI, HarmCategory, HarmBlockThreshold } = require('@google-cloud/vertexai');

const project = 'writeeasy-675b2';
const location = 'us-central1';
const textModel = 'gemini-1.0-pro';
const visionModel = 'gemini-1.0-pro-vision';

const vertex_ai = new VertexAI({ project: project, location: location });

const generativeModel = vertex_ai.getGenerativeModel({
    model: textModel,
    safety_settings: [{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }],
    generation_config: { max_output_tokens: 256 },
});

async function streamGenerateContent() {
    const request = {
        contents: [{ role: 'user', parts: [{ text: 'How are you doing today?' }] }],
    };
    const streamingResp = await generativeModel.generateContentStream(request);
    let finalResponse = {}; // Initialize an empty object to hold the final response
    for await (const item of streamingResp.stream) {
        // Removed console.log, the loop now simply iterates through the stream without logging
    }
    finalResponse = await streamingResp.response; // Assign the final aggregated response
    
    return finalResponse; // Return the final aggregated response
};

const healthCheckGemini = async () => {
    try {
        // Capture the returned value from streamGenerateContent
        const response = await streamGenerateContent();
        return response; // Return the response to the caller
    } catch (error) {
        console.error('Error making the request:', error);
    }
}

const rewriteContent = async (content) => {
    const request = {
        contents: [{ role: 'user', parts: [{ text: `Rewrite this section to make it sound more natural, more human and improve the flow. : ${content} \n ONLY INCLUDE IN YOUR RESPONSE THE REWRITTEN SECTION AND NOTHING MORE.  DO NOT FORMAT ONLY RAW TEXT. try to keep your new rewritten section roughly the same length.` }] }],
    };
    const streamingResp = await generativeModel.generateContentStream(request);
    let finalResponse = {}; // Initialize an empty object to hold the final response
    // for await (const item of streamingResp.stream) {
    //     // console.log('stream chunk: ', JSON.stringify(item));
    //     // You can process individual chunks here if needed
    // }
    finalResponse = await streamingResp.response; // Assign the final aggregated response
    // console.log('aggregated response: ', JSON.stringify(finalResponse));
    return finalResponse; // Return the final aggregated response
}

const generateArticleGemini = async (outline) => {
    const promises = [];

    for (const section of outline) {
        if (section.tagName == 'h3') {
            const promise = rewriteContent(section.sectionContent).then(completion => {
                let responseMessage = completion.candidates[0].content.parts[0].text
                section.sectionContent = responseMessage; // Correctly assign to each section
            });
            promises.push(promise);
        }
    }

    return await Promise.all(promises);;
}

module.exports = {
    healthCheckGemini,
    rewriteContent,
    generateArticleGemini
};
