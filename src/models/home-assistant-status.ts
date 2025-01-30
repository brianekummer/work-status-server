/**
 * Home Assistant Status
 * 
 * Defines the status retrieved from Home Assistant
 */
export default class HomeAssistantStatus {
  public static readonly EMPTY_STATUS: HomeAssistantStatus = new HomeAssistantStatus('', '', '');
  public static readonly ERROR_STATUS: HomeAssistantStatus = new HomeAssistantStatus('ERROR', 'ERROR', 'ERROR');
     

  constructor(
    public readonly washerText: string,
    public readonly dryerText: string,
    public readonly temperatureText: string) {}


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromApi(state: any): HomeAssistantStatus {
    return new HomeAssistantStatus(state.Washer, state.Dryer, state.Temperature);
  }
}