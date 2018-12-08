
"use strict";

var Service, Characteristic, HomebridgeAPI;
var CommunityTypes;
var fetch = require("node-fetch");


module.exports = function(homebridge) {
    console.log("BOMgovau says: homebridge API version: " + homebridge.version);
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
    CommunityTypes = require('hap-nodejs-community-types')(homebridge); //For Pressure sensor.
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory("homebridge-BOMgovau", "BOMgovau", BOMgovau);
}


function BOMgovau(log,config,api){
    var pjson = require('./package.json');
    this.version=pjson['version'];
    this.name = "BOMgovau";   //Initialise as something.
    this.log = log;
    this.config = config;
    this.lastUpdateTime=0;
    this.BOMdataExpires=0;

    this.stationName=this.config['name'];
    this.name = this.stationName;
/*
    if (!this.stationName){
        this.stationName="Unnamed Station";
    }
*/
    this.stationURL = this.config['stationURL'];
    if (!this.stationURL) {
        this.log("[BOM gov au] No station URL specified. You probably don't want the ACT, but it'll be a nice demo.");
        this.stationURL = "http://reg.bom.gov.au/fwo/IDN60903/IDN60903.94926.json";
        this.stationName="Demo station (Canberra)";        
    }


    this.log("[BOM gov au] Station Name is %s",this.stationName);    
    this.log("[BOM gov au] Station URL is %s",this.stationURL);
    
    this._services = [];

    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, "Stephen Cohen")
      .setCharacteristic(Characteristic.Model, "Homebridge-BOMgovau v"+this.version)
      .setCharacteristic(Characteristic.FirmwareRevision, "v"+this.version)
      .setCharacteristic(Characteristic.SerialNumber, "Station: "+this.stationName);


//Temperature Service        
    this.temperatureService = new Service.TemperatureSensor(this.name);
    this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({minValue: -100, maxValue: 100});
    this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getStateTemperature.bind(this));
    this.temperatureService.addCharacteristic(CommunityTypes.AtmosphericPressureLevel); //Add pressure characteristic.

    //Flags for later debugging.
    this.temperatureService.addOptionalCharacteristic(Characteristic.StatusFault); 
    this.temperatureService.addOptionalCharacteristic(Characteristic.StatusActive);
    this.temperatureService.setCharacteristic(Characteristic.StatusActive,false);

//Apparent Temp
    this.apparentTempService = new Service.TemperatureSensor(this.name);
    this.apparentTempService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({minValue: -100, maxValue: 100})
        .on('get', this.getStateTemperature.bind(this));

//Humidity Service
    this.humidityService = new Service.HumiditySensor(this.name);
    this.humidityService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getStateHumidity.bind(this));
    this.humidityService.addOptionalCharacteristic(Characteristic.StatusFault);
    this.humidityService.addOptionalCharacteristic(Characteristic.StatusActive);
    this.humidityService.setCharacteristic(Characteristic.StatusActive,false);

    this.obs={'air_temp':0,'press':0,'rel_hum':0,'apparent_t':0};


    if (!this.config.updateFrequency) {
        this.config.updateFrequency = 1000*45; //Force a 45 min refresh. This should be unnecessary as we dynamically time the updates from BOM.
    }
    this.updateObservations(); //First update of the system.
}


BOMgovau.prototype.updateObservations = function() {
    this.log("[BOM gov au] updateObservations running");
    //If we haven't done an update yet, or the updateFrequency has elapsed, or the data has expired.
    var now=new Date();
    var curTime=now.getTime();
    var timeSinceUpdate=curTime-this.lastUpdateTime;
    this.log("Current Time is "+curTime+", lastUpdatetime:"+this.lastUpdateTime+" timeSinceLastUpdate:"+timeSinceUpdate);

    if ((this.lastUpdateTime == null) || (timeSinceUpdate>=this.config.updateFrequency) || (curTime>=this.BOMdataExpires)){
        this.log("Updating observations from BOM. [timeSinceUpdate="+timeSinceUpdate+"; BOMDdataExpires="+this.BOMdataExpires+" Curtime="+curTime+"]");
        fetch(this.stationURL)
          .then(response => {
            response.json().then(json => {
                this.obs=json['observations']['data'][0];
                this.log("Observations retrieved from BOM.gov.au");
                
                var d=new Date();
                this.lastUpdateTime=d.getTime(); //UTC
                var BOMyear=parseInt(this.obs.aifstime_utc.substr(0,4));
                var BOMmonth=parseInt(this.obs.aifstime_utc.substr(4,2))-1; //Months start at 0, not 1.
                var BOMday=parseInt(this.obs.aifstime_utc.substr(6,2));
                var BOMhour=this.obs.aifstime_utc.substr(8,2);
                var BOMmin=this.obs.aifstime_utc.substr(10,2);
                var BOMsec=this.obs.aifstime_utc.substr(12,2);
                var BOMdataDateTime=new Date(Date.UTC(BOMyear,BOMmonth,BOMday,BOMhour,BOMmin,BOMsec)); 
                
                var BOMdataAge=d.getTime()-BOMdataDateTime.getTime()
                
                // bomUpdates every 30 mins = 30 * 60 * 1000 ms. 
                this.BOMdataExpires=BOMdataDateTime.getTime()+30*60*1000;
                this.log("BOM data will expire at "+this.BOMdataExpires.toString()+" which is in "+(this.BOMdataExpires-d.getTime())/1000/60+"min")
                
                
                // update all properties.
                this.temperatureService.setCharacteristic(Characteristic.StatusActive,true);
                this.temperatureService.setCharacteristic(Characteristic.StatusFault,false);
                this.temperatureService.setCharacteristic(Characteristic.CurrentTemperature, isNaN(this.obs.air_temp) ? 0 : this.obs.air_temp);
                this.temperatureService.setCharacteristic(CommunityTypes.AtmosphericPressureLevel, isNaN(this.obs.press) ? 0 : this.obs.press);

                this.apparentTempService.setCharacteristic(Characteristic.CurrentTemperature, isNaN(this.obs.apparent_t) ? 0 : this.obs.apparent_t);

                this.humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity, isNaN(this.obs.rel_hum) ? 0 : this.obs.rel_hum);
                this.humidityService.setCharacteristic(Characteristic.StatusActive,true);
                this.humidityService.setCharacteristic(Characteristic.StatusFault,false);
            
                this.informationService.setCharacteristic(Characteristic.SerialNumber, "Station:"+this.stationName+" | "+this.obs.local_date_time);

                this.lastUpdateTime=curTime; 
                                
            });
          })
          .catch(error => {
                this.temperatureService.setCharacteristic(Characteristic.StatusFault,true);
                this.humidityService.setCharacteristic(Characteristic.StatusFault,true);
            this.log(error);
    
          });

    } else {
        this.log("BOM update period has not elapsed. BOM data expires at "+this.BOMdataExpires);
    }

}

BOMgovau.prototype.getStateHumidity = function(callback) {
    this.updateObservations();
   	this.log("Setting humidity to "+this.obs.rel_hum);
    callback(null,this.obs.rel_hum);
}

BOMgovau.prototype.getStateTemperature = function(callback) {
    this.updateObservations();
    this.log("Setting temperature to "+this.obs.air_temp);
    callback(null,this.obs.air_temp);
}
	
BOMgovau.prototype.getServices = function(callback){
    return [this.informationService,this.temperatureService,this.humidityService]; //Todo: enable user to specify true/false for apparent temp in config file; then load it (or not) here.
}


/* //I forget why I needed this. Commented out for now...
if (!Date.now) {
    Date.now = function() { return new Date().getTime(); }
}
*/
