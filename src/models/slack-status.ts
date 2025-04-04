/**
 * Slack Status
 * 
 * Defines my status from Slack
 */


enum EMOJI {
  CALL = ':slack_call:',
  PTO = ':palm_tree:'
}


export default class SlackStatus {
  public static readonly EMPTY_STATUS = new SlackStatus();
  public static readonly ERROR_STATUS = new SlackStatus('ERROR', 'ERROR', 0, 'ERROR');

  
  constructor(
    public readonly emoji: string = '', 
    public readonly text: string = '', 
    public readonly expiration: number = 0, 
    public readonly presence: string = '') {}


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromApi(slackApiProfileResponse: any, slackApiPresenceResponse: any): SlackStatus {
    // Slack huddles don't set an emoji, they only set the "huddle_state" property.
    // For my purposes, while in a huddle, changing the emoji to be the same as the emoji
    // for a Slack call is fine.
    return new SlackStatus(
      slackApiProfileResponse.profile.huddle_state === 'in_a_huddle' 
                  ? EMOJI.CALL
                  : slackApiProfileResponse.profile.status_emoji, 
      slackApiProfileResponse.profile.status_text,
      slackApiProfileResponse.profile.status_expiration || 0,
      slackApiPresenceResponse.presence
    );
  }


  public toString(): string {
    return `${this.emoji}/${this.text}/${this.expiration}/${this.presence}`;
  }
}