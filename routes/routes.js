const express = require('express')
const logger = require('../services/logger');


/**
 * Routes
 */
module.exports = function(app) {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  // Pass the app object to StatusController so it can access the global 
  // variable app.locals.currentStatus
  const statusController = new (require('../controllers/status-controller'))(app);

  // Define our router
  const router = express.Router(); 
  let clients = new Set();
  let previousStatus = '';

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
  

  pushStatus = (client, initialPush, status) => {
    logger.debug(`Pushing ${initialPush ? 'initial data' : 'data'} to ${client.req.get('Referrer')}`);
    client.write(`data: ${status}\n\n`);
  }

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
    // Add the client to our list of who gets updates
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    clients.add(response);

    // Push initial data
    this.pushStatus(response, true, JSON.stringify(statusController.getStatusForClient(app.locals.currentStatus)));

    // Remove the client from our list when it closes the connection
    request.on('close', () => {
      clients.delete(response);
    });
  });

  // I don't have a favicon, just return 204/NO-CONTENT
  router.get('/favicon.ico', (request, response) => response.status(204).end());




  // Watch out for name updatedStatus, this named same as  what comes back from worker thread
  // but its not
  router.sendUpdateToClients = (updatedStatus) => {
    console.log(`>>> routes.sendUpdateToClients()`);
    let currentStatus = JSON.stringify(statusController.getStatusForClient(updatedStatus));

    if (currentStatus !== previousStatus) {
      clients.forEach(client => {
        this.pushStatus(client, false, currentStatus);
      });
      previousStatus = currentStatus;
    }
  }



  return router;
}