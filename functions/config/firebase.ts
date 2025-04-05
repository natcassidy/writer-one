import admin from 'firebase-admin';
import 'dotenv/config';

admin.initializeApp({
  credential: admin.credential.cert(process.env.FB_CREDENTIAL_PATH),
});

module.exports = admin;