//   - Wall mode is used by the phone on my wall, or if Jodi opens the page
//     on her phone. This is the default.
function displaySlackStatus() {
  fetch("/get-status")
    .then(response => {
      response.json()
      .then(jsonResponse => {
        // Set page visibility
        let showStatus = jsonResponse.emoji || jsonResponse.text;
        document.body.className = `${showStatus ? "visible" : "invisible"} wall`;

        if (showStatus) {
          setCommonElements(response, jsonResponse);
        }
      })
      .catch(err => console.log(`ERROR: ${err}`));
    });
}


// Display the status and then refresh every CLIENT_REFRESH_MS
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, CLIENT_REFRESH_MS);