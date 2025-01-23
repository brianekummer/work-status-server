const express = require('express')


/**
 * Routes
 */
module.exports = function(app) {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  // Pass the app object to StatusController so it can access the global 
  // variable app.locals.currentStatus
  const statusController = new (require('../controllers/status-controller'))(app);

  // Define our router and routes
  const router = express.Router(); 

  router.get("/desk", (request, response) => response.render("desk", { FONT_AWESOME_ACCOUNT_ID }));
  router.get("/wall", (request, response) => response.render("wall", {}));
  router.get('/api/status-updates', (request, response) => statusController.getStatusUpdates(request, response));

  // I don't have a favicon, just return 204/NO-CONTENT
  router.get('/favicon.ico', (request, response) => response.status(204).end());

  return router;
}