const logService = new (require("../services/log-service"));

class HomeAssistantService {
  // Public constants and variables
  EMPTY_HOME_ASSISTANT_STATUS = {
    washerText: null,
    dryerText: null,
    temperatureText: null
  };

  // Private constants and variables
  #HOME_ASSISTANT_BASE_URL = process.env.HOME_ASSISTANT_BASE_URL;
  #HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;


    

  haveHomeAssistantIntegration = () => {
    return this.#HOME_ASSISTANT_BASE_URL && this.#HOME_ASSISTANT_TOKEN;
  };


  buildHomeAssistantUrl = (urlPath) => {
    return new URL(urlPath, this.#HOME_ASSISTANT_BASE_URL);
  };


  /******************************************************************************
    Get status of Home Assistant devices
    
    If there is no security token, then just return nulls

    Returns a JSON object with status of those Home Assistant entities
  ******************************************************************************/
  getHomeAssistantStatus = () => {
    if (!this.haveHomeAssistantIntegration()) {
      return this.EMPTY_HOME_ASSISTANT_STATUS;
    } else {
      let headers = {
        "Authorization": `Bearer ${this.#HOME_ASSISTANT_TOKEN}`
      };
    
      return fetch(
          this.buildHomeAssistantUrl("/api/states/sensor.work_status_phone_info"), 
          { method: "GET", headers: headers })
        .then(response => response.json())
        .then(jsonResponse => {
          const state = JSON.parse(jsonResponse.state);
    
          return {
            washerText: state.Washer,
            dryerText: state.Dryer,
            temperatureText: state.Temperature
          };
        })
        .catch(ex => {
          logService.log(logService.LOG_LEVELS.ERROR, `ERROR in getHomeAssistantData: ${ex}`);
          return null;     // Explicitly handle the error case
        });
    
    }
  }
};


module.exports = HomeAssistantService;