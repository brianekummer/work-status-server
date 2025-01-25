import fs from 'fs';
import csv from 'csv-parser';
import watch from 'node-watch';
import logger from './logger';
import { SlackStatus } from '../models/slack-status';
import { StatusCondition } from '../models/status-condition';


/**
 * Status Condition Service
 * 
 * Maintains an up-to-date copy of the conditions file and provides logic
 * for determining which condition matches.
 */
export class StatusConditionService {
  private readonly STATUS_CONDITIONS_FILENAME: string = '../../files/status-conditions.csv';

  private statusConditions: StatusCondition[] = [];

  constructor() {
    // Initialize by reading status conditions
    this.readStatusConditions()
      .then((conditions) => {
        this.statusConditions = conditions;
        logger.info('Initial status conditions loaded.');
      })
      .catch((ex) => {
        logger.error(`StatusConditionService.constructor(), error loading initial status conditions: ${ex}`);
      });

    // Watch for file changes and re-read when necessary.
    watch(
      this.STATUS_CONDITIONS_FILENAME,
      { recursive: false },
      async (name: string) => {
        logger.debug(`${name} changed, re-reading it.`);
        try {
          this.statusConditions = await this.readStatusConditions();
        } catch (error) {
          logger.error(`Error re-reading status conditions: ${error}`);
        }
      }
    );
  }

  /**
   * Reads status conditions from a CSV file into an array of StatusCondition objects
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
   * Checks if an actual value matches the condition.
   *   - Condition value of null or empty string matches any value.
   *   - Condition value of * matches any non-empty value.
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
   * Returns the first condition that matches the current statuses.
   */
  public getMatchingCondition(workSlackStatus: SlackStatus, homeSlackStatus: SlackStatus): StatusCondition | undefined {
    try {
      return this.statusConditions.find((evaluatingStatus) =>
        this.matchesCondition(evaluatingStatus.conditions_work_emoji, workSlackStatus.emoji) &&
        this.matchesCondition(evaluatingStatus.conditions_work_presence, workSlackStatus.presence) &&
        this.matchesCondition(evaluatingStatus.conditions_home_emoji, homeSlackStatus.emoji) &&
        this.matchesCondition(evaluatingStatus.conditions_home_presence, homeSlackStatus.presence)
      );
    } catch (ex) {
      logger.error(`StatusConditionService.getMatchingCondition(), ERROR: ${ex}`);
      return undefined;
    }
  }
}
