const statusConditionService = new (require('../services/status-condition-service'));


/**
 * Combined Status
 * 
 * Has all Slack and Home Assistant statuses
 */
class CombinedStatus {
  // TODO- improve this??
  static EMPTY_STATUS = {
    slack: {
      emoji: null,
      text: null,
      times: null,
      statusStartTime: null
    },
    homeAssistant: {          
      washerText: null,
      dryerText: null,
      temperatureText: null
    }
  };

  #TIMES_TEMPLATES = {
    START: 'Started @ (START)',
    START_TO_END: '(START) - (STATUS_EXPIRATION)'
  }
  

  
  // TODO- Having fns in my models causes issues passing status into worker.postMessage
  //toStringDebug = () => `${this.washerText}/${this.dryerText}/${this.temperatureText}`;



  constructor(oldCombinedStatus, matchingCondition, workSlackStatus, homeSlackStatus, homeAssistantStatus) {
    console.log('&&&&& combined-status constructor()');
    
    let newCombinedStatus = {
      slack: {
        emoji: matchingCondition.display_emoji,
        text: (matchingCondition.display_text || '')
                .replace('(WORK_STATUS_TEXT)', workSlackStatus.text)
                .replace('(HOME_STATUS_TEXT)', homeSlackStatus.text),
        times: null,
        statusStartTime: null
      },
      homeAssistant: {          
        washerText: homeAssistantStatus.washerText,
        dryerText: homeAssistantStatus.dryerText,
        temperatureText: homeAssistantStatus.temperatureText
      }
    };
    
    // Set the status time (i.e. "Started @ 12:30 PM" or "12:30 PM - 1:00 PM") and
    // status start time
    this.updateSlackStatusTimes(matchingCondition, homeSlackStatus, workSlackStatus, oldCombinedStatus, newCombinedStatus);

    console.log('@@@@@ returning');
    console.log(newCombinedStatus);

    return newCombinedStatus;
  }


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