const fs = require('fs');
const csv = require('csv-parser');
const watch = require('node-watch');
const logger = require('./logger');


/**
 * Status Condition Service Service
 * 
 * Maintains an up-to-date copy of the conditions file and provides logic
 * for determining which condition matches.
 */
class StatusConditionService {
  #STATUS_CONDITIONS_FILENAME = 'status-conditions.csv';

  statusConditions = null;


  /**
   * Constructor
   * 
   * Reads the conditions from file. The file is watched and is re-read every
   * time it changes, with changes taking effect the next polling cycle.
   */
  constructor() {
    this.statusConditions = this.getStatusConditions();

    watch(this.#STATUS_CONDITIONS_FILENAME, (evt, name) => {
      logger.debug(`${name} changed, so re-reading it`);
      this.statusConditions = this.getStatusConditions();
    });
  };

  /**
   * Read status conditions from a CSV into a usable JSON object
   *
   * Notes
   *   - The condition in "mapHeaders" is because each line starts with a
   *     pipe delimiter and causes a blank column to be added
   *   - The "mapHeaders" and "mapValues" use "trim" to get rid of all the 
   *     whitespace I added in status-conditions for formatting purposes
   */
  getStatusConditions = () => {
    let results = [];
    fs.createReadStream(this.#STATUS_CONDITIONS_FILENAME)
      .pipe(csv({
          separator: '|',
          skipComments: true,
          mapHeaders: ({ header, index }) => header === '' ? null : header.trim(),
          mapValues: ({ header, index, value }) => value.trim()
        }))
      .on('data', (data) => results.push(data))
    return results;
  };


  /**
   * Decides if an actual value matches the condition
   *   - Condition value of null or empty string matches any value
   *   - Condition value of * matches any non-empty value
   */
  matchesCondition = (conditionValue, actualValue) => {
    return (conditionValue == null || conditionValue === '' || conditionValue === actualValue)
           || (conditionValue === '*' && actualValue != null && actualValue !== '');
  };


  /*
   * Returns the first condition that matches my current status
   */
  getMatchingCondition = (workSlackStatus, homeSlackStatus) => {
    try {
      return this.statusConditions.find(evaluatingStatus => 
        this.matchesCondition(evaluatingStatus.conditions_work_emoji, workSlackStatus.emoji) 
        && this.matchesCondition(evaluatingStatus.conditions_work_presence, workSlackStatus.presence)
        && this.matchesCondition(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji)
        && this.matchesCondition(evaluatingStatus.conditions_home_presence, homeSlackStatus.presence));

    } catch (ex) {
      logger.error(`ERROR in StatusConditionService.getMatchingCondition(): ${ex}`);
    }
  }
};


module.exports = StatusConditionService;