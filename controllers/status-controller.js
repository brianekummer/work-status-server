const { DateTime } = require("luxon");

const logService = require("../services/log-service");
const slackService = require("../services/slack-service");
const homeAssistantService = require("../services/home-assistant-service");
const criteriaService = new (require("../services/criteria-service"));



// Constants for working with the array of conditions for each status
const TIMES_TEMPLATES = {
  START: "Started @ (start)",
  START_TO_END: "(start) - (status_expiration)"
}


// Keep the status conditions and current status in memory
//let statusConditions = {};
let currentStatus = {
  slack: slackService.EMPTY_SLACK_STATUS,
  homeAssistant: homeAssistantService.EMPTY_HOME_ASSISTANT_STATUS
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
  processAnyStatusChange();
  // END OF TEMP CODE

  let status = {
    emoji: slackService.buildEmojiUrl(currentStatus.slack.emoji),
    text: currentStatus.slack.text,
    times: currentStatus.slack.times
  };
  // TODO- do not return HA data if is wall
  status.homeAssistant = {
    washerText: currentStatus.homeAssistant.washerText,
    dryerText: currentStatus.homeAssistant.dryerText,
    temperatureText: currentStatus.homeAssistant.temperatureText
  };

  return status;
};


/******************************************************************************
  Process any status change. This is executed on the server every x seconds.

  It gets my Slack status for my work and home accounts, as well as statuses of
  things in Home Assistant. Then it builds the latest status to display at home.
******************************************************************************/
const processAnyStatusChange = () => {
  // TODO- find better way of specifying which statuses[] record is which
  const STATUS_KEYS = {
    SLACK_WORK: 0,
    SLACK_HOME: 1,
    HOME_ASSISTANT: 2
  }

  Promise.all([
    slackService.getSlackStatus(slackService.ACCOUNTS.WORK),
    slackService.getSlackStatus(slackService.ACCOUNTS.HOME),
    homeAssistantService.getHomeAssistantStatus()
  ])
  .then(statuses => {
    let latestStatus = buildLatestStatus(currentStatus, statuses[STATUS_KEYS.SLACK_WORK], statuses[STATUS_KEYS.SLACK_HOME], statuses[STATUS_KEYS.HOME_ASSISTANT]);

    if (JSON.stringify(currentStatus) !== JSON.stringify(latestStatus)) {
      logService.log(logService.LOG_LEVELS.INFO, 
        `Changed status\n` +
        `   from Slack: ${currentStatus.slack.emoji}/${currentStatus.slack.text}/${currentStatus.slack.times} --- HA: ${currentStatus.homeAssistant.washerText}/${currentStatus.homeAssistant.dryerText}/${currentStatus.homeAssistant.temperatureText}\n` +
        `     to Slack: ${latestStatus.slack.emoji}/${latestStatus.slack.text}/${latestStatus.slack.times} --- HA: ${latestStatus.homeAssistant.washerText}/${latestStatus.homeAssistant.dryerText}/${latestStatus.homeAssistant.temperatureText}`);
    }

    currentStatus = latestStatus;
  })
  .catch(ex => {
    logService.log(logService.LOG_LEVELS.ERROR, `ERROR in processAnyStatusChange: ${ex}`);
  });
};




/******************************************************************************
  Builds the latest status

  It needs the current (about to be previous) status, as well as the latest
  Slack statuses for work and home, as well as the Home Assistant data.
******************************************************************************/
const buildLatestStatus = (currentStatus, workSlackStatus, homeSlackStatus, homeAssistantData) => {
  try {
    let latestStatus = currentStatus;

    let matchingStatus = criteriaService.getMatchingCondition(workSlackStatus, homeSlackStatus);
    if (matchingStatus) {
      // Build the latest status
      latestStatus = {
        slack: {
          emoji:  matchingStatus.display_emoji,
          text:   (matchingStatus.display_text || "")
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
      updateSlackStatusTimes(matchingStatus, homeSlackStatus, workSlackStatus, currentStatus, latestStatus);
    }
    
    return latestStatus;
  } catch (ex) {
    logService.log(logService.LOG_LEVELS.ERROR, `ERROR in buildLatestStatus: ${ex}`);
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
    homeSlackStatus.emoji && criteriaService.matchesCriteria(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji) 
      ? homeSlackStatus.expiration 
      : workSlackStatus.expiration;

  // Select the appropriate template for displaying the status time for this status
  let statusTimesTemplate = 
    (evaluatingStatus.display_times || "")
      .replace("START_TO_END", TIMES_TEMPLATES.START_TO_END)
      .replace("START",        TIMES_TEMPLATES.START);
  if (statusTimesTemplate === TIMES_TEMPLATES.START_TO_END && statusExpirationSeconds === 0) {
    // When we're supposed to display both the start and end time, but we only
    // have the start time
    statusTimesTemplate = TIMES_TEMPLATES.START;
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