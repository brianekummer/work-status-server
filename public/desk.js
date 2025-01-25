"use strict";
const EVERY_FIVE_SECONDS = 5000;


// Shorthand to select element by id
const $ = (id) => document.getElementById(id);


/**
 * Update the clocks. This will be scheduled here on the client, and
 * will happen every five seconds.
 */
const updateClocks = () => {
    if (document.body.className == 'visible') {
        let now = luxon.DateTime.now();
        let timeZoneAbbreviation = now.toFormat('ZZZZ');
        $('local12').innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);
        $('local12TimeZoneAbbreviation').innerHTML = timeZoneAbbreviation;
        $('local24').innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
        $('local24TimeZoneAbbreviation').innerHTML = timeZoneAbbreviation;
        $('utc').innerHTML = now.toUTC().toFormat('HH:mm');
    }
};


/**
 * Call the endpoint to get the status updates and the server will keep
 * sending messages with up-to-date statuses
 */
let eventSource = new EventSource('/api/status-updates');
eventSource.onmessage = (event) => {
    let status = JSON.parse(event.data);

    let isVisible = status.emojiImage || status.text;
    document.body.className = isVisible ? 'visible' : 'invisible';
    
    if (isVisible) {
        updateClocks(); // Update clocks as soon as page becomes visible

        $('status-text').className = status.text.length > 13
            ? 'status--font-size__small'
            : 'status--font-size'; // Adjust the size of the status text

        $('status-emoji').src = status.emojiImage || '';
        $('status-text').innerHTML = status.text || '';
        $('status-times').innerHTML = status.times || '';
        $('last-updated-time').innerHTML = status.lastUpdatedTime || '';

        $('washer-text').innerHTML = status.homeAssistant.washerText || '';
        $('dryer-text').innerHTML = status.homeAssistant.dryerText || '';
        $('temperature-text').innerHTML = status.homeAssistant.temperatureText || '';
    }
};
setInterval(updateClocks, EVERY_FIVE_SECONDS);
