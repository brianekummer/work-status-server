const logger = require('../services/logger');
const statusConditionService = new (require('../services/status-condition-service'));


/**
 * Combined Status
 * 
 * Has all Slack and Home Assistant statuses
 */
class CombinedStatus {
  static EMPTY_STATUS = new CombinedStatus(null, null, null, null, null, null, null);
  static fromJsonObject(jsonObject) {
    return new CombinedStatus(
      jsonObject.slack.emoji, 
      jsonObject.slack.text, 
      jsonObject.slack.times, 
      jsonObject.slack.statusStartTime,
      jsonObject.homeAssistant.washerText,
      jsonObject.homeAssistant.dryerText,
      jsonObject.homeAssistant.temperatureText);
  }

  #TIMES_TEMPLATES = {
    START: 'Started @ (START)',
    START_TO_END: '(START) - (STATUS_EXPIRATION)'
  }
  

  slack = {};
  homeAssistant = {};

  
  // doesn't like fat arrow syntax here, has issues being passed into worker thread - dunno why
  toString() { 
    return `Slack:${this.slack.emoji}/${this.slack.text}/${this.slack.times} ; HA:${this.homeAssistant.washerText}/${this.homeAssistant.dryerText}/${this.homeAssistant.temperatureText}`;
  }


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
    //logger.debug('&&&&& combined-status updateStatus()');
    //console.log(matchingCondition);
    
    let newCombinedStatus = new CombinedStatus(
      matchingCondition?.display_emoji,
      (matchingCondition.display_text)
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
    newCombinedStatus.updateSlackStatusTimes(matchingCondition, homeSlackStatus, workSlackStatus, this);

    //logger.debug('%%%%% CombinedStatus.updateStatus() RETURNING');
    //console.log(newCombinedStatus);

    return newCombinedStatus;
  }


  /**
   * Determine the times of the Slack status and update that in newStatus
   */
  *updateSlackStatusTimes(evaluatingStatus, homeSlackStatus, workSlackStatus, oldCombinedStatus) {
    // The start time only changes when the status text changes, so that if I
    // add minutes to my focus time, only the end time changes. We're adding it
    // to latestStatus so that we can use it the next time we check the status.
    this.slack.statusStartTime = oldCombinedStatus.slack.text !== this.slack.text
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
    this.slack.times = 
      statusTimesTemplate
        .replace('(START)', this.slack.statusStartTime)
        .replace('(STATUS_EXPIRATION)', statusExpiration);
  };
}
    
    
module.exports = CombinedStatus;