import { parentPort } from 'worker_threads';


/**
 * Status Worker
 *
 * This is a worker thread for collecting up-to-date status information and 
 * returning it back to the caller.
 * 
 * Reminder that this runs in a separate process and that all of the services
 * are new instances, separate from those of the main thread.
 */
import logger from '../services/logger';
import { CombinedStatus } from '../models/combined-status';


import { SlackService } from '../services/slack-service';
import { HomeAssistantService } from '../services/home-assistant-service';
import { StatusConditionService } from '../services/status-condition-service';



// TODO- direct injection?
const slackService = new SlackService();
const homeAssistantService = new HomeAssistantService();
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
  .then((newCombinedStatus: CombinedStatus) => {
    // Only send the new status back if there has been a change
    
    // TODO- this status does NOT include lastUpdatedTime, so it will
    //       ONLY return an update when the Slack or HA status changes.
    //       If I want it to update every minute, ONE SOLUTION is to add last updated
    //       time into this status
    if (JSON.stringify(oldCombinedStatus) !== JSON.stringify(newCombinedStatus)) {
      // TODO- commenting this out lets me see useful error messages when oldCombinedStatus.slack or newCombinedStatus.slack is null/undefined
      logger.info( 
        `status-worker.on.message(), changed status\n` +
        `   FROM ${oldCombinedStatus.toString()}\n` +
        `     TO ${newCombinedStatus.toString()}`);

      //logger.debug(';;;;; status-worker.postMessage SENDING');
      //console.log(newCombinedStatus);

      parentPort!.postMessage(newCombinedStatus);
    }
  });
});


/**
 * Get the latest status
 *
 * It gets my Slack status for my work and home accounts, as well as statuses of
 * things in Home Assistant. Then it builds the latest status to display.
 */
function getLatestStatus(oldCombinedStatus: CombinedStatus) {
  return Promise.resolve(
    Promise.all([
      slackService.getSlackStatus(slackService.ACCOUNTS.WORK),
      slackService.getSlackStatus(slackService.ACCOUNTS.HOME),
      homeAssistantService.getHomeAssistantStatus()
    ])
    .then(statuses => {
      // Statuses are returned in the same order they were called in Promises.all() 
      let [ workSlackStatus, homeSlackStatus, homeAssistantStatus ] = statuses;

      //logger.debug(`[[[[[`);
      //console.log(workSlackStatus);
      //console.log(homeSlackStatus);
      let matchingCondition = statusConditionService.getMatchingCondition(workSlackStatus, homeSlackStatus);
      return matchingCondition 
        ? oldCombinedStatus.updateStatus(matchingCondition, workSlackStatus, homeSlackStatus, homeAssistantStatus, statusConditionService.matchesCondition(matchingCondition.conditions_home_emoji, homeSlackStatus.emoji))
        : oldCombinedStatus;
    })
    .catch(ex => {
      logger.error(`status-worker.getLatestStatus(), ERROR: ${ex}`);
      return CombinedStatus.ERROR_STATUS;
    })
  );
};



//export {}