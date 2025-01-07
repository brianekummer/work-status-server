// TODO- remove CLIENT_REFRESH_MS from client and move it to server side
const eventSource = new EventSource('/api/get-updates');

eventSource.onmessage = (event) => {
  console.log(`>>> onmessage, data=${event.data}`);
  const currentStatus = JSON.parse(event.data);

  let showStatus = currentStatus.emoji || currentStatus.text;
  document.body.className = `${showStatus ? 'visible' : 'invisible'} wall`;

  if (showStatus) {
    let now = luxon.DateTime.now();
    let timeZoneAbbreviation = now.toFormat("ZZZZ");
    $("local12").innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);;
    $("local12TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
    $("local24").innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
    $("local24TimeZoneAbbreviation").innerHTML = timeZoneAbbreviation;
    $("utc").innerHTML = now.toUTC().toFormat("HH:mm");

    $("status-text").className = currentStatus.text.length > 13 
      ? "status--font-size__small" 
      : "status--font-size";    // Adjust the size of the status text

    $("home-assistant-data").className = "visible"; // TODO remove is redundant
    $("washer-text").innerHTML = currentStatus.homeAssistant.washerText;
    $("dryer-text").innerHTML = currentStatus.homeAssistant.dryerText;
    $("temperature-text").innerHTML = currentStatus.homeAssistant.temperatureText;
    
    setCommonElements(currentStatus);
  }
};