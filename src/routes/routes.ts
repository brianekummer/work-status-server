const express = require('express')
import { StatusController } from '../controllers/status-controller';


/**
 * Routes
 * 
 * @param statusController is the status controller
 * @returns the router 
 */
module.exports = function(statusController: StatusController) {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  // Define the router and our routes
  const router = express.Router(); 

  router.get("/desk", (request: any, response: any) => response.render("desk", { FONT_AWESOME_ACCOUNT_ID }));
  router.get("/wall", (request: any, response: any) => response.render("wall", {}));
  router.get('/api/status-updates', (request: any, response: any) => statusController.getStatusUpdates(request, response));
  router.get('/favicon.ico', (request: any, response: any) => response.status(204).end());

  return router;
}