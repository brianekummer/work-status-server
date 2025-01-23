const logger = require('./logger');


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
  EMPTY_STATUS = {
    emoji:           null,
    text:            null,
    expiration:      0,
    presence:        null
  };
  ERROR_STATUS = {
    emoji:           'ERROR',
    text:            'ERROR',
    expiration:      0,
    presence:        'ERROR'
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
        // Huddles don't set an emoji, they only set 'huddle_state' property. For
        // my purposes, changing the emoji to the same as a Slack call is fine.
        let emoji = jsonResponses[0].profile.huddle_state === 'in_a_huddle' 
                      ? this.#SLACK_CALL_STATUS_EMOJI 
                      : jsonResponses[0].profile.status_emoji;

        let slackStatus = {
          emoji:           emoji,
          text:            jsonResponses[0].profile.status_text,
          expiration:      jsonResponses[0].profile.status_expiration || 0,
          presence:        jsonResponses[1].presence
        };

        logger.debug(`Got SLACK for ${accountName}: ` +
          `${slackStatus.emoji} / ${slackStatus.text} / ${slackStatus.expiration} / ${slackStatus.presence}`);

        return Promise.resolve(slackStatus);
      })
      .catch(ex => {
        logger.error(`SlackService.getSlackStatus(), ERROR for ${accountName}: ${ex}`);
        return Promise.resolve(this.ERROR_STATUS);
      });
    } else {
      // We do not have a token for this Slack account, so return an empty status
      return Promise.resolve(this.EMPTY_STATUS);
    }
  };
}


module.exports = SlackService;