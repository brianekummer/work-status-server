const logger = require('./logger');


/**
 * Home Assistant Service
 * 
 * Gets status info about a couple of devices from Home Assistant
 */
class HomeAssistantService {
  // Private constants and variables
  #HOME_ASSISTANT_BASE_URL = process.env.HOME_ASSISTANT_BASE_URL;
  #HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;

  // Public constants and variables
  EMPTY_STATUS = {
    washerText: null,
    dryerText: null,
    temperatureText: null
  };
  ERROR_STATUS = {
    washerText: 'ERROR',
    dryerText: 'ERROR',
    temperatureText: 'ERROR'
  };


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
          let state = JSON.parse(jsonResponse.state);
    
          return {
            washerText: state.Washer,
            dryerText: state.Dryer,
            temperatureText: state.Temperature
          };
        })
        .catch(ex => {
          logger.error(`HomeAssistantService.getHomeAssistantStatus(), ERROR: ${ex}`);
          return this.ERROR_STATUS;
        });
    } else {
      return this.EMPTY_STATUS;
    }
  }
};


module.exports = HomeAssistantService;