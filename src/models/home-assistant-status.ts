/**
 * Home Assistant Status
 * 
 * 
 */
export class HomeAssistantStatus {
  public static readonly EMPTY_STATUS: HomeAssistantStatus = new HomeAssistantStatus('', '', '');
  public static readonly ERROR_STATUS: HomeAssistantStatus = new HomeAssistantStatus('ERROR', 'ERROR', 'ERROR');
    
  
  public washerText: string = '';
  public dryerText: string = '';
  public temperatureText: string = '';
  

  // Constructors
  constructor(washerText: string, dryerText: string, temperatureText: string) {
    this.washerText = washerText;
    this.dryerText = dryerText;
    this.temperatureText = temperatureText;
  }


  public static fromApi(state: any): HomeAssistantStatus {
    return new HomeAssistantStatus(state.Washer, state.Dryer, state.Temperature);
  }
}
  
  
//module.exports = HomeAssistantStatus;