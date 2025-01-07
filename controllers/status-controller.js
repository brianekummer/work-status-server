const { DateTime } = require('luxon');
let slackService = new (require('../services/slack-service'));
let homeAssistantService = new (require('../services/home-assistant-service'));


class StatusController {
  // TODO- explain why I need app object here, so I can get currentStatus from app global variables
  constructor(app) {
    this.app = app;
  }


  EMPTY_STATUS = {
    slack: slackService.EMPTY_SLACK_STATUS,
    homeAssistant: homeAssistantService.EMPTY_HOME_ASSISTANT_STATUS
  };


  /******************************************************************************
    Get status to send to the client, making any necessary changes, such as
    converting an emoji to an actual filename.

    I am intentionally not sending a timestamp in the payload because that'd 
    cause every payload to be unique and wreck the etag caching. So instead, the
    client will get the time from the response header.

    Returns the status as a JSON object
  ******************************************************************************/
  getStatusForClient = () => {
    // Get current status from global variable
    let currentStatus = this.app.locals.currentStatus;

    if (currentStatus) {
      let status = {
        emoji: slackService.buildEmojiUrl(currentStatus.slack.emoji),
        text: currentStatus.slack.text,
        times: currentStatus.slack.times,
        lastUpdatedTime: DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
      };
      // TODO- do not return HA data if is wall
      status.homeAssistant = {
        washerText: currentStatus.homeAssistant.washerText,
        dryerText: currentStatus.homeAssistant.dryerText,
        temperatureText: currentStatus.homeAssistant.temperatureText
      };
      if (!status.homeAssistant.washerIcon) {
        status.homeAssistant.washerIcon = homeAssistantService.buildHomeAssistantUrl('/local/icon/mdi-washing-machine-light.png');
        status.homeAssistant.dryerIcon = homeAssistantService.buildHomeAssistantUrl('/local/icon/mdi-tumble-dryer-light.png');        dryerText: currentStatus.homeAssistant.dryerText,
        status.homeAssistant.temperatureIcon = homeAssistantService.buildHomeAssistantUrl('/local/icon/thermometer.png');
      }

      return status;
    };
  };
}


module.exports = StatusController;