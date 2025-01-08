let eventSource = new EventSource('/api/get-updates');
eventSource.onmessage = (event) => {
  let status = JSON.parse(event.data);

  let showStatus = status.emoji || status.text;
  document.body.className = `${showStatus ? 'visible' : 'invisible'}`;

  if (showStatus) {
    let now = luxon.DateTime.now();
    let timeZoneAbbreviation = now.toFormat('ZZZZ');
    $('local12').innerHTML = now.toLocaleString(luxon.DateTime.TIME_SIMPLE);;
    $('local12TimeZoneAbbreviation').innerHTML = timeZoneAbbreviation;
    $('local24').innerHTML = now.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);
    $('local24TimeZoneAbbreviation').innerHTML = timeZoneAbbreviation;
    $('utc').innerHTML = now.toUTC().toFormat('HH:mm');

    $('status-text').className = status.text.length > 13 
      ? 'status--font-size__small' 
      : 'status--font-size';    // Adjust the size of the status text

    $('washer-text').innerHTML = status.homeAssistant.washerText;
    $('dryer-text').innerHTML = status.homeAssistant.dryerText;
    $('temperature-text').innerHTML = status.homeAssistant.temperatureText;
    
    setCommonElements(status);
  }
};