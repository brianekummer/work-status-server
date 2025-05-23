import Logger from './logger';
import SlackStatus from '../models/slack-status';
import Utilities from '../utilities/utilities';


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
   * Get the headers for the specified Slack account
   * 
   * @param account - The Slack account
   * @returns an object with the headers for the specified Slack account
   */
  private getHeaders(account: ACCOUNTS) {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${this.SLACK_TOKENS[account]}`  
    };
  }


  /**
   * Get Slack status for a given account, which includes status and presence
   *
   * @param account - The Slack account to get
   *
   * @returns a SlackStatus object with the Slack status. If there is no security token, 
   * then an an object with empty values is returned.
   */
  public async getSlackStatus(account: ACCOUNTS): Promise<SlackStatus> {
    if (!this.SLACK_TOKENS[account]) {
      // We do not have a token for this Slack account, so return an empty status
      return SlackStatus.EMPTY_STATUS;
    }

    const accountName = account === SlackService.ACCOUNTS.WORK ? 'WORK' : 'HOME';
    const headers = this.getHeaders(account);
    const requestOptions = { method: 'GET', headers };

    try {
      const [profileResponse, presenceResponse] = await Promise.all([
        Utilities.fetchWithRetry('https://slack.com/api/users.profile.get', requestOptions, `${accountName} profile fetch`),
        Utilities.fetchWithRetry('https://slack.com/api/users.getPresence', requestOptions, `${accountName} presence fetch`)
      ]);

      if (!profileResponse.ok || !presenceResponse.ok) {
        Logger.error(`SlackService.getSlackStatus(), API error for ${accountName}: 
          Profile status: ${profileResponse.status} ${profileResponse.statusText}, 
          Presence status: ${presenceResponse.status} ${presenceResponse.statusText}`);
        return SlackStatus.ERROR_STATUS;
      }

      const profileJson = await profileResponse.json();
      const presenceJson = await presenceResponse.json();

      const slackStatus = SlackStatus.fromApi(profileJson, presenceJson);
      Logger.debug(`Got SLACK for ${accountName}: ${slackStatus.toString()}`);
      return slackStatus;

    } catch (err: any) {
      Logger.error(`SlackService.getSlackStatus(), FINAL ERROR for ${accountName}: ${err.message}`);
      return SlackStatus.ERROR_STATUS;
    }
  }

  
  /**
   * Set the Slack status for a single account. This does not set the presence, only the status,
   * since that's all I need right now.
   * 
   * @param account - The Slack account to set
   * @param slackStatus - The Slack status
   */
  public setSlackStatus(account: ACCOUNTS, slackStatus: SlackStatus) {
    fetch('https://slack.com/api/users.profile.set', {
      method: 'POST',
      headers: this.getHeaders(account),
      body: `profile={'status_text': '${slackStatus.text}', 'status_emoji': '${slackStatus.emoji}', 'status_expiration': ${slackStatus.expiration}}`
    })
    .then(function(result) {
      const resultString = JSON.stringify(result);
      if (result.statusText == "OK") {
        Logger.debug(`Successfully changed my Slack status to ${slackStatus.emoji} ${slackStatus.text} (expires ${slackStatus.expiration})`);
      } else {
        Logger.error(`SlackService/setSlackStatus(), Error changing my Slack status to ${slackStatus.emoji} ${slackStatus.text} (expires ${slackStatus.expiration}), and this error occurred:\n${resultString}`);
      }
    })
  }
}