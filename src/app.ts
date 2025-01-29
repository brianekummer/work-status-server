/**
 * Server side code for Home Working Status
 *
 *
 * GENERAL STRATEGY
 *   - Timer runs every x seconds and gets my Slack status for work and home
 *     accounts, as well as some data from Home Assistant. It calculates my new
 *     status to display at home, and saves it in a global variable.
 *   - Use Server Sent Events (SSE) to periodically push the latest status 
 *     from the server (from that global variable), to the client, which then
 *     updates the elements on the page.
 *
 * 
 * 
 * TO DO ITEMS
 *   - Only sends updates when slack/ha changes- I want every minute so "last updated" changes
 *       - do this AFTER I look at webhook for HA, because that will likely significantly change
 *         how things are done

*   - Add error handling in desk/wall.js so that if server connection dies, I change something, 
 *     probably slack text to "COMMUNICATION ERROR" or something
 * 
 *   - is using font awesome to show HVAC status up-to-date enough to be useful?
 *   
 *   - Cleanup
 *       - consistent style in defining functions
 *       - check for removing env vars
 *       - Update all comments, readme's, etc.
 */

import express from 'express';
import mustacheExpress from 'mustache-express';
import { Worker } from 'worker_threads';
import path from 'path';
import bodyParser from 'body-parser';

import logger from './services/logger';
import routerModule from './routes/routes';
import { StatusController } from './controllers/status-controller';
import { EmojiService } from './services/emoji-service';


const port = 3000;        // Cannot be < 1024 (ie. 80) w/o root access

const app = express();

// Configure Mustache
app.engine('mst', mustacheExpress());
app.set('view engine', 'mst');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON bodies- must be before include the router
app.use(bodyParser.json());

const emojiService: EmojiService = new EmojiService();

// Start the worker thread and pass it to the status controller
const worker = new Worker('./controllers/status-worker.js');
const statusController = new StatusController(worker, emojiService);

// Initialize the router, which needs the status controller
const router = routerModule(statusController);
app.use(router);




// Expose public folder
app.use(express.static('../public'));

// Hack to prevent "certificate has expired" issue. Not suitable for production,
// but ok for me here. https://github.com/node-fetch/node-fetch/issues/568
process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

app.listen(port, () => logger.info(`Listening on port ${port}`));