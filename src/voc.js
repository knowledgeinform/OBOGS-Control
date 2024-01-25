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
const {crc32} = require('crc')

class Packet {
  constructor({cmd, data, length}) {
    this.length = length
    this.cmd = cmd
    this.data = data
    this.buffer = this.package()
  }

  package() {
    var length
    if (this.length === undefined) {
      length = this.data.length + 4
    } else {
      length = this.length
    }
    var partialBuffer
    if (this.data === undefined) {
      partialBuffer = Buffer.from([this.cmd, length])
    } else {
      partialBuffer = Buffer.from([this.cmd, length, this.data])
    }
    var crcStr = crc32(partialBuffer).toString(16)
    var crcHexArr = crcStr.match(/.{1,2}/g)
    var crcInts = []
    crcHexArr.forEach((rawHex, i) => {
      crcHexArr[i] = '0x' + rawHex
      crcInts.push(parseInt(crcHexArr[i], 16))
    })
    crcInts.reverse()

    if (this.data === undefined) {
      console.log([this.cmd, length].concat(crcInts).toString(16))
    } else {
      console.log([this.cmd, length, this.data].concat(crcInts))
      console.log([this.cmd, length, this.data].concat(crcInts).toString(16))
    }

    var retBuf = Buffer.concat([partialBuffer, Buffer.from(crcInts)])
    return retBuf
  }
}

var commands = {
  StopMeasurementCmd: {decCode: 20, length: 6},
  StartMeasurementCmd: {decCode: 21, length: 6},
  BeepCmd: {decCode: 26, length: 6},
  SetStartDelayCmd: {decCode: 28, length: 7, data: {minutes: 0}},
  GetCalPointCmd: {decCode: 31, length: 6, recv: {dataBytes: 24, length: 30}},
  GetCurrCountsCmd: {decCode: 32, length: 6},
  TakeBinCntOnlyCmd: {decCode: 71, length: 6, recv: {dataBytes: 3, length: 9}},
  SetZeroCalPointCmd: {decCode: 33, length: 20},
  SetSpanCalPointCmd: {decCode: 34, length: 20},
  SetCurrDateTimeCmd: {decCode: 40, length: 14},
  SetIntervalCmd: {decCode: 41, length: 9},
  SetAlarmLevelCncCmd: {decCode: 52, length: 10},
  SetAudioAlarmCmd: {decCode: 54, length: 7},
  ResetAlarmCmd: {decCode: 56, length: 6},
  GetMemoryDataCmd: {decCode: 61, length: 6, recv: {length: 0}},
  CleanMemoryCmd: {decCode: 62, length: 6},
  SetSensorTypeCmd: {decCode: 90, length: 7},
  SetSensorNameCmd: {decCode: 100, length: 14},
  GetMethodCmd: {decCode: 80, length: 6, recv: {dataBytes: 4, length: 52}},
  SetClampCmd: {decCode: 110, length: 7},
  SetLEDModeCmd: {decCode: 111, data: {'Bright blink': 0, blink: 1, 'Always On': 3}, length: 7},
}

class VOC {
  constructor({router, testFlag = false, debugTest = true}) {
    this.debugTest = debugTest
    this.testFlag = testFlag
    this.router = router
    this.property = {
      ZeroCal: new ad.DataPoint({value: 0, units: 'ppm'}),
      SpanCal: new ad.DataPoint({value: 0, units: 'ppm'}),
      Concentration: new ad.DataPoint({value: 0, units: 'ppm'}),
    }
    Object.defineProperty(this, 'ZeroCal', {
      enumerable: true,
      get: () => {
        return this.property.ZeroCal
      },
      set: val => {
        // stuff to set the zero cal
      },
    })
    Object.defineProperty(this, 'SpanCal', {
      enumerable: true,
      get: () => {
        return this.property.SpanCal
      },
      set: val => {
        // stuff to set the zero cal
      },
    })
    // this.SetDateHidden = new ad.DataPoint({value: 0, units: 'ppm'})
    // Object.defineProperty(this, 'SetDate', {
    //   enumerable: true,
    //   get: () => {
    //     return this.SetDateHidden
    //   },
    //   set: (val) => {
    //     // stuff to set the zero cal
    //   }
    // })
    this.CurrentDateTime = Date.now()
    Object.defineProperty(this, 'Concentration', {
      enumerable: true,
      get: () => {
        return this.property.Concentration
      },
    })
    this.Status = 'Not Set'
    this.serialControl = new ad.SerialControl({router: this.router, testFlag: testFlag, timeout: 2000})
    // console.log(this)
    // this.listen()
  }

  listen() {
    if (this.router.open) {
      this.Status = 'Reading'
      this.router.parser.addListener('data', this.process.bind(this))
    } else {
      this.Status = 'Waiting for serial port'
      setTimeout(() => {
        this.listen()
      }, 300)
    }
  }

  stopListening(status) {
    this.Status = status
    if (this.router.parser !== undefined) {
      this.router.parser.removeListener('data', this.process)
    }
  }

  process(d) {
    // console.log(d.toString())
    var str = d.toString()
    str = str.split('\r\n')[0]
    var parts = str.split('\t')
    // console.log(parts)
    // console.log(this.property)
    if (parts.length >= 2) {
      this.CurrentDateTime = Date.parse(parts[0] + 'T' + parts[1])
    }
    if (parts.length >= 3) {
      this.property.Concentration.value = Number(parts[2])
      this.property.Concentration.time = Date.now()
    }
    // console.log(new Date(this.CurrentDateTime).toISOString())
    // console.log(this.Concentration)

    // probably unnecessary
    // if (parts.length >= 4) {
    //   Object.entries(this.property).forEach(([key, value], i) => {
    //     this.property[key].units = parts[3]
    //   })
    //
    // }
  }

  async setLEDMode() {
    // command = 'getPV'
    var time
    var resp
    try {
      var shortCmd = 'SetLEDModeCmd'
      await this.stopMeasuring(shortCmd)
      var command = this.commandBuffer(shortCmd, 'Always On')
      console.log('command: ')
      console.log(command)
      resp = await this.serialControl.serial(command, true)
      time = Date.now()
      this.startMeasuring()
    } catch (error) {
      console.log(error)
      throw error
    }
    console.log('resp')
    console.log(resp[0].length)
    console.log(resp[0].toString())
    if (resp !== undefined) {
      // parse json
      // var respObj = JSON.parse(resp)
      // console.log(respObj)
    }
  }

  async getInfo() {
    // command = 'getPV'
    var time
    var resp
    try {
      var command = this.commandBuffer('GetMethodCmd')
      await this.stopMeasuring(command)
      console.log('command: ')
      console.log(command)
      resp = await this.serialControl.serial(command, true)
      time = Date.now()
      this.startMeasuring()
    } catch (error) {
      console.log(error)
      throw error
    }
    console.log('resp')
    console.log(resp[0].length)
    console.log(resp[0].toString())
    if (resp !== undefined) {
      // parse json
      // var respObj = JSON.parse(resp)
      // console.log(respObj)
    }
  }

  async startMeasuring() {
    this.listen()
    // command = 'getPV'
    var time
    var resp
    try {
      var command = this.commandBuffer('StartMeasurementCmd')
      console.log('command: ')
      console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
      console.log('resp')
      console.log(resp)
      if (resp !== undefined) {
        console.log(resp[0].length)
        console.log(resp[0].toString())
        // parse json
        // var respObj = JSON.parse(resp)
        // console.log(respObj)
      }
    } catch (error) {
      console.log('hcd pid voc traq start measurement error')
      console.log(error)
      // throw error
    }
    
  }

  async stopMeasuring(shortCmd) {
    this.stopListening(shortCmd)
    // command = 'getPV'
    var time
    var resp
    try {
      var command = this.commandBuffer('StopMeasurementCmd')
      console.log('command: ')
      console.log(command)
      resp = await this.serialControl.serial(command, true)
      time = Date.now()
      console.log('resp')
      console.log(resp)
      if (resp !== undefined) {
        console.log(resp[0].length)
        console.log(resp[0].toString())
        // parse json
        // var respObj = JSON.parse(resp)
        // console.log(respObj)
      }
    } catch (error) {
      console.log('hcd pid voc traq stop measurement error')
      console.log(error)
      // throw error
    }
    
  }

  commandBuffer(shortDescription, arg) {
    if (Object.prototype.hasOwnProperty.call(commands, shortDescription)) {
      if (commands[shortDescription].data !== undefined) {
        if (!Object.keys(commands[shortDescription].data).includes(arg)) {
          console.log('Command ' + shortDescription + ' does not have option:')
          console.log(arg)
          console.log('Available options:')
          console.log(Object.keys(commands[shortDescription].data).join(' '))
          return
        }
      }
    } else {
      console.log('Unknown Short Description: ' + shortDescription)
      console.log('Available Short Descriptions')
      Object.entries(commands).forEach(([key, value]) => {
        if (this.debugTest) console.log(value)
        if (this.debugTest) console.log(key + '\t\t' + value.Description)
      })
      return
    }
    var cmdObj = commands[shortDescription]
    var packet
    if (cmdObj.data === undefined) {
      packet = new Packet({cmd: cmdObj.decCode, length: cmdObj.length})
    } else {
      packet = new Packet({cmd: cmdObj.decCode, data: cmdObj.data[arg], length: cmdObj.length})
    }

    return packet.buffer
  }
}

module.exports = {
  Device: VOC,
  commandString: VOC.commandBuffer,
}

// crc32('hello').toString(16)
// '3610a686'
// async function f(router) {
//   try {
//     await router.openPort()
//     console.log('Router open')
//     var voc = new VOC({router: router})
//     voc.getInfo()
//     // voc.setLEDMode()
//   } catch (error) {
//     console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
//     throw error
//   }
// }
//
// console.log('Waiting 4 seconds to open serial port')
// setTimeout(() => {
//   var r = new ad.Router({portPath: '/dev/ttyUSB1', baud: 115200, testFlag: false, timing: true, manufacturer: 'FTDI', serialLineSerial: 'AL02ZPOO'})
//   f(r)
// }, 4000)
