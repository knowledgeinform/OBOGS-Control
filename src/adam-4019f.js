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

const ad = require('./abstract-driver.js')

class Channel {
  constructor() {
    this.typeRange = new ad.DataPoint({units: 'NA'})
    this.input = new ad.DataPoint({units: 'undefined'})
    this.status = new ad.DataPoint({units: 'NA'})
    this.enabled = new ad.DataPoint({value: false, units: 'undefined'})
  }
}

var inputRangeCodeLUT = {
  '02': '±100 mV',
  '03': '±500 mV',
  '04': '±1 V',
  '05': '±2.5 V',
  '07': '+4~20 mA',
  '08': '±10 V',
  '09': '±5 V',
  '0D': '±0 mA',
  '42': '0 ~ 100 mV',
  '43': '0 ~ 500 mV',
  '44': '0 ~ 1 V',
  '45': '0 ~ 2.5 V',
  '48': '0 ~ 10 V',
  '49': '0 ~ 5 V',
  '4D': '0 ~ 20 mA',
  '0E': 'Type J Thermocouple 0 ~ 760 °C',
  '0F': 'Type K Thermocouple 0 ~1370 °C',
  '10': 'Type T Thermocouple -100 ~ 400 °C',
  '11': 'Type E Thermocouple 0 ~ 1000 °C',
  '12': 'Type R Thermocouple 500 ~ 1750 °C',
  '13': 'Type S Thermocouple 500 ~ 1750 °C',
  '14': 'Type B Thermocouple 500 ~ 1800 °C',
  '18': 'Type N Thermocouple -200 ~ 1300 °C',
}

class Adam4019F {
  constructor({address = '01', router, testFlag = false}) {
    this.address = address
    this.router = router
    this.testFlag = testFlag

    this.serialControl = new ad.SerialControl({
      router: this.router,
      testFlag: this.testFlag,
      debugTest: false,
      timeout: 300,
      interMessageWait: 100,
    })

    this.numberChannels = 8

    this.inputTypesList = Object.values(inputRangeCodeLUT)

    this.hidden = {}
    this.hidden.configuration = new ad.DataPoint({})
    this.hidden.status = new ad.DataPoint({}) // enabled/disabled multiplexed channel
    this.hidden.wiring = new ad.DataPoint({})
    this.hidden.channels = []
    for (var channel = 0; channel < this.numberChannels; channel++) {
      this.hidden.channels[channel] = new Channel()
    }
  }

  validCommand(response) {
    return response[0] === '!'
  }

  async getChannelInput(i) {
    var msg = '#' + this.address + i.toString() + '\r'
    var ret
    try {
      if (i >= this.numberChannels) throw new Error('Invalid channel number')
      ret = await this.serialControl.serial(msg)
      // console.log(`Printing getChannelInput return: ${ret}`)
      // console.log(ret)
      this.hidden.channels[i].input.time = Date.now()
      var parts = ret[0].split('>')
      this.hidden.channels[i].input.value = Number(parts[parts.length - 1])

    } catch (error) {
      console.log('get channel input error')
      console.log(error)
    }
  }

  async getChannelType(i) {
    var msg = '$' + this.address + '8C' + i.toString() + '\r'
    var ret
    try{
      if (i >= this.numberChannels) throw new Error('Invalid channel number')
      ret = await this.serialControl.serial(msg)
      if (!this.validCommand(ret[0])) throw new Error('Invalid Command')

      this.hidden.channels[i].typeRange.time = Date.now()
      var parts = ret[0].split('R')
      
      this.hidden.channels[i].typeRange.value = inputRangeCodeLUT[parts[parts.length - 1]]
      var unitsParts = this.hidden.channels[i].typeRange.value.split(' ')
      this.hidden.channels[i].input.units = unitsParts[unitsParts.length - 1]
    } catch (error){
      console.log('getChannelType() error')
      console.log(error)
    }
  }

  async getWiring() {
    var msg = '$' + this.address + 'B\r'
    var ret
    try {
      ret = await this.serialControl.serial(msg)
      if (!this.validCommand(ret[0])) throw new Error('Invalid Command')
      this.hidden.wiring.time = Date.now()
      // console.log(ret[0])
      this.hidden.wiring.value = Number('0x' + ret[0].slice(3))
      // console.log(this.hidden.wiring.value)
      for (var channel = 0; channel < this.numberChannels; channel++) {
        this.hidden.channels[channel].status.time = this.hidden.wiring.time
        // console.log('this.hidden.status.value >> channel')
        // console.log(this.hidden.wiring.value >> channel)
        if (((this.hidden.wiring.value >> channel) & 1) === 1) {
          this.hidden.channels[channel].status.value = 'Error: Under/Over Range; Open wiring'
        } else {
          this.hidden.channels[channel].status.value = 'Normal'
        }
      }
    } catch (error) {
      console.log('get wiring error')
      console.log(error)
    }
  }

  async getStatus() {
    var msg = '$' + this.address + '6\r'
    var ret
    try {
      ret = await this.serialControl.serial(msg)
      if (!this.validCommand(ret[0])) throw new Error('Invalid Command')
      this.hidden.status.time = Date.now()
      // console.log(ret[0])
      this.hidden.status.value = Number('0x' + ret[0].slice(3))
      // console.log(this.hidden.status.value)
      for (var channel = 0; channel < this.numberChannels; channel++) {
        this.hidden.channels[channel].enabled.time = this.hidden.status.time
        this.hidden.channels[channel].enabled.value = ((this.hidden.status.value >> channel) & 1) === 1
      }
    } catch (error) {
      console.log('get status error')
      console.log(error)
    }
  }

  async getConfiguration() {
    var msg = '$' + this.address + '2\r'
    var ret
    try {
      ret = await this.serialControl.serial(msg)
      if (!this.validCommand(ret[0])) throw new Error('Invalid Command')
      this.hidden.configuration.time = Date.now()
      this.hidden.configuration.value = ret[0]
    } catch (error) {
      console.log('get configuration error')
      console.log(error)
    }
  }
}

module.exports = {
  Adam4019F: Adam4019F,
}

// async function f() {
//   var router = new ad.Router({
//     portPath: 'COM4',
//     testFlag: false,
//     maxQueueLength: 100,
//     baud: 9600,
//     manufacturer: 'FTDI',
//     // manufacturer: 'Prolific Technology Inc.',
//     seriallineSerial: 'FT67GAU2',
//   })
//
//   await router.openPort()
//
//   var dev = new Adam4019F({address: '01', router: router, testFlag: false})
//
//   setInterval(() => {
//     for (var channel = 0; channel < dev.numberChannels; channel++) {
//       if (channel === 0) {
//         dev.getStatus()
//         dev.getWiring()
//       }
//       dev.getChannelType(channel)
//       dev.getChannelInput(channel)
//       console.log('channel ' + channel + ' type and range: ' + dev.hidden.channels[channel].typeRange.value)
//       console.log(dev.hidden.channels[channel])
//     }
//   }, 1000)
// }
//
// console.log('Waiting 4 s before starting serial')
//
// setTimeout(() => {
//   f()
// }, 4000)
