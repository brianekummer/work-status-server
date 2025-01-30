/**
 * Server side code for Home Working Status
 *
 *
 * GENERAL STRATEGY
 *   - A worker thread runs every x seconds and polls my work and home Slack
 *     accounts, and collects it in a variable.
 *   - A webhook gets updates from my smart home (Home Assistant)
 *   - Web pages call this app and are served a web page showing those statuses
 *   - Server Sent Events (SSE) is used to periodically stream the latest status 
 *     from the server to those web pages, which then update the elements on 
 *     their pages.
 *
 * 
 * 
 * TO DO ITEMS
 *   - is using font awesome to show HVAC status up-to-date enough to be useful? If it's always > 1:30, then why bother?
 *       - Timing examples
 *           - Heat came on, took 2:58 for desk phone to get the updated icon
 *           - Heat/fan turned off took 1:47 to update
 *       - I THINK removing this would eliminate the need for Mustache
 *   
 *   - Cleanup
 *       - When redeploy, remove env vars for HOME_ASSISTANT and client refresh
 *       - update Notion documentation- move notes from RANDOM note
 */
import express from 'express';
import bodyParser from 'body-parser';
import mustacheExpress from 'mustache-express';
import { Worker } from 'worker_threads';

import EmojiService from './services/emoji-service';
import Logger from './services/logger';
import RouterModule from './routes/routes';
import StatusController from './controllers/status-controller';


const port = 3000;  // Cannot be < 1024 (ie. 80) w/o root access
const app = express();

// Configure Mustache
app.engine('mst', mustacheExpress());
app.set('view engine', 'mst');
app.set('views', 'views');

app.use(bodyParser.json());  // Must be before the router is used

// Instantiate controllers and services
const worker = new Worker(
  './controllers/status-worker.js', 
  { workerData: { statusConditionsFilename: '../../files/status-conditions.csv' }});
const emojiService: EmojiService = new EmojiService('../public/images');
const statusController = new StatusController(worker, emojiService);
const router = RouterModule(statusController);
app.use(router);

// Expose the public folder
app.use(express.static('../public'));

// TODO- DO I STILL NEED THIS? DEPLOY IT AND FIND OUT
// Hack to prevent "certificate has expired" issue. Not suitable for production
// on an internet-facing application, but is ok for being only accessible on my
// home network. https://github.com/node-fetch/node-fetch/issues/568
//process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

// Start listening for requests
app.listen(port, () => Logger.info(`Listening on port ${port}`));