import { DateTime } from 'luxon';
import { Request, Response } from 'express';
import { Worker } from 'worker_threads';
import { randomUUID }from 'node:crypto';

import Client from '../models/client';
import CombinedStatus from '../models/combined-status';
import EmojiService from '../services/emoji-service';
import Logger from '../services/logger';
import { PAGES } from '../constants';


/**
 * Status Controller
 * 
 * This controller is responsible for
 *   - Maintaining the combined status status (Slack + Home Assistant)
 *       - Periodically telling the worker thread to get my Slack statuses, 
 *         receiving it's response, and setting the new status
 *       - Getting webhook messages from Home Assistant with updates and
 *         applying those updates to the current status
 *   - Periodically sending the status to all the web clients
 */
export default class StatusController {
  private readonly SERVER_POLLING_MS: number = (process.env.SERVER_POLLING_SECONDS || 30) * 1000;


  private clients: Map<string, Client> = new Map<string, Client>();
  
  // combinedStatus is required to be a module-level variable because it 
  // contains slack.statusStartTime. This does not come from Slack and is 
  // added by this code to keep track of when the current status started.
  // It is necessary for maintaining slack.times ("Started @ 3:50 PM").
  private combinedStatus: CombinedStatus = CombinedStatus.EMPTY_STATUS;


  /**
   * Constructor
   * 
   * @param worker 
   * @param emojiService 
   */
  constructor(
    private readonly worker: Worker, 
    private readonly emojiService: EmojiService
  ) {
    this.worker = worker;
    this.emojiService = emojiService;

    this.worker.on('message', (newCombinedStatus: CombinedStatus) => 
      this.processWorkerThreadMessage(newCombinedStatus));
  
    this.tellWorkerToGetLatestSlackStatus();
    setInterval(() => this.tellWorkerToGetLatestSlackStatus(), this.SERVER_POLLING_MS); 
  }


  /**
   * Start streaming status updates to a web client, using Server Sent Events (SSE)
   *
   * Notes
   *   - To get the page name (I want "desk" or "wall"), request.get('Referrer') returns
   *     the full URL of the referring site (i.e. "http://server_ip:3000/desk")
   *   - On an IP address, the prefix "::ffff:" means that the IP is an IPv4-mapped
   *     IPv6 address, which I don't care about and will strip off
   * 
   *   - FOR DEBUGGING, adding a UUID to track if I have multiple clients coming from the
   *     same IP (which would be a single app having multiple clients, which I obviously 
   *     don't want)
   * 
   * @param request - The HTTP request
   * @param response - The HTTP response
   */
  public async startStreamingStatusUpdates(
    request: Request, 
    response: Response
  ) {
    const ipAddress: string = (response.req.ip || '').replace('::ffff:', '');
    const pageName: string = response.req.get('Referrer')?.split('/').pop()?.toLowerCase() || '';
    const uuid: string = randomUUID();
    const clientKey: string = `${ipAddress}_${pageName}_${uuid}`;

    // Configure this client for Server Sent Events
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
  
    // Save this new client to our list of clients that will get updates
    const client = new Client(ipAddress, pageName, response);
    this.clients.set(clientKey, client);
    
    // Push initial data to this new client
    this.pushStatusToClient(client, true, clientKey);

    // When the client closes its connection, remove it from our list of clients
    request.on('close', () => {
      Logger.debug(`StatusController.startStreamingStatusUpdates.close() for ${clientKey}`);
      this.clients.delete(clientKey);
    });
  }
  

  /**
   * Process an update from Home Assistant
   * 
   * Applies the update to the combinedStatus and pushes the updated combinedStatus
   * to all the web clients.
   * 
   * @param request - The HTTP request
   * @param response - the HTTP response
   */
  public homeAssistantUpdate(
    request: Request,
    response: Response
  ) {
    Logger.debug(`StatusController.homeAssistantUpdate()`);

    this.combinedStatus.updateHomeAssistantStatus(request.body);
    this.pushStatusToAllClients();
    response.status(200).end();
  }


  /**
   * User called this endpoint to notify that they updated their Slack status and that
   * we should immediately get that new status and push it to the clients
   * 
   * @param response - The HTTP response
   */
  public updatedSlackStatus(response: Response) {
    Logger.debug(`StatusController.updatedStatus(), checking for updates`);
    this.tellWorkerToGetLatestSlackStatus();

    this.turnScreenOn();

    response.status(200).end();
  }
  

  /**
   * Worker thread has a (potentially) new combined status
   * 
   * @param newCombinedStatus - The new combined status, which is passed as a
   *                            plain JSON object that needs converted to a real
   *                            CombinedStatus object
   */
  private processWorkerThreadMessage(newCombinedStatus: CombinedStatus) {
    newCombinedStatus = CombinedStatus.fromJsonObject(newCombinedStatus);

    const timeExceeded = this.combinedStatus.lastUpdatedDateTime.diffNow('seconds').seconds < -60;
    const statusChanged = !this.combinedStatus.equals(newCombinedStatus);

    if (timeExceeded || statusChanged) {
      if (timeExceeded) {
        Logger.debug(`StatusController.processWorkerThreadMessage(), pushing update because of time`);
      } else if (statusChanged) {
        Logger.info(`StatusController.processWorkerThreadMessage(), pushing update because status changed\n` +
          `   FROM ${this.combinedStatus.toString()}\n` +
          `     TO ${newCombinedStatus.toString()}`);
      }

      newCombinedStatus.lastUpdatedDateTime = DateTime.now();
      this.combinedStatus = newCombinedStatus;
      this.pushStatusToAllClients();
    }
  }


  /**
   * Tell the worker thread to go get the latest Slack status, instead of 
   * waiting for the polling to happen
   */
  private tellWorkerToGetLatestSlackStatus() {
    this.worker.postMessage(this.combinedStatus);
  }


  /**
   * Turn the screen on of the computer controlling the work status display
   */
  private async turnScreenOn() {
    try {
      const url = process.env.TURN_MONITOR_ON_URL;

      if (url) {
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) {
          Logger.debug(`StatusController: Failed to turn screen on, status ${response.status}`);
        }
      }
    } catch (error) {
      Logger.debug(`StatusController: Error turning screen on: ${error}`);
    }
  }

  private pushStatusToAllClients() {
    this.clients.forEach((client: Client, clientKey: string) => this.pushStatusToClient(client, false, clientKey));
  }


  /**
   * Set the emoji and emoji image that will be sent to the clients
   * 
   * The emoji image is randomly selected from a list of images available for that 
   * emoji.
   * 
   * It's fine, even preferred, for the wall phone to have the emoji image change 
   * for every push. For example, one time it's 8bit_1.png, the next time it's
   * 8bit_2.gif, etc. But I don't want my desk phone constantly changing and 
   * distracting me for no reason.
   *
   * @param client - The client 
   */
  private setEmoji(client: Client) {
    if (client.pageName !== PAGES.DESK || client.emoji !== this.combinedStatus.slack.emoji) {
      client.emoji = this.combinedStatus.slack.emoji;
      client.emojiImage = this.emojiService.getRandomEmojiImage(this.combinedStatus.slack.emoji, client.pageName);;
    }
  }


  /**
   * Push the latest status to a single client
   *
   * This builds the payload to send and pushes it
   *
   * @param client - The client to push to
   * @param initialPush - Is this the initial push for this client? Is used ONLY
   *                      for logging purposes
   * @param clientKey - The clientKey
   */
  private pushStatusToClient(
    client: Client,
    initialPush: boolean,
    clientKey: string
  ) {
    Logger.debug(`StatusController.pushStatusToClient(), pushing ${initialPush ? 'initial data' : 'data'} to ${clientKey}`);

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