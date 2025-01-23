/**
 * Home Assistant Status
 * 
 * 
 */
class HomeAssistantStatus {
  static EMPTY_STATUS = new HomeAssistantStatus(null, null, null);
  static ERROR_STATUS = new HomeAssistantStatus('ERROR', 'ERROR', 'ERROR');
  static fromApi = (state) => {
    return new HomeAssistantStatus(state.Washer, state.Dryer, state.Temperature);
  }
    
  
  washerText = '';
  dryerText = '';
  temperatureText= '';
  
    
  constructor(washerText, dryerText, temperatureText) {
    this.washerText = washerText;
    this.dryerText = dryerText;
    this.temperatureText = temperatureText;
  }

  // TODO- Having fns in my models causes issues passing status into worker.postMessage
  //toStringDebug = () => `${this.washerText}/${this.dryerText}/${this.temperatureText}`;
}
  
  
module.exports = HomeAssistantStatus;