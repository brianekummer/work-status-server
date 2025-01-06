const slackService = new (require("../services/slack-service"));


class StatusController {
  constructor(app) {
    this.app = app;
  }



  /******************************************************************************
    Get status to send to the client, making any necessary changes, such as
    converting an emoji to an actual filename.

    I am intentionally not sending a timestamp in the payload because that'd 
    cause every payload to be unique and wreck the etag caching. So instead, the
    client will get the time from the response header.

    Returns the status as a JSON object
  ******************************************************************************/
  getStatusForClient = () => {
    // TEMP CODE
    let currentStatus = this.app.locals.currentStatus;
    console.log(`StatusController.getStatusForClient(), currentStatus=${currentStatus}`);
    // END OF TEMP CODE

    let status = {
      emoji: slackService.buildEmojiUrl(currentStatus.slack.emoji),
      text: currentStatus.slack.text,
      times: currentStatus.slack.times
    };
    // TODO- do not return HA data if is wall
    status.homeAssistant = {
      washerText: currentStatus.homeAssistant.washerText,
      dryerText: currentStatus.homeAssistant.dryerText,
      temperatureText: currentStatus.homeAssistant.temperatureText
    };

    return status;
  };
}


module.exports = StatusController;