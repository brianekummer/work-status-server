import { DateTime } from "luxon";
import { Worker } from 'worker_threads';
import { Request, Response } from 'express';

import logger from '../services/logger';
import { Client } from '../models/client';
import { CombinedStatus } from '../models/combined-status';
import { EmojiService } from '../services/emoji-service';
import { PAGES } from '../constants';



/**
 * Status Controller
 * 
 * Used to build the status that will be send to the clients
 * 
 * 
 */
export class StatusController {
  private readonly SERVER_POLLING_MS: number = (process.env.SERVER_POLLING_SECONDS || 30) * 1000;

  // This variable is needed because it contains Slack.statusStartTime which this code adds to keep track of when the status started
  // It does not come from Slack, and when we set the status, we need the current value
  private combinedStatus: CombinedStatus = CombinedStatus.EMPTY_STATUS;


  private emojiService: EmojiService;
  private clients: Map<string, Client> = new Map<string, Client>();



  private worker: Worker;
  


  public homeAssistantUpdate(request: Request, response: Response) {
    logger.debug(`>>>>>>>>>>>>>>>>>>>>>> StatusController.homeAssistantUpdate()`);

    //   - status-worker is responsible for POLLING. StatusController is responsible 
    //     for maintaining this.combinedStatus
    //
    // If I get rid of HomeAssistantService and stop polling it, then when I open a 
    // webpage, I will not have any HA data until I get my first update, which could be
    // 5-45 minutes, depending on when something in that data changes. DO I CARE?
    // This looks significant, but may not be. THINK ABOUT IT.
    //   - This would affect Kaley opening the web page to see the laundry status, although
    //     if laundry is running, it'd update every minute
    //   - CORRECTION- this is only for the first couple of minutes the SERVER is running
    //     once the server has been running for a couple of minutes and gets the first
    //     HA update, any new client will IMMEDIATELY get the status. This is NOT
    //     worth the extra mess of keeping HomeAssistantService, the async constructor mess here, etc.
    //     DOCUMENT THIS SOMEWHERE as an oddity, known and accepted issue
    //
    // I thought about pushing updates for HA separate from Slack. Would be initiated
    // from the same route, but then could push two different payloads to the client,
    // and the client would have to look at the payload to determine what to update.
    // This seems very unnecessary. I may want to document this decision somewhere.

    logger.debug(`   BEFORE: ${JSON.stringify(this.combinedStatus.homeAssistant)}, is of type ${typeof this.combinedStatus.homeAssistant} and instanceof CombinedStatus = ${this.combinedStatus.homeAssistant instanceof CombinedStatus}`);
    this.combinedStatus.updateHomeAssistantStatus(request.body);
    logger.debug(`   AFTER: ${JSON.stringify(this.combinedStatus.homeAssistant)}`);

    this.sendStatusToAllClients();

    response.status(200).end();
  }



  /**
   * Constructor
   */
  constructor(worker: Worker, emojiService: EmojiService) {
    this.worker = worker;
    this.emojiService = emojiService;

    // Immediately send the currentStatus to the worker thread, which will check
    // for updates, and then send the updated status back in a message. Then
    // repeatedly do that every SERVER_REFRESH_MS.
    this.worker.on('message', (newCombinedStatus: CombinedStatus) => {
      logger.debug(`@@@@@ StatusController.on.message() RECEIVED, newCombinedStatus is type ${typeof newCombinedStatus} and instanceof CombinedStatus = ${newCombinedStatus instanceof CombinedStatus}`);
      // newCombinedStatus is passed as a simple JSON object, need to convert it back to a real CombinedStatus object so we can use those methods
      newCombinedStatus = CombinedStatus.fromJsonObject(newCombinedStatus);
      console.log(newCombinedStatus);
      logger.debug(`@@@@@ AFTER, newCombinedStatus is type ${typeof newCombinedStatus} and instanceof CombinedStatus = ${newCombinedStatus instanceof CombinedStatus}`);
  
      this.combinedStatus = newCombinedStatus;
      logger.debug(`this.combinedStatus is of type ${typeof this.combinedStatus} and instanceof CombinedStatus = ${this.combinedStatus instanceof CombinedStatus}`);
      this.sendStatusToAllClients();
    });
  
    this.tellWorkerToGetLatestStatus();
    
    setInterval(() => this.tellWorkerToGetLatestStatus(), this.SERVER_POLLING_MS); 
  }


  // TODO- rename this fn - tellWorkerToGetLatestSlackStatus ?
  private tellWorkerToGetLatestStatus() {
    this.worker.postMessage(this.combinedStatus);
  }


  /*
  * 
  * Use Server Sent Events to stream updates to the browser. Constructor sets up the loop that pushes updates every SERVER_POLLING_SECONDS
  *
  */
  public async streamStatusUpdates(request: Request, response: Response) {
    // Prefix ""::ffff:" means clientIp is an IPv4-mapped IPv6 address, and I want to strip that off
    const getIpAddress = (response: Response) => (response.req.ip || '').replace('::ffff:', '');

    const getPageName = (response: Response) => response.req.get('Referrer')?.split('/').pop()?.toLowerCase() || '';
    const getClientKey = (ipAddress: string, pageName: string) => `${ipAddress}-${pageName}`;

    const ipAddress: string = getIpAddress(response);
    const pageName: string = getPageName(response);
    logger.debug(`StatusController.streamStatusUpdates() => Started streaming to IP address ${ipAddress} for page ${pageName}`);


    // Add the client to our list of clients that need updates
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
  
    // Save info about the client we're streaming to
    const client = new Client(ipAddress, pageName, response, '', '');
    this.clients.set(getClientKey(ipAddress, pageName), client);
    
    // Push initial data to this client
    this.pushStatusToClient(client, true);

    // Remove the client from our list when it closes its connection
    request.on('close', () => {
      const ipAddress: string = getIpAddress(response);
      const pageName: string = getPageName(response);
      logger.debug(`StatusController.request.on.close => Closing connection to IP address ${ipAddress} for page ${pageName}`);
      this.clients.delete(getClientKey(ipAddress, pageName)); 
    });
  }


  /**
   * 
   */
  private sendStatusToAllClients() {
    this.clients.forEach((client: Client) => this.pushStatusToClient(client, false));
  }



    // It's fine (even preferred) for wall to change emoji all the time, but I don't want my desk phone needlessly changing
    private handleEmojis(client: Client) {
    let emojiImage = client.emojiImage;
    if (client.emoji !== this.combinedStatus.slack.emoji || client.pageName !== PAGES.DESK) {
      // Emoji has changed, so get a new random image
      emojiImage = this.emojiService.getRandomEmojiImage(this.combinedStatus.slack.emoji, client.pageName);
      logger.debug(`pushStatusToClient => emoji changing from ${client.emoji} to ${this.combinedStatus.slack.emoji}, new image is ${emojiImage}`);
      client.emoji = this.combinedStatus.slack.emoji;
      client.emojiImage = emojiImage;
    } else {
      logger.debug(`pushStatusToClient =? emoji is still ${client.emoji} so image is staying as ${emojiImage}`);
    }
  }


  /**
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   * 
   *    * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   */
  private pushStatusToClient(client: Client, initialPush: boolean) {
    // Prefix ""::ffff:" means clientIp is an IPv4-mapped IPv6 address, and I want to strip that off
    logger.debug(`StatusController.pushStatusToClient(), pushing ${initialPush ? 'initial data' : 'data'} for ${client.pageName} on ${client.ipAddress}`);


    this.handleEmojis(client);
    

    const statusToSend = {
      emojiImage: client.emojiImage,
      text: this.combinedStatus.slack.text,
      times: this.combinedStatus.slack.times,
      lastUpdatedTime: DateTime.now().toLocaleString(DateTime.TIME_SIMPLE),
      homeAssistant: {
        washerText: this.combinedStatus.homeAssistant.washerText,
        dryerText: this.combinedStatus.homeAssistant.dryerText,
        temperatureText: this.combinedStatus.homeAssistant.temperatureText
      }
    };
    
    client.response.write(`data: ${JSON.stringify(statusToSend)}\n\n`);
  }

  /**
   * User says they just updated their status, so immediately 
   * 
   * @param response 
   */
  public updatedStatus(response: Response) {
    // Have the worker thread check NOW!
    logger.debug(`StatusController.updatedStatus() called, checking for updates NOW`);
    this.tellWorkerToGetLatestStatus();
    response.status(200).end();
  }
}