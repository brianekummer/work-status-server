function setCommonElements(jsonResponse) {
  $('status-emoji').src = jsonResponse.emoji;
  $('status-text').innerHTML = jsonResponse.text;
  $('status-times').innerHTML = jsonResponse.times;
  $('last-updated-time').innerHTML = jsonResponse.lastUpdatedTime;
}


// Shorthand to simplify code, same syntax as jQuery
function $(id) {
  return document.getElementById(id);
}