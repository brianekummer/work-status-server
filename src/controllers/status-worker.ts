import { parentPort, workerData } from 'worker_threads';

import CombinedStatus from '../models/combined-status';
import Logger from '../services/logger';
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
        return oldCombinedStatus.updateSlackStatus(
          matchingCondition,
          workSlackStatus,
          homeSlackStatus,
          statusConditionService.matchesCondition(matchingCondition.conditionsHomeEmoji, homeSlackStatus.emoji));
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