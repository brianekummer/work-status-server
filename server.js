/******************************************************************************
  Server side code for Home Working Status


  TODO- Move command line arguments into env vars


  GENERAL STRATEGY
    - Timer runs every 60 seconds and gets my Slack status for work and home
      accounts. It calculates my new status to display at home, and if it's 
      changed, it saves it to a file ("status.json").
    - Web pages periodically (every 10 seconds) ask for my latest status. This
      call returns the contents of that file so they can show my latest status.

  REQUIREMENTS
    NPM Packages
      express............For coding simple web pages
      node-fetch.........For simplifying http commands
      node-json-minify...Since comments are invalid syntax in JSON, they need to be 
                         stripped out of the status conditions matrix
      luxon..............For date formatting, instead of momentJS
    Command-line 
      argument 2.........Must be the Slack security tokens for my work and home
                         and accounts in a csv, like this: 
                         <work_token>,<home_token>
      argument 3.........Home Assistant url
      argument 4.........Home Assistant token                         

  OPTIONAL
    command-line
      argument 5........The logging level- can be DEBUG|INFO|ERROR

******************************************************************************/

// Require packages
const express = require("express");
const mustacheExpress = require("mustache-express");
const fs = require("fs");
const fetch = require("node-fetch");
const app = express();
var { DateTime } = require('luxon');
JSON.minify = require("node-json-minify");

const STATUS_FILENAME = "status.json";

// Constants for working with the matrix of conditions for each status
const STATUS_CONDITIONS = {
  FILENAME: "status-conditions.json",
  COLUMNS: {
    STATUS_NAME:                0,
    RESULT_SCREEN:              1,
    RESULT_NEW_STATUS_EMOJI:    2,
    RESULT_NEW_STATUS_TEXT:     3,
    RESULT_NEW_STATUS_TIMES:    4,
    CRITERIA_WORK_STATUS_EMOJI: 5,
    CRITERIA_WORK_PRESENCE:     6,
    CRITERIA_HOME_STATUS_EMOJI: 7,
    CRITERIA_HOME_PRESENCE:     8
  },
  TIME_TEXT: {
    START: "Started @ (start)",
    START_TO_END: "(start) - (status_expiration)"
  }
};

// My Slack security tokens
let WORK = 0;
let HOME = 1;
let SLACK_SECURITY_TOKENS = process.argv[2].split(",");


let HOME_ASSISTANT_URL = process.argv[3];
let HOME_ASSISTANT_TOKEN = process.argv[4];
console.log(HOME_ASSISTANT_URL);
console.log(HOME_ASSISTANT_TOKEN);

// My simple home grown logging
const LOG_LEVELS = {
  DEBUG: 0,
  INFO:  1,
  ERROR: 2
};
var LOG_LEVEL = LOG_LEVELS[ ( process.argv.length > 5 ? process.argv[5].toUpperCase() : "ERROR")];
let log = (level, message) => {
  if (level >= LOG_LEVEL) {
    console.log(message);
  }   
};
log(LOG_LEVELS.INFO, `Log level is ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] == LOG_LEVEL)}`);

// Keep the current status in memory
let currentStatus = {
  screen: null,
  emoji:  null,
  text:   null,
  times:  null,
  statusTimesTemplate: null,
  statusStartTime: null,
  workStatusExpiration: null,
  homeStatusExpiration: null,
  homeAssistant: { 
    url: null, 
    token: null 
  }
};



/***********************  Start of Node Configuration  ***********************/
const port = 3000;        // Cannot be < 1024 (ie. 80) w/o root access

// Register mustache extension withe mustache express
app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Expose only the necessary files
app.use(express.static(`${__dirname}/public`));

// Hack to prevent "certificate has expired" issue. Note suitable for production,
// but ok for me here. https://github.com/node-fetch/node-fetch/issues/568
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';

// "http://xxxxx:3000"  without a path sends the status page
app.get("/", (request, response) => {
  let showUtc = false;    
  if (typeof request.query.showutc === 'string') {
    showUtc = (request.query.showutc.toLowerCase() == 'true'); 
  }
  
  response.render('status', {"showUtc": showUtc});
});

// Call from status.html asking for latest status
app.get('/get-status', (request, response) => response.status(200).json(getStatus()));

app.listen(port, () => log(LOG_LEVELS.INFO, `Listening on port ${port}`));
/************************  End of Node Configuration  ************************/




/******************************************************************************
  Sleep x milliseconds
******************************************************************************/
const sleep = ms => {
  var waitTill = new Date(new Date().getTime() + ms);
  while(waitTill > new Date()){}
};


/******************************************************************************
  Read a file synchronously, with retry logic
    filename..........Filename, including path
    encoding..........File encoding
    numberOfRetries...Number of retries
  Returns the data read from the file
******************************************************************************/
const readFileSyncWithRetry = (filename, encoding = "utf8", numberOfRetries = 3) => {
  let data = null;
  let tryNumber = 1;
  do {
    try {
      data = fs.readFileSync(filename, encoding);
    }
    catch (ex) {
      if (tryNumber > numberOfRetries) throw ex;
      sleep(100 + tryNumber*150);  // 250, 400, 550, 700 ms
      tryNumber += 1;
    }
  } while (data == null);
    
  return data;
};


/******************************************************************************
  Save a file synchronously, with retry logic
    filename..........Filename, including path
    data..............The data to write
    encoding..........File encoding
    numberOfRetries...Number of retries
  Returns nothing
******************************************************************************/
const saveFileSyncWithRetry = (filename, data, encoding = "utf8", numberOfRetries = 3) => {
  let success = false;
  let tryNumber = 1;
  do {
    try {
      fs.writeFileSync(filename, data, encoding);
      success = true;
    }
    catch (ex) {
      if (tryNumber > numberOfRetries) throw ex;
      sleep(100 + tryNumber*150);  // 250, 400, 550, 700 ms
      tryNumber += 1;
    }
  } while (!success);
};


/******************************************************************************
  Get my status. This is read from the JSON file.
  Also return any Home Assistant info that the browser needs to call HA.

  Returns the status as a JSON object
******************************************************************************/
const getStatus = () => {
  let status = JSON.parse(readFileSyncWithRetry(STATUS_FILENAME));
  let rightNow = DateTime.now();
  
  // I had problems with Luxon in Node when running this on a phone. I should
  // be able to get the short offset name (i.e. "EDT") using 
  //   DateTime.now().toFormat("ZZZZ")
  // but instead, I got something like "Monday, March 1, 2021, 9:56 PM", so I
  // had to just parsing it out of the JavaScript printed date:
  //   Mon Mar 01 2021 22:39:15 GMT-0500 (EST)
  //
  // But since moving this web server off a phone, I don't have that problem 
  // any more.
  let shortOffset = DateTime.now().toFormat("ZZZZ");

  return {
    screen: status.screen,
    emoji: `/images/${status.emoji}.png`,
    text: status.text,
    times: status.times,
    timestamps: {
      local12: rightNow.toLocaleString(DateTime.TIME_SIMPLE),
      local24: rightNow.toLocaleString(DateTime.TIME_24_SIMPLE),
      localShortOffset: shortOffset,
      utc: rightNow.toUTC().toFormat("HH:mm")
    },
    homeAssistant: {
      url: HOME_ASSISTANT_URL,
      token: HOME_ASSISTANT_TOKEN
    }
  };
};


/******************************************************************************
  Decide if the status has changed
******************************************************************************/
const statusHasChanged = (currentStatus, latestStatus) => {
  return (currentStatus == null || 
          currentStatus.text != latestStatus.text || 
          currentStatus.workStatusExpiration != latestStatus.workStatusExpiration ||
          currentStatus.homeStatusExpiration != latestStatus.homeStatusExpiration);
};


/******************************************************************************
  Process any status change. This is executed on the server every x seconds.

  It gets my Slack status for my work and home accounts and calculates my  
  status to display at home. If that status has changed, the save it so that 
  it can be read by the web pages.
******************************************************************************/
const processAnyStatusChange = () => {
  Promise.all([
	getSlackStatus(SLACK_SECURITY_TOKENS[WORK]),
	getSlackStatus(SLACK_SECURITY_TOKENS[HOME])
  ])
  .then(slackStatuses => {
    let latestStatus = calculateLatestStatus(slackStatuses[WORK], slackStatuses[HOME]);
    if (statusHasChanged(currentStatus, latestStatus)) {
      latestStatus = buildStatusTimes(currentStatus, latestStatus);
      log(LOG_LEVELS.INFO, 
        `Changed status from ${currentStatus.screen}/${currentStatus.emoji}/${currentStatus.text}/${currentStatus.times} => ` +
        `${latestStatus.screen}/${latestStatus.emoji}/${latestStatus.text}/${latestStatus.times}`);
      currentStatus = latestStatus;
      saveFileSyncWithRetry(STATUS_FILENAME, JSON.stringify(latestStatus));
    }
  })
  .catch(ex => {
    log(LOG_LEVELS.ERROR, `ERROR in processAnyStatusChange: ${ex}`);
  });
}


/******************************************************************************
  Get my Slack status for the given account. This includes my status and 
  presence.
  
  Returns a JSON object with my Slack status.
******************************************************************************/
const getSlackStatus = securityToken => {
  let headers = {
    "Content-Type":  "application/x-www-form-urlencoded",
    "Authorization": `Bearer ${securityToken}`  
  };
  return Promise.all([
    fetch("https://slack.com/api/users.profile.get", { method: 'GET', headers: headers}),
    fetch("https://slack.com/api/users.getPresence", { method: 'GET', headers: headers})
  ])
  .then(responses => Promise.all(responses.map(response => response.json())))
  .then(jsonResponses => {
    if (LOG_LEVEL == LOG_LEVELS.DEBUG)
      log(LOG_LEVELS.DEBUG, `Got SLACK for ${securityToken == SLACK_SECURITY_TOKENS[WORK] ? 'WORK' : 'HOME'}\n` +
        `profile=${JSON.stringify(jsonResponses[0])}\n` + 
        `presence=${JSON.stringify(jsonResponses[1])}`);
    else if (LOG_LEVEL == LOG_LEVELS.INFO) 
      log(LOG_LEVELS.INFO, `Got SLACK for ${securityToken == SLACK_SECURITY_TOKENS[WORK] ? 'WORK' : 'HOME'}: ` +
        `${jsonResponses[0].profile.status_emoji} / ` +
        `${jsonResponses[0].profile.status_text} / ` +
        `${jsonResponses[0].profile.status_expiration} / ` +
        `${jsonResponses[1].presence}`);

    // Huddles don't set the emoji, they set "huddle_state" property. For my
    // purposes, changing the emoji to the same as a Slack call is fine.
    if (jsonResponses[0].profile.huddle_state == "in_a_huddle")
        jsonResponses[0].profile.status_emoji = ":slack_call:";

    return Promise.resolve({
      emoji:      jsonResponses[0].profile.status_emoji,
      text:       jsonResponses[0].profile.status_text,
      expiration: jsonResponses[0].profile.status_expiration || 0,
      presence:   jsonResponses[1].presence
    });
  })
  .catch(ex => {
    log(LOG_LEVELS.ERROR, `ERROR in getSlackStatus: ${ex}`);
  });
};


/******************************************************************************
  Decide if an actual value matches the criteria. Criteria values of null and
  empty string match everything. 
******************************************************************************/
const matchesCriteria = (criteriaValue, actualValue) => {
  return (criteriaValue == null || criteriaValue == "" || criteriaValue == actualValue);
};


/******************************************************************************
  Decide if all the criteria match.
******************************************************************************/
const matchesAllCriteria = (evaluatingStatus, workSlackStatus, homeSlackStatus) => {
  return (matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_WORK_STATUS_EMOJI], workSlackStatus.emoji) &&
          matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_WORK_PRESENCE],     workSlackStatus.presence) &&
          matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_HOME_STATUS_EMOJI], homeSlackStatus.emoji) &&
          matchesCriteria(evaluatingStatus[STATUS_CONDITIONS.COLUMNS.CRITERIA_HOME_PRESENCE],     homeSlackStatus.presence));
};


/******************************************************************************
  Calculate the latest status
  
  Reads the status conditions from a JSON file, to simplify updating it. The
  first matching status is used.
******************************************************************************/
const calculateLatestStatus = (workSlackStatus, homeSlackStatus) => {
  let latestStatus = null;

  try {
    // Read status conditions from a file, strip out comments, and parse it
    let statusConditions = JSON.parse(JSON.minify(fs.readFileSync(STATUS_CONDITIONS.FILENAME, "utf8")));

    for (let evaluatingStatus of statusConditions) {
      if (matchesAllCriteria(evaluatingStatus, workSlackStatus, homeSlackStatus)) {

        // Handle when we want both start and end time, but we only have the start time
        let statusTimesTemplate = (evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_TIMES] || "")
          .replace("TIME_TEXT_START_TO_END", STATUS_CONDITIONS.TIME_TEXT.START_TO_END)
          .replace("TIME_TEXT_START",        STATUS_CONDITIONS.TIME_TEXT.START);
        if (statusTimesTemplate == STATUS_CONDITIONS.TIME_TEXT.START_TO_END && workSlackStatus.expiration == 0 && homeSlackStatus.expiration == 0) {
          statusTimesTemplate = STATUS_CONDITIONS.TIME_TEXT.START;
        }

        // Build the latest status
        latestStatus = {
          screen: evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_SCREEN],
          emoji:  evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_EMOJI],
          text:   (evaluatingStatus[STATUS_CONDITIONS.COLUMNS.RESULT_NEW_STATUS_TEXT] || "")
                    .replace("(work_status_text)", workSlackStatus.text)
                    .replace("(home_status_text)", homeSlackStatus.text),
          statusTimesTemplate:  statusTimesTemplate,
          workStatusExpiration: workSlackStatus.expiration,
          homeStatusExpiration: homeSlackStatus.expiration
        };
        
        log(LOG_LEVELS.INFO, `Latest status is now ${latestStatus.screen}/${latestStatus.emoji}/${latestStatus.text}`);
        
        break;
      }
    };
    
    return latestStatus;
  } catch (ex) {
    log(LOG_LEVELS.ERROR, `ERROR in calculateLatestStatus: ${ex}`);
  }
};


/******************************************************************************
  Format the times of the status. The start time only changes when the status
  text changes, so that if I add minutes to my focus time, only the end time 
  changes.
******************************************************************************/
const buildStatusTimes = (currentStatus, latestStatus) => {
  latestStatus.statusStartTime = currentStatus.text != latestStatus.text
    ? DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)
    : currentStatus.statusStartTime;
  latestStatus.times = latestStatus.statusTimesTemplate
    .replace("(start)", latestStatus.statusStartTime)
    .replace("(status_expiration)", 
      DateTime.fromSeconds(latestStatus.workStatusExpiration != 0 ? latestStatus.workStatusExpiration : latestStatus.homeStatusExpiration).toLocaleString(DateTime.TIME_SIMPLE)
    );

  return latestStatus;
};


setInterval(processAnyStatusChange, 30000);
