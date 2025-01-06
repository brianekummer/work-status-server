//   - Desk mode is for the phone on my desk, which displays the time in ET
//     and UTC, as well as some data from Home Assistant.
function displaySlackStatus() {
  fetch("/get-status")
    .then(response => {
      response.json()
      .then(jsonResponse => {
        // Set page visibility
        let showStatus = jsonResponse.emoji || jsonResponse.text;
        let visibilityClass = `${showStatus ? "visible" : "invisible"}`;
        document.body.className = `${visibilityClass} desk`;

        if (showStatus) {
          let now = luxon.DateTime.now();
          let timeZoneAbbreviation = now.toFormat("ZZZZ");
          $("local12").innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);;
          $("local12TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
          $("local24").innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
          $("local24TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
          $("utc").innerHTML = now.toUTC().toFormat("HH:mm");

          // Only adjust size for desk mode, since wall mode can expand the whole width 
          // of the screen
          $("status-text").className = jsonResponse.text.length > 13 
            ? "status--font-size__small" 
            : "status--font-size";    // Adjust the size of the status text

          $("home-assistant-data").className = "visible";
          $("washer-text").innerHTML = jsonResponse.homeAssistant.washerText;
          $("dryer-text").innerHTML = jsonResponse.homeAssistant.dryerText;
          $("temperature-text").innerHTML = jsonResponse.homeAssistant.temperatureText;

          $("status-emoji").src = jsonResponse.emoji;
          $("status-text").innerHTML = jsonResponse.text;
          $("status-times").innerHTML = jsonResponse.times;

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


// Display the status and then refresh every CLIENT_REFRESH_MS
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, CLIENT_REFRESH_MS);