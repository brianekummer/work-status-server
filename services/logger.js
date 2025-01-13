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
require('winston-daily-rotate-file');
const fs = require('fs');


// Generate timestamp in New York timezone
const timezonedTimestamp = () => 
  new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

// Determine log directory (defaults to the project folder if /var/log doesn't exist)
const logDir = fs.existsSync('/var/log') ? '/var/log/' : '';
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: `${logDir}work-server-status.%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxFiles: '10d',
});


const logger = winston.createLogger({
  level: (process.env.LOG_LEVEL || 'error').toLowerCase(),
  format: winston.format.combine(
    winston.format.timestamp({ format: timezonedTimestamp }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    fileRotateTransport
  ]
});


logger.on('error', (err) => {
  console.error('Error with logging:', err);
});


module.exports = logger;