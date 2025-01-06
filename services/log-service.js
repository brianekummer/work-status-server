const LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};

let _logLevel;

const setLogLevel = (levelAsString) => {
  _logLevel = LOG_LEVELS[ levelAsString.toUpperCase() ];
  log(LOG_LEVELS.INFO, `Log level is ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] == _logLevel)}`);
};

const log = (level, message) => {
  if (level >= _logLevel) {
    console.log(message);
  }   
};

module.exports = {
  LOG_LEVELS,
  setLogLevel,
  log
}