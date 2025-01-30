import express, { Request, Response } from 'express';
import StatusController from '../controllers/status-controller';
import { PAGES } from '../constants';


/**
 * Routes
 * 
 * @param statusController - The status controller
 * @returns the router 
 */
export default (statusController: StatusController) => {
  const FONT_AWESOME_ACCOUNT_ID = (process.env.FONT_AWESOME_ACCOUNT_ID || '');

  const router = express.Router(); 

  router.get('/favicon.ico', (request: Request, response: express.Response) => response.status(204).end());
  router.get(`/${PAGES.DESK}`, (request: Request, response: Response) => response.render(PAGES.DESK, { FONT_AWESOME_ACCOUNT_ID }));
  router.get(`/${PAGES.WALL}`, (request: Request, response: Response) => response.render(PAGES.WALL, {}));
  router.get('/api/status-updates', (request: Request, response: Response) => statusController.startStreamingStatusUpdates(request, response));
  router.post('/api/updated-slack-status', (request: Request, response: Response) => statusController.updatedSlackStatus(response));
  router.post('/api/home-assistant-update', (request: Request, response: Response) => statusController.homeAssistantUpdate(request, response));

  return router;
}