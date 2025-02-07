/**
 * Logger
 * 
 * Using Winston for a simple Logger
 * 
 * This is intentionally a module and not a class so that it acts like a
 * singleton, and it works inside status-worker, which runs in a different
 * thread. 
 *   - Setting the log level with an environment variable makes it easy for 
 *     the log level to get set for the instance of the Logger instantiated 
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
 *     };
 */
import winston from 'winston';
import 'winston-daily-rotate-file';
import fs from 'fs';


// Generate timestamp in New York timezone
const timezonedTimestamp = (): string => 
  new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', 
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  } as Intl.DateTimeFormatOptions);

  
// Define file logging transport, set log directory to the project folder if /var/log doesn't exist
const logDir = fs.existsSync('/var/log') ? '/var/log/' : '';
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: `${logDir}work-server-status.%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxFiles: '10d'
});


const Logger = winston.createLogger({
  level: (process.env.LOG_LEVEL || 'error').toLowerCase(),
  format: winston.format.combine(
    winston.format.timestamp({ format: timezonedTimestamp }),
    winston.format.printf(({ timestamp, level, message }) => 
      `${timestamp} [${level}]: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    fileRotateTransport
  ]
});


Logger.on('error', (err: unknown) => {
  console.error('Error with logging:', err);   // eslint-disable-line no-console
});


// Export the Logger as default
export default Logger;