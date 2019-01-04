
# Homebridge-BOMgovau

Retrieves official weather data (temperature, humidity, air pressure) from the Australian [Bureau of Meteorology](http://www.bom.gov.au).

# Installation

## Install using NPM
` npm install -g homebridge-bomgovau `

While that's running, you'll need to get the right URL for your chosen station...

## Select your station. 
Find the JSON data feed for your station's observations. This is listed at the bottom of the human-readable observations page. e.g.  Latest Canberra observations in human readable format are at http://www.bom.gov.au/products/IDN60801/IDN60801.94926.shtml. At the bottom of this page is the JSON url: http://www.bom.gov.au/fwo/IDN60801/IDN60801.94926.json

## Add configuration to Homebridge config.json
Configuration sample (uses Canberra Airport in this example)
```json
"accessories": [
	{ "accessory":"BOMgovau",
	"name":"Canberra Airport",
	"stationURL":"http://reg.bom.gov.au/fwo/IDN60903/IDN60903.94926.json"
   }
```

Restart homebridge and the temperature and humidity sensors should appear in your Home app. Air pressure is not currently in the Home app, but can be viewed through third party apps (e.g. Elgato's Eve app). Data will refresh every 30 minutes, when BOM publishes new data to the web. 

