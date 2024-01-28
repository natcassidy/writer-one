const express = require('express');
const app = express();
const cors = require('cors');
const functions = require('firebase-functions');
const aiRoutes = require('./routes/aiRoutes');
const gptRoutes = require('./routes/gptRoutes');
const adminRoutes = require('./routes/adminRoutes');
require('dotenv').config();

const corsOptions = {
  origin: 'https://chat.openai.com',
  optionsSuccessStatus: 200 
}

app.use(cors(corsOptions));
app.use(express.json());
app.use('/ai', aiRoutes);
app.use('/gpt', gptRoutes);
app.use('/admin', adminRoutes);

exports.plugin = functions.https.onRequest(app); 