// Singleton

class LogService {
  static instance;

  LOG_LEVELS = {
    DEBUG: 0,
    INFO:  1,
    ERROR: 2
  };

  constructor() {
    if (LogService.instance) {
      return LogService.instance;
    }

    this.logLevel = this.LOG_LEVELS.ERROR;
  
    LogService.instance = this;
  }

  setLogLevel = (logLevelAsString) => {
    this.logLevel = this.LOG_LEVELS[ logLevelAsString.toUpperCase() ];
    this.log(this.LOG_LEVELS.INFO, `Log level is ${Object.keys(this.LOG_LEVELS).find(key => this.LOG_LEVELS[key] == this.logLevel)}/${this.logLevel}`);
  };

  log = (level, message) => {
    if (level >= this.logLevel) {
      console.log(message);
    }   
  };
}

module.exports = LogService;