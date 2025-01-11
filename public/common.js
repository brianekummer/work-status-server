function setCommonElements(status) {
  $('status-emoji').src = status.emoji;
  $('status-text').innerHTML = status.text;
  $('status-times').innerHTML = status.times;
  $('last-updated-time').innerHTML = status.lastUpdatedTime;
}


// Shorthand to simplify code, same syntax as jQuery
function $(id) {
  return document.getElementById(id);
}