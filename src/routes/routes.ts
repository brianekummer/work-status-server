import express, { Request, Response } from 'express';
import { StatusController } from '../controllers/status-controller';


/**
 * Routes
 * 
 * @param statusController is the status controller
 * @returns the router 
 */
export default (statusController: StatusController) => {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  // Define the router and our routes
  const router = express.Router(); 

  router.get("/desk", (request: Request, response: Response) => response.render("desk", { FONT_AWESOME_ACCOUNT_ID }));
  router.get("/wall", (request: Request, response: Response) => response.render("wall", {}));
  router.get('/api/status-updates', (request: Request, response: Response) => statusController.streamStatusUpdates(request, response));
  router.post('/api/updated-status', (request: Request, response: Response) => statusController.updatedStatus(response));
  router.get('/favicon.ico', (request: Request, response: express.Response) => response.status(204).end());

  return router;
}