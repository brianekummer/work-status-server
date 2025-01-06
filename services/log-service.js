// TODO- not duplicate this in server.js
const LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};
var LOG_LEVEL = LOG_LEVELS[ ( process.argv.length > 2 ? process.argv[2].toUpperCase() : "ERROR")];
const log = (level, message) => {
  if (level >= LOG_LEVEL) {
    console.log(message);
  }   
};

module.exports = {
  log    
}