import { parentPort } from 'worker_threads';
import { StatusCondition } from '../models/status-condition';


/**
 * Status Worker
 *
 * This is a worker thread for collecting up-to-date status information and 
 * returning it back to the caller.
 * 
 */
import logger from '../services/logger';
import { CombinedStatus } from '../models/combined-status';
import { SlackService } from '../services/slack-service';
import { StatusConditionService } from '../services/status-condition-service';



// This worker thread runs in a separate process and that all of the services
// are new instances, separate from those of the main thread.
const slackService = new SlackService();
const statusConditionService = new StatusConditionService();


/**
 * This event is fired when the main thread sends us the current status
 *
 * It is a signal to go get updates and to return the updated status
 */
parentPort!.on('message', (oldCombinedStatus: CombinedStatus) => {
  // The object being received is a simple JSON object, not a JS class, so we must convert it
  // so we can use its methods
  oldCombinedStatus = CombinedStatus.fromJsonObject(oldCombinedStatus);
  //logger.debug('^^^^^ status-worker.on.message() RECEIVED (after conversion)');
  //console.log(oldCombinedStatus);

  getLatestStatus(oldCombinedStatus)
  .then((newCombinedStatus: CombinedStatus) => 
    parentPort!.postMessage(newCombinedStatus));
});


/**
 * Get the latest status
 *
 * It gets my Slack status for my work and home accounts, as well as statuses of
 * things in Home Assistant. Then it builds the latest status to display.
 */
function getLatestStatus(oldCombinedStatus: CombinedStatus): Promise<CombinedStatus> {
  return Promise.resolve(
    Promise.all([
      slackService.getSlackStatus(SlackService.ACCOUNTS.WORK),
      slackService.getSlackStatus(SlackService.ACCOUNTS.HOME)
    ])
    .then(statuses => {
      // Statuses are returned in the same order they were called in Promises.all() 
      //const [ workSlackStatus, homeSlackStatus, homeAssistantStatus ] = statuses;
      const [ workSlackStatus, homeSlackStatus ] = statuses;

      //logger.debug(`[[[[[`);
      //console.log(workSlackStatus);
      //console.log(homeSlackStatus);
      const matchingCondition: StatusCondition|undefined = statusConditionService.getMatchingCondition(workSlackStatus, homeSlackStatus);
      return matchingCondition 
        //? oldCombinedStatus.updateStatus(matchingCondition, workSlackStatus, homeSlackStatus, homeAssistantStatus, statusConditionService.matchesCondition(matchingCondition.conditions_home_emoji, homeSlackStatus.emoji))
        ? oldCombinedStatus.updateSlackStatus(matchingCondition, workSlackStatus, homeSlackStatus, statusConditionService.matchesCondition(matchingCondition.conditions_home_emoji, homeSlackStatus.emoji))
        : oldCombinedStatus;
    })
    .catch(ex => {
      logger.error(`status-worker.getLatestStatus(), ERROR: ${ex}`);
      return CombinedStatus.ERROR_STATUS;
    })
  );
};