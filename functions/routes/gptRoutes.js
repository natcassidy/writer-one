const express = require('express');
const admin = require('../config/firebase');
require('dotenv').config();
const router = express.Router();
const fs = require('fs');
const path = require('path');

// app.use(cors(corsOptions));

// // Middleware for authentication
// const authMiddleware = (req, res, next) => {
//   // Retrieve the auth-key from the request headers
//   const authKey = req.headers['auth-key'];

//   // Verify the auth-key against the API_KEY_FOR_AUTH in the environment variables
//   if (authKey && authKey === process.env.API_KEY_FOR_AUTH) {
//       next(); // Key matches, proceed to the next middleware
//   } else {
//       res.status(401).json({ message: 'Unauthorized: Invalid auth-key' });
//   }
// };

// app.use(authMiddleware);

router.get('/health', (req, res) => {
  console.log('Healthy')
  res.status(200).send("I'm alive gpt")
})

router.post('/addToDoc/:docId', async (req, res) => {
  try {
    const docId = req.params.docId;
    const content = req.body.content;
    const openaiConvoId = req.headers['openai-conversation-id'];

    const constructedDocId = `${docId}-${openaiConvoId}`

    // Check if a document with the given docId exists
    const documentQuery = admin.firestore().collection('documents').where('docId', '==', constructedDocId);
    const querySnapshot = await documentQuery.get();

    if (!querySnapshot.empty) {
      // If a document with docId exists
      const documentRef = querySnapshot.docs[0].ref;
      const currentContent = (await documentRef.get()).data().content || '';

      // Split content into words and compare first four words
      const currentWords = currentContent.split(/\s+/).slice(0, 4);
      const newWords = content.split(/\s+/).slice(0, 4);

      if (currentWords.join(' ') === newWords.join(' ')) {
        // If the first four words match, return 200 and do nothing else
        return res.status(200).send('Content already present');
      }

      // Otherwise, append content to it
      const updatedContent = currentContent + "\n" + content;
      await documentRef.update({ content: updatedContent });
    } else {
      // If no document with docId exists, create a new one with docId as a field
      await admin.firestore().collection('documents').add({ docId: constructedDocId, content });
    }

    res.status(200).send('Content appended successfully');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error appending content');
  }
});


router.get('/getCompletedDoc/:docId', async (req, res) => {
  try {
    const docId = req.params.docId;
    const openaiConvoId = req.headers['openai-conversation-id'];

    const constructedDocId = `${docId}-${openaiConvoId}`

    // Check if a document with the given docId exists
    const documentQuery = admin.firestore().collection('documents').where('docId', '==', constructedDocId);
    const querySnapshot = await documentQuery.get();

    if (!querySnapshot.empty) {
      // If a document with docId exists, fetch its content and send it in the response
      const firestoreDocId = querySnapshot.docs[0].id;
      console.log('docId; ', firestoreDocId)

      let urlForResponse = `https://writer-one.com/gpt/documents/${firestoreDocId}`
      console.log('url: ', urlForResponse)
      res.status(200).send({ documentUrl: urlForResponse })
    } else {
      // If no document with docId exists, return an error
      res.status(400).send('Document not found');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error fetching document content');
  }
});

router.get('/documents/:docId', async (req, res) => {
  try {
    const docId = req.params.docId;
    const documentRef = admin.firestore().collection('documents').doc(docId);
    const documentSnapshot = await documentRef.get();

    if (documentSnapshot.exists) {
      const documentData = documentSnapshot.data();

      if (documentData && documentData.content) {
        const rawContent = documentData.content;

        // HTML response with toggle functionality
        const htmlResponse = `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Toggle HTML View</title>
              <style>
                body {
                    background-color: #333; /* Dark background */
                    color: #fff; /* Light text */
                    font-family: 'Arial', sans-serif; /* Modern font */
                    margin: 0;
                    padding: 20px;
                }

                #content {
                    border: none;
                    background-color: #444; /* Slightly lighter than body for contrast */
                    padding: 20px;
                    margin-top: 20px;
                    white-space: pre-wrap;
                    border-radius: 10px; /* Rounded corners */
                }
                
                button {
                  background-color: #6a0dad; /* Purple background */
                  color: white; /* White text for contrast */
                  border: none;
                  padding: 15px 20px; /* Increased padding for larger button */
                  margin-bottom: 10px;
                  border-radius: 5px; /* Rounded corners */
                  cursor: pointer;
                  transition: background-color 0.3s ease;
                  font-size: 16px; /* Larger font size for better readability */
                  font-weight: bold; /* Bold text for clarity */
                }
      
                button:hover {
                    background-color: #7c2ae8; /* Lighter purple on hover */
                }
            </style>
          </head>
          <body>

          <button id="toggleButton">Toggle HTML Tags On/Off</button>

          <div id="content"></div>

          <script>
            const rawContent = \`${rawContent}\`;
            const contentDiv = document.getElementById('content');
            let isRawHTML = true;

            function escapeHTML(htmlStr) {
              return htmlStr.replace(/[&<>"']/g, function(match) {
                return {
                  '&': '&amp;',
                  '<': '&lt;',
                  '>': '&gt;',
                  '"': '&quot;',
                  "'": '&#39;'
                }[match];
              });
            }

            function updateContent() {
              if (isRawHTML) {
                contentDiv.innerHTML = escapeHTML(rawContent);
              } else {
                contentDiv.innerHTML = rawContent;
              }
            }

            document.getElementById('toggleButton').addEventListener('click', function() {
              isRawHTML = !isRawHTML;
              updateContent();
            });

            updateContent(); // Initial call to set the content
          </script>

          </body>
          </html>
        `;

        res.status(200).send(htmlResponse);
      } else {
        res.status(400).send('Document content not found');
      }
    } else {
      res.status(400).send('Document not found');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error fetching document content');
  }
});

// Serve the Privacy Policy HTML page
router.get('/privacy-policy', (req, res) => {
  const filePath = path.join(__dirname, '../public/privacy-policy.html'); // Adjust the path as necessary
  fs.readFile(filePath, 'utf8', (err, htmlContent) => {
    if (err) {
      console.error('Error reading privacy-policy.html:', err);
      return res.status(500).send('Error loading the privacy policy page');
    }
    res.status(200).send(htmlContent);
  });
});

// Serve the Main Index HTML page
router.get('/', (req, res) => {
  const filePath = path.join(__dirname, '../public/index.html'); // Adjust the path as necessary
  fs.readFile(filePath, 'utf8', (err, htmlContent) => {
    if (err) {
      console.error('Error reading index.html:', err);
      return res.status(500).send('Error loading the main page');
    }
    res.status(200).send(htmlContent);
  });
});

module.exports = router;