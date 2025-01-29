import express, { Request, Response } from 'express';
import { StatusController } from '../controllers/status-controller';
import { PAGES } from '../constants';


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

  router.get(`/${PAGES.DESK}`, (request: Request, response: Response) => response.render(PAGES.DESK, { FONT_AWESOME_ACCOUNT_ID }));
  router.get(`/${PAGES.WALL}`, (request: Request, response: Response) => response.render(PAGES.WALL, {}));
  router.get('/api/status-updates', (request: Request, response: Response) => statusController.streamStatusUpdates(request, response));
  router.post('/api/updated-status', (request: Request, response: Response) => statusController.updatedStatus(response));
  router.get('/favicon.ico', (request: Request, response: express.Response) => response.status(204).end());

  // TRYING THIS !!
  router.post('/api/home-assistant-update', (request: Request, response: Response) => statusController.homeAssistantUpdate(request, response));

  

  return router;
}