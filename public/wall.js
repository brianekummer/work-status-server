// Shorthand to select element by id
const $ = (id) => document.getElementById(id);


/**
 * Call the endpoint to get the status updates and the server will keep
 * sending messages with up-to-date statuses
 */
let eventSource = new EventSource('/api/status-updates');
eventSource.onmessage = (event) => {
  let status = JSON.parse(event.data);
  let isVisible = status.emoji || status.text;

  document.body.className = isVisible ? 'visible' : 'invisible';

  if (isVisible) {
    $('status-emoji').src = status.emoji || '';
    $('status-text').innerHTML = status.text || '';
    $('status-times').innerHTML = status.times || '';
    $('last-updated-time').innerHTML = status.lastUpdatedTime || '';
  }
};