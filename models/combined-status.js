const logger = require('../services/logger');
const statusConditionService = new (require('../services/status-condition-service'));


/**
 * Combined Status
 * 
 * Has all Slack and Home Assistant statuses
 */
class CombinedStatus {
  // TODO- improve this??
  static EMPTY_STATUS = new CombinedStatus(null, null, null, null, null, null, null);

  #TIMES_TEMPLATES = {
    START: 'Started @ (START)',
    START_TO_END: '(START) - (STATUS_EXPIRATION)'
  }
  

  slack = {};
  homeAssistant = {};

  
  // TODO- Having fns in my models causes issues passing status into worker.postMessage
  //toStringDebug = () => `${this.washerText}/${this.dryerText}/${this.temperatureText}`;


  constructor(oldCombinedStatus, matchingCondition, workSlackStatus, homeSlackStatus, homeAssistantStatus) {
  // Definition of EMPTY_STATUS passes in null for everything, so use ? operator and be careful
    logger.debug('&&&&& combined-status constructor()');
    console.log(matchingCondition);
    
    let newCombinedStatus = {
      slack: {
        emoji: matchingCondition?.display_emoji,
        text: (matchingCondition?.display_text || '')
                .replace('(WORK_STATUS_TEXT)', workSlackStatus?.text)
                .replace('(HOME_STATUS_TEXT)', homeSlackStatus?.text),
        times: null,
        statusStartTime: null
      },
      homeAssistant: {          
        washerText: homeAssistantStatus?.washerText,
        dryerText: homeAssistantStatus?.dryerText,
        temperatureText: homeAssistantStatus?.temperatureText
      }
    };
    
    // Set the status time (i.e. "Started @ 12:30 PM" or "12:30 PM - 1:00 PM") and
    // status start time
    if (matchingCondition) {
      this.updateSlackStatusTimes(matchingCondition, homeSlackStatus, workSlackStatus, oldCombinedStatus, newCombinedStatus);
    }

    //logger.debug('@@@@@ returning');
    //logger.debug(newCombinedStatus);

    return newCombinedStatus;
  }

  /***** DOESN'T WORK *****
  constructor(slackEmoji, slackText, slackTimes, slackStatusStartTime, homeAssistantWasherText, homeAssistantDryerText, homeAssistantTemperatureText) {
    this.slack = {
      emoji: slackEmoji,
      text: slackText,
      times: slackTimes,
      statusStartTime: slackStatusStartTime
    };
    this.homeAssistant = {          
      washerText: homeAssistantWasherText,
      dryerText: homeAssistantDryerText,
      temperatureText: homeAssistantTemperatureText
    };
  }

  updateStatus(matchingCondition, workSlackStatus, homeSlackStatus, homeAssistantStatus) {
    logger.debug('&&&&& combined-status updateStatus()');
    
    let newCombinedStatus = new CombinedStatus(
        matchingCondition.display_emoji,
        (matchingCondition.display_text || '')
          .replace('(WORK_STATUS_TEXT)', workSlackStatus.text)
          .replace('(HOME_STATUS_TEXT)', homeSlackStatus.text),
        null,
        null, 
        homeAssistantStatus.washerText,
        homeAssistantStatus.dryerText,
        homeAssistantStatus.temperatureText
    );
    
    // Set the status time (i.e. "Started @ 12:30 PM" or "12:30 PM - 1:00 PM") and
    // status start time
    this.updateSlackStatusTimes(matchingCondition, homeSlackStatus, workSlackStatus, this, newCombinedStatus);

    logger.debug('@@@@@ returning');
    logger.debug(newCombinedStatus);

    return newCombinedStatus;
  }
    ******/



  /**
   * Determine the times of the Slack status and update that in newStatus
   */
  *updateSlackStatusTimes(evaluatingStatus, homeSlackStatus, workSlackStatus, oldCombinedStatus, newCombinedStatus) {
    // The start time only changes when the status text changes, so that if I
    // add minutes to my focus time, only the end time changes. We're adding it
    // to latestStatus so that we can use it the next time we check the status.
    newCombinedStatus.slack.statusStartTime = oldCombinedStatus.slack.text !== newCombinedStatus.slack.text
      ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
      : oldCombinedStatus.slack.statusStartTime;

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
    newCombinedStatus.slack.times = 
      statusTimesTemplate
        .replace('(START)', newCombinedStatus.slack.statusStartTime)
        .replace('(STATUS_EXPIRATION)', statusExpiration);
  };
}
    
    
module.exports = CombinedStatus;