//   - Wall mode is used by the phone on my wall, or if Jodi opens the page
//     on her phone. This is the default.
function displaySlackStatus() {
  fetch("/get-status")
    .then(response => {
      response.json()
      .then(jsonResponse => {
        // Set page visibility
        let showStatus = jsonResponse.slack.emoji || jsonResponse.slack.text;
        let visibilityClass = `${showStatus ? "visible" : "invisible"}`;
        document.body.className = `${visibilityClass} wall`;

        if (showStatus) {
          $("status-emoji").src = jsonResponse.slack.emoji;
          $("status-text").innerHTML = jsonResponse.slack.text;
          $("status-times").innerHTML = jsonResponse.slack.times;

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