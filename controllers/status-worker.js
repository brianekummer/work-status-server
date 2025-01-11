const { DateTime } = require('luxon');
const { parentPort, workerData } = require('worker_threads');


/**
 * Status Worker
 *
 * This is a worker thread for collecting up-to-date status information and 
 * returning it back to the caller.
 * 
 * Reminder that this runs in a separate process and that all of the services
 * are new instances, separate from those of the main thread.
 */
const logService = require('../services/log-service');
const slackService = new (require('../services/slack-service'));
const homeAssistantService = new (require('../services/home-assistant-service'));
const statusConditionService = new (require('../services/status-condition-service'));


const TIMES_TEMPLATES = {
  START: 'Started @ (START)',
  START_TO_END: '(START) - (STATUS_EXPIRATION)'
}


/**
 * This event is fired when the main thread sends us the current status
 *
 * It is a signal to go get updates and to return the updated status
 */
parentPort.on('message', (currentStatus) => {
  processAnyStatusChange(currentStatus)
  .then((updatedStatus) => {
    parentPort.postMessage(updatedStatus);
  });
});


/**
 * Process any status change
 *
 * It gets my Slack status for my work and home accounts, as well as statuses of
 * things in Home Assistant. Then it builds the latest status to display.
 */
processAnyStatusChange = (currentStatus) => {
  return Promise.resolve(
    Promise.all([
      slackService.getSlackStatus(slackService.ACCOUNTS.WORK),
      slackService.getSlackStatus(slackService.ACCOUNTS.HOME),
      homeAssistantService.getHomeAssistantStatus()
    ])
    .then(statuses => {
      // Statuses are returned in the same order they were called in Promises.all() 
      let latestStatus = buildNewStatus(currentStatus, 
        statuses[0],   // Slack work
        statuses[1],   // Slack home
        statuses[2]);  // Home Assistant
    
      if (JSON.stringify(currentStatus) !== JSON.stringify(latestStatus)) {
        logService.log(logService.LOG_LEVELS.INFO, 
          `Changed status\n` +
          `   from Slack: ${currentStatus.slack.emoji}/${currentStatus.slack.text}/${currentStatus.slack.times} --- HA: ${currentStatus.homeAssistant.washerText}/${currentStatus.homeAssistant.dryerText}/${currentStatus.homeAssistant.temperatureText}\n` +
          `     to Slack: ${latestStatus.slack.emoji}/${latestStatus.slack.text}/${latestStatus.slack.times} --- HA: ${latestStatus.homeAssistant.washerText}/${latestStatus.homeAssistant.dryerText}/${latestStatus.homeAssistant.temperatureText}`);
      }
      
      return latestStatus;
    })
    .catch(ex => {
      logService.log(logService.LOG_LEVELS.ERROR, `ERROR in processAnyStatusChange: ${ex}`);
      return slackService.EMPTY_SLACK_STATUS;
    })
  );
};


/**
 * Build the new status
 *
 * It needs the current (about to be previous) status, as well as the latest
 * Slack statuses for work and home, as well as the Home Assistant data.
 */
buildNewStatus = (currentStatus, workSlackStatus, homeSlackStatus, homeAssistantData) => {
  try {
    let newStatus = currentStatus;

    let matchingCondition = statusConditionService.getMatchingCondition(workSlackStatus, homeSlackStatus);
    if (matchingCondition) {
      newStatus = {
        slack: {
          emoji:  matchingCondition.display_emoji,
          text:   (matchingCondition.display_text || '')
                    .replace('(WORK_STATUS_TEXT)', workSlackStatus.text)
                    .replace('(HOME_STATUS_TEXT)', homeSlackStatus.text)
        },
        homeAssistant: {          
          washerText: homeAssistantData.washerText,
          dryerText: homeAssistantData.dryerText,
          temperatureText: homeAssistantData.temperatureText
        }
      };

      // Set the status time (i.e. "Started @ 12:30 PM" or "12:30 PM - 1:00 PM")
      updateSlackStatusTimes(matchingCondition, homeSlackStatus, workSlackStatus, currentStatus, newStatus);
    }
    
    return newStatus;
  } catch (ex) {
    logService.log(logService.LOG_LEVELS.ERROR, `ERROR in buildNewStatus: ${ex}`);
  }
};


/**
 * Determine the times of the Slack status and update that in newStatus
 */
updateSlackStatusTimes = (evaluatingStatus, homeSlackStatus, workSlackStatus, currentStatus, newStatus) => {
  // The start time only changes when the status text changes, so that if I
  // add minutes to my focus time, only the end time changes. We're adding it
  // to latestStatus so that we can use it the next time we check the status.
  newStatus.slack.statusStartTime = currentStatus.slack.text !== newStatus.slack.text
    ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
    : currentStatus.slack.statusStartTime;

  // Determine the expiration time of the status
  // 
  // If we matched the home emoji, then we need to use the home expiration.
  // The home emoji is intentionally being checked (instead of the work emoji)
  // because
  //   - It's possible that I'd be on PTO for work and that status would have an
  //     expiration in a couple of days, and also be on a non-work meeting with 
  //     an expiration of an hour or so. In this case, the home expiration 
  //     should be used.
  //   - Similarly, I can be on PTO and have a home status with no expiration,
  //     where I want to use the no-expiration of my home status instead of the
  //     expiration of my PTO at work.
  //   - It's highly unlikely that I'd have a home status with an expiration 
  //     while I'm working, where I'd want to use the work status's expiration.
  let statusExpirationSeconds = 
    homeSlackStatus.emoji && statusConditionService.matchesCondition(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji) 
      ? homeSlackStatus.expiration 
      : workSlackStatus.expiration;

  // Select the appropriate template for displaying the status time (i.e. 
  // "Started @ 12:30 PM" or "12:30 PM - 1:00 PM")
  let statusTimesTemplate = statusExpirationSeconds === 0 
    ? TIMES_TEMPLATES.START 
    : TIMES_TEMPLATES.START_TO_END;

  let statusExpiration = DateTime
    .fromSeconds(statusExpirationSeconds)
    .toLocaleString(DateTime.TIME_SIMPLE);

  // Set the times of this status
  newStatus.slack.times = 
    statusTimesTemplate
      .replace('(START)', newStatus.slack.statusStartTime)
      .replace('(STATUS_EXPIRATION)', statusExpiration);
};