# AI-Powered Itinerary Generator

This is a serverless application that generates detailed travel itineraries using an AI Large Language Model (LLM). The project demonstrates a modern, asynchronous architecture using Cloudflare Workers for the backend API, Google Firestore for the database, and a SvelteKit frontend for real-time status checking.

## Live Demo

*   **Frontend UI (Status Checker):** [https://itinerary-generator.pages.dev/](https://itinerary-generator.pages.dev/)
*   **Backend API Endpoint:** `https://ai-itinerary-generator.myserviceisuptowork.workers.dev/`

## Features

*   **Asynchronous API:** The API responds instantly with a `jobId` while the itinerary is generated in the background.
*   **LLM Integration:** Uses the OpenAI GPT-4o model to create detailed, structured travel plans.
*   **Serverless Architecture:** Built entirely on serverless platforms (Cloudflare Workers & Pages) for infinite scalability and zero maintenance.
*   **Real-Time Status Updates:** A SvelteKit frontend listens for real-time updates from Firestore to track the job status (`processing`, `completed`, `failed`).
*   **Data Validation (Bonus Challenge):** Uses `zod` to validate incoming requests and the LLM response, ensuring data integrity.
*   **Advanced Error Handling (Bonus Challenge):** The backend includes a retry-on-failure mechanism with exponential backoff for transient LLM errors.
*   **Robust Data Parsing:** Includes resilient data cleaning and parsing on both the backend (for the LLM response) and the frontend (for the Firestore data).

## Tech Stack

*   **Backend API:** Cloudflare Workers
*   **Frontend Framework:** SvelteKit
*   **Hosting:** Cloudflare Pages
*   **Database:** Google Cloud Firestore (in Native Mode)
*   **AI Model:** OpenAI GPT-4o
*   **Schema Validation:** Zod

## Architectural Overview

The application is split into a frontend and a backend, which operate independently. The asynchronous flow is the core of the architecture.

```
1. Client makes POST request to API Worker with destination/duration.
   |
   V
2. Cloudflare Worker API:
   - Validates the request.
   - Creates a document in Firestore with status: "processing".
   - Immediately returns a 202 Accepted response with a unique `jobId`.
   - Starts a background task using `ctx.waitUntil()`.
   |
   V
3. Background Task (asynchronous):
   - Constructs a prompt and calls the OpenAI API.
   - Cleans and validates the JSON response from the LLM.
   - Updates the Firestore document with status: "completed" and the itinerary data.
   - If any step fails, it updates the document with status: "failed" and an error message.
```

The frontend uses the `jobId` to listen for changes to the specific document in Firestore in real-time.

---

## Setup and Deployment

### Prerequisites

*   Node.js and npm installed.
*   A Cloudflare account.
*   A Google Cloud account.
*   An OpenAI API Key with credits.

### Step 1: Backend Setup (Cloudflare Worker)

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/amir-esmaeili/itinerary-generator.git
    cd ai-itinerary-generator/backend
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Create a Google Cloud Service Account:**
    *   In your Google Cloud project, navigate to `IAM & Admin > Service Accounts`.
    *   Create a new service account.
    *   Grant it the **Cloud Datastore User** role.
    *   Go to the service account's "Keys" tab, create a new JSON key, and download the file.

4.  **Configure Cloudflare Secrets:**
    Log in to Wrangler and set the following secrets. The `FIREBASE_SERVICE_ACCOUNT` secret requires pasting the *entire content* of the downloaded JSON key file.

    ```bash
    # Authenticate with Cloudflare
    npx wrangler login

    # Set your Google Cloud Project ID
    npx wrangler secret put FIREBASE_PROJECT_ID

    # Set your OpenAI API Key
    npx wrangler secret put OPENAI_API_KEY

    # Set your Firebase Service Account Key
    npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
    # (Paste the full content of the JSON file here and press Enter)
    ```

5.  **Deploy the Worker:**
    ```bash
    npm run deploy
    ```
    Wrangler will output the URL of your deployed worker (e.g., `https://ai-itinerary-generator.<...>.workers.dev`).

### Step 2: Firestore Setup

1.  **Create Firestore Database:**
    *   In your Google Cloud Console, navigate to Firestore.
    *   Click "Create Database".
    *   Choose a location for your database.

2.  **Set Security Rules:**
    *   In the Firestore section of the console, click the **"Rules"** tab.
    *   Replace the existing content with the following to allow clients to read documents if they know the ID:
        ```
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /itineraries/{jobId} {
              allow read: if true;
              allow write: if false;
            }
          }
        }
        ```
    *   Click **"Publish"**.

### Step 3: Frontend Setup (SvelteKit UI)

1.  **Navigate to the Frontend Directory:**
    ```bash
    cd ../frontend
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Client-Side Firebase:**
    *   Go to the **Firebase Console** (`console.firebase.google.com`).
    *   In your project, go to **Project settings > General**.
    *   Scroll to "Your apps" and click the web icon (`</>`) to register a new web app.
    *   Firebase will provide a `firebaseConfig` object. Copy it.
    *   Open `frontend/src/lib/firebase.js` and replace the placeholder object with the one you copied.

4.  **Deploy to Cloudflare Pages:**
    ```bash
    npm run deploy
    ```
    Wrangler will build the app and deploy it, providing you with your live frontend URL (e.g., `https://itinerary-generator.pages.dev`).

---

## How to Use the Application

1.  **Get a Job ID:**
    Use a tool like `cURL` to make a `POST` request to your deployed backend worker URL.

    ```bash
    curl -X POST \
      https://ai-itinerary-generator.myserviceisuptowork.workers.dev/ \
      -H "Content-Type: application/json" \
      -d '{
        "destination": "Kyoto, Japan",
        "durationDays": 4
      }'
    ```
    The response will be a JSON object with a unique `jobId`.
    ```json
    {
      "jobId": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    }
    ```

2.  **Check the Status:**
    *   Open your live frontend URL (`https://itinerary-generator.pages.dev/`).
    *   Paste the `jobId` into the input field.
    *   Click "Check Status".
    *   The page will show the status as "Processing" and will automatically update to "Completed" when the itinerary is ready, displaying the full result.