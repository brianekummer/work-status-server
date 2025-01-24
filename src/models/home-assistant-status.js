/**
 * Home Assistant Status
 * 
 * 
 */
class HomeAssistantStatus {
  static EMPTY_STATUS = new HomeAssistantStatus(null, null, null);
  static ERROR_STATUS = new HomeAssistantStatus('ERROR', 'ERROR', 'ERROR');
    
  
  washerText = '';
  dryerText = '';
  temperatureText= '';
  

  // Constructors
  constructor(washerText, dryerText, temperatureText) {
    this.washerText = washerText;
    this.dryerText = dryerText;
    this.temperatureText = temperatureText;
  }


  static fromApi = (state) => {
    return new HomeAssistantStatus(state.Washer, state.Dryer, state.Temperature);
  }
}
  
  
module.exports = HomeAssistantStatus;