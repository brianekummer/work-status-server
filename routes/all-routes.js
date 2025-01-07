module.exports = function(app) {
  const express = require("express")
  let statusController = new (require("../controllers/status-controller"))(app);

  let router = express.Router(); 

  router.get('/favicon.ico', (request, response) => 
    response.status(204).end());

  router.get("/desk", (request, response) => 
    response.render("desk", statusController.getDeskPayload()));
  
    router.get("/wall", (request, response) =>
    response.render("wall", statusController.getWallPayload()));
    
  router.get("/get-status", (request, response) => 
    response.status(200).json(statusController.getStatusForClient()));
  
  return router;
}