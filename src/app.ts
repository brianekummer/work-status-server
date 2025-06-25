/**
 * Server side code for Home Working Status
 *
 *
 * GENERAL STRATEGY
 *   - A worker thread runs every x seconds and polls my work and home Slack
 *     accounts, and collects it in a variable in StatusController.
 *   - A webhook gets updates from my smart home (Home Assistant)
 *   - Web pages call this app and are served a web page showing those statuses
 *   - Server Sent Events (SSE) are used to periodically stream the latest status 
 *     from the server to those web pages, which then update the elements on 
 *     their pages.
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

// Configure MustacheAdd commentMore actions
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

// Start listening for requests
app.listen(port, () => Logger.info(`Listening on port ${port}`));