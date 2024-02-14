function displaySlackStatus() {
  fetch("/get-status")
  .then(response => response.json())
  .then(jsonResponse => {
    // Load the data into the web page
    document.getElementById("emoji").src = jsonResponse.emoji;
    document.getElementById("text").innerHTML = jsonResponse.text;
    document.getElementById("times").innerHTML = jsonResponse.times;
    document.getElementById("last-updated-timestamp").innerHTML = jsonResponse.timestamps.local12;

    // Style things appropriately
    document.getElementById("text").className = "status--font-size" +
      (jsonResponse.text.length > 13 ? "__small" : "");

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
    //     (dimmed) or on (undimmed), and a aTasker profile watches for that
    //     and does as it's told.
    // 
    // If viewing this web page somewhere other than on that phone, such
    // and my laptop, Jodi's phone, etc, then I want to display some
    // other message. One row of the table of the web page is to be
    // displayed on the working status phone, and another row is displayed
    // on any other device. The code below shows/hides those rows
    // depending on which device this page is being rendered on.
    //
    // The variable "tk" is defined when running in a Tasker scene,
    // which is only applicable on the status phone.
    let runningOnStatusPhone = (typeof tk !== "undefined");
    let screenOn = jsonResponse.screen == "on";
    let visibility = screenOn ? "visible" : "invisible";
    if (runningOnStatusPhone) {
      document.body.className = "page--" + visibility;
      document.getElementById("status-table").className = "table--padding table--" + visibility;
      tk.setGlobal("ChangeScreenTo", jsonResponse.screen);
    }
    else {
      document.getElementById("working").className = "row--" + visibility;
      document.getElementById("not-working").className = "row--" + (screenOn ? "invisible" : "visible");
    }
    
    if (showUtc) {
      document.getElementById("local12").innerHTML = jsonResponse.timestamps.local12;
      document.getElementById("local24").innerHTML = jsonResponse.timestamps.local24;
      document.getElementById("local12ShortOffset").innerHTML = jsonResponse.timestamps.localShortOffset;
      document.getElementById("local24ShortOffset").innerHTML = jsonResponse.timestamps.localShortOffset;
      document.getElementById("utc").innerHTML = jsonResponse.timestamps.utc;
      document.getElementById("times-table").className = "table--visible";
    }
    else 
    {
      document.getElementById("times-table").className = "table--invisible";
        
    }

  })
  .catch(err => console.log(`ERROR: ${err}`));
}

// Display the status and then refresh every 15 seconds
setTimeout(displaySlackStatus, 1);
setInterval(displaySlackStatus, 15000);