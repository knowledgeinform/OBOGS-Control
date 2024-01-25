/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED 'AS IS.' JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


const net = require('net')
const ad = require('./abstract-driver.js')

var testData = [
    '08:36:25 02-15-2023 Background_(ppb_or_ug/m3) 2.484316 Photometer_Lamp_Temperature_(degC) 60.027298 Concentration_(ppb_or_ug/m3) 29.439602 Photometer_Bench_Temperature_(degC) 25.873524 Cell_A_Photometer_Frequency_(Hz) 101891.000000 Cell_B_Photometer_Frequency_(Hz) 101066.000000 Photometer_Pressure_A_(mmHg) 744.874756 Calculated_Flow_A_(L/Min) 1.401253 Photometer_Pressure_A_Alarm 0',
    '08:36:26 02-15-2023 Background_(ppb_or_ug/m3) 2.484316 Photometer_Lamp_Temperature_(degC) 59.984100 Concentration_(ppb_or_ug/m3) 29.439602 Photometer_Bench_Temperature_(degC) 25.873524 Cell_A_Photometer_Frequency_(Hz) 101891.000000 Cell_B_Photometer_Frequency_(Hz) 101066.000000 Photometer_Pressure_A_(mmHg) 744.871704 Calculated_Flow_A_(L/Min) 1.401238 Photometer_Pressure_A_Alarm 0',
    '08:36:27 02-15-2023 Background_(ppb_or_ug/m3) 2.484316 Photometer_Lamp_Temperature_(degC) 59.984100 Concentration_(ppb_or_ug/m3) 29.439602 Photometer_Bench_Temperature_(degC) 25.898130 Cell_A_Photometer_Frequency_(Hz) 101891.000000 Cell_B_Photometer_Frequency_(Hz) 101068.000000 Photometer_Pressure_A_(mmHg) 744.868896 Calculated_Flow_A_(L/Min) 1.401389 Photometer_Pressure_A_Alarm 0',
    '08:36:28 02-15-2023 Background_(ppb_or_ug/m3) 2.484316 Photometer_Lamp_Temperature_(degC) 59.944355 Concentration_(ppb_or_ug/m3) 29.439602 Photometer_Bench_Temperature_(degC) 25.898130 Cell_A_Photometer_Frequency_(Hz) 101893.000000 Cell_B_Photometer_Frequency_(Hz) 101067.000000 Photometer_Pressure_A_(mmHg) 744.866333 Calculated_Flow_A_(L/Min) 1.401443 Photometer_Pressure_A_Alarm 0',
    '08:36:29 02-15-2023 Background_(ppb_or_ug/m3) 2.484316 Photometer_Lamp_Temperature_(degC) 59.944355 Concentration_(ppb_or_ug/m3) 29.439602 Photometer_Bench_Temperature_(degC) 25.873524 Cell_A_Photometer_Frequency_(Hz) 101892.000000 Cell_B_Photometer_Frequency_(Hz) 101069.000000 Photometer_Pressure_A_(mmHg) 744.864014 Calculated_Flow_A_(L/Min) 1.401410 Photometer_Pressure_A_Alarm 0',
]

var tagList = {
    o3Background: 'Background_\\(ppb_or_ug\/m3\\)',
    lampTemperature: 'Photometer_Lamp_Temperature_\\(degC\\)',
    o3: 'Concentration_\\(ppb_or_ug\/m3\\)',
    benchTemperature: 'Photometer_Bench_Temperature_\\(degC\\)',
    cellAIntensity: 'Cell_A_Photometer_Frequency_\\(Hz\\)',
    cellBIntensity: 'Cell_B_Photometer_Frequency_\\(Hz\\)',
    pressure: 'Photometer_Pressure_A_\\(mmHg\\)',
    flow: 'Calculated_Flow_A_\\(L\/Min\\)',
}

class Ozone49_IQC {
    constructor({
        host = '192.12.3.149',
        port = '9881',
        timeout = 3000,
        testFlag = false
    }) {
        this.testFlag = testFlag
        this.testDataIndex = 0 // test data index
        
        this.host = host
        this.port = port
        this.client = net.connect({host: this.host, port: this.port}, () => {
            console.log('Connected to ozone analyzer 49iq')
            this.status = 'connected'
        })
        this.status = 'connecting'

        this.client.on('data', this.process.bind(this))
        this.client.on('end', this.endStream)
        this.client.on('close', this.reconnect.bind(this))
        this.client.on('error', this.processError.bind(this))

        this.o3 = new ad.DataPoint({units: 'ppb'})
        this.o3Background = new ad.DataPoint({units: 'ppb'})
        this.benchTemperature = new ad.DataPoint({units: '˚C'})
        this.lampTemperature = new ad.DataPoint({units: '˚C'})
        this.cellAIntensity = new ad.DataPoint({units: 'Hz'})
        this.cellBIntensity = new ad.DataPoint({units: 'Hz'})
        this.pressure = new ad.DataPoint({units: 'mmHg'})
        this.flow = [new ad.DataPoint({units: 'L/min'})]

        this.timeout = timeout
        this.timeoutTimer = setTimeout(() => {
            this.status = 'Timed out'
            if (this.testFlag) {
                this.process(testData[this.testDataIndex++])
                if (this.testDataIndex == testData.length) this.testDataIndex = 0
            } else {
                this.reconnect(true)
            }
        }, this.timeout)
    
    }

    process(d) {
        var time = Date.now()
        var data = d.toString()
        this.status = 'Reading'
        // console.log('data rxd')
        // console.log(data)
        Object.entries(tagList).forEach(([key, tag], i) => {
            var regex = new RegExp(tag + ' *(-?\\d+\.?\\d*)');
            try {
              var temp = data.match(regex)
              if (key === 'flow') {
                this[key][0].value = Number(temp[1])
                this[key][0].time = time
              } else {
                this[key].value = Number(temp[1])
                this[key].time = time
              }
              
            } catch (error) {
              console.log('Ozone Analyzer 49iq Parsing Error for',key)
              console.log('regex',regex)
              console.log('temp',temp)
              console.log('data',data)
              console.log(error)
            }
          })
      
          this.timeoutTimer.refresh()
      
    }

    endStream() {
        console.log('disconnected from server')
    }

    reconnect(hadError) {
        if (hadError) {
            console.log('Ozone Analyzer 49iQ Had error. Attempting to reconnect')
            setTimeout(() => {
                this.client.connect({host: this.host, port: this.port}, () => {
                    console.log('Connected to ozone analyzer 49iq')
                    this.status = 'connected'
                })
            }, this.timeout * 2)
        }
    }

    processError(e) {
        console.log('Ozone Analyzer 49iQ error')
        console.log(e)
    }
}

module.exports = {
    Device: Ozone49_IQC,
  }

// var o = new Ozone49_IQC({})
