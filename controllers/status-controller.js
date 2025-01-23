const { DateTime } = require('luxon');
const logger = require('../services/logger');
const SlackStatus = require('../models/slack-status');
const homeAssistantService = new (require('../services/home-assistant-service'));

const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;


/**
 * Status Controller
 * 
 * Used to build the status that will be send to the clients
 */
class StatusController {
  // The default, empty status
  EMPTY_STATUS = {
    slack: SlackStatus.EMPTY_STATUS,
    homeAssistant: homeAssistantService.EMPTY_STATUS
  };

  // TODO- should I add models for SlackStatus, HomeAssistantStatus, CombinedStatus (currentStatus), and the output of getStatusForClient (StatusToClient)?

  // This variable is needed because it contains Slack.statusStartTime which this code adds to keep track of when the status started
  // It does not come from Slack, and when we set the status, we need the current value
  currentStatus = null;


  clients = new Set();
  worker = null;


  /**
   * Constructor
   */
  constructor(worker) {
    // Immediately send the currentStatus to the worker thread, which will check
    // for updates, and then send the updated status back in a message. Then
    // repeatedly do that every SERVER_REFRESH_MS.
    this.worker = worker;
    this.worker.on('message', (updatedStatus) => {
      this.currentStatus = updatedStatus;
  
      this.sendUpdateToClients(updatedStatus);
    });
  
    this.currentStatus = this.EMPTY_STATUS;

    this.worker.postMessage(this.currentStatus);
    setInterval(() => this.worker.postMessage(this.currentStatus), SERVER_REFRESH_MS); 
  }


  /*
  * 
  * Use Server Sent Events to continually push updates to the browser every
  * CLIENT_REFRESH_MS.
  *
  */
  getStatusUpdates = async (request, response) => {
    // Add the client to our list of clients that need updates
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    this.clients.add(response);
  
    // Push initial data to this client
    this.pushStatusToClient(response, true, this.currentStatus);

    // Remove the client from our list when it closes the connection
    request.on('close', () => {
      this.clients.delete(response);
    });
  }


  /**
   * 
   * @param {*} updatedStatus 
   */
  sendUpdateToClients = (updatedStatus) => {
    this.clients.forEach(client => {
      this.pushStatusToClient(client, false, updatedStatus);
    });
  }


  /**
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   */
  pushStatusToClient = (client, initialPush, status) => {
    logger.debug(`Pushing ${initialPush ? 'initial data' : 'data'} to ${client.req.get('Referrer')}`);
    client.write(`data: ${JSON.stringify(this.getStatusForClient(status))}\n\n`);
  }


  /**
   * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   *
   * Returns the status as a JSON object
   */
  getStatusForClient = (currentStatus) => {
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