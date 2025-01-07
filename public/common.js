function setCommonElements(response, jsonResponse) {
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


// Shorthand to simplify code, same syntax as jQuery
function $(id) {
  return document.getElementById(id);
}