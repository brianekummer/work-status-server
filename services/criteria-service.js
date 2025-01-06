const fs = require("fs");
const csv = require('csv-parser');
const watch = require("node-watch");

const logService = require("../services/log-service");


class CriteriaService {
  // Constants for working with the array of conditions for each status
  STATUS_CONDITIONS_FILENAME = "status-conditions.csv";


  constructor() {
    this.statusConditions = this.getStatusConditions();

    // Watch for file to change, if it does, then re-read it and changes will take effect on the next polling cycle
    watch(this.STATUS_CONDITIONS_FILENAME, (evt, name) => {
      logService.log(logService.LOG_LEVELS.DEBUG, `${name} changed, so am re-reading it`);
      this.statusConditions = this.getStatusConditions();
    });
  };

  // Read status conditions from a CSV into a usable JSON object
  getStatusConditions = () => {
    let results = [];
    fs.createReadStream(this.STATUS_CONDITIONS_FILENAME)
    .pipe(csv(
      { separator: "|",
        skipComments: true,
        mapHeaders: ({ header, index }) => header === "" ? null : header.trim(),   // ignore '' header from each row starting with |
        mapValues: ({ header, index, value }) => value.trim()
        }
    ))
    .on('data', (data) => {
      results.push(data);
    })
    return results;
  };



  /******************************************************************************
    Decide if an actual value matches the criteria
      - Criteria value of null and empty string match any value
      - Criteria value of * matches any non-empty value
  ******************************************************************************/
  matchesCriteria = (criteriaValue, actualValue) => {
    return (criteriaValue == null || criteriaValue === "" || criteriaValue === actualValue) ||
            (criteriaValue === "*" && actualValue != null && actualValue !== "");
  };


  /*
     TODO
   */
  getMatchingCondition = (workSlackStatus, homeSlackStatus) => {
    try {
      return this.statusConditions.find(evaluatingStatus => 
        this.matchesCriteria(evaluatingStatus.conditions_work_emoji, workSlackStatus.emoji) &&
        this.matchesCriteria(evaluatingStatus.conditions_work_presence, workSlackStatus.presence) &&
        this.matchesCriteria(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji) &&
        this.matchesCriteria(evaluatingStatus.conditions_home_presence, homeSlackStatus.presence));

    } catch (ex) {
      logService.log(logService.LOG_LEVELS.ERROR, `ERROR in getMatchingCondition: ${ex}`);
    }
  }
};

module.exports = CriteriaService;