import { RequestSchema } from "./types.js";
import { generateItinerary } from "./llm.js";
import { FirestoreClient, getAccessToken } from "./firestore.js";
import {
  generateUUID,
  validateEnvironment,
  getCorsHeaders,
  createErrorResponse,
  createSuccessResponse,
} from "./utils.js";

/**
 * Main Cloudflare Worker handler
 */
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders();

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return createErrorResponse("Method not allowed. Use POST.", 405);
    }

    try {
      console.log("Processing itinerary request...");

      // Validate environment variables
      validateEnvironment(env);
      console.log("Environment variables validated");

      // Parse and validate request body
      let requestBody;
      try {
        requestBody = await request.json();
      } catch (parseError) {
        return createErrorResponse("Invalid JSON in request body", 400);
      }

      console.log("Request body:", requestBody);

      // Validate request schema
      let validatedRequest;
      try {
        validatedRequest = RequestSchema.parse(requestBody);
      } catch (validationError) {
        const errorMessage = validationError.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");
        return createErrorResponse(`Invalid request: ${errorMessage}`, 400);
      }

      const { destination, durationDays } = validatedRequest;
      console.log(`Validated request: ${destination}, ${durationDays} days`);

      // Generate unique job ID
      const jobId = generateUUID();
      console.log("Generated job ID:", jobId);

      // Initialize Firestore client
      const accessToken = await getAccessToken(env.FIREBASE_SERVICE_ACCOUNT);
      const firestore = new FirestoreClient(
        env.FIREBASE_PROJECT_ID,
        accessToken
      );

      // Create initial document with processing status
      await firestore.createDocument("itineraries", jobId, {
        status: "processing",
        destination,
        durationDays,
        createdAt: new Date(),
        completedAt: null,
        itinerary: null,
        error: null,
      });

      console.log("Initial document created, starting background processing");

      // Start background processing (asynchronous)
      ctx.waitUntil(
        processItinerary(firestore, jobId, destination, durationDays, env)
      );

      // Return immediate response with job ID
      return createSuccessResponse({ jobId }, 202);
    } catch (error) {
      console.error("Main handler error:", error);
      console.error("Error stack:", error.stack);

      return createErrorResponse(
        "Internal server error occurred",
        500,
        error.message
      );
    }
  },
};

/**
 * @param {FirestoreClient} firestore - Firestore client instance
 * @param {string} jobId - Job ID
 * @param {string} destination - Travel destination
 * @param {number} durationDays - Duration in days
 * @param {object} env - Environment variables
 */
async function processItinerary(
  firestore,
  jobId,
  destination,
  durationDays,
  env
) {
  try {
    console.log(`Starting background processing for job: ${jobId}`);

    // Generate itinerary using LLM
    const itinerary = await generateItinerary(
      destination,
      durationDays,
      env.OPENAI_API_KEY
    );

    console.log(`Itinerary generated successfully for job: ${jobId}`);

    await firestore.updateDocument("itineraries", jobId, {
      status: "completed",
      destination,
      durationDays,
      completedAt: new Date(),
      itinerary,
      error: null,
    });

    console.log(
      `Background processing completed successfully for job: ${jobId}`
    );
  } catch (error) {
    console.error(`Background processing error for job ${jobId}:`, error);

    try {
      await firestore.updateDocument("itineraries", jobId, {
        status: "failed",
        completedAt: new Date(),
        error: error.message,
      });

      console.log(`Error status updated for job: ${jobId}`);
    } catch (updateError) {
      console.error(
        `Failed to update error status for job ${jobId}:`,
        updateError
      );
    }
  }
}
