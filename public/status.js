// I have two modes for this web page
//   - Wall mode is used by the phone on my wall, or if Jodi opens the page
//     on her phone. This is the default.
//   - Desk mode is for the phone on my desk, which displays the time in ET
//     and UTC, as well as some data from Home Assistant.



function displaySlackStatus() {
  fetch("/get-status")
    .then(response => {
      response.json()
      .then(jsonResponse => {
        // Setup page visibility and showing the correct mode
        let showStatus = jsonResponse.emoji || jsonResponse.text;
        let visibilityClass = `page--${showStatus ? "visible" : "invisible"}`;
        let mode = showDesk ? "desk" : "wall";
        document.body.className = `${visibilityClass} ${mode}`;

        if (showStatus) {
          if (showDesk) {
            // Set the times
            let now = luxon.DateTime.now();
            let timeZoneAbbreviation = now.toFormat("ZZZZ");
            $("local12").innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);;
            $("local12TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
            $("local24").innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
            $("local24TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
            $("utc").innerHTML = now.toUTC().toFormat("HH:mm");

            // Set the URL for each of the HA icons, using the HA url from the server,
            // IF it has not already been set
            // TODO- move this out of this loop, and move building urls to server
            const baseUrl = `${jsonResponse.homeAssistant.url}/local/icon`;
            $("washer-image").src = $("washer-image").src || `${baseUrl}/mdi-washing-machine-light.png`;
            $("dryer-image").src = $("dryer-image").src || `${baseUrl}/mdi-tumble-dryer-light.png`;
            $("thermometer-image").src = $("thermometer-image").src || `${baseUrl}/thermometer.png`;

            // Display Home Assistant data
            $("washer-text").innerHTML = jsonResponse.homeAssistant.washerText;
            $("dryer-text").innerHTML = jsonResponse.homeAssistant.dryerText;
            $("temperature-text").innerHTML = jsonResponse.homeAssistant.temperatureText;
          }

          // Load the data into the web page
          $("status-emoji").src = jsonResponse.emoji;
          $("status-text").innerHTML = jsonResponse.text;
          $("status-times").innerHTML = jsonResponse.times;

          // Set the size of the status text
          $("status-text").className = jsonResponse.text.length > 13 
            ? "status--font-size__small" 
            : "status--font-size";

          // Get the last updated time from the response header. I am intentionally not 
          // including a timestamp in the server payload because that'd cause every
          // payload to be unique and wreck the etag caching. 
          $("last-updated-time").innerHTML = luxon.DateTime
            .fromHTTP(response.headers.get('Date'))
            .toLocaleString(luxon.DateTime.TIME_SIMPLE);

        }
      })
      .catch(err => console.log(`ERROR: ${err}`));
    });
}


// Shorthand to simplify code, same syntax as jQuery
function $(id) {
  return document.getElementById(id);
}


// Display the status and then refresh every 15 seconds
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, 15000);