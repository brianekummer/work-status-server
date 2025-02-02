import { DateTime } from "luxon";

import HomeAssistantStatus from './home-assistant-status';
import SlackStatus from './slack-status';
import StatusCondition from './status-condition';


interface SlackStatusData {
  emoji: string;
  text: string;
  times: string;
  statusStartTime: string;
}


/**
 * Combined Status model, is a combination of status from Slack and Home
 * Assistant
 * 
 * This class is passed between status-controller and status-worker, and 
 * apparently JavaScript doesn't like functions in this class to use "arrow"
 * syntax, or else JavaScript can't clone instances of this class. So all
 * functions must be defined using "function" syntax.
 */
export default class CombinedStatus {
  public static readonly EMPTY_STATUS = new CombinedStatus();
  public static readonly ERROR_STATUS = new CombinedStatus('ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR');


  private readonly TIMES_TEMPLATES = {
    EMPTY: '',
    START: 'Started @ (START)',
    START_TO_END: '(START) - (STATUS_EXPIRATION)'
  }
  

  public slack: SlackStatusData;
  public homeAssistant: HomeAssistantStatus;
  public lastUpdatedDateTime: DateTime;

  
  constructor(
    slackEmoji: string = '', 
    slackText: string = '', 
    slackTimes: string = '',
    slackStatusStartTime: string = '',
    homeAssistantWasherText: string = '',
    homeAssistantDryerText: string = '',
    homeAssistantTemperatureText: string = ''
  ) {
    this.slack = {
      emoji: slackEmoji,
      text: slackText,
      times: slackTimes,
      statusStartTime: slackStatusStartTime
    };
    this.homeAssistant = new HomeAssistantStatus(
      homeAssistantWasherText,
      homeAssistantDryerText,
      homeAssistantTemperatureText
    );
    this.lastUpdatedDateTime = DateTime.now();
  }


  /**
   * Static constructor to create a CombinedStatus object from a JSON object
   * 
   * This is used when passing a COmbinedStatus object between the worker 
   * thread and StatusController.
   * 
   * @param jsonObject - The JSON object to convert
   * @returns an equivalent CombinedStatus object
   */
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


  /**
   * Convert this model to a pretty string for logging purposes
   * 
   * @returns this model as a string
   */
  public toString(): string { 
    return `Slack:${this.slack.emoji}/${this.slack.text}/${this.slack.times} ; HA:${this.homeAssistant.washerText}/${this.homeAssistant.dryerText}/${this.homeAssistant.temperatureText}`;
  }


  /**
   * Is this model equal to another combine status?
   * 
   * @param otherCombinedStatus - The combined status to compare this model to
   * @returns true if the properties of otherCombinedStatus match the properties of this model
   */
  public equals(otherCombinedStatus: CombinedStatus): boolean {
    return this.slack.emoji === otherCombinedStatus.slack.emoji &&
           this.slack.text === otherCombinedStatus.slack.text &&
           this.slack.times === otherCombinedStatus.slack.times &&
           this.slack.statusStartTime === otherCombinedStatus.slack.statusStartTime &&
           this.homeAssistant.washerText === otherCombinedStatus.homeAssistant.washerText &&
           this.homeAssistant.dryerText === otherCombinedStatus.homeAssistant.dryerText &&
           this.homeAssistant.temperatureText === otherCombinedStatus.homeAssistant.temperatureText;
  }


  /**
   * Update the Home Assistant status
   * 
   * @param homeAssistantWebhookData - the payload from Home Assistant
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public updateHomeAssistantStatus(webhookData: any) {
    this.homeAssistant = new HomeAssistantStatus(
      webhookData.Washer,
      webhookData.Dryer,
      webhookData.Temperature);
  }


  /**
   * Update the Slack status
   * 
   * @param matchingCondition - The status condition that matched
   * @param workSlackStatus - Status from my work Slack account
   * @param homeSlackStatus - Status from my home Slack account
   * @param matchedHomeEmoji - True if the new combined status match my home emoji
   * @returns a combined status
   */
  public updateSlackStatus(
    matchingCondition: StatusCondition,
    workSlackStatus: SlackStatus,
    homeSlackStatus: SlackStatus,
    matchedHomeEmoji: boolean
  ): CombinedStatus {
    const newCombinedStatus = new CombinedStatus(
      matchingCondition.displayEmojiImage,
      (matchingCondition.displayText)
        .replace('(WORK_STATUS_TEXT)', workSlackStatus.text)
        .replace('(HOME_STATUS_TEXT)', homeSlackStatus.text),
      '', '',    // "times" and "statusStartTime" will be updated shortly
      this.homeAssistant.washerText,
      this.homeAssistant.dryerText,
      this.homeAssistant.temperatureText
    );
    
    // Set the status time (i.e. "Started @ 12:30 PM" or "12:30 PM - 1:00 PM") and
    // status start time
    newCombinedStatus.updateSlackStatusTimes(workSlackStatus, homeSlackStatus, this, matchedHomeEmoji);

    return newCombinedStatus;
  }


  /**
   * Determine the times of the Slack status and updates it in this model
   *
   * @param workSlackStatus - Status from my work Slack account
   * @param homeSlackStatus - Status from my home Slack account
   * @param oldCombinedStatus - The old/current combined status
   * @param matchedHomeEmoji - True if the new combined status match my home emoji
   */
  private updateSlackStatusTimes(
    workSlackStatus: SlackStatus,
    homeSlackStatus: SlackStatus,
    oldCombinedStatus: CombinedStatus,
    matchedHomeEmoji: boolean
  ) {
    // The start time only changes when the status text changes, so that if I
    // add minutes to my meeting, only the end time changes. We're adding it
    // to statusStartTime so we can use it the next time we check the status.
    this.slack.statusStartTime = oldCombinedStatus.slack.text !== this.slack.text
      ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
      : oldCombinedStatus.slack.statusStartTime;

    // Determine the expiration time of the status
    // 
    // If the new status matched the home emoji, then we need to use the home expiration.
    // The home emoji is intentionally being checked (instead of the work emoji)
    // because:
    //   - It's possible that I'd be on PTO for work and that status would have an
    //     expiration in a couple of days, and also be on a non-work meeting with 
    //     an expiration of an hour or so. In this case, the home expiration 
    //     should be used.
    //   - Similarly, I can be on PTO and have a home status with no expiration,
    //     where I want to use the no-expiration of my home status instead of the
    //     expiration of my PTO at work.
    //   - It's highly unlikely that I'd have a home status with an expiration 
    //     while I'm working, where I'd want to use the work status's expiration.
    const statusExpirationSeconds = homeSlackStatus.emoji && matchedHomeEmoji
      ? homeSlackStatus.expiration 
      : workSlackStatus.expiration;
  
    // Select the appropriate template for displaying the status time
    const statusTimesTemplate = 
      this.slack.emoji === '' && this.slack.text === '' ? this.TIMES_TEMPLATES.EMPTY :
      statusExpirationSeconds === 0 ? this.TIMES_TEMPLATES.START :
      this.TIMES_TEMPLATES.START_TO_END;

    // Format the expiration time
    const statusExpiration = DateTime
      .fromSeconds(statusExpirationSeconds)
      .toLocaleString(DateTime.TIME_SIMPLE);
  
    // Set the times of this status by replacing tokens with the appropriate values
    this.slack.times = 
      statusTimesTemplate
        .replace('(START)', this.slack.statusStartTime)
        .replace('(STATUS_EXPIRATION)', statusExpiration);
  }
}