const logger = require('./logger');
const HomeAssistantStatus = require('../models/home-assistant-status');


/**
 * Home Assistant Service
 * 
 * Gets status info about a couple of devices from Home Assistant
 */
class HomeAssistantService {
  // Public constants and variables


  // Private constants and variables
  #HOME_ASSISTANT_BASE_URL = process.env.HOME_ASSISTANT_BASE_URL;
  #HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;



  /**
   * Returns true if there is Home Assistant integration
   */
  haveHomeAssistantIntegration = () => 
    this.#HOME_ASSISTANT_BASE_URL && this.#HOME_ASSISTANT_TOKEN;


  /**
   * Get status of Home Assistant devices
   * 
   * If there is no known URL or security token, then just return an empty status
   * object.
   *
   * Returns a JSON object with status of the relevant Home Assistant entities
   */
  getHomeAssistantStatus = () => {
    if (this.haveHomeAssistantIntegration()) {
      const headers = {
        'Authorization': `Bearer ${this.#HOME_ASSISTANT_TOKEN}`
      };
    
      return fetch(
          new URL('/api/states/sensor.work_status_phone_info', this.#HOME_ASSISTANT_BASE_URL),
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


module.exports = HomeAssistantService;