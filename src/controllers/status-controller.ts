import { DateTime } from "luxon";
import { Worker } from 'worker_threads';
import { Request, Response } from 'express';

import logger from '../services/logger.js';
import { CombinedStatus } from '../models/combined-status.js';
import { EmojiService } from '../services/emoji-service.js';
import { HomeAssistantService } from '../services/home-assistant-service.js';
//import { HomeAssistantStatus } from "../models/home-assistant-status";




/**
 * Status Controller
 * 
 * Used to build the status that will be send to the clients
 */
export class StatusController {
  private readonly SERVER_POLLING_MS: number = (process.env.SERVER_POLLING_SECONDS || 30) * 1000;

  // This variable is needed because it contains Slack.statusStartTime which this code adds to keep track of when the status started
  // It does not come from Slack, and when we set the status, we need the current value
  private combinedStatus: CombinedStatus = CombinedStatus.EMPTY_STATUS;


  private emojiService: EmojiService;
  private homeAssistantService: HomeAssistantService;


  private clients: Set<Response> = new Set<Response>();
  private worker: Worker;
  // TODO- declare a type for this??
  


  public homeAssistantUpdate(request: Request, response: Response) {
    logger.debug(`>>>>>>>>>>>>>>>>>>>>>> StatusController.homeAssistantUpdate()`);

    //   - status-worker is responsible for POLLING. StatusController is responsible 
    //     for maintaining this.combinedStatus
    //
    // If I get rid of HomeAssistantService and stop polling it, then when I open a 
    // webpage, I will not have any HA data until I get my first update, which could be
    // 10-20 minutes, depending on when something in that data changes. DO I CARE?
    // This looks significant, but may not be. THINK ABOUT IT.
    //   - This would affect Kaley opening the web page to see the laundry status, although
    //     if laundry is running, it'd update every minute
    //   - CORRECTION- this is only for the first couple of minutes the SERVER is running
    //     once the server has been running for a couple of minutes and gets the first
    //     HA update, any new client will IMMEDIATELY get the status. This is NOT
    //     worth the extra mess of keeping HomeAssistantService, the async constructor mess here, etc.
    //
    // I thought about pushing updates for HA separate from Slack. Would be initiated
    // from the same route, but then could push two different payloads to the client,
    // and the client would have to look at the payload to determine what to update.
    // This seems very unnecessary. I may want to document this decision somewhere.

    logger.debug(`   BEFORE: ${JSON.stringify(this.combinedStatus.homeAssistant)}`);
    this.combinedStatus.updateHomeAssistantStatus(request.body);
    logger.debug(`   AFTER: ${JSON.stringify(this.combinedStatus.homeAssistant)}`);

    this.sendStatusToAllClients();

    response.status(200).end();
  }



  /**
   * Constructor
   */
  constructor(
    worker: Worker, 
    emojiService: EmojiService, 
    homeAssistantService: HomeAssistantService
  ) {
    this.worker = worker;
    this.emojiService = emojiService;
    this.homeAssistantService = homeAssistantService;
  }

  static async create(
    worker: Worker, 
    emojiService: EmojiService, 
    homeAssistantService: HomeAssistantService
  ) {
    const controller = new StatusController(worker, emojiService, homeAssistantService);


    // When the worker sends us a message, save it and send it to all the clients
    worker.on('message', (newCombinedStatus: CombinedStatus) => {
      //logger.debug(`@@@@@ StatusController.on.message() RECEIVED`);
      //console.log(newCombinedStatus);
      //logger.debug(`@@@@@`);
      controller.combinedStatus = newCombinedStatus;
      controller.sendStatusToAllClients();
    });


    // Get the Home Assistant status and then have the worker get the Slack status 
    // and send it to all clients
    controller.combinedStatus.homeAssistant = await homeAssistantService.getHomeAssistantStatus();
    controller.tellWorkerToGetLatestStatus();
    
    // Every SERVER_POLLING_MS, tell the worker to get the status. It will do that and
    // send us a message, which is the "worker.on('message'..." above.
    setInterval(() => controller.tellWorkerToGetLatestStatus(), controller.SERVER_POLLING_MS); 

    return controller;
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
    // Add the client to our list of clients that need updates
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    this.clients.add(response);
  
    // If we do not yet have the Home Assistant status, go get it
    // TODO- I'd like this in the constructor, but not sure that'll work
    if (this.combinedStatus.homeAssistant.washerText === '') {
      this.combinedStatus.homeAssistant = await this.homeAssistantService.getHomeAssistantStatus();
    }

    // Push initial data to this client
    this.pushStatusToClient(response, true);

    // Remove the client from our list when it closes its connection
    request.on('close', () => this.clients.delete(response));
  }


  /**
   * 
   */
  private sendStatusToAllClients() {
    this.clients.forEach((client: Response) => this.pushStatusToClient(client, false));
  }


  /**
   * FYI, request.get('Referrer') returns the full URL of the referring/
   * requesting site
   * 
   *    * Get status to send to the client, making any necessary changes, such as
   * converting an emoji to an actual filename.
   */
  private pushStatusToClient(client: Response, initialPush: boolean) {
    // Prefix ""::ffff:" means clientIp is an IPv4-mapped IPv6 address, and I want to strip that off
    const clientIp: string = (client.req.ip || '').replace('::ffff:', '');
    const pageName: string = client.req.get('Referrer')?.split('/').pop()?.toLowerCase() || '';
    logger.debug(`StatusController.pushStatusToClient(), pushing ${initialPush ? 'initial data' : 'data'} for ${pageName} on ${clientIp}`);

    const statusToSend = {
      emojiImage: this.emojiService.getRandomEmojiImage(this.combinedStatus.slack.emoji, pageName),
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