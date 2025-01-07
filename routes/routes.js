module.exports = function(app) {
  const express = require('express')
  let statusController = new (require('../controllers/status-controller'))(app);

  const CLIENT_REFRESH_MS = (process.env.CLIENT_REFRESH_SECONDS || 30) * 1000;

  let router = express.Router(); 

  router.get('/favicon.ico', (request, response) => 
    response.status(204).end());

  router.get('/desk', (request, response) => 
    response.render('desk'));

  router.get('/wall', (request, response) => 
    response.render('wall'));
  
  router.get('/api/get-updates', (request, response) => {
    // Use server sent events to continually push updates to the browser every CLIENT_REFRESH_MS
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const intervalId = setInterval(() => {
      response.write(`data: ${JSON.stringify(statusController.getStatusForClient())}\n\n`);
    }, CLIENT_REFRESH_MS); 

    request.on('close', () => {
      clearInterval(intervalId);
    });
  });

  return router;
}