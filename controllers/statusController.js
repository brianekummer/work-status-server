const logService = require("../services/log-service");
const fs = require("fs");
const csv = require('csv-parser');
const { DateTime } = require("luxon");

// TODO- not duplicate this everywhere
const LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};
var LOG_LEVEL = LOG_LEVELS[ ( process.argv.length > 2 ? process.argv[2].toUpperCase() : "ERROR")];

// Constants for working with the array of conditions for each status
const STATUS_CONDITIONS = {
  FILENAME: "status-conditions.csv",
  TIMES_TEMPLATES: {
    START: "Started @ (start)",
    START_TO_END: "(start) - (status_expiration)"
  }
};

// Empty status objects
const EMPTY_SLACK_STATUS = {
  emoji:      null,
  text:       null,
  expiration: 0,
  presence:   null
};
const EMPTY_HOME_ASSISTANT_STATUS = {
  washerText: null,
  dryerText: null,
  temperatureText: null
}

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL;
const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;


// Get my Slack security tokens, and if there is only one Slack token, set the home token to blank
const WORK = 0;
const HOME = 1;
let SLACK_TOKENS = process.env.SLACK_TOKENS.split(",");
if (SLACK_TOKENS.length === 1) SLACK_TOKENS.push("");

// 
const SLACK_CALL_STATUS_EMOJI = ":slack_call:";

// Keep the status conditions and current status in memory
let statusConditions = {};
let currentStatus = {
  slack: EMPTY_SLACK_STATUS,
  homeAssistant: EMPTY_HOME_ASSISTANT_STATUS
};


// Read status conditions from a CSV into a usable JSON object
// TODO- move this somewhere. Maybe into a class dealing with conditions?
const getStatusConditions = () => {
  let results = [];
  fs.createReadStream(STATUS_CONDITIONS.FILENAME)
  .pipe(csv(
    { separator: "|",
      skipComments: true,
      mapHeaders: ({ header, index }) => header === "" ? null : header.trim(),   // ignore '' header from each row starting with |
      mapValues: ({ header, index, value }) => value.trim()
      }
  ))
  .on('data', (data) => {
    results.push(data);
  })
  return results;
};


/******************************************************************************
  Get status to send to the client, making any necessary changes, such as
  converting an emoji to an actual filename.

  I am intentionally not sending a timestamp in the payload because that'd 
  cause every payload to be unique and wreck the etag caching. So instead, the
  client will get the time from the response header.

  Returns the status as a JSON object
******************************************************************************/
const getStatusForClient = () => {
  // TEMP CODE

  statusConditions = getStatusConditions();
  processAnyStatusChange();






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

    if (JSON.stringify(currentStatus) !== JSON.stringify(latestStatus)) {
      logService.log(LOG_LEVELS.INFO, 
        `Changed status\n` +
        `   from Slack: ${currentStatus.slack.emoji}/${currentStatus.slack.text}/${currentStatus.slack.times} --- HA: ${currentStatus.homeAssistant.washerText}/${currentStatus.homeAssistant.dryerText}/${currentStatus.homeAssistant.temperatureText}\n` +
        `     to Slack: ${latestStatus.slack.emoji}/${latestStatus.slack.text}/${latestStatus.slack.times} --- HA: ${latestStatus.homeAssistant.washerText}/${latestStatus.homeAssistant.dryerText}/${latestStatus.homeAssistant.temperatureText}`);
    }

    currentStatus = latestStatus;
  })
  .catch(ex => {
    logService.log(LOG_LEVELS.ERROR, `ERROR in processAnyStatusChange: ${ex}`);
  });
};


/******************************************************************************
  Get my Slack status for the given account, which includes my status and 
  presence
  
  If there is no security token, then just return nulls

  Returns a JSON object with my Slack status
******************************************************************************/
const getSlackStatus = (securityToken) => {
  if (!securityToken) {
    // We do not have a token for this Slack account, so return an empty object
    return Promise.resolve(EMPTY_SLACK_STATUS);
  } else {
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
      let slackStatus = {
        // Huddles don't set an emoji, they only set "huddle_state" property. For
        // my purposes, changing the emoji to the same as a Slack call is fine.
        emoji:      jsonResponses[0].profile.huddle_state === "in_a_huddle" 
                      ? SLACK_CALL_STATUS_EMOJI 
                      : jsonResponses[0].profile.status_emoji,
        text:       jsonResponses[0].profile.status_text,
        expiration: jsonResponses[0].profile.status_expiration || 0,
        presence:   jsonResponses[1].presence
      };

      if (LOG_LEVEL === LOG_LEVELS.DEBUG)
        logService.log(LOG_LEVELS.INFO, `Got SLACK for ${securityToken === SLACK_TOKENS[WORK] ? "WORK" : "HOME"}: ` +
          `${slackStatus.emoji} / ${slackStatus.text} / ${slackStatus.expiration} / ${slackStatus.presence}`);

      return Promise.resolve(slackStatus);
    })
    .catch(ex => {
      logService.log(LOG_LEVELS.ERROR, `ERROR in getSlackStatus: ${ex}`);
    });
  }
};


/******************************************************************************
  Get status of Home Assistant devices
  
  If there is no security token, then just return nulls

  Returns a JSON object with status of those Home Assistant entities
******************************************************************************/
const getHomeAssistantStatus = () => {
  if (!HOME_ASSISTANT_URL && !HOME_ASSISTANT_TOKEN) {
    return EMPTY_HOME_ASSISTANT_STATUS;
  } else {
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
          temperatureText: state.Temperature
        };
      })
      .catch(ex => {
        logService.log(LOG_LEVELS.ERROR, `ERROR in getHomeAssistantData: ${ex}`);
        return null;     // Explicitly handle the error case
      });
  
  }
};


/******************************************************************************
  Decide if an actual value matches the criteria
    - Criteria value of null and empty string match any value
    - Criteria value of * matches any non-empty value
******************************************************************************/
const matchesCriteria = (criteriaValue, actualValue) => {
  return (criteriaValue == null || criteriaValue === "" || criteriaValue === actualValue) ||
          (criteriaValue === "*" && actualValue != null && actualValue !== "");
  // TODO: remove commented code
  //let matchesA = (criteriaValue == null || criteriaValue === "" || criteriaValue === actualValue);
  //let matchesB = (criteriaValue === "*" && actualValue != null && actualValue !== "");
  //let matches = matchesA || matchesB;
  //console.log(`    matchesCriteria. criteriaValue=${criteriaValue}, actualValue=${actualValue}, matchesA=${matchesA}, matchesB=${matchesB}=>${matches}`);
  //return matchesA || matchesB;
};


/******************************************************************************
  Decide if all the criteria match
******************************************************************************/
const matchesAllCriteria = (evaluatingStatus, workSlackStatus, homeSlackStatus) => {
  // TODO: remove commented code
  //console.log(`>> matchesAllCriteria. ${evaluatingStatus.status_name}`);
  return (matchesCriteria(evaluatingStatus.conditions_work_emoji, workSlackStatus.emoji) &&
          matchesCriteria(evaluatingStatus.conditions_work_presence, workSlackStatus.presence) &&
          matchesCriteria(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji) &&
          matchesCriteria(evaluatingStatus.conditions_home_presence, homeSlackStatus.presence));
  //let matchesWorkEmoji = matchesCriteria(evaluatingStatus.conditions_work_emoji, workSlackStatus.emoji);
  //let matchesWorkPresence = matchesCriteria(evaluatingStatus.conditions_work_presence, workSlackStatus.presence);
  //let matchesHomeEmoji = matchesCriteria(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji);
  //let matchesHomePresence = matchesCriteria(evaluatingStatus.conditions_home_presence, homeSlackStatus.presence);
  //let matches = matchesWorkEmoji && matchesWorkPresence && matchesHomeEmoji && matchesHomePresence;
  //console.log(`    matchesWorkEmoji=${matchesWorkEmoji}, matchesWorkPresence=${matchesWorkPresence}, matchesHomeEmoji=${matchesHomeEmoji}, matchesHomePresence=${matchesHomePresence} => ${matches}`);
  //return matches;
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
            emoji:  evaluatingStatus.display_emoji,
            text:   (evaluatingStatus.display_text || "")
                      .replace("(WORK_STATUS_TEXT)", workSlackStatus.text)
                      .replace("(HOME_STATUS_TEXT)", homeSlackStatus.text)
          },
          homeAssistant: {          
            washerText: homeAssistantData.washerText,
            dryerText: homeAssistantData.dryerText,
            temperatureText: homeAssistantData.temperatureText
          }
        };

        // Determine and set the the status time
        updateSlackStatusTimes(evaluatingStatus, homeSlackStatus, workSlackStatus, currentStatus, latestStatus);

        break;
      }
    }
    
    return latestStatus;
  } catch (ex) {
    logService.log(LOG_LEVELS.ERROR, `ERROR in calculateLatestStatus: ${ex}`);
  }
};


/******************************************************************************
  Determine and set the times of the Slack status in latestStatus
******************************************************************************/
const updateSlackStatusTimes = (evaluatingStatus, homeSlackStatus, workSlackStatus, currentStatus, latestStatus) => {
  // The start time only changes when the status text changes, so that if I
  // add minutes to my focus time, only the end time changes. We're adding it
  // to latestStatus so that we can use it the next time we check the status.
  latestStatus.slack.statusStartTime = currentStatus.slack.text !== latestStatus.slack.text
    ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
    : currentStatus.slack.statusStartTime;

  // Determine the expiration time of the status
  // 
  // If we matched the home emoji, then we need to use the home expiration.
  // I am intentionally checking the home emoji (instead of work) because
  //   - It's possible that I'd be on PTO for work and have an expiration in
  //     a couple of days, and also be on a non-work meeting with an expiration 
  //     of an hour or so. In this case, I want to use the home expiration.
  //   - Similarly, I can be on PTO and have a home status with no expiration,
  //     where I want to use the no-expiration of my home status instead of the
  //     expiration of my PTO at work.
  //   - It's highly unlikely I'd have a home status with an expiration while 
  //     I'm working, where I'd want to use the work status's expiration.
  const statusExpirationSeconds = 
    homeSlackStatus.emoji && matchesCriteria(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji) 
      ? homeSlackStatus.expiration 
      : workSlackStatus.expiration;

  // Select the appropriate template for displaying the status time for this status
  let statusTimesTemplate = 
    (evaluatingStatus.display_times || "")
      .replace("START_TO_END", STATUS_CONDITIONS.TIMES_TEMPLATES.START_TO_END)
      .replace("START",        STATUS_CONDITIONS.TIMES_TEMPLATES.START);
  if (statusTimesTemplate === STATUS_CONDITIONS.TIMES_TEMPLATES.START_TO_END && statusExpirationSeconds === 0) {
    // When we're supposed to display both the start and end time, but we only
    // have the start time
    statusTimesTemplate = STATUS_CONDITIONS.TIMES_TEMPLATES.START;
  }

  let statusExpiration = DateTime
    .fromSeconds(statusExpirationSeconds)
    .toLocaleString(DateTime.TIME_SIMPLE);

  // Set the times of this status
  latestStatus.slack.times = 
    statusTimesTemplate
      .replace("(start)", latestStatus.slack.statusStartTime)
      .replace("(status_expiration)", statusExpiration);
};

module.exports = {
  getStatusForClient    
}
