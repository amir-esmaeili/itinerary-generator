/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {ErrorConstructor} retryableError - The specific error class to catch for retries
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000, retryableError = Error) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry if the error is an instance of the specified retryableError
      if (error instanceof retryableError && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `Attempt ${attempt + 1} failed with retryable error, retrying in ${delay}ms:`,
          error.message
        );
        await sleep(delay);
      } else {
        // If it's not a retryable error or we've run out of retries, re-throw.
        throw lastError;
      }
    }
  }
}

/**
 * @param {object} env - Environment variables
 * @throws {Error} If required variables are missing
 */
export function validateEnvironment(env) {
  const required = [
    "FIREBASE_SERVICE_ACCOUNT",
    "FIREBASE_PROJECT_ID",
    "OPENAI_API_KEY",
  ];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

/**
 * @returns {object} CORS headers
 */
export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} [details] - Additional error details
 * @returns {Response}
 */
export function createErrorResponse(message, status = 500, details = null) {
  const corsHeaders = getCorsHeaders();
  const body = { error: message };
  if (details) body.details = details;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

/**
 * @param {object} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
export function createSuccessResponse(data, status = 200) {
  const corsHeaders = getCorsHeaders();

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
