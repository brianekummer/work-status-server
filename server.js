/******************************************************************************
  Server side code for Home Working Status


  GENERAL STRATEGY
    - Timer runs every x seconds and gets my Slack status for work and home
      accounts, as well as some data from Home Assistant. It calculates my new
      status to display at home, and saves it in a variable in memory.
    - Web pages periodically (every x seconds) ask for my latest status. This
      call returns the contents of that variable in memory.

  REQUIREMENTS
    NPM Packages
      express...................For coding simple web pages
      mustache-express..........For implementing Mustache templates with Express
      node-fetch................For simplifying http commands
      csv-parser................For parsing status-conditions.csv
      luxon.....................For date formatting, instead of momentJS
      node-watch................For watching if the status conditions file changes,
                                so we can pickup any changes to that file without
                                requiring an app restart

    Environment Variables
      SLACK_TOKENS..............Must be the Slack security tokens for my work and
                                home accounts in a csv, like this: 
                                <work_token>,<home_token>
      HOME_ASSISTANT_BASE_URL...Base URL for Home Assistant
      HOME_ASSISTANT_TOKEN......Security token for accessing Home Assistant
      SERVER_REFRESH_SECONDS....Refresh time on the server side, defaults to 30
      CLIENT_REFRESH_SECONDS....Refresh time on the client side, defaults to 15

  OPTIONAL
    Command Line Parameters
      argument 2.............The logging level- can be DEBUG|INFO|ERROR


  TODO
  - does mustache really add any value any more? only urls of HA icons
  - style changes from here: https://google.github.io/styleguide/jsguide.html
  - Clean up css
  - documentation



******************************************************************************/

// Require packages
const express = require("express");
const mustacheExpress = require("mustache-express");

const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;

let logLevelText = process.argv.length > 2 ? process.argv[2] : "ERROR";
let logService = require("./services/log-service");
logService.setLogLevelByText(logLevelText);


/***********************  Start of Node Configuration  ***********************/
const port = 3000;        // Cannot be < 1024 (ie. 80) w/o root access


// Register mustache extension withe mustache express
let app = express();
app.engine("mustache", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", "./views");

// Expose only the necessary files
app.use(express.static(`./public`));

// Hack to prevent "certificate has expired" issue. Not suitable for production,
// but ok for me here. https://github.com/node-fetch/node-fetch/issues/568
process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

let router = require("./routes/all-routes")(app);
app.use(router);

app.listen(port, () => logService.log(logService.LOG_LEVELS.INFO, `Listening on port ${port}`));
/************************  End of Node Configuration  ************************/



// TODO- explain how am using worker thread
let statusController = new (require("./controllers/status-controller"));
app.locals.currentStatus = statusController.EMPTY_STATUS;

const { Worker, workerData } = require('worker_threads');
let worker = new Worker(
  './controllers/status-worker.js', 
  { workerData: { logLevelText: logLevelText }});
worker.on('message', (updatedStatus) => {
  // We got an updated status from our worker thread, so save it
  app.locals.currentStatus = updatedStatus;
});

setInterval(() => {
  // Send the currentStatus to the worker thread. It will check for updates, and send back an updated version to "worker.on('message', ...)"
  worker.postMessage(app.locals.currentStatus); 
}, SERVER_REFRESH_MS); 