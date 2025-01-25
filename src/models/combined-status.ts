import { DateTime } from "luxon";
//import logger from '../services/logger';
import { HomeAssistantStatus } from './home-assistant-status';
import { SlackStatus } from './slack-status';
import { StatusCondition } from './status-condition';


// TODO- fix naming !!
interface slackStuff {
  emoji: string,
  text: string,
  times: string,
  statusStartTime: string
}

interface homeAssistantStuff {          
  washerText: string,
  dryerText: string,
  temperatureText: string
}


/**
 * Combined Status
 * 
 * Has all Slack and Home Assistant statuses
 * 
 * 
 * This class is passed between StatusController and status-worker. Apparently JS doesn't like fns
 * in this class to use "fat arrow" syntax, or JS can't clone objects of this class for that purpose.
 * So all fns must be defined using "standard" (TODO- what is proper term here?) syntax.
 * 
 */
export class CombinedStatus {
  public static readonly EMPTY_STATUS = new CombinedStatus('', '', '', '', '', '', '');
  public static readonly ERROR_STATUS = new CombinedStatus('ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR');

  private readonly TIMES_TEMPLATES = {
    START: 'Started @ (START)',
    START_TO_END: '(START) - (STATUS_EXPIRATION)'
  }
  

  public slack: slackStuff;
  public homeAssistant: homeAssistantStuff;

  
  public toString(): string { 
    return `Slack:${this.slack.emoji}/${this.slack.text}/${this.slack.times} ; HA:${this.homeAssistant.washerText}/${this.homeAssistant.dryerText}/${this.homeAssistant.temperatureText}`;
  }


  // Constructors
  constructor(slackEmoji: string, slackText: string, slackTimes: string, slackStatusStartTime: string, homeAssistantWasherText: string, homeAssistantDryerText: string, homeAssistantTemperatureText: string) {
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


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromJsonObject(jsonObject: any): CombinedStatus {
    return new CombinedStatus(
      jsonObject.slack.emoji, 
      jsonObject.slack.text, 
      jsonObject.slack.times, 
      jsonObject.slack.statusStartTime,
      jsonObject.homeAssistant.washerText,
      jsonObject.homeAssistant.dryerText,
      jsonObject.homeAssistant.temperatureText);
  }


  public updateStatus(matchingCondition: StatusCondition, workSlackStatus: SlackStatus, homeSlackStatus: SlackStatus, homeAssistantStatus: HomeAssistantStatus, matchesHomeEmoji: boolean): CombinedStatus {
    //logger.debug('&&&&& combined-status updateStatus()');
    //console.log(matchingCondition);
    
    const newCombinedStatus = new CombinedStatus(
      matchingCondition.display_emoji_image,
      (matchingCondition.display_text)
        .replace('(WORK_STATUS_TEXT)', workSlackStatus.text)
        .replace('(HOME_STATUS_TEXT)', homeSlackStatus.text),
      '',
      '',
      homeAssistantStatus.washerText,
      homeAssistantStatus.dryerText,
      homeAssistantStatus.temperatureText
    );
    
    // Set the status time (i.e. "Started @ 12:30 PM" or "12:30 PM - 1:00 PM") and
    // status start time
    newCombinedStatus.updateSlackStatusTimes(homeSlackStatus, workSlackStatus, this, matchesHomeEmoji);

    //logger.debug('%%%%% CombinedStatus.updateStatus() RETURNING');
    //console.log(newCombinedStatus);

    return newCombinedStatus;
  }


  /**
   * Determine the times of the Slack status and update that in newStatus
   */
  private updateSlackStatusTimes(homeSlackStatus: SlackStatus, workSlackStatus: SlackStatus, oldCombinedStatus: CombinedStatus, matchesHomeEmoji: boolean) {
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
    const statusExpirationSeconds = homeSlackStatus.emoji && matchesHomeEmoji
        ? homeSlackStatus.expiration 
        : workSlackStatus.expiration;
  
    // Select the appropriate template for displaying the status time (i.e. 
    // "Started @ 12:30 PM" or "12:30 PM - 1:00 PM")
    const statusTimesTemplate = statusExpirationSeconds === 0 
      ? this.TIMES_TEMPLATES.START 
      : this.TIMES_TEMPLATES.START_TO_END;
  
    const statusExpiration = DateTime
      .fromSeconds(statusExpirationSeconds)
      .toLocaleString(DateTime.TIME_SIMPLE);
  
    // Set the times of this status
    this.slack.times = 
      statusTimesTemplate
        .replace('(START)', this.slack.statusStartTime)
        .replace('(STATUS_EXPIRATION)', statusExpiration);
  };
}