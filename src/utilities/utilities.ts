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
    } catch (firstError: unknown) {
      const firstErrorMessage = firstError instanceof Error ? `${firstError.name}: ${firstError.message}` : String(firstError);
      Logger.debug(`${logLabel} failed because ${firstErrorMessage}, retrying`);
      await this.sleep(1000);  // Give the site a chance to recover before hitting it again
      try {
        return await fetch(url, options);
      } catch (secondError: unknown) {
        const secondErrorMessage = secondError instanceof Error ? `${secondError.name}: ${secondError.message}` : String(secondError);
        throw new Error(`${logLabel} failed after retry because ${secondErrorMessage}`);
      }
    }
  }
}