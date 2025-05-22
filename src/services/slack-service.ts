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


  private getHeaders(account: ACCOUNTS) {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${this.SLACK_TOKENS[account]}`  
    };
  }


  private async fetchWithRetry(url: string, options: RequestInit, logLabel: string): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (firstError: any) {
      Logger.debug(`${logLabel} failed because ${firstError.name}: ${firstError.message}, retrying`);
      try {
        return await fetch(url, options);
      } catch (secondError: any) {
        throw new Error(`${logLabel} failed after retry because ${secondError.name}: ${secondError.message}`);
      }
    }
  }


  /**
   * Get Slack status for a given account, which includes status and presence
   *
   * If there is no security token, then an an object with empty values is returned
   *
   * @returns a SlackStatus object with the Slack status
   */
  public async getSlackStatus(account: ACCOUNTS): Promise<SlackStatus> {
    if (!this.SLACK_TOKENS[account]) {
      // Do not have a token for this Slack account, so return an empty status
      return SlackStatus.EMPTY_STATUS;
    }

    const accountName = account === SlackService.ACCOUNTS.WORK ? 'WORK' : 'HOME';
    const headers = this.getHeaders(account);
    const requestOptions = { method: 'GET', headers };

    try {
      const [profileResponse, presenceResponse] = await Promise.all([
        this.fetchWithRetry('https://slack.com/api/users.profile.get', requestOptions, `${accountName} profile fetch`),
        this.fetchWithRetry('https://slack.com/api/users.getPresence', requestOptions, `${accountName} presence fetch`)
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


  public setSlackStatus(account: ACCOUNTS, slackStatus: SlackStatus) {
    // This does not set the presence, only the status, since I have no need for that right now
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