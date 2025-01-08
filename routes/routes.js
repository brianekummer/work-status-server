const express = require('express')


/**
 * Routes
 */
module.exports = function(app) {
  // Pass the app object to StatusController so it can access the global 
  // variable app.locals.currentStatus
  const statusController = new (require('../controllers/status-controller'))(app);

  const CLIENT_REFRESH_MS = (process.env.CLIENT_REFRESH_SECONDS || 30) * 1000;
  const SSE_HEADER = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  };

  const router = express.Router(); 

  // This route is called by the clients to start receiving status updates
  router.get('/api/get-updates', (request, response) => {
    // Use Server Sent Events to continually push updates to the browser every CLIENT_REFRESH_MS
    response.writeHead(200, SSE_HEADER);

    let intervalId = setInterval(() => {
      // FYI, request.get('Referrer') returns the full URL of the referring/requesting site
      response.write(`data: ${JSON.stringify(statusController.getStatusForClient())}\n\n`);},
    CLIENT_REFRESH_MS); 

    request.on('close', () => clearInterval(intervalId));
  });

  // I don't have a favicon, just return 204/NO-CONTENT
  router.get('/favicon.ico', (request, response) => response.status(204).end());

  return router;
}