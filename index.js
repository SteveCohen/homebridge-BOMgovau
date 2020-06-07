// 0.1.4: Adds customisable updateInterval; minor cleanup, enable/disable sensors, initial fakegato code (coming soon)

"use strict";

var Service, Characteristic, HomebridgeAPI;
var CommunityTypes;
var FakeGatoHistoryService;
const moment = require('moment');
var fetch = require("node-fetch");

  
module.exports = function(homebridge) {
  console.log("BOMgovau says: homebridge API version: " + homebridge.version);
  
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  FakeGatoHistoryService = require('fakegato-history')(homebridge);
  CommunityTypes = require('hap-nodejs-community-types')(homebridge); //For Pressure sensor.
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory("homebridge-BOMgovau", "BOMgovau", BOMgovau);

}


function BOMgovau(log,config,api){
    var pjson = require('./package.json');
    this.version=pjson['version'];
    this.name = "BOMgovau";
    this.log = log;
    this.config = config;
    this.updateInterval=this.config['updateInterval'] | 30*60*1000;  //How often to update from BOM site.
    this.historyrefresh=3; //How often to refresh the data in fakegato

    this.BOMdataExpires=0;

    this.stationName=this.config['name'];
    this.name = this.stationName;

    this.sensors={}
    //Determine which sensors to enable. If the sensor is not listed in the 'sensors' array it will be enabled by default. This means you can simply specify those to DISABLE. e.g. setting humidity=false
    var possibleSensors=['temperature','humidity','apparentTemp'];
    this.log("[BOM gov au] Enabling sensors")
    for (var i = 0; i < possibleSensors.length; i++) {
        var sensor=possibleSensors[i];
        if (this.config['sensors'][sensor]===undefined){
            this.sensors[sensor]=true;   
        }
        else {
            this.sensors[sensor]=this.config['sensors'][sensor]
        }
        this.log("[BOM gov au] Sensor %s = %s",sensor,this.sensors[sensor])
    }
    

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



    if (this.sensors['temperature']) {
        this.temperatureService = new Service.TemperatureSensor(this.name);
        this.temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({minValue: -100, maxValue: 100})
            .on('get', this.getStateTemperature.bind(this));
        this.temperatureService.addCharacteristic(CommunityTypes.AtmosphericPressureLevel); //Add pressure characteristic.
        

        //Service status.
        this.temperatureService.addOptionalCharacteristic(Characteristic.StatusFault); 
        this.temperatureService.addOptionalCharacteristic(Characteristic.StatusActive);
        this.temperatureService.setCharacteristic(Characteristic.StatusActive,false);

        //FakeGato
        this.temperatureService.setCharacteristic(Characteristic.SerialNumber,"Station:"+this.stationName)
        this.history = new FakeGatoHistoryService('weather', this.temperatureService, { storage: 'fs' });

    }
    if (this.sensors['apparentTemp']) {
        //Apparent Temp
            this.apparentTempService = new Service.TemperatureSensor(this.name);
            this.apparentTempService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({minValue: -100, maxValue: 100})
                .on('get', this.getStateTemperature.bind(this));
    }
    if (this.sensors['humidity']) {
        //Humidity Service
        this.humidityService = new Service.HumiditySensor(this.name);
        this.humidityService
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on('get', this.getStateHumidity.bind(this));
        this.humidityService.addOptionalCharacteristic(Characteristic.StatusFault);
        this.humidityService.addOptionalCharacteristic(Characteristic.StatusActive);
        this.humidityService.setCharacteristic(Characteristic.StatusActive,false);
        this.humidityService.setCharacteristic(Characteristic.SerialNumber,"Station:"+this.stationName)
    }
    
    this.obs={'air_temp':0,'press':0,'rel_hum':0,'apparent_t':0};    
    if (!this.config.updateFrequency) {
        this.config.updateFrequency = 30*60*1000; //Force a 30min refresh.
    }
    this.updateObservations(); //First update of the system.
    
}


BOMgovau.prototype.updateObservations = function() {
    //If we haven't done an update yet, or the data has expired.
    var now=new Date();
    var curTime=now.getTime();
    
    if (curTime>=this.BOMdataExpires) {
        this.log("Current Time is "+curTime+", BOM data expires at "+this.BOMdataExpires);
        this.log("Updating observations from BOM.");

        fetch(this.stationURL)
          .then(response => {
            response.json().then(json => {
                this.obs=json['observations']['data'][0];
                this.log("Observations retrieved.");
                
                var BOMyear=parseInt(this.obs.aifstime_utc.substr(0,4));
                var BOMmonth=parseInt(this.obs.aifstime_utc.substr(4,2))-1; //Months start at 0, not 1.
                var BOMday=parseInt(this.obs.aifstime_utc.substr(6,2));
                var BOMhour=this.obs.aifstime_utc.substr(8,2);
                var BOMmin=this.obs.aifstime_utc.substr(10,2);
                var BOMsec=this.obs.aifstime_utc.substr(12,2);
                var BOMdataDateTime=new Date(Date.UTC(BOMyear,BOMmonth,BOMday,BOMhour,BOMmin,BOMsec)); 
                
                var BOMdataAge=curTime-BOMdataDateTime.getTime()
                
                // bomUpdates every 30 mins = 30 * 60 * 1000 ms. 
                this.BOMdataExpires=BOMdataDateTime.getTime()+this.config.updateFrequency;
                this.log("BOM data will expire at "+this.BOMdataExpires.toString()+" which is in "+((this.BOMdataExpires-curTime)/1000/60).toFixed(1)+"min")
                
                
                // update all properties.
                if (this.sensors['temperature']) {
                    this.temperatureService.setCharacteristic(Characteristic.StatusActive,true);
                    this.temperatureService.setCharacteristic(Characteristic.StatusFault,false);
                    this.temperatureService.setCharacteristic(Characteristic.CurrentTemperature, isNaN(this.obs.air_temp) ? 0 : this.obs.air_temp);
                    this.temperatureService.setCharacteristic(CommunityTypes.AtmosphericPressureLevel, isNaN(this.obs.press) ? 0 : this.obs.press);
                }
                if (this.sensors['apaprentTemp']) {
                    this.apparentTempService.setCharacteristic(Characteristic.CurrentTemperature, isNaN(this.obs.apparent_t) ? 0 : this.obs.apparent_t);
                }
                if (this.sensors['humidity']) {
                    this.humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity, isNaN(this.obs.rel_hum) ? 0 : this.obs.rel_hum);
                    this.humidityService.setCharacteristic(Characteristic.StatusActive,true);
                    this.humidityService.setCharacteristic(Characteristic.StatusFault,false);
                }
                
                //FakeGato logs:
                this.history.addEntry({
                      time: moment().unix(),
                      temp: this.obs.air_temp,
                      pressure: this.obs.press,
                      humidity: this.obs.rel_hum
                    });
                this.log("Added FakeGato history")
                                            
            });
          })
          .catch(error => {
                this.temperatureService.setCharacteristic(Characteristic.StatusFault,true);
                this.humidityService.setCharacteristic(Characteristic.StatusFault,true);
            this.log(error);
    
          });

    } else {
        this.log("BOM data will expire at "+this.BOMdataExpires.toString()+" which is in "+((this.BOMdataExpires-curTime)/1000/60).toFixed(1)+"min")
    }

}

BOMgovau.prototype.getStateHumidity = function(callback) {
    this.updateObservations();
    callback(null,this.obs.rel_hum);
}

BOMgovau.prototype.getStateTemperature = function(callback) {
    this.updateObservations();
    callback(null,this.obs.air_temp);
}
	
BOMgovau.prototype.getServices = function(callback){
    return [this.informationService,this.temperatureService,this.humidityService]; //Todo: enable user to specify true/false for apparent temp in config file; then load it (or not) here.
}
