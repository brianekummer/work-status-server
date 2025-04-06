import { parentPort, workerData } from 'worker_threads';
import { DateTime } from 'luxon';

import CombinedStatus from '../models/combined-status';
import Logger from '../services/logger';
import SlackStatus from '../models/slack-status';
import SlackService from '../services/slack-service';
import StatusCondition from '../models/status-condition';
import StatusConditionService from '../services/status-condition-service';




/**
 * Status worker thread
 *
 * This module is responsible for
 *   - Collecting up-to-date status information from my Slack accounts
 *   - Determining the new status
 *   - Returning it back to the caller
 * 
 * This worker thread runs in a separate process than the main thread, so all
 * of the services are new instances.
 */
const OUT_OF_OFFICE_STATUS_REGEX = new RegExp(process.env.OUT_OF_OFFICE_STATUS_REGEX || 'Out of Office.*Outlook Calendar');  // Reasonable default
const OUT_OF_OFFICE_MIN_HOURS = process.env.OUT_OF_OFFICE_MIN_HOURS || 9999; // Defaults to over a year, so is essentially disabled unless user intentionally enables it

const slackService = new SlackService();
const statusConditionService = new StatusConditionService(workerData.statusConditionsFilename);


/**
 * The main thread sent the current combined status and is requesting
 * the new combined status be calculated and sent back
 *
 * @param oldCombinedStatus - The current/old combined status, which is
 *                            received as a simple JSON object, not a
 *                            JavaScript class, so we must convert it so
 *                            we can later use its methods
 */
parentPort!.on('message', (oldCombinedStatus: CombinedStatus) => {
  oldCombinedStatus = CombinedStatus.fromJsonObject(oldCombinedStatus);

  getLatestStatus(oldCombinedStatus)
  .then((newCombinedStatus: CombinedStatus) => 
    parentPort!.postMessage(newCombinedStatus));
});


/**
 * Check if the Slack status is from the Out of Office app in Slack, and the user's Slack status
 * should be changed to "PTO".
 * 
 * @param workSlackStatus - The Slack status for the work account
 * @param statusStartTime - The time the status started, in the format 'h:mm a'
 * @param minimumPtoDurationHours - The minimum duration in hours to be considered PTO
 * @returns true if the status is Out of Office for PTO, false otherwise
 */
function isStatusOutOfOfficeForPto(workSlackStatus: SlackStatus, statusStartTime: string, minimumPtoDurationHours: number): boolean {
  const startTime = DateTime.fromFormat(statusStartTime, 'h:mm a');
  if (!startTime.isValid) {
    Logger.error(`Invalid time format for slack.statusStartTime: ${statusStartTime}`);
    return false;
  } else {
    const durationInHours = DateTime.fromSeconds(workSlackStatus.expiration).diff(startTime, 'hours').hours;
    return workSlackStatus.emoji === SlackStatus.EMOJI.UNAVAILABLE && OUT_OF_OFFICE_STATUS_REGEX.test(workSlackStatus.text) && durationInHours >= minimumPtoDurationHours;
  }
}


/**
 * Get the latest Slack status
 *
 * @param oldCombinedStatus - The old/current combined status
 * @returns a promise for a CombinedStatus
 */
function getLatestStatus(
  oldCombinedStatus: CombinedStatus
): Promise<CombinedStatus> {
  return Promise.resolve(
    Promise.all([
      slackService.getSlackStatus(SlackService.ACCOUNTS.WORK),
      slackService.getSlackStatus(SlackService.ACCOUNTS.HOME)
    ])
    .then(statuses => {
      // Statuses are returned in the same order they were called in Promises.all() 
      const [ workSlackStatus, homeSlackStatus ] = statuses;
      
      const matchingCondition: StatusCondition|undefined = statusConditionService.getFirstMatchingCondition(workSlackStatus, homeSlackStatus);
      if (matchingCondition) {
        // Update the combined status with the new Slack status
        let updatedCombinedStatus: CombinedStatus = oldCombinedStatus.updateSlackStatus(
          matchingCondition,
          workSlackStatus,
          homeSlackStatus,
          statusConditionService.matchesCondition(matchingCondition.conditionsHomeEmoji, homeSlackStatus.emoji));
  

        // TODO- Document in readme why I'm doing this and this oddity
        //   - One oddity- This sets the Slack status because the Slack Outlook app sets the status. If
        //     you delete the Outlook calendar event that started this while in progress, Outlook 
        //     doesn't change your Slack status back.

        // If this Slack status is from Slack's Outlook app changing me to be Out Of Office for at least x hours,
        // then set my Slack status to PTO.
        //   - It looks nicer to my co-workers on Slack
        //   - My work status phones will display nothing instead of the Outlook status, which is nice
        if (isStatusOutOfOfficeForPto(workSlackStatus, updatedCombinedStatus.slack.statusStartTime, OUT_OF_OFFICE_MIN_HOURS)) {
          Logger.debug(`status-worker.getLatestStatus(), changing Out Of Office status to PTO`);
          slackService.setSlackStatus(
            SlackService.ACCOUNTS.WORK,
            new SlackStatus(SlackStatus.EMOJI.VACATION, 'PTO', workSlackStatus.expiration));
        }
          
        return updatedCombinedStatus;
      } else {
        return oldCombinedStatus;
      }
    })
    .catch(ex => {
      Logger.error(`status-worker.getLatestStatus(), ERROR: ${ex}`);
      return CombinedStatus.ERROR_STATUS;
    })
  );
};