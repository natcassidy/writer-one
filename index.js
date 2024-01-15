const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const pdfParse = require('pdf-parse');
const app = express();
const cors = require('cors');
require('dotenv').config()
const { Configuration, OpenAIApi } = require("openai");
const OpenAIEmbeddings = require('langchain/embeddings/openai').OpenAIEmbeddings;
const PineconeClient = require('@pinecone-database/pinecone').PineconeClient;
const { CloudTasksClient } = require('@google-cloud/tasks');
const { v4: uuidv4 } = require('uuid');

const pinecone = new PineconeClient();
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const tasksClient = new CloudTasksClient();

(async () => {
    await pinecone.init({
        environment: process.env.PINECONE_ENVIRONMENT,
        apiKey: process.env.PINECONE_API_KEY
    });
    const index = pinecone.Index('write-easy')

    const corsOptions = {
        origin: 'https://chat.openai.com',
        optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
    }

    app.use(cors(corsOptions));

    app.get('/analyze', async (req, res) => {
        console.log('inside analyze')
        const openaiConvoId = req.headers['openai-conversation-id'];
        console.log('openaiconvoid: ', openaiConvoId)

        let urls = prepareUrls(req.query.urls);
        const queries = req.query.queries;

        let allContent = await fetchContent(urls);

        try {
            console.log('adding doc');
            const vectors = await createVectors(allContent, openaiConvoId);
            await index.upsert({
                upsertRequest: {
                    vectors: vectors,
                    namespace: `${openaiConvoId}`,
                },
            });
            console.log('done adding docs');
        } catch (e) {
            console.log('exception:', e);
        }

        let allResults = await getQueryResults(queries, openaiConvoId);


        /**
         * task queue for deletion
         */
        const projectId = process.env.PROJECT_ID;
        const queueName = 'vector-deletion-queue'; // The name of the queue you created
        const location = 'northamerica-northeast1'; // The region where your queue is located
        const url = `https://trendseerai.com/deleteVectors`;
        const oneHourInSeconds = 60;

        // const parent = tasksClient.queuePath(projectId, location, queueName);
        // const task = {
        //     httpRequest: {
        //         httpMethod: 'POST',
        //         url: `${url}?openaiConvoId=${openaiConvoId}`,
        //         headers: {
        //             'Content-Type': 'application/json',
        //         },
        //     },
        //     scheduleTime: {
        //         seconds: Math.floor(Date.now() / 1000) + oneHourInSeconds
        //     },
        // };

        // await tasksClient.createTask({ parent, task })
        //     .then(() => {
        //         console.log("Vector deletion scheduled successfully");
        //     })
        //     .catch((error) => {
        //         console.error(`Error: ${error.code} - ${error.message}`);
        //     });

        res.json({ results: allResults });
    });

    app.get('/query', async (req, res) => {
        const openaiConvoId = req.headers['openai-conversation-id'];
        console.log('openaiconvoid: ', openaiConvoId)

        let queries = prepareQueries(req.query.queries);

        let allResults = await getQueryResults(queries, openaiConvoId);
        res.status(200).send(allResults);
    });

    app.post('/deleteVectors', async (req, res) => {
        const openaiConvoId = req.body.openaiConvoId;
        console.log('openaiconvoid: ', openaiConvoId)

        await index.delete({
            deleteRequest: {
                ids: ['*'],
                namespace: `${openaiConvoId}`,
            },
        });

        res.status(200).send('Vectors deleted successfully');
    });

    async function fetchContent(urls) {
        let allContent = ""
        for (let url of urls) {
            const content = await getContentFromUrl(url);
            allContent += content;
        }
        return allContent;
    }

    function prepareUrls(urls) {
        // Check if urls is a string, if so, convert it to an array
        if (typeof urls === 'string') {
            urls = [urls];
        }

        // If urls is undefined, set it to an empty array
        if (!urls) {
            urls = [];
        } else {
            urls = urls.slice(0, 3);
        }
        return urls;
    }

    async function getContentFromUrl(url) {
        console.log('url: ', url)
        const response = await axios.get(url, { responseType: 'arraybuffer', validateStatus: false });
        const contentType = response.headers['content-type'];

        let content;
        const $ = cheerio.load(response.data);
        content = $('article').text() || $('main').text() || $('section').text() || $('div').text() || $('p').text();

        return content;
    }

    async function createVectors(allContent, openaiConvoId) {
        const batchSize = 1000;
        const chunks = chunk(allContent, batchSize).slice(0, 30);

        const vectors = []
        for (let chunk of chunks) {
            try {
                const doc = chunk;
                let vectorId = uuidv4();
                const embeddedText = await openai.createEmbedding({
                    model: "text-embedding-ada-002",
                    input: doc,
                });
                const metadata = { text: doc, convo_id: openaiConvoId, vector_id: vectorId };

                const vector =
                {
                    id: vectorId,
                    values: embeddedText.data.data[0].embedding,
                    metadata: metadata,
                }
                // console.log('vector: ', vector)
                vectors.push(vector)
            } catch (e) {
                console.log('exception creating embedding: \n', e)
            }

        }
        return vectors;
    }


    async function getQueryResults(queries, openaiConvoId) {
        let allResults = [];
        let resultIds = [];
        for (let query of queries) {
            // console.log('embedding query: ', query)
            const queryEmbeddings = await openai.createEmbedding({
                model: "text-embedding-ada-002",
                input: query,
            });

            const embedding = queryEmbeddings.data.data[0].embedding
            try {
                const queryResponse = await index.query({
                    queryRequest: {
                        topK: 2,
                        includeValues: false,
                        includeMetadata: true,
                        vector: embedding,
                        namespace: `${openaiConvoId}`,
                        filter: {
                            "vector_id": { "$nin": resultIds }
                        }
                    },
                });

                for (let match of queryResponse.matches) {
                    // console.log('text: ', match.metadata.text);
                    // console.log('score: ', match.score)
                    // console.log('metadata: ', match.metadata)
                    const dataItem = {
                        text: match.metadata.text,
                        score: match.score
                    }
                    resultIds.push(match.metadata["vector_id"])
                    console.log('match: ', match.metadata)
                    allResults.push(dataItem)
                }
            } catch (err) {
                console.log("error finding matches: ", err);
                allResults.push({ message: `${query} doesn't match any search` });
            }
        }
        return allResults;
    }


    function chunk(arr, size) {
        return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
            arr.slice(i * size, (i + 1) * size)
        );
    }

    function prepareQueries(queries) {
        // If queries is a string, convert it to an array
        if (typeof queries === 'string') {
            queries = [queries];
        }
        return queries;
    }


    app.get("/.well-known/ai-plugin.json", (req, res) => {
        console.log('sending wellknown')
        res.sendFile(path.join(__dirname, "/.well-known/ai-plugin.json"));
    });

    app.get("/openai.yaml", (req, res) => {
        console.log('sending yaml')
        res.sendFile(path.join(__dirname, 'openai.yaml'));
    });

    app.get('/legal', (req, res) => {
        res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Write Easy Plugin - Legal Information Document</title>
        <style>
            body {
                font-family: Arial, sans-serif;
            }
            h1, h2 {
                color: #333;
            }
        </style>
    </head>
    <body>
        <h1>Write Easy Plugin - Legal Information Document</h1>
        <h2>1. Introduction</h2>
        <p>This document outlines the legal information and terms of use for the Write Easy Plugin (hereinafter referred to as "the Plugin"). By using the Plugin, you agree to abide by these terms. Please read them carefully.</p>
        <h2>2. No Warranty</h2>
        <p>The Plugin is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the Plugin or the use or other dealings in the Plugin.</p>
        <h2>3. No Responsibility for AI Detection Failures</h2>
        <p>The Plugin is designed to assist users in creating content that is virtually undetectable by AI writing detectors. However, the Plugin does not guarantee that the content generated will always pass AI detection. The user assumes all responsibility for any content that fails AI detection. The Plugin, its authors, and affiliates take no responsibility for any consequences, penalties, or damages that may arise due to content failing AI detection.</p>
        <h2>4. User Responsibility</h2>
        <p>The user is solely responsible for the content they generate using the Plugin. This includes ensuring the content is legal, ethical, and does not infringe on any copyrights or other rights. The user is also responsible for the consequences of any content that fails AI detection.</p>
        <h2>5. Indemnification</h2>
        <p>The user agrees to indemnify, defend, and hold harmless the Plugin, its authors, and affiliates from and against all losses, expenses, damages and costs, including reasonable attorneys' fees, resulting from any violation of these terms of use or any activity related to the user's account (including negligent or wrongful conduct) by the user or any other person accessing the Plugin using the user's account.</p>
        <h2>6. Changes to Terms</h2>
        <p>The Plugin reserves the right to change these terms at any time without notice. It is the user's responsibility to regularly check these terms for updates.</p>
        <h2>7. Governing Law</h2>
        <p>These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the Plugin's authors are based, without regard to its conflict of law provisions.</p>
        <h2>8. Contact Information</h2>
        <p>For any queries or concerns regarding these terms, please contact the Plugin's authors at the provided contact information.</p>
        <p>By using the Plugin, you acknowledge that you have read, understood, and agree to be bound by these terms.</p>
        <p>Last Updated: May 30, 2023</p>
        </body>
    </html>    
    `);
    });

    app.listen(3000, () => {
        console.log(`App listening on port 3000`)
    });

})();