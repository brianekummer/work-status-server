// I have two modes for this web page
//   - Wall mode is used by the phone on my wall, or if Jodi opens the page
//     on her phone. This is the default.
//   - Desk mode is for the phone on my desk, which displays the time in ET
//     and UTC, as well as some data from Home Assistant.
function displaySlackStatus() {
  fetch("/get-status")
  .then(response => response.json())
  .then(jsonResponse => {
    // Setup page visibility and showing the correct mode
    let showStatus = jsonResponse.emoji || jsonResponse.text;
    let visibilityClass = `page--${showStatus ? "visible" : "invisible"}`;
    let mode = showDesk ? "desk" : "wall";
    document.body.className = `${visibilityClass} ${mode}`;

    if (showStatus) {
      // Load the data into the web page
      $("status-emoji").src = jsonResponse.emoji;
      $("status-text").innerHTML = jsonResponse.text;
      $("status-times").innerHTML = jsonResponse.times;
      $("last-updated-timestamp").innerHTML = jsonResponse.timestamps.local12;

      // Shrink the status text, if necessary
      $("status-text").className = jsonResponse.text.length > 13 
        ? "status--font-size__small" 
        : "status--font-size";

      if (showDesk) {
        // Set the times
        const timestamps = jsonResponse.timestamps;
        $("local12").innerHTML = timestamps.local12;
        $("local12ShortOffset").innerHTML = timestamps.localShortOffset;
        $("local24").innerHTML = timestamps.local24;
        $("local24ShortOffset").innerHTML = timestamps.localShortOffset;
        $("utc").innerHTML = timestamps.utc;

        // Set the URL for each of the HA icons, using the HA url from the server
        const baseUrl = `${jsonResponse.homeAssistant.url}/local/icon`;
        $("washer-image").src = $("washer-image").src || `${baseUrl}/mdi-washing-machine-light.png`;
        $("dryer-image").src = $("dryer-image").src || `${baseUrl}/mdi-tumble-dryer-light.png`;
        $("thermometer-image").src = $("thermometer-image").src || `${baseUrl}/thermometer.png`;

        // Display Home Assistant data
        getAndDisplayHomeAssistantData(jsonResponse.homeAssistant.url, jsonResponse.homeAssistant.token);
      }
      else 
      {
        // Showing on the wall phone is the default, so no changes are needed
      }
    }
  })
  .catch(err => console.log(`ERROR: ${err}`));
}


// Shorthand to simplify code, same syntax as jQuery
function $(id) {
  return document.getElementById(id);
}


function getAndDisplayHomeAssistantData(url, token) {
  // Get data from Home Assistant to display
  var xhttp = new XMLHttpRequest();
  xhttp.responseType = 'json';
  xhttp.onreadystatechange = function() {
    // Ready state has changed, check if the data has been returned
    if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
      var state = JSON.parse(this.response.state);

      $("washer-text").innerHTML = state.Washer;
      $("dryer-text").innerHTML = state.Dryer;
      $("thermometer-text").innerHTML = state.Temperature;
    }
  };
  xhttp.open("GET", `${url}/api/states/sensor.work_status_phone_info`, true);
  xhttp.setRequestHeader("Authorization", `Bearer ${token}`);
  xhttp.send();
}


// Display the status and then refresh every 15 seconds
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, 15000);
