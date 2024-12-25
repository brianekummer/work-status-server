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
    times:  null,
    statusTimesTemplate: null,
    statusStartTime: null,
    workStatusExpiration: null,
    homeStatusExpiration: null
  },
  homeAssistant: { 
    url: null,
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

// "http://xxxxx:3000" without a path sends the status page
app.get("/", (request, response) => {
  let showDesk = false;    
  if (typeof request.query.showDesk === "string") {
    showDesk = (request.query.showDesk.toLowerCase() == "true"); 
  }
  
  response.render("status", {"showDesk": showDesk});
});

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
  checkForStatusChange();
});

// Call from status.html asking for latest status
app.get("/get-status", (request, response) => response.status(200).json(getStatusForClient()));

app.listen(port, () => log(LOG_LEVELS.INFO, `Listening on port ${port}`));
/************************  End of Node Configuration  ************************/





/******************************************************************************
  Sleep x milliseconds
******************************************************************************/
const sleep = ms => {
  var waitTill = new Date(new Date().getTime() + ms);
  while(waitTill > new Date()){}
};


/******************************************************************************
  Get my status. This merges my current Slack status and any Home Assistant 
  info that the browser needs in order for it to call HA.

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
      url: HOME_ASSISTANT_URL,
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

  It gets my Slack status for my work and home accounts and calculates my  
  status to display at home. If that status has changed, the save it so that 
  it can be read by the web pages.
******************************************************************************/
const checkForStatusChange = () => {
  Promise.all([
	  getSlackStatus(SLACK_TOKENS[WORK]),
	  getSlackStatus(SLACK_TOKENS[HOME]),
    getHomeAssistantStatus()
  ])
  .then(statuses => {
    let latestStatus = calculateLatestStatus(statuses[WORK], statuses[HOME], statuses[2]);
    if (statusHasChanged(currentStatus, latestStatus)) {
      latestStatus = updateSlackStatusTimes(currentStatus, latestStatus);
      log(LOG_LEVELS.INFO, 
        `Changed status from Slack:${currentStatus.slack.emoji}/${currentStatus.slack.text}/${currentStatus.slack.times}/HA:${currentStatus.homeAssistant.washerText}/${currentStatus.homeAssistant.dryerText}/${currentStatus.homeAssistant.temperatureText}} => ` +
        `${latestStatus.slack.emoji}/${latestStatus.slack.text}/${latestStatus.slack.times}/HA:${latestStatus.homeAssistant.washerText}/${latestStatus.homeAssistant.dryerText}/${latestStatus.homeAssistant.temperatureText}`);
      currentStatus = latestStatus;
    }
  })
  .catch(ex => {
    log(LOG_LEVELS.ERROR, `ERROR in checkForStatusChange: ${ex}`);
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
  
  Returns a JSON object with my Slack status.
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
      log(LOG_LEVELS.DEBUG, `Got SLACK for ${securityToken == SLACK_TOKENS[WORK] ? "WORK" : "HOME"}\n` +
        `profile=${JSON.stringify(jsonResponses[0])}\n` + 
        `presence=${JSON.stringify(jsonResponses[1])}`);
    else if (LOG_LEVEL == LOG_LEVELS.INFO) 
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
  Calculate the latest status
******************************************************************************/
const calculateLatestStatus = (workSlackStatus, homeSlackStatus, homeAssistantData) => {
  let latestStatus = null;

  try {
    for (let evaluatingStatus of statusConditions) {
      // The FIRST condition that matches all criteria is used, so the order of
      // conditions is important
      if (matchesAllCriteria(evaluatingStatus, workSlackStatus, homeSlackStatus)) {
        // Handle when we want both start and end time, but we only have the start time
        let statusTimesTemplate = (evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_TIMES] || "")
          .replace("TIME_TEXT_START_TO_END", STATUS_CONDITIONS.TIME_TEXT.START_TO_END)
          .replace("TIME_TEXT_START",        STATUS_CONDITIONS.TIME_TEXT.START);
        if (statusTimesTemplate == STATUS_CONDITIONS.TIME_TEXT.START_TO_END && workSlackStatus.expiration == 0 && homeSlackStatus.expiration == 0) {
          statusTimesTemplate = STATUS_CONDITIONS.TIME_TEXT.START;
        }

        // Build the latest status
        latestStatus = {
          slack: {
            emoji:  evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_EMOJI],
            text:   (evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_TEXT] || "")
                      .replace("(work_status_text)", workSlackStatus.text)
                      .replace("(home_status_text)", homeSlackStatus.text),
            statusTimesTemplate:  statusTimesTemplate,
            workStatusExpiration: workSlackStatus.expiration,
            homeStatusExpiration: homeSlackStatus.expiration,
          },
          homeAssistant: {          
            washerText: homeAssistantData.washerText,
            dryerText: homeAssistantData.dryerText,
            temperatureText: homeAssistantData.temperatureText
          }
        };
        
        log(LOG_LEVELS.INFO, `Latest status is now ${latestStatus.slack.emoji}/${latestStatus.slack.text}`);
        
        break;
      }
    };
    
    return latestStatus;
  } catch (ex) {
    log(LOG_LEVELS.ERROR, `ERROR in calculateLatestStatus: ${ex}`);
  }
};


/******************************************************************************
  Format the times of the Slack status. The start time only changes when the
  status text changes, so that if I add minutes to my focus time, only the end 
  time changes.
******************************************************************************/
const updateSlackStatusTimes = (currentStatus, latestStatus) => {
  latestStatus.slack.statusStartTime = currentStatus.slack.text != latestStatus.slack.text
    ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
    : currentStatus.slack.statusStartTime;

  // When calculating status_expiration, I am intentionally checking the home
  // expiration first because
  //   - It's possible that I'd be on PTO for work and have an expiration in
  //     a couple of days, and also be on a non-work meeting with an expiration 
  //     of an hour or so. In this case, I want to use the home expiration.
  //   - It's highly unlikely I'd have a home status with an expiration while 
  //     I'm working, where I'd want to use the work status's expiration.
  let statusExpiration = latestStatus.slack.homeStatusExpiration != 0
    ? latestStatus.slack.homeStatusExpiration
    : latestStatus.slack.workStatusExpiration;

  latestStatus.slack.times = latestStatus.slack.statusTimesTemplate
    .replace("(start)", latestStatus.slack.statusStartTime)
    .replace("(status_expiration)", 
      DateTime.fromSeconds(statusExpiration)
      .toLocaleString(DateTime.TIME_SIMPLE)
    );

  return latestStatus;
};


setInterval(checkForStatusChange, 30000);