/**
 * Slack Status
 * 
 * 
 */
export class SlackStatus {
  // Static variables and functions
  public static readonly EMPTY_STATUS = new SlackStatus('', '', 0, '');
  public static readonly ERROR_STATUS = new SlackStatus('ERROR', 'ERROR', 0, 'ERROR');
  private static readonly SLACK_CALL_STATUS_EMOJI: string = ':slack_call:';

  
  // Public variables/properties
  public emoji: string = '';
  public text: string = '';
  public expiration: number = 0;
  public presence: string = '';


  // Private variables


  // Constructors
  constructor(emoji: string, text: string, expiration: number, presence: string) {
    this.emoji = emoji;
    this.text = text;
    this.expiration = expiration;
    this.presence = presence;
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromApi(slackApiProfileResponse: any, slackApiPresenceResponse: any): SlackStatus {
    // Slack huddles don't set an emoji, they only set 'huddle_state' property. For
    // my purposes, changing the emoji to the same as a Slack call is fine.
    const emoji: string = slackApiProfileResponse.profile.huddle_state === 'in_a_huddle' 
                  ? this.SLACK_CALL_STATUS_EMOJI
                  : slackApiProfileResponse.profile.status_emoji;

    return new SlackStatus(
      emoji, 
      slackApiProfileResponse.profile.status_text,
      slackApiProfileResponse.profile.status_expiration || 0,
      slackApiPresenceResponse.presence
    );
  }


  public toString(): string {
    return `${this.emoji}/${this.text}/${this.expiration}/${this.presence}`;
  }
}