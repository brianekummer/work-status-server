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
  

  /**
   * Constructor
   */
  constructor(worker: Worker, emojiService: EmojiService) {
    this.worker = worker;
    this.emojiService = emojiService;

    // When the worker thread sends an updated status, process it
    this.worker.on('message', (newCombinedStatus: CombinedStatus) => 
      this.processWorkerThreadMessage(newCombinedStatus));
  
    // Tell the worker thread t5o get the latest Slack status and send it back to us,
    // then repeat that every SERVER_REFRESH_MS.
    this.tellWorkerToGetLatestSlackStatus();
    setInterval(() => this.tellWorkerToGetLatestSlackStatus(), this.SERVER_POLLING_MS); 
  }

  
 /**
  * 
  * Use Server Sent Events to stream updates to the browser. Constructor sets up the loop that pushes updates every SERVER_POLLING_SECONDS
  *
  * FYI, request.get('Referrer') returns the full URL of the referring/requesting site (http://server_ip:3000/desk)
    // Prefix ""::ffff:" means clientIp is an IPv4-mapped IPv6 address, and I want to strip that off
  */
  public async streamStatusUpdates(request: Request, response: Response) {
    const ipAddress: string = (response.req.ip || '').replace('::ffff:', '');
    const pageName: string = response.req.get('Referrer')?.split('/').pop()?.toLowerCase() || '';
    const clientKey: string = `${ipAddress}-${pageName}`;

    logger.debug(`StatusController.streamStatusUpdates() => Started streaming to IP address ${ipAddress} for page ${pageName}`);

    // Configure this client to have updates streamed to it
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
  
    // Save this new client to our list of clients that should get updates
    const client = new Client(ipAddress, pageName, response, '', '');
    this.clients.set(clientKey, client);
    
    // Push initial data to this new client
    this.pushStatusToClient(client, true);

    // When the client closes its connection, remove it from our list of clients
    request.on('close', () => this.clients.delete(clientKey));
  }
  

  public homeAssistantUpdate(request: Request, response: Response) {
    logger.debug(`StatusController.homeAssistantUpdate()`);

    //   - status-worker is responsible for POLLING. StatusController is responsible 
    //     for maintaining this.combinedStatus and getting it out to the clients
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

    this.combinedStatus.updateHomeAssistantStatus(request.body);
    this.sendStatusToAllClients();
    response.status(200).end();
  }


  /**
   * User says they just updated their status, so immediately 
   * 
   * @param response 
   */
  public updatedStatus(response: Response) {
    logger.debug(`StatusController.updatedStatus(), checking for updates`);
    this.tellWorkerToGetLatestSlackStatus();
    response.status(200).end();
  }
  

  /*
  private processWorkerThreadMessage(newCombinedStatus: CombinedStatus) {
    // newCombinedStatus is passed as a simple JSON object, need to convert it back to
    // a real CombinedStatus object so we can use its methods
    newCombinedStatus = CombinedStatus.fromJsonObject(newCombinedStatus);

    // TODO- decide if send this update or not. Send it if
    //   - it changed
    //   - it has been at least one minute since the last update
    if (this.combinedStatus.lastUpdatedDateTime.diffNow('seconds').seconds < -60 || !this.combinedStatus.equals(newCombinedStatus)) {
      if (this.combinedStatus.lastUpdatedDateTime.diffNow('seconds').seconds < -60) {
        logger.debug(`StatusController.processWorkerThreadMessage(), pushing update because of time`);
      } else if (!this.combinedStatus.equals(newCombinedStatus)) {
        logger.info( 
          `StatusController.processWorkerThreadMessage(), pushing update because status changed\n` +
          `   FROM ${this.combinedStatus.toString()}\n` +
          `     TO ${newCombinedStatus.toString()}`);
      }
      newCombinedStatus.lastUpdatedDateTime = DateTime.now();
      this.combinedStatus = newCombinedStatus;
      this.sendStatusToAllClients();
    }  
  }
  */
  private processWorkerThreadMessage(newCombinedStatus: CombinedStatus) {
    // Convert plain JSON object to a real CombinedStatus instance
    newCombinedStatus = CombinedStatus.fromJsonObject(newCombinedStatus);

    const timeExceeded = this.combinedStatus.lastUpdatedDateTime.diffNow('seconds').seconds < -60;
    const statusChanged = !this.combinedStatus.equals(newCombinedStatus);

    if (timeExceeded || statusChanged) {
      if (timeExceeded) {
        logger.debug(`StatusController.processWorkerThreadMessage(), pushing update because of time`);
      } else if (statusChanged) {
        logger.info(`StatusController.processWorkerThreadMessage(), pushing update because status changed\n` +
          `   FROM ${this.combinedStatus.toString()}\n` +
          `     TO ${newCombinedStatus.toString()}`);
      }

      newCombinedStatus.lastUpdatedDateTime = DateTime.now();
      this.combinedStatus = newCombinedStatus;
      this.sendStatusToAllClients();
    }
  }




  private tellWorkerToGetLatestSlackStatus() {
    this.worker.postMessage(this.combinedStatus);
  }


  /**
   * 
   */
  private sendStatusToAllClients() {
    this.clients.forEach((client: Client) => this.pushStatusToClient(client, false));
  }



  // It's fine (even preferred) for wall to change emoji all the time, but I don't want my desk phone needlessly changing
  private setEmoji(client: Client) {
    let emojiImage = client.emojiImage;
    if (client.pageName !== PAGES.DESK || client.emoji !== this.combinedStatus.slack.emoji) {
      // Emoji has changed, so get a new random image
      emojiImage = this.emojiService.getRandomEmojiImage(this.combinedStatus.slack.emoji, client.pageName);
      logger.debug(`pushStatusToClient => emoji changing from ${client.emoji} to ${this.combinedStatus.slack.emoji}, so new image is ${emojiImage}`);
      client.emoji = this.combinedStatus.slack.emoji;
      client.emojiImage = emojiImage;
    } else {
      logger.debug(`pushStatusToClient => emoji is still ${client.emoji} so image is staying ${emojiImage}`);
    }
  }


  /**
   * 
   *    * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   */
  private pushStatusToClient(client: Client, initialPush: boolean) {
    logger.debug(`StatusController.pushStatusToClient(), pushing ${initialPush ? 'initial data' : 'data'} for ${client.pageName} on ${client.ipAddress}`);

    this.setEmoji(client);

    const statusToStream = {
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
    
    client.response.write(`data: ${JSON.stringify(statusToStream)}\n\n`);
  }
}