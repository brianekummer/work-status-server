/**
 * Log Service
 * 
 * This is intentionally a module and not a class so that it acts like a
 * singleton, and it works inside status-worker, which runs in a different
 * thread.
 * 
 * Setting the log level by an environment variable means the log level
 * gets set properly no matter which process this is run from.
 */

LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};

logLevelText = process.env.LOG_LEVEL || 'ERROR';
logLevel = LOG_LEVELS[ logLevelText ];


/**
 * TODO- document if keeping this
 */
log = (level, message) => {
  if (level >= logLevel) {
    console.log(message);
  }   
};


log(LOG_LEVELS.INFO, `Log level is ${logLevelText}/${logLevel}`);


module.exports = {
  LOG_LEVELS,
  log
};