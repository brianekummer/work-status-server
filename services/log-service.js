// TODO- explain that am intentionally not making this a class so it acts like a singleton,
// and I am able to make it work with status-worker, which runs in a different thread of something, not sure,
// need to look up details so I can explain it here

LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};

let logLevel = LOG_LEVELS.ERROR;

setLogLevelByText = (logLevelAsText) => {
  logLevel = LOG_LEVELS[ logLevelAsText.toUpperCase() ];
  log(LOG_LEVELS.INFO, `Log level is ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] == logLevel)}/${logLevel}`);
};

log = (level, message) => {
  if (level >= logLevel) {
    console.log(message);
  }   
};

module.exports = {
  LOG_LEVELS,
  setLogLevelByText,
  log
};