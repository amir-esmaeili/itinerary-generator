<script>
  import { onMount } from 'svelte';
  import { doc, onSnapshot } from "firebase/firestore";
  import { db } from '$lib/firebase';

  let jobId = '';
  let status = 'idle'; // idle, loading, processing, completed, failed, not_found
  let itineraryData = null; 
  let error = '';
  let unsubscribe = () => {};

  function handleSubmit() {
    if (!jobId.trim()) return;

    status = 'loading';
    itineraryData = null;
    error = '';
    unsubscribe();

    const docRef = doc(db, "itineraries", jobId.trim());
    
    unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        status = data.status; // Get the status from the data
        itineraryData = data; // Store the entire clean object
        error = data.error || '';
      } else {
        status = 'not_found';
        error = `No job found with ID: ${jobId.trim()}`;
      }
    }, (err) => {
      console.error("Firestore listener error:", err);
      status = 'failed';
      error = 'Could not connect to the database to check status.';
    });
  }

  onMount(() => {
    return () => unsubscribe();
  });
</script>

<div class="container">
  <h1>Itinerary Status Checker</h1>
  <p>Enter the Job ID you received to track the status of your itinerary.</p>

  <form on:submit|preventDefault={handleSubmit} class="form-group">
    <input
      type="text"
      bind:value={jobId}
      placeholder="Enter your Job ID"
      required
    />
    <button type="submit" disabled={status === 'loading' || status === 'processing'}>
      Check Status
    </button>
  </form>

  {#if status !== 'idle'}
    <div class="results">
      {#if status === 'loading'}
        <p>Connecting...</p>
      {/if}

      {#if status === 'processing'}
        <div class="status-badge processing">Processing</div>
        <p>Your itinerary for <strong>{itineraryData?.destination || 'your destination'}</strong> is being generated. This page will update automatically.</p>
      {/if}

      {#if status === 'completed' && itineraryData}
        <div class="status-badge completed">Completed</div>
        <h2>Your Itinerary for {itineraryData.destination}</h2>
        {#each itineraryData.itinerary as day}
          <div class="day">
            <h3>Day {day.day}: {day.theme}</h3>
            {#each day.activities as activity}
              <div class="activity">
                <h4>{activity.time}</h4>
                <p>{activity.description}</p>
                <span><strong>Location:</strong> {activity.location}</span>
              </div>
            {/each}
          </div>
        {/each}
      {/if}
      
      {#if status === 'failed'}
        <div class="status-badge failed">Failed</div>
        <p>There was an error generating your itinerary.</p>
        <p class="error-message"><strong>Details:</strong> {error || 'An unknown error occurred.'}</p>
      {/if}

      {#if status === 'not_found'}
        <div class="status-badge failed">Not Found</div>
        <p class="error-message">{error}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container { font-family: sans-serif; max-width: 800px; margin: 2rem auto; }
  .form-group { display: flex; gap: 0.5rem; }
  input { flex-grow: 1; padding: 0.75rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
  button { padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px; }
  button:disabled { background-color: #aaa; }
  .results { margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1.5rem; }
  .status-badge { display: inline-block; padding: 0.5rem 1rem; margin-bottom: 1rem; border-radius: 999px; color: white; font-weight: bold; }
  .processing { background-color: #ff9800; }
  .completed { background-color: #4caf50; }
  .failed { background-color: #f44336; }
  .error-message { color: #f44336; }
  .day { margin-bottom: 2rem; }
  .activity { border-left: 3px solid #eee; padding-left: 1rem; margin-bottom: 1rem; }
  h2, h3, h4 { margin-top: 0; }
</style>