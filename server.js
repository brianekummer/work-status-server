/******************************************************************************
  Server side code for Home Working Status


  GENERAL STRATEGY
    - Timer runs every 30 seconds and gets my Slack status for work and home
      accounts. It calculates my new status to display at home, and saves it 
      in a variable in memory.
    - Web pages periodically (every 10 seconds) ask for my latest status. This
      call returns the contents of that variable in memory.

  REQUIREMENTS
    NPM Packages
      express..................For coding simple web pages
      node-fetch...............For simplifying http commands
      csv-parser...............For parsing status-conditions.csv
      luxon....................For date formatting, instead of momentJS
      mustache-express.........For implementing Mustache templates with Express
      node-watch...............For watching if the status conditions file changes,
                               so we can pickup any changes to that file without
                               requiring an app restart

    Environment Variables
      SLACK_TOKENS.............Must be the Slack security tokens for my work and
                               home accounts in a csv, like this: 
                               <work_token>,<home_token>
      HOME_ASSISTANT_BASE_URL..Base URL for Home Assistant
      HOME_ASSISTANT_TOKEN.....Security token for accessing Home Assistant
      SERVER_REFRESH_SECONDS...Refresh time on the server side, defaults to 30
      CLIENT_REFRESH_SECONDS...Refresh time on the client side, defaults to 15

  OPTIONAL
    Command Line Parameters
      argument 2.............The logging level- can be DEBUG|INFO|ERROR


  TODO
  - Initial version, upon page request, reads the status conditions file, then gets status from Slack and HA, builds response and responds
     - Read Slack and HA status and refresh when it changes
  - Try to make all services into classes
  - Can I use mustache for fetch call to get-status?
  - style changes from here: https://google.github.io/styleguide/jsguide.html

  LINKS TO RESEARCH
    - https://www.inngest.com/blog/no-workers-necessary-nodejs-express
    - https://www.npmjs.com/package/webworker-threads
    - https://www.youtube.com/watch?v=Q2ZglbOauD8
    - https://www.youtube.com/watch?v=Cgvopu9zg8Y
    - https://www.youtube.com/watch?v=bQuBlR0T5cc

******************************************************************************/

// Require packages
const express = require("express");
const mustacheExpress = require("mustache-express");

const logService = require("./services/log-service");
logService.setLogLevel(process.argv.length > 2 ? process.argv[2] : "ERROR");


// TODO- this is needed for server side refresh
const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;


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


const router = require("./routes/all-routes");
app.use(router);






app.listen(port, () => logService.log(logService.LOG_LEVELS.INFO, `Listening on port ${port}`));
/************************  End of Node Configuration  ************************/











// TODO- have this run in the background and pass data to the main thread
//setInterval(processAnyStatusChange, SERVER_REFRESH_MS);