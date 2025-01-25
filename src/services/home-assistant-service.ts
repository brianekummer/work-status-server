import logger from './logger';
import { HomeAssistantStatus } from '../models/home-assistant-status';


/**
 * Home Assistant Service
 * 
 * Gets status info about a couple of devices from Home Assistant
 */
export class HomeAssistantService {
  // Public constants and variables


  // Private constants and variables
  private readonly HOME_ASSISTANT_BASE_URL = process.env.HOME_ASSISTANT_BASE_URL;
  private readonly HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;



  /**
   * Returns true if there is Home Assistant integration
   */
  // TODO- set return type
  private haveHomeAssistantIntegration() {
    return this.HOME_ASSISTANT_BASE_URL && this.HOME_ASSISTANT_TOKEN;
  }


  /**
   * Get status of Home Assistant devices
   * 
   * If there is no known URL or security token, then just return an empty status
   * object.
   *
   * Returns a JSON object with status of the relevant Home Assistant entities
   */
  // TODO- set return type
  public getHomeAssistantStatus() {
    if (this.haveHomeAssistantIntegration()) {
      const headers = {
        'Authorization': `Bearer ${this.HOME_ASSISTANT_TOKEN}`
      };
    
      return fetch(
          new URL('/api/states/sensor.work_status_phone_info', this.HOME_ASSISTANT_BASE_URL),
          { method: 'GET', headers: headers })
        .then(response => response.json())
        .then(jsonResponse => {
          return HomeAssistantStatus.fromApi(JSON.parse(jsonResponse.state));
        })
        .catch(ex => {
          logger.error(`HomeAssistantService.getHomeAssistantStatus(), ERROR: ${ex}`);
          return HomeAssistantStatus.ERROR_STATUS;
        });
    } else {
      return HomeAssistantStatus.EMPTY_STATUS;
    }
  }
};


//module.exports = HomeAssistantService;