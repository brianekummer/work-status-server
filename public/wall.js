"use strict";
const THIRTY_SECONDS = 30000;

// Shorthand to select element by id
const $ = (id) => document.getElementById(id);

// compute variant from server-injected global or location search
const VARIANT = window.__WALL_VARIANT__ ||
  (new URL(window.location.href)).searchParams.get('variant') ||
  'wall';


/**
 * Call the endpoint to get the status updates and the server will keep
 * sending messages with up-to-date statuses
 */
let errorTimeout = null;
let eventSource = new EventSource(`/api/status-updates?variant=${encodeURIComponent(VARIANT)}`);

eventSource.onmessage = (event) => {
  let status = JSON.parse(event.data);

  let isVisible = status.emojiImage || status.text;
  document.body.className = isVisible ? 'visible' : 'invisible';
    
  if (isVisible) {
    $('status-emoji').src = status.emojiImage || '';
    $('status-text').innerHTML = status.text || '';
    $('status-times').innerHTML = status.times || '';
    $('last-updated-time').innerHTML = status.lastUpdatedTime || '';
  }

  // Clear any pending error display
  if (errorTimeout) {
    clearTimeout(errorTimeout);
    errorTimeout = null;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE error: ', error);

  // Only show error if connection is down for >30 seconds
  if (!errorTimeout) {
    errorTimeout = setTimeout(() => {
      $('status-emoji').src = '';
      $('status-text').innerHTML = 'Communication Error!';
      $('status-times').innerHTML = '';
      $('last-updated-time').innerHTML = '';
    }, THIRTY_SECONDS);
  }
};

// Listen for control commands from the server (SSE "command" events)
eventSource.addEventListener('command', (e) => {
  try {
    const cmd = JSON.parse(e.data);
    if (cmd && cmd.action === 'reload') {
      // Reload the page, to pick up and content changes
      window.location.reload();
    }
  } catch (err) {
    console.error('Failed to handle command event', err);
  }
});
