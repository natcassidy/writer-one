// firebase.ts
import { initializeApp, getApp, cert, App, getApps } from 'firebase-admin/app';
import 'dotenv/config'; // Make sure .env is loaded BEFORE any access to process.env

let appInstance: App;

// It's good practice to wrap initialization in a try-catch
try {
  if (!getApps().length) {
    console.log('Attempting to initialize Firebase Admin App...');

    // --- THIS IS THE MOST LIKELY POINT OF FAILURE ---
    const credentialPath = process.env.FB_CREDENTIAL_PATH;
    console.log(`FB_CREDENTIAL_PATH from .env: "${credentialPath}"`); // DEBUG

    if (!credentialPath) {
      throw new Error('FB_CREDENTIAL_PATH environment variable is not set. Please check your .env file or environment configuration.');
    }

    // cert() expects a path to the JSON file or the parsed JSON object.
    // If FB_CREDENTIAL_PATH is a path, this is correct.
    // If FB_CREDENTIAL_PATH is the JSON string itself, you need JSON.parse() first.
    // Assuming it's a path as the variable name suggests:
    const serviceAccount = cert(credentialPath);

    appInstance = initializeApp({
      credential: serviceAccount,
      // Optionally, you can specify a databaseURL if you have multiple RTDB instances or a non-default one.
      // databaseURL: 'https://<YOUR_PROJECT_ID>.firebaseio.com'
    });
    console.log('Firebase Admin App initialized successfully.');
  } else {
    console.log('Firebase Admin App already initialized. Getting existing instance.');
    appInstance = getApp();
  }
} catch (error) {
  console.error('FATAL ERROR: Firebase Admin SDK initialization failed:', error);
  // Depending on your application, you might want to re-throw or process.exit
  // throw error; // or process.exit(1);
  // For now, let's ensure appInstance is undefined so subsequent calls might fail more clearly
  appInstance = undefined as any; // To make it clear it failed
}

export { appInstance };