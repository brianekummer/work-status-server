const express = require('express')
const logger = require('../services/logger');


/**
 * Routes
 */
module.exports = function(statusController) {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  // Define our router and our routes
  const router = express.Router(); 

  router.get("/desk", (request, response) => response.render("desk", { FONT_AWESOME_ACCOUNT_ID }));
  router.get("/wall", (request, response) => response.render("wall", {}));
  router.get('/api/status-updates', (request, response) => statusController.getStatusUpdates(request, response));
  router.get('/favicon.ico', (request, response) => response.status(204).end());

  return router;
}