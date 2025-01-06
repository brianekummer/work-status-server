const logService = require("../services/log-service");

const HOME_ASSISTANT_BASE_URL = process.env.HOME_ASSISTANT_BASE_URL;
const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN;


const EMPTY_HOME_ASSISTANT_STATUS = {
  washerText: null,
  dryerText: null,
  temperatureText: null
};
  

const haveHomeAssistantIntegration = () => {
  return HOME_ASSISTANT_BASE_URL && HOME_ASSISTANT_TOKEN;
};

const buildHomeAssistantUrl = (urlPath) => {
  return new URL(urlPath, HOME_ASSISTANT_BASE_URL);
};



/******************************************************************************
  Get status of Home Assistant devices
  
  If there is no security token, then just return nulls

  Returns a JSON object with status of those Home Assistant entities
******************************************************************************/
const getHomeAssistantStatus = () => {
  if (!haveHomeAssistantIntegration()) {
    return EMPTY_HOME_ASSISTANT_STATUS;
  } else {
    let headers = {
      "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`
    };
  
    return fetch(buildHomeAssistantUrl("/api/states/sensor.work_status_phone_info"), { method: "GET", headers: headers })
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
};



module.exports = {
    EMPTY_HOME_ASSISTANT_STATUS,
    haveHomeAssistantIntegration,
    buildHomeAssistantUrl,
    getHomeAssistantStatus
  }