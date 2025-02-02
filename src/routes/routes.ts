import express, { Request, Response } from 'express';
import StatusController from '../controllers/status-controller';


/**
 * Routes
 * 
 * @param statusController - The status controller
 * @returns the router 
 */
export default (statusController: StatusController) => {
  const router = express.Router(); 

  router.get('/favicon.ico', (request: Request, response: express.Response) => response.status(204).end());
  router.get('/api/status-updates', (request: Request, response: Response) => statusController.startStreamingStatusUpdates(request, response));
  router.post('/api/updated-slack-status', (request: Request, response: Response) => statusController.updatedSlackStatus(response));
  router.post('/api/home-assistant-update', (request: Request, response: Response) => statusController.homeAssistantUpdate(request, response));

  return router;
}