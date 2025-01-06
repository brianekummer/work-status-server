const logService = require("../services/log-service");


// TODO- try to make this a class again


// Empty status objects
const EMPTY_SLACK_STATUS = {
  emoji:      null,
  text:       null,
  expiration: 0,
  presence:   null
};

const ACCOUNTS = {
  WORK: 0,
  HOME: 1
};

// Get my Slack security tokens, assumes "work_token,home_token", and if there is only one Slack token, set the home token to blank
const SLACK_TOKENS = 
  (process.env.SLACK_TOKENS.includes(",") ? process.env.SLACK_TOKENS : `${process.env.SLACK_TOKENS},`)
  .split(",");


// 
const SLACK_CALL_STATUS_EMOJI = ":slack_call:";


const buildEmojiUrl = (emoji) => {
  return emoji ? `/images/${emoji}.png` : "";
};



/******************************************************************************
  Get my Slack status for the given account, which includes my status and 
  presence
  
  If there is no security token, then just return nulls

  Returns a JSON object with my Slack status
******************************************************************************/
const getSlackStatus = (accountKey) => {
  if (!SLACK_TOKENS[accountKey]) {
    // We do not have a token for this Slack account, so return an empty object
    return Promise.resolve(EMPTY_SLACK_STATUS);
  } else {
    let headers = {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Bearer ${SLACK_TOKENS[accountKey]}`  
    };
    return Promise.all([
      fetch("https://slack.com/api/users.profile.get", { method: "GET", headers: headers }),
      fetch("https://slack.com/api/users.getPresence", { method: "GET", headers: headers })
    ])
    .then(responses => Promise.all(responses.map(response => response.json())))
    .then(jsonResponses => {
      let slackStatus = {
        // Huddles don't set an emoji, they only set "huddle_state" property. For
        // my purposes, changing the emoji to the same as a Slack call is fine.
        emoji:      jsonResponses[0].profile.huddle_state === "in_a_huddle" 
                      ? SLACK_CALL_STATUS_EMOJI 
                      : jsonResponses[0].profile.status_emoji,
        text:       jsonResponses[0].profile.status_text,
        expiration: jsonResponses[0].profile.status_expiration || 0,
        presence:   jsonResponses[1].presence
      };

      logService.log(logService.LOG_LEVELS.DEBUG, `Got SLACK for ${accountKey === ACCOUNTS.WORK ? "WORK" : "HOME"}: ` +
        `${slackStatus.emoji} / ${slackStatus.text} / ${slackStatus.expiration} / ${slackStatus.presence}`);

      return Promise.resolve(slackStatus);
    })
    .catch(ex => {
      logService.log(logService.LOG_LEVELS.ERROR, `ERROR in getSlackStatus: ${ex}`);
    });
  }
};






module.exports = {
  EMPTY_SLACK_STATUS,
  ACCOUNTS,
  buildEmojiUrl,
  getSlackStatus
}
