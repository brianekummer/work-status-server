let eventSource = new EventSource('/api/status-updates');
eventSource.onmessage = (event) => {
  let status = JSON.parse(event.data);

  let showStatus = status.emoji || status.text;
  document.body.className = `${showStatus ? 'visible' : 'invisible'}`;

  if (showStatus) {
    setCommonElements(status);
  }
};