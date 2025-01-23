const { DateTime } = require('luxon');
const slackService = new (require('../services/slack-service'));
const homeAssistantService = new (require('../services/home-assistant-service'));


/**
 * Status Controller
 * 
 * Used to build the status that will be send to the clients
 */
class StatusController {

  /**
   * Constructor
   * 
   * Because this needs the global variable app.locals.currentStatus, the app
   * object is being passed into this constructor so it is available.
   */
  constructor(app) {
    this.app = app;
  }


  // The default, empty status
  EMPTY_STATUS = {
    slack: slackService.EMPTY_STATUS,
    homeAssistant: homeAssistantService.EMPTY_STATUS
  };


  // TODO- I think this controller should be removed, and then I can eliminate the 
  //       global variable. EXCEPT in routes where I push the status in the get /api//status-updates,
  //       where I need the global var


  /**
   * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   *
   * Returns the status as a JSON object
   */
  getStatusForClient = (currentStatus) => {
    //let currentStatus = this.app.locals.currentStatus;

    if (currentStatus) {
      return {
        emoji: currentStatus.slack.emoji ? `/images/${currentStatus.slack.emoji}.png` : '',
        text: currentStatus.slack.text,
        times: currentStatus.slack.times,
        lastUpdatedTime: DateTime.now().toLocaleString(DateTime.TIME_SIMPLE),
        homeAssistant: {
          washerText: currentStatus.homeAssistant.washerText,
          dryerText: currentStatus.homeAssistant.dryerText,
          temperatureText: currentStatus.homeAssistant.temperatureText
        }
      };
    };
  };
}


module.exports = StatusController;