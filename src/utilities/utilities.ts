import Logger from '../services/logger';


/**
 * Utility functions
 */
export default class Utilities {

  /**
   * Sleep for a specified number of milliseconds
   * 
   * @param ms - The number of milliseconds to sleep
   * @returns a promise
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * Fetch a URL with a retry
   * 
   * @param url - The URL to fetch
   * @param options - Options such as the method and headers
   * @param logLabel - The label to use for logs
   * 
   * @returns a promise for the fetch
   */
  public static async fetchWithRetry(url: string, options: RequestInit, logLabel: string): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (firstError: any) {
      Logger.debug(`${logLabel} failed because ${firstError.name}: ${firstError.message}, retrying`);
      await this.sleep(1000);  // Give the site a chance to recover before hitting it again
      try {
        return await fetch(url, options);
      } catch (secondError: any) {
        throw new Error(`${logLabel} failed after retry because ${secondError.name}: ${secondError.message}`);
      }
    }
  }
}