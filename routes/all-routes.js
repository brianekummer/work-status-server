const CLIENT_REFRESH_MS = (process.env.CLIENT_REFRESH_SECONDS || 30) * 1000;

module.exports = function(app) {
  const express = require("express")
  const statusController = new (require("../controllers/status-controller"))(app);
  const homeAssistantService = new (require("../services/home-assistant-service"));

  const router = express.Router(); 

  router.get('/favicon.ico', (request, response) => response.status(204).end());


  router.get("/desk", (request, response) => {
    payload = {
      CLIENT_REFRESH_MS,
      WASHER_ICON_URL: homeAssistantService.buildHomeAssistantUrl("/local/icon/mdi-washing-machine-light.png"),
      DRYER_ICON_URL: homeAssistantService.buildHomeAssistantUrl("/local/icon/mdi-tumble-dryer-light.png"),
      TEMPERATURE_ICON_URL: homeAssistantService.buildHomeAssistantUrl("/local/icon/thermometer.png")
    };
    
    response.render("desk", payload);
  });
  
  
  router.get("/wall", (request, response) => {
    payload = {
      CLIENT_REFRESH_MS
    };
    
    response.render("wall", payload);
  });
  
  
  router.get("/get-status", (request, response) => response.status(200).json(statusController.getStatusForClient()));
  
  return router;
}