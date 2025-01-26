import { DateTime } from "luxon";
import { Worker } from 'worker_threads';
import { Request, Response } from 'express';

import logger from '../services/logger';
import { CombinedStatus } from '../models/combined-status';
import { globSync } from 'glob';
import path from 'path';


// TODO- is this type worthwhile??
type EmojiImagesDictionary = Map<string, string[]>;


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





  private clients: Set<Response> = new Set<Response>();
  private worker: Worker;
  // TODO- declare a type for this??
  private emojiImages: EmojiImagesDictionary;


  /**
   * Constructor
   */
  constructor(worker: Worker) {
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
  
    this.tellWorkerToGetLatestStatus();
    setInterval(() => this.tellWorkerToGetLatestStatus(), this.SERVER_POLLING_MS); 

    this.emojiImages = this.buildListOfEmojiImages()
  }


  // TODO- rename this fn
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




  //***** SHOULD THE EMOJI IMAGE STUFF BE PULLED INTO A SEPARATE SERVICE?

  /**
   * Explain how am doing this
   */
  private buildListOfEmojiImages(): EmojiImagesDictionary {
    const dirname = '../public/images';

    // Build a unique list of emojis by stripping trailing digits and underscores from filenames
    const filenames = globSync(`${dirname}/*`);
    const emojis = Array.from(new Set(
      filenames.map(f =>
        path.basename(f, path.extname(f)).replace(/_\d+$/, '')
      )
    ));

    // Create a map of emoji to their corresponding images
    const emojiImages: EmojiImagesDictionary = new Map<string, string[]>();
    emojis.forEach(e => {
      const images = 
        globSync(`${dirname}/${e}*`)
        .map(i => `/images/${path.basename(i)}`);
      emojiImages.set(e, images);
    });

    return emojiImages;
  }
  /**
   * 
   */
  private getRandomEmojiImage(emoji: string): string {
    const images = this.emojiImages.get(emoji);
    return images ? images[Math.floor(Math.random() * images.length)] : '';
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
    const clientIp = (client.req.ip || '').replace('::ffff:', '');
    logger.debug(`StatusController.pushStatusToClient(), pushing ${initialPush ? 'initial data' : 'data'} to ${client.req.get('Referrer')?.split('/').pop()} on ${clientIp}`);

    const statusToSend = {
      emojiImage: this.getRandomEmojiImage(this.combinedStatus.slack.emoji),
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