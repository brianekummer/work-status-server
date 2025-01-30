import Logger from './logger';
import SlackStatus from '../models/slack-status';


enum ACCOUNTS {
  WORK = 0,
  HOME = 1
}


/**
 * Slack Service
 * 
 * Gets the status of a single Slack account
 */
export default class SlackService {
  static readonly ACCOUNTS = ACCOUNTS;

  
  private readonly SLACK_TOKENS = [process.env.SLACK_TOKEN_WORK, process.env.SLACK_TOKEN_HOME || ''];


  /**
   * Get Slack status for a given account, which includes status and presence
   *
   * If there is no security token, then an an object with empty values is returned
   *
   * @returns a SlackStatus object with the Slack status
   */
  public getSlackStatus(account: ACCOUNTS): Promise<SlackStatus> {
    if (this.SLACK_TOKENS[account]) {
      const accountName = (account === SlackService.ACCOUNTS.WORK ? 'WORK' : 'HOME');
      const headers = {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${this.SLACK_TOKENS[account]}`  
      };

      return Promise.all([
        fetch('https://slack.com/api/users.profile.get', { method: 'GET', headers: headers }),
        fetch('https://slack.com/api/users.getPresence', { method: 'GET', headers: headers })
      ])
      .then(responses => Promise.all(responses.map(response => response.json())))
      .then(jsonResponses => {
        const slackStatus = SlackStatus.fromApi(jsonResponses[0], jsonResponses[1]);
        Logger.debug(`Got SLACK for ${accountName}: ${slackStatus.toString()}`);

        return Promise.resolve(slackStatus);
      })
      .catch(ex => {
        Logger.error(`SlackService.getSlackStatus(), ERROR for ${accountName}: ${ex}`);
        return Promise.resolve(SlackStatus.ERROR_STATUS);
      });
    } else {
      // Do not have a token for this Slack account, so return an empty status
      return Promise.resolve(SlackStatus.EMPTY_STATUS);
    }
  };
}