
# Homebridge-BOMgovau

Retrieves official weather data (temperature, humidity, air pressure) from the Australian [Bureau of Meteorology](http://www.bom.gov.au).

# Installation

## Select your station. 
Specify the JSON URL for the observations. This is listed at the bottom of the human-readable observations page. e.g.  Latest Canberra observations in human readable format are at http://www.bom.gov.au/products/IDN60801/IDN60801.94926.shtml. At the bottom of this page is the JSON url: http://www.bom.gov.au/fwo/IDN60801/IDN60801.94926.json

## Add configuration
Configuration sample (uses Canberra Airport weather in this example)
```json
"accessories": [
	{ "accessory":"BOMgovau",
	"name":"Canberra Airport"
	"stationurl":"http://reg.bom.gov.au/fwo/IDN60903/IDN60903.94926.json"
   }
```

Restart homebridge and the temperature, humidity sensors should appear in your Home app.