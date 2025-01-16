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
 */

// Require packages
const express = require("express");
const mustacheExpress = require("mustache-express");
const logger = require("./services/logger");

const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;



/***********************  Start of Node Configuration  ***********************/
const port = 3000;        // Cannot be < 1024 (ie. 80) w/o root access

let app = express();

// Configure Mustache
app.engine("mustache", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", "./views");

// Pass the app object to the router so it can pass it to the StatusController
let router = require("./routes/routes")(app);
app.use(router);

// Expose only the necessary files
app.use(express.static(`./public`));

// Hack to prevent "certificate has expired" issue. Not suitable for production,
// but ok for me here. https://github.com/node-fetch/node-fetch/issues/568
process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

app.listen(port, () => logger.info(`Listening on port ${port}`));
/************************  End of Node Configuration  ************************/



/**
 * Periodic polling of Slack and Home Assistant for an up-to-date status is
 * being done in a worker thread (status-worker.js), and the results are stored in 
 * the global variable app.locals.currentStatus.
 * 
 * So that the global variable is available to other modules (namely 
 * StatusController), "app" is passed into the router and then passed to
 * StatusController.
 */
let statusController = new (require("./controllers/status-controller"))(app);
app.locals.currentStatus = statusController.EMPTY_STATUS;

const { Worker } = require('worker_threads');
let worker = new Worker('./controllers/status-worker.js');

// Immediately send the currentStatus to the worker thread, which will check
// for updates, and then send the updated status back in a message. Then
// repeatedly do that every SERVER_REFRESH_MS.
worker.postMessage(app.locals.currentStatus);
setInterval(() => {
  worker.postMessage(app.locals.currentStatus); 
}, SERVER_REFRESH_MS); 

worker.on('message', (updatedStatus) => {
  // We got an updated status from our worker thread, so save it back into our 
  // global variable
  app.locals.currentStatus = updatedStatus;
});