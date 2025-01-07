module.exports = function(app) {
  const express = require("express")
  let statusController = new (require("../controllers/status-controller"))(app);

  let router = express.Router(); 

  router.get('/favicon.ico', (request, response) => 
    response.status(204).end());

  router.get("/desk", (request, response) => 
    response.render("desk", statusController.getDeskPayload()));
  


  router.get("/wall", (request, response) => {
    response.render("wall", statusController.getWallPayload());
  });
  
  

  router.get("/get-status", (request, response) => 
    response.status(200).json(statusController.getStatusForClient()));

  router.get("/api/get-updates", (request, response) => {
    console.log(`>>> /api/get-updates`);

  // THIS MIGHT HELP : https://blog.bayn.es/real-time-web-applications-with-server-sent-events-pt-1/

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const intervalId = setInterval(() => {
      console.log(`>>> /api/get-updates, writing data`);
      
      response.write(`data: ${JSON.stringify(statusController.getStatusForClient())}\n\n`);
      //response.write('data: {"message": "Hello from SSE!"}\n\n');
    }, 10000); 

    request.on('close', () => {
      clearInterval(intervalId);
      console.log('Client disconnected');
    });
  });

  return router;
}