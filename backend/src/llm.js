import { ItinerarySchema } from "./types.js";
import { retryWithBackoff } from "./utils.js";

// Custom error to distinguish between retryable and fatal errors
class RetryableError extends Error {}

/**
 * @param {string} destination - Travel destination
 * @param {number} durationDays - Duration in days
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array>} Generated itinerary
 */
export async function generateItinerary(destination, durationDays, apiKey) {
  console.log(`Generating itinerary for: ${destination}, ${durationDays} days`);

  const prompt = createItineraryPrompt(destination, durationDays);

  const generateFn = async () => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a professional travel planner with extensive knowledge of destinations worldwide. You create detailed, practical itineraries that balance must-see attractions with authentic local experiences. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", {
        status: response.status,
        error: errorText,
      });

      // Only retry on specific temporary errors (rate limits, server errors).
      if (response.status === 429 || response.status >= 500) {
        throw new RetryableError(`OpenAI service error: ${response.status}`);
      }

      // For other client errors (e.g., 401 Unauthorized), fail immediately.
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Invalid response structure from OpenAI API");
    }

    console.log("Raw OpenAI response received, length:", content.length);

    const startIndex = content.indexOf("[");
    const endIndex = content.lastIndexOf("]");

    if (startIndex === -1 || endIndex === -1) {
      console.error("Could not find JSON array in LLM response:", content);
      throw new RetryableError(
        "LLM response did not contain a valid JSON array."
      );
    }

    // Extract the substring that contains only the JSON array.
    const jsonString = content.substring(startIndex, endIndex + 1);
    console.log(
      "Extracted JSON string for parsing, length:",
      jsonString.length
    );

    console.log("OpenAI response received, length:", content.length);

    let itinerary;
    try {
      itinerary = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse the cleaned JSON string:", parseError);
      throw new RetryableError(
        "LLM returned invalid JSON format even after cleaning."
      );
    }

    try {
      const validatedItinerary = ItinerarySchema.parse(itinerary);
      console.log(
        `Itinerary validated successfully: ${validatedItinerary.length} days`
      );
      return validatedItinerary;
    } catch (validationError) {
      console.error("Itinerary validation failed:", validationError.message);
      throw new RetryableError(
        `Generated itinerary doesn't match required format: ${validationError.message}`
      );
    }
  };

  return await retryWithBackoff(generateFn, 3, 2000, RetryableError);
}

/**
 * @param {string} destination - Travel destination
 * @param {number} durationDays - Duration in days
 * @returns {string} Formatted prompt
 */
function createItineraryPrompt(destination, durationDays) {
  return `Create a detailed ${durationDays}-day travel itinerary for ${destination}.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no additional text, explanations, or markdown
2. Follow the exact structure specified below
3. Include exactly ${durationDays} days
4. Each day must have exactly 3 activities: Morning, Afternoon, and Evening
5. Provide specific, actionable descriptions with practical tips
6. Include real location names and addresses when possible

REQUIRED JSON STRUCTURE:
[
  {
    "day": 1,
    "theme": "Brief descriptive theme for the day (e.g., 'Historical Exploration')",
    "activities": [
      {
        "time": "Morning",
        "description": "Detailed activity description with practical tips, timing suggestions, and what to expect. Include booking advice if needed.",
        "location": "Specific location name with area/district"
      },
      {
        "time": "Afternoon",
        "description": "Detailed activity description with practical tips, timing suggestions, and what to expect. Include booking advice if needed.",
        "location": "Specific location name with area/district"
      },
      {
        "time": "Evening",
        "description": "Detailed activity description with practical tips, timing suggestions, and what to expect. Include dining recommendations.",
        "location": "Specific location name with area/district"
      }
    ]
  }
]

CONTENT GUIDELINES:
- Mix famous attractions with authentic local experiences
- Consider logical geographical flow to minimize travel time
- Include practical details like opening hours, booking requirements
- Suggest specific restaurants, cafes, or food experiences
- Account for cultural norms and local customs
- Balance active sightseeing with relaxation
- Include transportation tips between locations
- Consider seasonal factors if relevant

EXAMPLE ACTIVITY DESCRIPTION:
"Visit the world-renowned Louvre Museum. Book timed entry tickets online in advance to skip the lines. Allow 3-4 hours minimum. Start with the highlights: Mona Lisa, Venus de Milo, and Winged Victory. The museum opens at 9 AM - arrive early for smaller crowds. Consider the museum's free app for self-guided tours."

Remember: Return ONLY the JSON array, exactly as specified above.`;
}