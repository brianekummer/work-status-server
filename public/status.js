// I have two modes for this web page
//   - Wall mode is used by the phone on my wall, or if Jodi opens the page
//     on her phone. This is the default.
//   - Desk mode is for the phone on my desk, which displays the time in ET
//     and UTC, as well as some data from Home Assistant.
//
// When I'm not working, I want the screen of the status phone to
// be off. I originally had Tasker handle that, but there were issues
// getting the screen to turn back on. 
//   - Instead, because that phone has an AMOLED screen, I just make 
//     everything black and all those pixels are off.
//   - But on the phone for my desk that shows that same status and
//     the local and UTC times, that is an LCD screen, so making it 
//     all black still leaves the screen pretty bright. So I just
//     dim it all the way down, which combined with making everything
//     black, is good enough for me. So I set the Tasker global variable
//     variable "ChangeScreenTo" to say if I want the screen off 
//     (dimmed) or on (undimmed), and a Tasker profile watches for that
//     and does as it's told.
function displaySlackStatus() {
  fetch("/get-status")
  .then(response => response.json())
  .then(jsonResponse => {
    // Load the data into the web page
    $("status-emoji").src = jsonResponse.emoji;
    $("status-text").innerHTML = jsonResponse.text;
    $("status-times").innerHTML = jsonResponse.times;
    $("last-updated-timestamp").innerHTML = jsonResponse.timestamps.local12;

    // Shrink the status text, if necessary
    $("status-text").className = jsonResponse.text.length > 13 
      ? "status--font-size__small" 
      : "status--font-size";

    // If viewing this web page somewhere other than on a status phone (wall
    // or desk), such as my laptop, Jodi's phone, etc, then I want to display
    // some other message. One row of the table of the web page is to be
    // displayed on the working status phone, and another row is displayed on
    // any other device. The code below shows/hides those rows depending on
    // which device this page is being rendered on.
    //
    // The variable "tk" is defined when running in a Tasker scene, which is
    // only applicable on a status phone like on the wall or my office desk.
    let runningOnStatusPhone = (typeof tk !== "undefined");
    let screenOn = jsonResponse.screen == "on";
    let visibility = screenOn ? "visible" : "invisible";
    let mode = showDesk ? "desk" : "wall";

    if (runningOnStatusPhone) {
      // Set the background to gray/black (page--visible/page--invisible)
      document.body.className = `page--${visibility} ${mode}`;


      // TODO- THIS IS NECESSARY AT NIGHT, BUT MESSSES UP DURING THE DAY !!!!
      // Set the status table visible/invisible
      //$("status-table").className = `table--padding table--${visibility}`;


      tk.setGlobal("ChangeScreenTo", jsonResponse.screen);
    }
    else {
      document.body.className = `page--visible ${mode}`;    // Always be visible
      $("working").className = `row--${visibility}`;
      $("not-working").className = `row--${screenOn ? "invisible" : "visible"}`;
    }
    
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
      xhttp.open("GET", `${jsonResponse.homeAssistant.url}/api/states/sensor.work_status_phone_info`, true);
      xhttp.setRequestHeader("Authorization", `Bearer ${jsonResponse.homeAssistant.token}`);
      xhttp.send();
    }
    else 
    {
      // Showing on the wall phone is the default, so no CSS changes are needed
    }

  })
  .catch(err => console.log(`ERROR: ${err}`));
}

// Shorthand to simplify code, same syntax as jQuery
function $(id) {
  return document.getElementById(id);
}

// Display the status and then refresh every 15 seconds
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, 15000);
