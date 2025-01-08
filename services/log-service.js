/**
 * Log Service
 * 
 * My exceptionally basic log service
 * 
 * This is intentionally a module and not a class so that it acts like a
 * singleton, and it works inside status-worker, which runs in a different
 * thread. 
 *   - Setting the log level by an environment variable makes it easy for 
 *     the log level to get set for the instance of the logger instantiated 
 *     by status-worker.
 */

LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};

logLevelText = process.env.LOG_LEVEL || 'ERROR';
logLevel = LOG_LEVELS[ logLevelText ];


/**
 * Log a message when the specified level is >= the log level
 */
log = (level, message) => {
  if (level >= logLevel) {
    console.log(message);
  }   
};


// When this is used, log the log level
log(LOG_LEVELS.INFO, `Log level is ${logLevelText}/${logLevel}`);


module.exports = {
  LOG_LEVELS,
  log
};