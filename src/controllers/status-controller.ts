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
  private readonly TEAMS_HEARTBEAT_TIMEOUT_MS: number = (parseInt(`${process.env.TEAMS_HEARTBEAT_TIMEOUT_SECONDS || 90}`, 10) || 90) * 1000;

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
    setInterval(() => {
      this.refreshTeamsOverrideState();
      this.tellWorkerToGetLatestSlackStatus();
    }, this.SERVER_POLLING_MS); 
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
   * Handle a Teams heartbeat from the laptop helper.
   */
  public handleTeamsCall(request: Request, response: Response) {
    const secret = process.env.TEAMS_CALLBACK_SECRET || '';
    const token = (request.get('X-Auth-Token') || request.get('x-auth-token') || '');

    if (secret && token !== secret) {
      Logger.warn(`StatusController.handleTeamsCall(): unauthorized callback`);
      return response.status(401).end();
    }

    const rawInCall = request.body?.inCall;
    const inCall = rawInCall === true || rawInCall === 'true';
    Logger.debug(`StatusController.handleTeamsCall(), inCall=${inCall}`);

    if (inCall) {
      this.combinedStatus.updateTeamsOverrideState(true);
      this.pushStatusToAllClients();
      return response.status(200).end();
    }

    if (this.combinedStatus.teamsOverride.isActive) {
      this.combinedStatus.updateTeamsOverrideState(false);
      this.tellWorkerToGetLatestSlackStatus();
      this.pushStatusToAllClients();
    }

    return response.status(200).end();
  }


  /**
   * Check whether the Teams heartbeat has gone stale and clear the override if needed.
   */
  private refreshTeamsOverrideState() {
    const expired = this.combinedStatus.refreshTeamsOverrideState(this.TEAMS_HEARTBEAT_TIMEOUT_MS);
    if (expired) {
      Logger.debug(`StatusController.refreshTeamsOverrideState(), Teams heartbeat expired`);
      this.tellWorkerToGetLatestSlackStatus();
      this.pushStatusToAllClients();
    }
  }


  /**
   * Return the display status, prioritizing Slack meetings but falling back to Teams for other scenarios.
   */
  private getDisplayStatus() {
    // Only prioritize Slack if it's a meeting-type status
    const slackHasActiveMeeting = this.isMeetingStatusValue(this.combinedStatus.status.statusImageName);
    
    if (slackHasActiveMeeting) {
      // Show scheduled/Slack meeting with its calendar-driven expiration
      return {
        imageName: this.combinedStatus.status.statusImageName,
        text: this.combinedStatus.status.statusText,
        times: this.combinedStatus.status.statusTimes
      };
    }

    // Teams overrides everything except Slack meetings
    if (this.combinedStatus.teamsOverride.isActive) {
      const startTime = this.combinedStatus.teamsOverride.startedAt > 0
        ? DateTime.fromMillis(this.combinedStatus.teamsOverride.startedAt).toLocaleString(DateTime.TIME_SIMPLE)
        : DateTime.now().toLocaleString(DateTime.TIME_SIMPLE);
      return {
        imageName: 'meeting',
        text: 'Meeting',
        times: `Started @ ${startTime}`
      };
    }

    // Fall back to normal Slack status (lunch, vacation, etc.)
    return {
      imageName: this.combinedStatus.status.statusImageName,
      text: this.combinedStatus.status.statusText,
      times: this.combinedStatus.status.statusTimes
    };
  }


  /**
   * Check if a status value represents a meeting-type status.
   * Only meeting statuses take priority over Teams overrides.
   */
  private isMeetingStatusValue(statusValue: string): boolean {
    // Check both Slack emoji names and display image names (after status-conditions mapping)
    const meetingStatusValues = [':slack_call:', ':spiral_calendar_pad:', ':non_work_meeting:', 'meeting', 'telephone_receiver', 'non_work_meeting'];
    return meetingStatusValues.includes(statusValue);
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

    Logger.debug(`StatusController.updatedSlackStatus(), turning screen on, combinedStatus.status = ${JSON.stringify(this.combinedStatus.status)}`);

    // TODO- if the status is blank, don't turn the screen on. But at this point in the code,
    // the worker hasn't yet updated this.combinedStatus. So I need to wait until after the worker
    // has done its job.
    // HOWEVER, for now this is ok because my office exit script is waiting 30 seconds or so,
    // which lets this change my status to blank, which keeps the screen on, and then the office
    // script turns the screen off.
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
      const url = process.env.HOME_ASSISTANT_BASE_URL + '/api/services/switch/turn_on';
      const token = process.env.HOME_ASSISTANT_TOKEN;

      if (!url || !token) {
        Logger.debug(`StatusController: Missing Home Assistant URL or token, cannot turn screen on`);
        return;
      }

      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'  
        },
        body: JSON.stringify({
          entity_id: 'switch.work_status_monitor'
        })
      });

      Logger.debug(`StatusController: Sent request to turn screen on via Home Assistant`);
    } catch (error) {
      Logger.debug(`StatusController: Error turning screen on: ${error}`);
    }
  }

  private pushStatusToAllClients() {
    this.clients.forEach((client: Client, clientKey: string) => this.pushStatusToClient(client, false, clientKey));
  }


  /**
   * Send a command object to all connected SSE clients as an `command` event.
   * @param commandObj - Any JSON-serializable command (e.g. { action: 'reload' })
   */
  public pushCommandToAllClients(response: Response, commandObj: unknown) {
    const payload = JSON.stringify(commandObj);

    this.clients.forEach((client: Client, clientKey: string) => {
      try {
        client.response.write('event: command\n');
        client.response.write(`data: ${payload}\n\n`);
      } catch (err) {
        Logger.debug(`StatusController.pushCommandToAllClients(): failed for ${clientKey}: ${err}`);
      }
    });

    response.status(200).end();
  }


  /**
   * Set the display image that will be sent to the clients.
   * 
   * The image path is randomly selected from a list of files available for the
   * chosen image name.
   * 
   * It's fine, even preferred, for the wall phone to have the image change 
   * for every push. For example, one time it's 8bit_1.png, the next time it's
   * 8bit_2.gif, etc. But I don't want my desk phone constantly changing and 
   * distracting me for no reason.
   *
   * @param client - The client 
   */
  private setDisplayImage(client: Client) {
    const displayStatus = this.getDisplayStatus();

    if (client.pageName !== PAGES.DESK || client.displayImageName !== displayStatus.imageName) {
      client.displayImageName = displayStatus.imageName;
      client.displayImagePath = this.emojiService.getRandomImagePath(displayStatus.imageName, client.pageName);
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

    this.setDisplayImage(client);

    const displayStatus = this.getDisplayStatus();

    const statusToStream = {
      imagePath: client.displayImagePath,
      text: displayStatus.text,
      times: displayStatus.times,
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