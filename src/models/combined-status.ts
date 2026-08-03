import { DateTime } from 'luxon';

import HomeAssistantStatus from './home-assistant-status';
import SlackStatus from './slack-status';
import StatusCondition from './status-condition';


interface StatusData {
  statusImageName: string;
  statusText: string;
  statusTimes: string;
  statusStartTime: string;
}

interface TeamsOverrideData {
  isActive: boolean;
  lastHeartbeatAt: number;
  startedAt: number;
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
  

  public status: StatusData;
  public homeAssistant: HomeAssistantStatus;
  // Teams callback state is an ephemeral display override that can supersede
  // the Slack-derived status while heartbeats are still arriving.
  public teamsOverride: TeamsOverrideData;
  public lastUpdatedDateTime: DateTime;

  
  constructor(
    statusImageName: string = '', 
    statusText: string = '', 
    statusTimes: string = '',
    statusStartTime: string = '',
    homeAssistantWasherText: string = '',
    homeAssistantDryerText: string = '',
    homeAssistantTemperatureText: string = '',
    teamsOverrideIsActive: boolean = false,
    teamsOverrideLastHeartbeatAt: number = 0,
    teamsOverrideStartedAt: number = 0
  ) {
    this.status = {
      statusImageName,
      statusText,
      statusTimes,
      statusStartTime
    };
    this.homeAssistant = new HomeAssistantStatus(
      homeAssistantWasherText,
      homeAssistantDryerText,
      homeAssistantTemperatureText
    );
    this.teamsOverride = {
      isActive: teamsOverrideIsActive,
      lastHeartbeatAt: teamsOverrideLastHeartbeatAt,
      startedAt: teamsOverrideStartedAt
    };
    this.lastUpdatedDateTime = DateTime.now();
  }


  /**
   * Static constructor to create a CombinedStatus object from a JSON object
   * 
   * This is used when passing a CombinedStatus object between the worker 
   * thread and StatusController.
   * 
   * @param jsonObject - The JSON object to convert
   * @returns an equivalent CombinedStatus object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromJsonObject(jsonObject: any): CombinedStatus {
    return new CombinedStatus(
      jsonObject.status.statusImageName,
      jsonObject.status.statusText,
      jsonObject.status.statusTimes,
      jsonObject.status.statusStartTime,
      jsonObject.homeAssistant.washerText,
      jsonObject.homeAssistant.dryerText,
      jsonObject.homeAssistant.temperatureText,
      jsonObject.teamsOverride?.isActive ?? false,
      jsonObject.teamsOverride?.lastHeartbeatAt ?? 0,
      jsonObject.teamsOverride?.startedAt ?? 0);
  }


  /**
   * Convert this model to a pretty string for logging purposes
   * 
   * @returns this model as a string
   */
  public toString(): string { 
    return `Slack:${this.status.statusImageName}/${this.status.statusText}/${this.status.statusTimes} ; HA:${this.homeAssistant.washerText}/${this.homeAssistant.dryerText}/${this.homeAssistant.temperatureText}`;
  }


  public isBlankStatus(): boolean {
    return this.status.statusImageName === '' && this.status.statusText === '';
  }


  /**
   * Is this model equal to another combined status model?
   * 
   * @param otherCombinedStatus - The combined status to compare this model to
   * @returns true if the properties of otherCombinedStatus match the properties of this model
   */
  public equals(otherCombinedStatus: CombinedStatus): boolean {
    return this.status.statusImageName === otherCombinedStatus.status.statusImageName &&
           this.status.statusText === otherCombinedStatus.status.statusText &&
           this.status.statusTimes === otherCombinedStatus.status.statusTimes &&
           this.status.statusStartTime === otherCombinedStatus.status.statusStartTime &&
           this.homeAssistant.washerText === otherCombinedStatus.homeAssistant.washerText &&
           this.homeAssistant.dryerText === otherCombinedStatus.homeAssistant.dryerText &&
           this.homeAssistant.temperatureText === otherCombinedStatus.homeAssistant.temperatureText &&
           this.teamsOverride.isActive === otherCombinedStatus.teamsOverride.isActive &&
           this.teamsOverride.lastHeartbeatAt === otherCombinedStatus.teamsOverride.lastHeartbeatAt &&
           this.teamsOverride.startedAt === otherCombinedStatus.teamsOverride.startedAt;
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
   * Update the Teams meeting heartbeat state and preserve it as part of the
   * displayed status model.
   */
  public updateTeamsOverrideState(inCall: boolean): void {
    if (inCall) {
      if (!this.teamsOverride.isActive) {
        this.teamsOverride.isActive = true;
        if (this.teamsOverride.startedAt === 0) {
          this.teamsOverride.startedAt = Date.now();
        }
      }
      this.teamsOverride.lastHeartbeatAt = Date.now();
      return;
    }

    this.teamsOverride.isActive = false;
    this.teamsOverride.lastHeartbeatAt = 0;
    this.teamsOverride.startedAt = 0;
  }


  /**
   * Refresh the Teams heartbeat override state and clear the override when it
   * expires.
   */
  public refreshTeamsOverrideState(heartbeatTimeoutMs: number): boolean {
    if (!this.teamsOverride.isActive || this.teamsOverride.lastHeartbeatAt === 0) {
      return false;
    }

    const elapsedMs = Date.now() - this.teamsOverride.lastHeartbeatAt;
    if (elapsedMs > heartbeatTimeoutMs) {
      this.updateTeamsOverrideState(false);
      return true;
    }

    return false;
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
      matchingCondition.displayImageName,
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
    this.status.statusStartTime = oldCombinedStatus.status.statusText !== this.status.statusText
      ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
      : oldCombinedStatus.status.statusStartTime;

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
      this.status.statusImageName === '' && this.status.statusText === '' ? this.TIMES_TEMPLATES.EMPTY :
      statusExpirationSeconds === 0 ? this.TIMES_TEMPLATES.START :
      this.TIMES_TEMPLATES.START_TO_END;

    // Format the expiration time
    const statusExpiration = DateTime
      .fromSeconds(statusExpirationSeconds)
      .toLocaleString(DateTime.TIME_SIMPLE);
  
    // Set the times of this status by replacing tokens with the appropriate values
    this.status.statusTimes = 
      statusTimesTemplate
        .replace('(START)', this.status.statusStartTime)
        .replace('(STATUS_EXPIRATION)', statusExpiration);
  }
}