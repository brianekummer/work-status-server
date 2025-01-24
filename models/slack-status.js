/**
 * Slack Status
 * 
 * 
 */
class SlackStatus {
  // Static variables and functions
  static EMPTY_STATUS = new SlackStatus(null, null, 0, null);
  static ERROR_STATUS = new SlackStatus('ERROR', 'ERROR', 0, 'ERROR');
  static fromApi(slackApiProfileResponse, slackApiPresenceResponse) {
    // Slack huddles don't set an emoji, they only set 'huddle_state' property. For
    // my purposes, changing the emoji to the same as a Slack call is fine.
    let emoji = slackApiProfileResponse.profile.huddle_state === 'in_a_huddle' 
                  ? this.#SLACK_CALL_STATUS_EMOJI 
                  : slackApiProfileResponse.profile.status_emoji;

    return new SlackStatus(
      emoji, 
      slackApiProfileResponse.profile.status_text,
      slackApiProfileResponse.profile.status_expiration || 0,
      slackApiPresenceResponse.presence
    );
  }

  
  // Public variables/properties
  emoji = '';
  text = '';
  expiration = 0;
  presence = '';


  // Private variables
  #SLACK_CALL_STATUS_EMOJI = ':slack_call:';


  constructor(emoji, text, expiration, presence) {
    this.emoji = emoji;
    this.text = text;
    this.expiration = expiration;
    this.presence = presence;
  }


  // TODO- Having fns in my models causes issues passing status into worker.postMessage
  toString() {
    return `${this.emoji}/${this.text}/${this.expiration}/${this.presence}`;
  }
}


module.exports = SlackStatus;