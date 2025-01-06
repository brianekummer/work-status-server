const express = require("express")
const router = express.Router();
const statusController = require("../controllers/statusController");

// TODO- this is needed for server side refresh
const SERVER_REFRESH_MS = (process.env.SERVER_REFRESH_SECONDS || 30) * 1000;


const CLIENT_REFRESH_MS = (process.env.CLIENT_REFRESH_SECONDS || 30) * 1000;

// TODO- move this somewhere else
const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL;


router.get('/favicon.ico', (request, response) => response.status(204).end());

router.get("/desk", (request, response) => {
  // TODO- break this out into its own controller?
  payload = {
    CLIENT_REFRESH_MS,
    WASHER_ICON_URL: HOME_ASSISTANT_URL ? `${HOME_ASSISTANT_URL}/local/icon/mdi-washing-machine-light.png` : "",
    DRYER_ICON_URL: HOME_ASSISTANT_URL ? `${HOME_ASSISTANT_URL}/local/icon/mdi-tumble-dryer-light.png` : "",
    TEMPERATURE_ICON_URL: HOME_ASSISTANT_URL ? `${HOME_ASSISTANT_URL}/local/icon/thermometer.png` : ""
  };
  
  response.render("desk", payload);
});

router.get("/wall", (request, response) => {
  payload = {
    CLIENT_REFRESH_MS
  };
  
  response.render("wall", payload);
});

// Call from the client asking for the latest status
// TODO- break this into a controller
router.get("/get-status", (request, response) => response.status(200).json(statusController.getStatusForClient()));






module.exports = router;