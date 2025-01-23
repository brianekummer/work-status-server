const { DateTime } = require('luxon');
const slackService = new (require('../services/slack-service'));
const homeAssistantService = new (require('../services/home-assistant-service'));
const logger = require('../services/logger');

const CLIENT_REFRESH_MS = (process.env.CLIENT_REFRESH_SECONDS || 30) * 1000;


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


  /**
   * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   *
   * Returns the status as a JSON object
   */
  getStatusForClient = () => {
    let currentStatus = this.app.locals.currentStatus;

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


  /**
   * Get the latest status and push it to the client
   */
  getLatestStatusAndPush = (request, response) => {
    try {
      let pageName = request.get('Referrer').split("/").pop();
      logger.debug(`Pushing data to ${pageName}`);
      
      response.write(`data: ${JSON.stringify(this.getStatusForClient())}\n\n`);
    } catch (ex) {
      logger.error(`StatusController.getLatestStatusAndPush(), ERROR: ${ex}`);
    }
  };


  /**
   * Use Server Sent Events to continually push updates to the browser every
   * CLIENT_REFRESH_MS.
   *
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   */
  getStatusUpdates = (request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Immediately push the status to the client, then repeatedly do that every
    // CLIENT_REFRESH_MS.
    this.getLatestStatusAndPush(request, response);
    let intervalId = setInterval(() => this.getLatestStatusAndPush(request, response), CLIENT_REFRESH_MS); 

    request.on('close', () => {
      clearInterval(intervalId);
      logger.info('StatusController.getStatusUpdates(), closed connection');
    });
  }
}

module.exports = StatusController;