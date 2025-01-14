const EVERY_FIVE_SECONDS = 5000;


/**
 * The clocks should be updated more frequently than the statuses
 */
updateClocks = () => {
  if (document.body.className == 'visible') {
    let now = luxon.DateTime.now();
    let timeZoneAbbreviation = now.toFormat('ZZZZ');
    $('local12').innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);
    $('local12TimeZoneAbbreviation').innerHTML = timeZoneAbbreviation;
    $('local24').innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
    $('local24TimeZoneAbbreviation').innerHTML = timeZoneAbbreviation;
    $('utc').innerHTML = now.toUTC().toFormat('HH:mm');
  }
}


/**
 * Call the endpoint to get the status updates and the server will keep
 * sending messages with up-to-date statuses
 */
let eventSource = new EventSource('/api/status-updates');
eventSource.onmessage = (event) => {
  let status = JSON.parse(event.data);

  let showStatus = status.emoji || status.text;
  document.body.className = `${showStatus ? 'visible' : 'invisible'}`;

  if (showStatus) {
    updateClocks();   // Update clocks as soon as page becomes visible

    $('status-text').className = status.text.length > 13 
      ? 'status--font-size__small' 
      : 'status--font-size';    // Adjust the size of the status text

    $('washer-text').innerHTML = status.homeAssistant.washerText;
    $('dryer-text').innerHTML = status.homeAssistant.dryerText;
    $('temperature-text').innerHTML = status.homeAssistant.temperatureText;
    
    setCommonElements(status);
  }
};


setInterval(updateClocks, EVERY_FIVE_SECONDS);