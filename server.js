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
      express................For coding simple web pages
      node-fetch.............For simplifying http commands
      node-json-minify.......Since comments are invalid syntax in JSON, they need 
                             to be stripped out of the status conditions matrix
      luxon..................For date formatting, instead of momentJS
      mustache-express.......For implementing Mustache templates with Express
      node-watch.............For watching if the status conditions file changes,
                             so we can pickup any changes to that file without
                             requiring an app restart

    Environment Variables
      SLACK_TOKENS...........Must be the Slack security tokens for my work and home
                             and accounts in a csv, like this: 
                             <work_token>,<home_token>
      HOME_ASSISTANT_URL.....URL for Home Assistant
      HOME_ASSISTANT_TOKEN...Security token for accessing Home Assistant

  OPTIONAL
    Command Line Parameters
      argument 2.............The logging level- can be DEBUG|INFO|ERROR

  TO DO
    - Why is the browser calling Home Assistant to get that information?
      Can't this app do that? Yes, it can, but the browser makes a call every 10 
      seconds or so, meaning it will get the most up-to-date information from
      Home Assistant.

******************************************************************************/

// Require packages
const express = require("express");
const mustacheExpress = require("mustache-express");
const fs = require("fs");
const fetch = require("node-fetch");
const watch = require("node-watch");
const app = express();
const { DateTime } = require("luxon");
JSON.minify = require("node-json-minify");

// Constants for working with the matrix of conditions for each status
const STATUS_CONDITIONS = {
  FILENAME: "status-conditions.json",
  COLUMNS: {
    STATUS_NAME:                0,
    CRITERIA_WORK_STATUS_EMOJI: 1,
    CRITERIA_WORK_PRESENCE:     2,
    CRITERIA_HOME_STATUS_EMOJI: 3,
    CRITERIA_HOME_PRESENCE:     4,
    RESULT_NEW_STATUS_EMOJI:    5,
    RESULT_NEW_STATUS_TEXT:     6,
    RESULT_NEW_STATUS_TIMES:    7
  },
  TIME_TEXT: {
    START: "Started @ (start)",
    START_TO_END: "(start) - (status_expiration)"
  }
};

const SLACK_CALL_STATUS_EMOJI = ":slack_call:";

// My Slack security tokens
let WORK = 0;
let HOME = 1;
let SLACK_TOKENS = process.env.SLACK_TOKENS.split(",");

let HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL;
let HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;

// My simple home-grown logging
const LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};
var LOG_LEVEL = LOG_LEVELS[ ( process.argv.length > 2 ? process.argv[2].toUpperCase() : "ERROR")];
let log = (level, message) => {
  if (level >= LOG_LEVEL) {
    console.log(message);
  }   
};
log(LOG_LEVELS.INFO, `Log level is ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] == LOG_LEVEL)}`);

// Keep the status conditions and current status in memory
let statusConditions = {};
let currentStatus = {
  slack: {
    emoji:  null,
    text:   null,
    statusStartTime: null,
    times:  null
  },
  homeAssistant: { 
    washerText: null,
    dryerText: null,
    temperatureText: null
  }
};



/***********************  Start of Node Configuration  ***********************/
const port = 3000;        // Cannot be < 1024 (ie. 80) w/o root access

// Register mustache extension withe mustache express
app.engine("html", mustacheExpress());
app.set("view engine", "html");
app.set("views", `${__dirname}/views`);

// Expose only the necessary files
app.use(express.static(`${__dirname}/public`));

// Hack to prevent "certificate has expired" issue. Not suitable for production,
// but ok for me here. https://github.com/node-fetch/node-fetch/issues/568
process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

// Read status conditions from a file, strip out comments, and parse it into a usable
// JSON object
const getStatusConditions = () => {
  return JSON.parse(JSON.minify(fs.readFileSync(STATUS_CONDITIONS.FILENAME, "utf8")));
};

// Get the conditions to determine the status. Whenever they change, get the changes
// and re-evaluate our status, because it might be different because of those changes.
statusConditions = getStatusConditions();
watch(STATUS_CONDITIONS.FILENAME, {}, function(evt, name) {
  log(LOG_LEVELS.DEBUG, `${name} changed, so am re-reading it`);
  statusConditions = getStatusConditions();
  processAnyStatusChange();
});

// Don't bother returning a favicon
app.get('/favicon.ico', (request, response) => response.status(204).end());

// "http://xxxxx:3000" without a path sends the status page
// Since we have them now, we'll pass the URLs for the Home Assistant icons that will
// be displayed if showDesk=true
app.get("/", (request, response) => {
  // Default payload
  let payload = { showDesk: false };
  
  if (typeof request.query.showDesk === "string") {
    // User passed showDesk as a query param
    payload = {
      showDesk: (request.query.showDesk.toLowerCase() == "true"),
      washerIconUrl: `${HOME_ASSISTANT_URL}/local/icon/mdi-washing-machine-light.png`,
      dryerIconUrl: `${HOME_ASSISTANT_URL}/local/icon/mdi-tumble-dryer-light.png`,
      temperatureIconUrl: `${HOME_ASSISTANT_URL}/local/icon/thermometer.png`
    }
  }
  
  response.render("status", payload);
});

// Call from status.js on the client asking for the latest status
app.get("/get-status", (request, response) => response.status(200).json(getStatusForClient()));

app.listen(port, () => log(LOG_LEVELS.INFO, `Listening on port ${port}`));
/************************  End of Node Configuration  ************************/





/******************************************************************************
  Get status to send to the client, making any necessary changes, such as
  converting an emoji to an actual filename.

  I am intentionally not sending a timestamp in the payload because that'd 
  cause every payload to be unique and wreck the etag caching. So instead, the
  client will get the time from the response header.

  Returns the status as a JSON object
******************************************************************************/
const getStatusForClient = () => {
  return {
    slack: {
      emoji: currentStatus.slack.emoji ? `/images/${currentStatus.slack.emoji}.png` : "",
      text: currentStatus.slack.text,
      times: currentStatus.slack.times
    },
    homeAssistant: {
      washerText: currentStatus.homeAssistant.washerText,
      dryerText: currentStatus.homeAssistant.dryerText,
      temperatureText: currentStatus.homeAssistant.temperatureText
    }
  };
};


/******************************************************************************
  Decide if the status has changed
******************************************************************************/
const statusHasChanged = (currentStatus, latestStatus) => {
  return (currentStatus == null || 
          currentStatus.slack.text != latestStatus.slack.text || 
          currentStatus.slack.workStatusExpiration != latestStatus.slack.workStatusExpiration ||
          currentStatus.slack.homeStatusExpiration != latestStatus.slack.homeStatusExpiration ||
          currentStatus.homeAssistant.washerText != latestStatus.homeAssistant.washerText ||
          currentStatus.homeAssistant.dryerText != latestStatus.homeAssistant.dryerText ||
          currentStatus.homeAssistant.temperatureText != latestStatus.homeAssistant.temperatureText);
};


/******************************************************************************
  Process any status change. This is executed on the server every x seconds.

  It gets my Slack status for my work and home accounts, as well as statuses of
  things in Home Assistant. Then it builds the latest status to display at home.
******************************************************************************/
const processAnyStatusChange = () => {
  Promise.all([
	  getSlackStatus(SLACK_TOKENS[WORK]),
	  getSlackStatus(SLACK_TOKENS[HOME]),
    getHomeAssistantStatus()
  ])
  .then(statuses => {
    let latestStatus = buildLatestStatus(currentStatus, statuses[WORK], statuses[HOME], statuses[2]);

    if (statusHasChanged(currentStatus, latestStatus)) {
      log(LOG_LEVELS.INFO, 
        `Changed status\n` +
        `   from Slack: ${currentStatus.slack.emoji}/${currentStatus.slack.text}/${currentStatus.slack.times} --- HA: ${currentStatus.homeAssistant.washerText}/${currentStatus.homeAssistant.dryerText}/${currentStatus.homeAssistant.temperatureText}\n` +
        `     to Slack: ${latestStatus.slack.emoji}/${latestStatus.slack.text}/${latestStatus.slack.times} --- HA: ${latestStatus.homeAssistant.washerText}/${latestStatus.homeAssistant.dryerText}/${latestStatus.homeAssistant.temperatureText}`);
    }

    currentStatus = latestStatus;
  })
  .catch(ex => {
    log(LOG_LEVELS.ERROR, `ERROR in processAnyStatusChange: ${ex}`);
  });
}


/******************************************************************************
  Get status of Home Assistant devices
  
  Returns a JSON object with status of those Home Assistant entities
******************************************************************************/
const getHomeAssistantStatus = () => {
  let headers = {
    "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`
  };

  return fetch(`${HOME_ASSISTANT_URL}/api/states/sensor.work_status_phone_info`, { method: "GET", headers: headers })
    .then(response => response.json())
    .then(jsonResponse => {
      const state = JSON.parse(jsonResponse.state);

      return {
        washerText: state.Washer,
        dryerText: state.Dryer,
        temperatureText: state.Temperature,
      };
    })
    .catch(ex => {
      log(LOG_LEVELS.ERROR, `ERROR in getHomeAssistantData: ${ex}`);
      return null; // Explicitly handle the error case
    });
};


/******************************************************************************
  Get my Slack status for the given account. This includes my status and 
  presence.
  
  Returns a JSON object with my Slack status
******************************************************************************/
const getSlackStatus = securityToken => {
  let headers = {
    "Content-Type":  "application/x-www-form-urlencoded",
    "Authorization": `Bearer ${securityToken}`  
  };
  return Promise.all([
    fetch("https://slack.com/api/users.profile.get", { method: "GET", headers: headers }),
    fetch("https://slack.com/api/users.getPresence", { method: "GET", headers: headers })
  ])
  .then(responses => Promise.all(responses.map(response => response.json())))
  .then(jsonResponses => {
    if (LOG_LEVEL == LOG_LEVELS.DEBUG)
      log(LOG_LEVELS.INFO, `Got SLACK for ${securityToken == SLACK_TOKENS[WORK] ? "WORK" : "HOME"}: ` +
        `${jsonResponses[0].profile.status_emoji} / ` +
        `${jsonResponses[0].profile.status_text} / ` +
        `${jsonResponses[0].profile.status_expiration} / ` +
        `${jsonResponses[1].presence}`);

    // Huddles don't set an emoji, they only set "huddle_state" property. For
    // my purposes, changing the emoji to the same as a Slack call is fine.
    if (jsonResponses[0].profile.huddle_state == "in_a_huddle")
      jsonResponses[0].profile.status_emoji = SLACK_CALL_STATUS_EMOJI;

    return Promise.resolve({
      emoji:      jsonResponses[0].profile.status_emoji,
      text:       jsonResponses[0].profile.status_text,
      expiration: jsonResponses[0].profile.status_expiration || 0,
      presence:   jsonResponses[1].presence
    });
  })
  .catch(ex => {
    log(LOG_LEVELS.ERROR, `ERROR in getSlackStatus: ${ex}`);
  });
};


/******************************************************************************
  Decide if an actual value matches the criteria. Criteria values of null and
  empty string match everything. 
******************************************************************************/
const matchesCriteria = (criteriaValue, actualValue) => {
  return (criteriaValue == null || criteriaValue == "" || criteriaValue == actualValue);
};


/******************************************************************************
  Decide if all the criteria match.
******************************************************************************/
const matchesAllCriteria = (evaluatingStatus, workSlackStatus, homeSlackStatus) => {
  return (matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_WORK_STATUS_EMOJI], workSlackStatus.emoji) &&
          matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_WORK_PRESENCE],     workSlackStatus.presence) &&
          matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_HOME_STATUS_EMOJI], homeSlackStatus.emoji) &&
          matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_HOME_PRESENCE],     homeSlackStatus.presence));
};


/******************************************************************************
  Builds the latest status

  It needs the current (about to be previous) status, as well as the latest
  Slack statuses for work and home, as well as the Home Assistant data.
******************************************************************************/
const buildLatestStatus = (currentStatus, workSlackStatus, homeSlackStatus, homeAssistantData) => {
  let latestStatus = null;

  try {
    for (let evaluatingStatus of statusConditions) {
      // The FIRST condition that matches all criteria is used, so the order of
      // conditions is important
      if (matchesAllCriteria(evaluatingStatus, workSlackStatus, homeSlackStatus)) {
        // Build the latest status
        latestStatus = {
          slack: {
            emoji:  evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_EMOJI],
            text:   (evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_TEXT] || "")
                      .replace("(work_status_text)", workSlackStatus.text)
                      .replace("(home_status_text)", homeSlackStatus.text)
          },
          homeAssistant: {          
            washerText: homeAssistantData.washerText,
            dryerText: homeAssistantData.dryerText,
            temperatureText: homeAssistantData.temperatureText
          }
        };

        // Select the appropriate template for displaying the status time for this status
        let statusTimesTemplate = (evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_TIMES] || "")
          .replace("TIME_TEXT_START_TO_END", STATUS_CONDITIONS.TIME_TEXT.START_TO_END)
          .replace("TIME_TEXT_START",        STATUS_CONDITIONS.TIME_TEXT.START);
        if (statusTimesTemplate == STATUS_CONDITIONS.TIME_TEXT.START_TO_END && workSlackStatus.expiration == 0 && homeSlackStatus.expiration == 0) {
          // When we're supposed to display both the start and end time, but we only
          // have the start time
          statusTimesTemplate = STATUS_CONDITIONS.TIME_TEXT.START;
        }

        // Update the status time
        updateSlackStatusTimes(currentStatus, latestStatus, statusTimesTemplate, workSlackStatus.expiration, homeSlackStatus.expiration);

        break;
      }
    }
    
    return latestStatus;
  } catch (ex) {
    log(LOG_LEVELS.ERROR, `ERROR in calculateLatestStatus: ${ex}`);
  }
};


/******************************************************************************
  Format the times of the Slack status
******************************************************************************/
const updateSlackStatusTimes = (currentStatus, latestStatus, statusTimesTemplate, workSlackStatusExpiration, homeSlackStatusExpiration) => {
  // The start time only changes when the status text changes, so that if I
  // add minutes to my focus time, only the end time changes. We're adding it
  // to latestStatus so that we can use it the next time we check the status.
  latestStatus.slack.statusStartTime = currentStatus.slack.text != latestStatus.slack.text
    ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
    : currentStatus.slack.statusStartTime;
    
  // When calculating status expiration, I am intentionally checking the home
  // expiration first because
  //   - It's possible that I'd be on PTO for work and have an expiration in
  //     a couple of days, and also be on a non-work meeting with an expiration 
  //     of an hour or so. In this case, I want to use the home expiration.
  //   - It's highly unlikely I'd have a home status with an expiration while 
  //     I'm working, where I'd want to use the work status's expiration.
  let statusExpirationSeconds = homeSlackStatusExpiration != 0
    ? homeSlackStatusExpiration
    : workSlackStatusExpiration;
  let statusExpiration = DateTime
    .fromSeconds(statusExpirationSeconds)
    .toLocaleString(DateTime.TIME_SIMPLE);

  // Set the times of this status
  latestStatus.slack.times = statusTimesTemplate
    .replace("(start)", latestStatus.slack.statusStartTime)
    .replace("(status_expiration)", statusExpiration);
};



setInterval(processAnyStatusChange, 30000);