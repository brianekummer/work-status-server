const express = require('express')
const logger = require('../services/logger');


/**
 * Routes
 */
module.exports = function(app) {
  const CLIENT_REFRESH_MS = (process.env.CLIENT_REFRESH_SECONDS || 30) * 1000;
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');
  const SSE_HEADER = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  };

  // Pass the app object to StatusController so it can access the global 
  // variable app.locals.currentStatus
  const statusController = new (require('../controllers/status-controller'))(app);

  // Define our router
  const router = express.Router(); 


  /**
   * Endpoint for desk phone
   */
  router.get("/desk", (request, response) => 
    response.render("desk", { FONT_AWESOME_ACCOUNT_ID }));


  /**
   * Endpoint for wall phone
   */
  router.get("/wall", (request, response) =>
    response.render("wall", {}));
  

  /**
   * This route is called by the clients to start receiving status updates 
   * 
   * Use Server Sent Events to continually push updates to the browser every
   * CLIENT_REFRESH_MS.
   *
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   */
  router.get('/api/status-updates', (request, response) => {
    const pageName = request.get('Referrer').split("/").pop();
    let previousStatus = '';
    let currentStatus = '';

    response.writeHead(200, SSE_HEADER);

    // TODO- can I set up a watch on something instead of this tight polling?

    let intervalId = setInterval(() => {
      currentStatus = JSON.stringify(statusController.getStatusForClient());
      // Since lastUpdatedTime is in status, will happen at LEAST once per minute
      if (currentStatus !== previousStatus) {
        logger.debug(`Pushing data to ${pageName}`);
        response.write(`data: ${currentStatus}\n\n`);
        previousStatus = currentStatus;
      }
    }, CLIENT_REFRESH_MS); 

    request.on('close', () => {
      clearInterval(intervalId);
      logger.info('routes /api/get-updates, closed connection');
    });
  });

  // I don't have a favicon, just return 204/NO-CONTENT
  router.get('/favicon.ico', (request, response) => response.status(204).end());

  return router;
}