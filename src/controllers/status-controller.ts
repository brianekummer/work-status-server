const { DateTime } = require('luxon');
import logger from '../services/logger';
import { CombinedStatus } from '../models/combined-status';



/**
 * Status Controller
 * 
 * Used to build the status that will be send to the clients
 */
export class StatusController {
  private readonly SERVER_REFRESH_MS: number = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;
  // The default, empty status

  // This variable is needed because it contains Slack.statusStartTime which this code adds to keep track of when the status started
  // It does not come from Slack, and when we set the status, we need the current value
  private combinedStatus: CombinedStatus = CombinedStatus.EMPTY_STATUS;


  private clients: any = new Set();
  private worker: any = null;


  /**
   * Constructor
   */
  constructor(worker: any) {
    // Immediately send the currentStatus to the worker thread, which will check
    // for updates, and then send the updated status back in a message. Then
    // repeatedly do that every SERVER_REFRESH_MS.
    this.worker = worker;
    this.worker.on('message', (newCombinedStatus: CombinedStatus) => {
      //logger.debug(`@@@@@ StatusController.on.message() RECEIVED`);
      //console.log(newCombinedStatus);
      //logger.debug(`@@@@@`);
      this.combinedStatus = newCombinedStatus;
      this.sendStatusToAllClients();
    });
  
    this.worker.postMessage(this.combinedStatus);
    setInterval(() => this.worker.postMessage(this.combinedStatus), this.SERVER_REFRESH_MS); 
  }


  /*
  * 
  * Use Server Sent Events to continually push updates to the browser every
  * CLIENT_REFRESH_MS.
  *
  */
  public async getStatusUpdates(request: any, response: any) {
    // Add the client to our list of clients that need updates
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    this.clients.add(response);
  
    // Push initial data to this client
    this.pushStatusToClient(response, true);

    // Remove the client from our list when it closes its connection
    request.on('close', () => this.clients.delete(response));
  }


  /**
   * 
   */
  private sendStatusToAllClients() {
    this.clients.forEach((client: any) => this.pushStatusToClient(client, false));
  }


  /**
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   * 
   *    * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   */
  private pushStatusToClient(client: any, initialPush: boolean) {
    logger.debug(`Pushing ${initialPush ? 'initial data' : 'data'} to ${client.req.get('Referrer')}`);

    let statusToSend = {
      emojiImage: this.combinedStatus.slack.emoji ? `/images/${this.combinedStatus.slack.emoji}.png` : '',
      text: this.combinedStatus.slack.text,
      times: this.combinedStatus.slack.times,
      lastUpdatedTime: DateTime.now().toLocaleString(DateTime.TIME_SIMPLE),
      homeAssistant: {
        washerText: this.combinedStatus.homeAssistant.washerText,
        dryerText: this.combinedStatus.homeAssistant.dryerText,
        temperatureText: this.combinedStatus.homeAssistant.temperatureText
      }
    };
    client.write(`data: ${JSON.stringify(statusToSend)}\n\n`);
  }
}

//module.exports = StatusController;