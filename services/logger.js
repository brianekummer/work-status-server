/**
 * Logger
 * 
 * Using Winston for a simple logger
 * 
 * This is intentionally a module and not a class so that it acts like a
 * singleton, and it works inside status-worker, which runs in a different
 * thread. 
 *   - Setting the log level by an environment variable makes it easy for 
 *     the log level to get set for the instance of the logger instantiated 
 *     by status-worker.
 * 
 * Winston log levels are (quote from https://www.npmjs.com/package/winston):
 *   Logging levels in winston conform to the severity ordering specified by
 *   RFC5424: severity of all levels is assumed to be numerically ascending 
 *   from most important to least important.
 *     const levels = {
 *       error: 0,
 *       warn: 1,
 *       info: 2,
 *       http: 3,
 *       verbose: 4,
 *       debug: 5,
 *       silly: 6
 *      };
 */

const winston = require('winston');
const fs = require('fs');


const timezonedTimestamp = () => 
  new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });


const logger = winston.createLogger({
  level: (process.env.LOG_LEVEL || 'error').toLowerCase(),
  format: winston.format.combine(
    winston.format.timestamp({
      format: timezonedTimestamp 
    }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),

    // Log to file, either in the linux folder /var/log, or the project folder
    new winston.transports.File({ 
      filename: (fs.existsSync('/var/log') ? '/var/log/' : '') + 'work-status-server.log' 
    })
  ]
});

module.exports = logger;