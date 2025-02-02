import fs from 'fs';
import csv from 'csv-parser';
import watch from 'node-watch';

import Logger from './logger';
import SlackStatus from '../models/slack-status';
import StatusCondition from '../models/status-condition';


/**
 * Status Condition Service
 * 
 * This service is responsible for
 *   - Maintaining an up-to-date copy of status-conditions.csv
 *   - Providing logic for determining which status condition matches
 */
export default class StatusConditionService {
  private readonly STATUS_CONDITIONS_FILENAME: string = '../../files/status-conditions.csv';


  private statusConditions: StatusCondition[] = [];


  /**
   * Constructor
   * 
   * @param statusConditionsFilename - The filename of the status conditions csv
   */
  constructor(private readonly statusConditionsFilename: string) {
    // Read the csv
    this.readStatusConditions()
      .then((conditions) => {
        this.statusConditions = conditions;
        Logger.info('Initial status conditions loaded.');
      })
      .catch((ex) => {
        Logger.error(`StatusConditionService.constructor(), error loading initial status conditions: ${ex}`);
      });

    // Watch for file changes and re-read when necessary
    watch(
      this.statusConditionsFilename,
      { recursive: false },
      async (name: string) => {
        Logger.debug(`StatusConditionService.constructor(), ${name} changed, re-reading it`);
        try {
          this.statusConditions = await this.readStatusConditions();
        } catch (error) {
          Logger.error(`StatusConditionService.constructor(), Error re-reading ${name}, ${error}`);
        }
      }
    );
  }


  /**
   * Reads status conditions from a CSV file into an array of StatusCondition objects
   * 
   * @returns a promise of an array of StatusCondition objects
   */
  private readStatusConditions(): Promise<StatusCondition[]> {
    return new Promise((resolve, reject) => {
      const results: StatusCondition[] = [];

      fs.createReadStream(this.STATUS_CONDITIONS_FILENAME)
        .pipe(
          csv({
            separator: '|',
            skipComments: true,
            mapHeaders: ({ header }: { header: string; index: number }) => (header === '' ? null : header.trim()),
            mapValues: ({ value }: { header: string; index: number; value: string }) => value.trim(),
          }),
        )
        .on('data', (data: StatusCondition) => results.push(data as StatusCondition))
        .on('end', () => resolve(results))
        .on('error', (error: unknown) => reject(error));
    });
  }


  /**
   * Checks if an actual value matches the condition
   *   - Condition value of null or empty string matches any value
   *   - Condition value of * matches any non-empty value
   * 
   * @param conditionValue - The value in the condition
   * @param actualValue - The actual value
   * @returns true if the actual value matches the condition
   */
  public matchesCondition(conditionValue: string, actualValue: string): boolean {
    return (
      conditionValue == null || 
      conditionValue === '' || 
      conditionValue === actualValue || 
      (conditionValue === '*' && actualValue != null && actualValue !== '')
    );
  }


  /**
   * Returns the first status condition that matches my current work and home 
   * Slack status and presence
   *
   * @param workSlackStatus - The status from my work Slack account
   * @param homeSlackStatus - The status from my home Slack account
   * @returns the first matching StatusCondition
  */
  public getFirstMatchingCondition(
    workSlackStatus: SlackStatus,
    homeSlackStatus: SlackStatus
  ): StatusCondition | undefined {
    try {
      return this.statusConditions.find((evaluatingStatus) =>
        this.matchesCondition(evaluatingStatus.conditionsWorkEmoji, workSlackStatus.emoji) &&
        this.matchesCondition(evaluatingStatus.conditionsWorkPresence, workSlackStatus.presence) &&
        this.matchesCondition(evaluatingStatus.conditionsHomeEmoji, homeSlackStatus.emoji) &&
        this.matchesCondition(evaluatingStatus.conditionsHomePresence, homeSlackStatus.presence)
      );
    } catch (ex) {
      Logger.error(`StatusConditionService.getFirstMatchingCondition(), ERROR: ${ex}`);
      return undefined;
    }
  }
}
