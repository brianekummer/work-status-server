/**
 * Log Service
 * 
 * This is intentionally a module and not a class so that it acts like a
 * singleton, and it works inside status-worker, which runs in a different
 * thread.
 */

LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};

let logLevel = LOG_LEVELS.ERROR;

/**
 * TODO- document if keeping this
 */
setLogLevelByText = (logLevelAsText) => {
  logLevel = LOG_LEVELS[ logLevelAsText.toUpperCase() ];
  log(LOG_LEVELS.INFO, `Log level is ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] == logLevel)}/${logLevel}`);
};


/**
 * TODO- document if keeping this
 */
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