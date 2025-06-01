# Writer-One Backend: Advanced AI Content Generation Engine

This backend powers Writer-One, a platform designed to elevate AI content creation beyond simple prompts. It addresses common limitations of basic AI interfaces by integrating real-time data, custom user configurations, and robust background processing for a richer, more efficient content generation experience.

**See it in action:** [Writer-One Frontend](https://writer-one-frontend.vercel.app/)

## Solving Real-World Content Challenges

Standard AI tools often lack contextual depth and specific features needed for professional content. Writer-One tackles this by:

1.  **Injecting Real-Time Context:** Instead of relying solely on the AI's training data, it performs **live SERP analysis** (via BrightData/Google Search) and **fetches current Amazon product data** (using ASINData API) to ground generated articles in relevant, up-to-date information.
2.  **Streamlining Workflow:** The **asynchronous bulk generation** feature, built using Firebase Cloud Functions and Pub/Sub, allows users to queue multiple articles, freeing them from waiting for individual completions. This demonstrates building scalable, non-blocking background task processing.
3.  **Personalizing Output:** Goes beyond simple tone prompts by implementing **custom voice tuning**. The system analyzes user-provided text samples to guide the AI (Google Gemini) in mimicking a specific writing style, ensuring brand consistency.
4.  **Integrating SEO Elements:** Allows users to specify **internal URLs** to be naturally woven into the generated content, addressing a common SEO requirement often missing from basic AI tools.

## Key Technical Highlights & Demonstrations

This project showcases experience in:

*   **Integrating Multiple External APIs:** Effectively managing requests, responses, and error handling for Google Gemini, Stripe, ASINData, and potentially SERP APIs within a cohesive application flow.
*   **Building Asynchronous Job Queues:** Leveraging **Firebase Pub/Sub and Cloud Functions** for reliable, scalable background task execution (bulk article generation). This includes managing job states (pending, inProgress, completed, error) in Firestore.
*   **Cloud-Native Architecture:** Utilizing a serverless approach with **Firebase Cloud Functions** for API endpoints and background tasks, alongside **Firestore** for data persistence and real-time updates (though not heavily used for real-time in this context).
*   **Secure Payment Integration:** Implementing **Stripe** for subscription management, including secure handling of payments and state changes via **webhook signature verification**.
*   **TypeScript & Modern Backend Practices:** Using **TypeScript** for enhanced type safety and maintainability, building upon **Node.js** and **Express.js**, and adopting **ESM modules**.
*   **API Design:** Structuring RESTful endpoints in Express for different functionalities (AI tasks, admin, webhooks).
*   **Web Data Extraction:** Utilizing tools like Axios and potentially Cheerio/proxy services for targeted data fetching from web sources.

## Core Technologies

*   **Runtime/Language:** Node.js, TypeScript
*   **Framework:** Express.js
*   **Cloud:** Firebase (Cloud Functions, Firestore, Pub/Sub, Authentication)
*   **AI:** Google Gemini (via `@google/generative-ai`)
*   **Payments:** Stripe API
*   **Data APIs:** ASINData API, Google Search (via BrightData or similar)
*   **Testing:** Jest, Supertest

---

## Getting Started

### Prerequisites

*   Node.js (v18+) & npm/yarn
*   Firebase CLI (`npm i -g firebase-tools`), logged in (`firebase login`)
*   Firebase Project (Functions, Firestore, Pub/Sub enabled)
*   API Keys: Google Gemini, Stripe (Secret Key + Webhook Secret), ASINData
*   (Optional) BrightData Credentials

### Environment Setup

1.  Navigate to the `functions` directory.
2.  Create a `.env` file by copying `.env.example` (see below).
3.  Fill in your API keys and Firebase project details. **Never commit your `.env` file!**

```dotenv
# .env.example (Fill with your actual values)

# Google Gemini
GEMINI_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-1.5-flash-latest
GEMINI_MODEL_PRO=gemini-1.5-pro-latest

# Firebase (Path relative to 'functions' dir OR setup GOOGLE_APPLICATION_CREDENTIALS for local dev)
FB_CREDENTIAL_PATH=./path/to/your/serviceAccountKey.json

# Stripe
STRIPE_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_STRIPE_WEBHOOK_SIGNING_SECRET
PRICE_10_PRICE=price_...
PRICE_30_PRICE=price_...
PRICE_100_PRICE=price_...
PRICE_300_PRICE=price_...

# Amazon Product Data API
ASIN_API_KEY=YOUR_ASINDATA_API_KEY

# BrightData (if used)
BRIGHTDATA_SERP_USERNAME=...
BRIGHTDATA_SERP_PASSWORD=...
BRIGHTDATA_DC_USERNAME=...
BRIGHTDATA_DC_PASSWORD=...
