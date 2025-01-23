const { DateTime } = require('luxon');
//const logger = require('../services/logger');
const CombinedStatus = require('../models/combined-status');

const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;


/**
 * Status Controller
 * 
 * Used to build the status that will be send to the clients
 */
class StatusController {
  // The default, empty status

  // TODO- should I add models for SlackStatus, HomeAssistantStatus, CombinedStatus (currentStatus), and the output of getStatusForClient (StatusToClient)?

  // This variable is needed because it contains Slack.statusStartTime which this code adds to keep track of when the status started
  // It does not come from Slack, and when we set the status, we need the current value
  combinedStatus = CombinedStatus.EMPTY_STATUS;


  clients = new Set();
  worker = null;


  /**
   * Constructor
   */
  constructor(worker, logger) {
    // Immediately send the currentStatus to the worker thread, which will check
    // for updates, and then send the updated status back in a message. Then
    // repeatedly do that every SERVER_REFRESH_MS.
    this.worker = worker;
    this.worker.on('message', (newCombinedStatus) => {
      console.log(`@@@@@`);
      console.log(newCombinedStatus);
      console.log(`@@@@@`);
      this.combinedStatus = newCombinedStatus;
      this.sendUpdateToClients(newCombinedStatus);
    });
  
    // PASSING in logger from server.js doesn't make it work either
    this.logger = logger;

    this.worker.postMessage(this.combinedStatus);
    setInterval(() => this.worker.postMessage(this.combinedStatus), SERVER_REFRESH_MS); 
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
    this.pushStatusToClient(response, true, this.combinedStatus);

    // Remove the client from our list when it closes the connection
    request.on('close', () => {
      this.clients.delete(response);
    });
  }


  /**
   * 
   * @param {*} updatedStatus 
   */
  sendUpdateToClients = (newCombinedStatus) => {
    this.clients.forEach(client => {
      this.pushStatusToClient(client, false, newCombinedStatus);
    });
  }


  /**
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   */
  pushStatusToClient = (client, initialPush, newCombinedStatus) => {
    // TODO- logger statement is not working since moving it to status controller
    this.logger.debug(`Pushing ${initialPush ? 'initial data' : 'data'} to ${client.req.get('Referrer')}`);
    client.write(`data: ${JSON.stringify(this.getStatusForClient(newCombinedStatus))}\n\n`);
  }


  /**
   * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   *
   * Returns the status as a JSON object
   */
  getStatusForClient = (combinedStatus) => {
    if (combinedStatus) {
      return {
        emoji: combinedStatus.slack.emoji ? `/images/${combinedStatus.slack.emoji}.png` : '',
        text: combinedStatus.slack.text,
        times: combinedStatus.slack.times,
        lastUpdatedTime: DateTime.now().toLocaleString(DateTime.TIME_SIMPLE),
        homeAssistant: {
          washerText: combinedStatus.homeAssistant.washerText,
          dryerText: combinedStatus.homeAssistant.dryerText,
          temperatureText: combinedStatus.homeAssistant.temperatureText
        }
      };
    };
  };
}


module.exports = StatusController;