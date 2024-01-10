const express = require('express');
const app = express();
const cors = require('cors');
const functions = require('firebase-functions');
const admin = require('./config/firebase');
const path = require('path');

const corsOptions = {
  origin: 'https://chat.openai.com',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions));

app.post('/addToDoc/:docId', async (req, res) => {
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


app.get('/getCompletedDoc/:docId', async (req, res) => {
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

      let urlForResponse = `https://writer-one.com/documents/${firestoreDocId}`
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

app.get('/documents/:docId', async (req, res) => {
  try {
    const docId = req.params.docId;

    console.log('docId', docId);
    // Access the specific document by its ID
    const documentRef = admin.firestore().collection('documents').doc(docId);
    const documentSnapshot = await documentRef.get();

    if (documentSnapshot.exists) {
      // If a document with docId exists, fetch its content and send it in the response
      const documentData = documentSnapshot.data();

      if (documentData && documentData.content) {
        const content = documentData.content;
        console.log('content ', content);
        res.status(200).send(content);
      } else {
        res.status(400).send('Document content not found');
      }
    } else {
      // If no document with docId exists, return an error
      res.status(400).send('Document not found');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error fetching document content');
  }
});

exports.plugin = functions.https.onRequest(app); 