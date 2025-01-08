/******************************************************************************
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
 * REQUIREMENTS
 *   NPM Packages
 *     express...................For coding simple web pages
 *     node-fetch................For simplifying http commands
 *     csv-parser................For parsing status-conditions.csv
 *     luxon.....................For date formatting, instead of momentJS
 *     node-watch................For watching if the status conditions file changes,
 *                               so we can pickup any changes to that file without
 *                               requiring an app restart
 *
 *   Environment Variables
 *     SLACK_TOKENS..............Must be the Slack security tokens for my work and
 *                               home accounts in a csv, like this: 
 *                               <work_token>,<home_token>
 *     HOME_ASSISTANT_BASE_URL...Base URL for Home Assistant
 *     HOME_ASSISTANT_TOKEN......Security token for accessing Home Assistant
 *     SERVER_REFRESH_SECONDS....Refresh time on the server side, defaults to 30
 *     CLIENT_REFRESH_SECONDS....Refresh time on the client side, defaults to 15
 *
 * OPTIONAL
 *   Command Line Parameters
 *     argument 2.............The logging level- can be DEBUG|INFO|ERROR
 *

  TODO
  - get rid of Time template in status-conditions?
  - does moving to Winston for logging solve my issue with passing log level to worker thread?
  - documentation

 *****************************************************************************/

// Require packages
const express = require("express");

const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;

let logLevelText = process.argv.length > 2 ? process.argv[2] : "ERROR";
let logService = require("./services/log-service");
logService.setLogLevelByText(logLevelText);


/***********************  Start of Node Configuration  ***********************/
const port = 3000;        // Cannot be < 1024 (ie. 80) w/o root access

let app = express();
// Pass the app object to the router so it can pass it to the StatusController
let router = require("./routes/routes")(app);
app.use(router);

// Expose only the necessary files
app.use(express.static(`./public`));

// Hack to prevent "certificate has expired" issue. Not suitable for production,
// but ok for me here. https://github.com/node-fetch/node-fetch/issues/568
process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

app.listen(port, () => logService.log(logService.LOG_LEVELS.INFO, `Listening on port ${port}`));
/************************  End of Node Configuration  ************************/



/**
 * Periodic polling of Slack and Home Assistant for an up-to-date status is
 * being done in a worked thread (status-worker.js), and the results are stored in 
 * the global variable app.locals.currentStatus.
 * 
 * So that the global variable is available to other modules (namely 
 * StatusController), "app" is passed into the router and then passed to
 * StatusController.
 * 
 * Also note that because the worker thread runs in a child process, its instance
 * of LogService is separate from the LogService used by the main thread. So the
 * worker thread needs to explicitly set the log level, which is being passed in
 * using WorkerData.
 */
let statusController = new (require("./controllers/status-controller"))(app);
app.locals.currentStatus = statusController.EMPTY_STATUS;

const { Worker, workerData } = require('worker_threads');
let worker = new Worker('./controllers/status-worker.js', 
  { workerData: { logLevelText: logLevelText }});

// Periodically send the currentStatus to the worker thread, which will check
// for updates, and then send the updated status back in a message
setInterval(() => {
  worker.postMessage(app.locals.currentStatus); 
}, SERVER_REFRESH_MS); 

worker.on('message', (updatedStatus) => {
  // We got an updated status from our worker thread, so save it back into our 
  // global variable
  app.locals.currentStatus = updatedStatus;
});