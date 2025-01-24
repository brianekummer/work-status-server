const express = require('express')


/**
 * Routes
 * 
 * @param statusController is the status controller
 * @returns the router 
 */
module.exports = function(statusController) {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  // Define the router and our routes
  const router = express.Router(); 

  router.get("/desk", (request, response) => response.render("desk", { FONT_AWESOME_ACCOUNT_ID }));
  router.get("/wall", (request, response) => response.render("wall", {}));
  router.get('/api/status-updates', (request, response) => statusController.getStatusUpdates(request, response));
  router.get('/favicon.ico', (request, response) => response.status(204).end());

  return router;
}