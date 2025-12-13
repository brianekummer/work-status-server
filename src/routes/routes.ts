import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
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

  const viewsDir = path.join(__dirname, '..', '..', 'views');

  const router = express.Router(); 

  router.get('/favicon.ico', (request: Request, response: express.Response) => response.status(204).end());


  //router.get(`/${PAGES.DESK}`, (request: Request, response: Response) => response.render(PAGES.DESK, { FONT_AWESOME_ACCOUNT_ID }));
  router.get(`/${PAGES.DESK}`, (request: Request, response: Response) => {
    const queryVariant = (request.query?.variant as string) || '';
    const envVariant = process.env.ACTIVE_DESK || '';
    const candidate = (queryVariant || envVariant || 'desk').toLowerCase();

    // If there's a specific template named e.g. 'desk2.mst', render that.
    const templatePath = path.join(viewsDir, `${candidate}.mst`);
    const templateName = fs.existsSync(templatePath) ? candidate : 'wall';

    console.log(`Rendering variant '${candidate}' using template '${templateName}'`);

    // Pass the variant to the template so JS/CSS can use it
    response.render(templateName, { variant: candidate, FONT_AWESOME_ACCOUNT_ID });
  });
  
  router.get(`/${PAGES.WALL}`, (request: Request, response: Response) => {
    const queryVariant = (request.query?.variant as string) || '';
    const envVariant = process.env.ACTIVE_WALL || '';
    const candidate = (queryVariant || envVariant || 'wall').toLowerCase();

    // If there's a specific template named e.g. 'wall2.mst', render that.
    const templatePath = path.join(viewsDir, `${candidate}.mst`);
    const templateName = fs.existsSync(templatePath) ? candidate : 'wall';

    console.log(`Rendering variant '${candidate}' using template '${templateName}'`);

    // Pass the variant to the template so JS/CSS can use it
    response.render(templateName, { variant: candidate });
  });


  router.get('/api/status-updates', (request: Request, response: Response) => statusController.startStreamingStatusUpdates(request, response));
  router.post('/api/updated-slack-status', (request: Request, response: Response) => statusController.updatedSlackStatus(response));
  router.post('/api/home-assistant-update', (request: Request, response: Response) => statusController.homeAssistantUpdate(request, response));
  router.post('/api/screen/refresh', (request: Request, response: Response) => statusController.pushCommandToAllClients(response, { action: 'reload' }));

  return router;
}