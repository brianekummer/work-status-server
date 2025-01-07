//   - Desk mode is for the phone on my desk, which displays the time in ET
//     and UTC, as well as some data from Home Assistant.
function displaySlackStatus() {
  fetch("/get-status")
    .then(response => {
      response.json()
      .then(jsonResponse => {
        // Set page visibility
        let showStatus = jsonResponse.emoji || jsonResponse.text;
        document.body.className = `${showStatus ? "visible" : "invisible"} desk`;

        if (showStatus) {
          let now = luxon.DateTime.now();
          let timeZoneAbbreviation = now.toFormat("ZZZZ");
          $("local12").innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);;
          $("local12TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
          $("local24").innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
          $("local24TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
          $("utc").innerHTML = now.toUTC().toFormat("HH:mm");

          $("status-text").className = jsonResponse.text.length > 13 
            ? "status--font-size__small" 
            : "status--font-size";    // Adjust the size of the status text

          $("home-assistant-data").className = "visible";
          $("washer-text").innerHTML = jsonResponse.homeAssistant.washerText;
          $("dryer-text").innerHTML = jsonResponse.homeAssistant.dryerText;
          $("temperature-text").innerHTML = jsonResponse.homeAssistant.temperatureText;

          setCommonElements(response, jsonResponse);
        }
      })
      .catch(err => console.log(`ERROR: ${err}`));
    });
}


// Display the status and then refresh every CLIENT_REFRESH_MS
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, CLIENT_REFRESH_MS);