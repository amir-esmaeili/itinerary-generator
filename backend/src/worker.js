import { RequestSchema } from './types.js';
import { generateJobId } from './utils.js';
import { initializeFirestore, createItineraryDoc, updateItineraryDoc } from './firestore.js';
import { generateItinerary } from './llm.js';

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    try {
      // Parse and validate request
      const body = await request.json();
      const { destination, durationDays } = RequestSchema.parse(body);
      
      const jobId = generateJobId();
      
      const db = initializeFirestore(env.FIREBASE_SERVICE_ACCOUNT, env.FIRESTORE_PROJECT_ID);
      
      await createItineraryDoc(jobId, destination, durationDays);
      
      ctx.waitUntil(processItinerary(jobId, destination, durationDays, env));
      
      return new Response(JSON.stringify({ jobId }), {
        status: 202,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
      
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

async function processItinerary(jobId, destination, durationDays, env) {
  try {
    const itinerary = await generateItinerary(
      destination, 
      durationDays, 
      env.LLM_API_KEY,
      env.LLM_PROVIDER || 'openai'
    );
    
    await updateItineraryDoc(jobId, {
      status: 'completed',
      itinerary
    });
    
  } catch (error) {
    console.error('Processing error:', error);
    
    await updateItineraryDoc(jobId, {
      status: 'failed',
      error: error.message
    });
  }
}