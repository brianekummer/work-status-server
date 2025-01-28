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
 *   - convert to typescript? would save me some grief
 *       - deploy to proxmox and test for a week
 *       - emoji is the same between desk and phone, but image is not. so can have mario (8bit_1)
 *         on desk and 8bit_2 on wall - do I care? How hard to make them the same?
 *           - selecting which image would have to be done in sendStatusToAllClients(), and that
 *             would have to assume that there's always a png and gif, etc. very ugly and fragile?
 *           - code is in folder "work-status-server - complex client object", not checked in
 *       - merge to master
 * 
 *   - instead of polling HA, use webhook
 *       - I think this should be a separate branch- ha-webhook
 *           - merge in migrate-to-typescript
 *       - How awkward is this change? will likely be some drastic changes?
 * 
 *   - Only sends updates when slack/ha changes- I want every minute so "last updated" changes
 *       - do this AFTER I look at webhook for HA, because that will likely significantly change
 *         how things are done
 *
 *   - is using font awesome to show HVAC status up-to-date enough to be useful?
 *   
 *   - Cleanup
 *       - find a linter
 *       - consistent style in defining functions
 *       - Update all comments, readme's, etc.
 */

import express from 'express';
import mustacheExpress from 'mustache-express';
import { Worker } from 'worker_threads';
import path from 'path';

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