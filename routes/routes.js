const express = require('express')
const logger = require('../services/logger');


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

  /**
   * Get the latest status and push it to the client
   */
  const getLatestStatusAndPush = (request, response) => {
    let data = statusController.getStatusForClient();

    let pageName = request.get('Referrer').split("/").pop();
    logger.debug(`Pushing data to ${pageName}`);
    
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  /**
   * This route is called by the clients to start receiving status updates 
   * 
   * Use Server Sent Events to continually push updates to the browser every
   * CLIENT_REFRESH_MS.
   *
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   */
  router.get('/api/get-updates', (request, response) => {
    response.writeHead(200, SSE_HEADER);

    // Immediately push the status to the client, then repeatedly do that every
    // SERVER_REFRESH_MS.
    getLatestStatusAndPush(request, response);
    let intervalId = setInterval(() => getLatestStatusAndPush(request, response), CLIENT_REFRESH_MS); 

    request.on('close', () => clearInterval(intervalId));
  });

  // I don't have a favicon, just return 204/NO-CONTENT
  router.get('/favicon.ico', (request, response) => response.status(204).end());

  return router;
}