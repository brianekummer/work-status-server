const eventSource = new EventSource('/api/get-updates');

eventSource.onmessage = (event) => {
  console.log(`>>> onmessage, data=${event.data}`);
  const currentStatus = JSON.parse(event.data);

  let showStatus = currentStatus.emoji || currentStatus.text;
  document.body.className = `${showStatus ? 'visible' : 'invisible'} wall`;

  if (showStatus) {
    setCommonElements(currentStatus);
  }
};