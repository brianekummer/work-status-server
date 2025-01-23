const logger = require('./logger');
const SlackStatus = require('../models/slack-status');

/**
 * Slack Service
 * 
 * Gets the status of a Slack account
 */
class SlackService {
  // Public constants and variables
  ACCOUNTS = {
    WORK: 0,
    HOME: 1
  };

  // Private constants and variables

  // Get the Slack security tokens
  #SLACK_TOKENS = [process.env.SLACK_TOKEN_WORK, process.env.SLACK_TOKEN_HOME || ''];
  #SLACK_CALL_STATUS_EMOJI = ':slack_call:';


  /**
   * Get my Slack status for the given account, which includes my status and 
   * presence
   *   - If there is no security token, then just return an object with empty values
   *
   * Returns a JSON object with my Slack status
   */
  getSlackStatus = (account) => {
    if (this.#SLACK_TOKENS[account]) {
      const accountName = account === this.ACCOUNTS.WORK ? 'WORK' : 'HOME';
      let headers = {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${this.#SLACK_TOKENS[account]}`  
      };

      return Promise.all([
        fetch('https://slack.com/api/users.profile.get', { method: 'GET', headers: headers }),
        fetch('https://slack.com/api/users.getPresence', { method: 'GET', headers: headers })
      ])
      .then(responses => Promise.all(responses.map(response => response.json())))
      .then(jsonResponses => {
        let slackStatus = SlackStatus.fromApi(jsonResponses[0], jsonResponses[1]);
        logger.debug(`Got SLACK for ${accountName}: ${slackStatus.toString()}`);

        return Promise.resolve(slackStatus);
      })
      .catch(ex => {
        logger.error(`SlackService.getSlackStatus(), ERROR for ${accountName}: ${ex}`);
        return Promise.resolve(SlackStatus.ERROR_STATUS);
      });
    } else {
      // We do not have a token for this Slack account, so return an empty status
      return Promise.resolve(SlackStatus.EMPTY_STATUS);
    }
  };
}


module.exports = SlackService;