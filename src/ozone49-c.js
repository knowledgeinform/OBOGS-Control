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

var commands = {
  GetO3Level: {cmd: 'o3'},
  GetGasMode: {cmd: 'gas mode'},
  SetSampleGas: {cmd: 'set sample gas'},
  SetZeroGas: {cmd: 'set zero gas'},
  SetLevel: {cmd: 'set level', opts: ['1', '2']},
  GetMode: {cmd: 'mode'},
  SetMode: {cmd: 'set mode', opts: ['local', 'remote']},
  GetGasUnit: {cmd: 'gas unit'},
  SetGasUnit: {cmd: 'set gas unit', opts: ['ppm', 'mg/m3']},
  GetRange: {cmd: 'range'},
  SetRange: {cmd: 'set range', opts: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
    optMeaning: ['0.05 ppm',
      '0.1 ppm',
      '0.2 ppm',
      '0.5 ppm',
      '1 ppm',
      '2 ppm',
      '5 ppm',
      '10 ppm',
      '20 ppm',
      '50 ppm',
      '100 ppm',
      '200 ppm',
      'C1',
      'C2',
      'C3']},
  GetCustomRange: {cmd: 'custom', opts: ['1', '2', '3']},
  SetCustomRange1: {cmd: 'set custom 1 range', opts: [/\b\d{1,5}\.*\d{0,1}\b/g]},
  SetCustomRange2: {cmd: 'set custom 2 range', opts: [/\b\d{1,5}\.*\d{0,1}\b/g]},
  SetCustomRange3: {cmd: 'set custom 3 range', opts: [/\b\d{1,5}\.*\d{0,1}\b/g]},
  GetAvgTime: {cmd: 'avg time'},
  SetAvgTime: {cmd: 'set avg time', opts: ['0', '1', '2', '3', '4', '5', '6', '7', '8']},
  GetO3Background: {cmd: 'o3 bkg'},
  SetO3Background: {cmd: 'set o3 bkg', opts: [/\b\d{1,2}\.*\d{0,1}\b/g]},
  GetO3Coef: {cmd: 'o3 coef'},
  SetO3Coef: {cmd: 'set o3 coef', opts: [/\b\d{1}\.*\d{0,3}\b/g]},
  GetTemperatureCompensation: {cmd: 'temp comp'},
  SetTemperatureCompensation: {cmd: 'set temp comp', opts: ['on', 'off']},
  GetPressureCompensation: {cmd: 'pres comp'},
  SetPressureCompensation: {cmd: 'set pres comp', opts: ['on', 'off']},
  GetTime: {cmd: 'time'},
  SetTime: {cmd: 'set time', opts: [/(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/g]},
  GetDate: {cmd: 'date'},
  SetDate: {cmd: 'set date', opts: [/(?:(?:([01]?\d|2[0-3])-)?([0-3]?\d)-)?([0-9]?\d)$/g]},
  GetBenchTemperature: {cmd: 'bench temp'},
  GetLampTemperature: {cmd: 'lamp temp'},
  GetCellAIntensity: {cmd: 'cell a int'},
  GetCellBIntensity: {cmd: 'cell b int'},
  GetLampSetting: {cmd: 'lamp setting'},
  GetPressure: {cmd: 'pres'},
  GetFlow: {cmd: 'flow', opts: ['a', 'b']},
  GetO3Flow: {cmd: 'oz flow'},
  GetDAC: {cmd: 'dtoa', opts: ['0', '1', '2', '3', '4', '5', '6', '7']},
  GetOptionSwitches: {cmd: 'option switches'},
}

class Ozone49C {
  constructor({router, testFlag = false, debugTest = true, id = 49, maxRefreshInterval = 1000}) {
    this.id = id
    this.debugTest = debugTest
    this.testFlag = testFlag
    this.router = router
    this.property = {
      o3: new ad.DataPoint({value: 0, units: 'NA'}),
      gasMode: new ad.DataPoint({value: 0, units: 'NA'}),
      o3Background: new ad.DataPoint({value: 0, units: 'NA'}),
      temperatureCompensation: new ad.DataPoint({value: 0, units: 'NA'}),
      pressureCompensation: new ad.DataPoint({value: 0, units: 'NA'}),
      benchTemperature: new ad.DataPoint({value: 0, units: 'NA'}),
      lampTemperature: new ad.DataPoint({value: 0, units: 'NA'}),
      cellAIntensity: new ad.DataPoint({value: 0, units: 'NA'}),
      cellBIntensity: new ad.DataPoint({value: 0, units: 'NA'}),
      pressure: new ad.DataPoint({value: 0, units: 'NA'}),
      flowa: new ad.DataPoint({value: 0, units: 'NA'}),
      flowb: new ad.DataPoint({value: 0, units: 'NA'}),
      o3Flow: new ad.DataPoint({value: 0, units: 'NA'}),
      range: new ad.DataPoint({value: '14', units: 'NA'}),
    }
    this.lockRefreshInterval = false
    this.maxRefreshInterval = maxRefreshInterval
    this.lastReadTime = {}
    this.lastReadTime.o3 = Date.now()
    this.lastReadTime.gasMode = Date.now()
    this.lastReadTime.o3Background = Date.now()
    this.lastReadTime.temperatureCompensation = Date.now()
    this.lastReadTime.pressureCompensation = Date.now()
    this.lastReadTime.benchTemperature = Date.now()
    this.lastReadTime.lampTemperature = Date.now()
    this.lastReadTime.cellAIntensity = Date.now()
    this.lastReadTime.cellBIntensity = Date.now()
    this.lastReadTime.pressure = Date.now()
    this.lastReadTime.flowa = Date.now()
    this.lastReadTime.flowb = Date.now()
    this.lastReadTime.o3Flow = Date.now()
    this.lastReadTime.range = Date.now()

    this.Status = 'Not Set'
    this.serialControl = new ad.SerialControl({router: this.router, testFlag: testFlag, timeout: 600, debugTest: false, interMessageWait: 200})
    // console.log(this)
    // this.listen()
  }

  update() {
    // dummy variable to have getters called
    // var tmp
    // tmp = this.o3
    // tmp = this.gasMode
    // tmp = this.o3Background
    // tmp = this.temperatureCompensation
    // tmp = this.pressureCompensation
    // tmp = this.benchTemperature
    // tmp = this.lampTemperature
    // tmp = this.cellAIntensity
    // tmp = this.cellBIntensity
    // tmp = this.pressure
    // tmp = this.flow
    // tmp = this.o3Flow
    // tmp = this.range
  }

  async getO3() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetO3Level')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp[0].toString())
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.o3.value = Number(parts[1])
      this.property.o3.units = parts[2].replace('\r', '')
      this.property.o3.time = time
    }
  }

  get o3() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.o3 <= this.maxRefreshInterval) {
      return this.property.o3
    } else {
      this.lastReadTime.o3 = Date.now()
    }
    this.getO3().catch(error => {
      console.log('get o3 error')
      console.log(error)
    })
    return this.property.o3
  }

  async getGasMode() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetGasMode')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.gasMode.value = parts[2].replace('\r', '')
      this.property.gasMode.time = time
    }
  }

  get gasMode() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.gasMode <= this.maxRefreshInterval) {
      return this.property.gasMode
    } else {
      this.lastReadTime.gasMode = Date.now()
    }
    this.getGasMode().catch(error => {
      console.log('get gas mode error')
      console.log(error)
    })
    return this.property.gasMode
  }

  async getO3Background() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetO3Background')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      var units = parts[3].replace('\r', '')
      if (units !== undefined) {
        this.property.o3Background.value = Number(parts[2])
        this.property.o3Background.units = units
        this.property.o3Background.time = time
      }
    }
  }

  get o3Background() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.o3Background <= this.maxRefreshInterval) {
      return this.property.o3Background
    } else {
      this.lastReadTime.o3Background = Date.now()
    }
    this.getO3Background().catch(error => {
      console.log('get o3 background error')
      console.log(error)
    })
    return this.property.o3Background
  }

  async getTemperatureCompensation() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetTemperatureCompensation')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      if (parts[2] === 'on') {
        this.property.temperatureCompensation.value = true
      } else {
        this.property.temperatureCompensation.value = false
      }
      this.property.temperatureCompensation.time = time
    }
  }

  get temperatureCompensation() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.temperatureCompensation <= this.maxRefreshInterval) {
      return this.property.temperatureCompensation.value
    } else {
      this.lastReadTime.temperatureCompensation = Date.now()
    }
    this.getTemperatureCompensation().catch(error => {
      console.log('get temperature compensation error')
      console.log(error)
    })
    return this.property.temperatureCompensation.value
  }

  set temperatureCompensation(binary) {

  }

  async getPressureCompensation() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetPressureCompensation')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      if (parts[2] === 'on') {
        this.property.pressureCompensation.value = true
      } else {
        this.property.pressureCompensation.value = false
      }
      this.property.pressureCompensation.time = time
    }
  }

  get pressureCompensation() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.pressureCompensation <= this.maxRefreshInterval) {
      return this.property.pressureCompensation.value
    } else {
      this.lastReadTime.pressureCompensation = Date.now()
    }
    this.getPressureCompensation().catch(error => {
      console.log('get pressure compensation error')
      console.log(error)
    })
    return this.property.pressureCompensation.value
  }

  set pressureCompensation(binary) {

  }

  async getBenchTemperature() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetBenchTemperature')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.benchTemperature.value = Number(parts[6])
      this.property.benchTemperature.units = parts[4].replace(',', '')
      this.property.benchTemperature.time = time
    }
  }

  get benchTemperature() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.benchTemperature <= this.maxRefreshInterval) {
      return this.property.benchTemperature
    } else {
      this.lastReadTime.benchTemperature = Date.now()
    }
    this.getBenchTemperature().catch(error => {
      console.log('get bench temperature error')
      console.log(error)
    })
    return this.property.benchTemperature
  }

  async getLampTemperature() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetLampTemperature')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.lampTemperature.value = Number(parts[2])
      this.property.lampTemperature.units = parts[4].replace('\r', '')
      this.property.lampTemperature.time = time
    }
  }

  get lampTemperature() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.lampTemperature <= this.maxRefreshInterval) {
      return this.property.lampTemperature
    } else {
      this.lastReadTime.lampTemperature = Date.now()
    }

    this.getLampTemperature().catch(error => {
      console.log('get lamp temperature error')
      console.log(error)
    })
    return this.property.lampTemperature
  }

  async getCellAIntensity() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetCellAIntensity')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.cellAIntensity.value = Number(parts[3])
      this.property.cellAIntensity.units = parts[4].replace('\r', '')
      this.property.cellAIntensity.time = time
    }
  }

  get cellAIntensity() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.cellAIntensity <= this.maxRefreshInterval) {
      return this.property.cellAIntensity
    } else {
      this.lastReadTime.cellAIntensity = Date.now()
    }

    this.getCellAIntensity().catch(error => {
      console.log('get cell A intensity error')
      console.log(error)
    })
    return this.property.cellAIntensity
  }

  async getCellBIntensity() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetCellBIntensity')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.cellBIntensity.value = Number(parts[3])
      this.property.cellBIntensity.units = parts[4].replace('\r', '')
      this.property.cellBIntensity.time = time
    }
  }

  get cellBIntensity() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.cellBIntensity <= this.maxRefreshInterval) {
      return this.property.cellBIntensity
    } else {
      this.lastReadTime.cellBIntensity = Date.now()
    }

    this.getCellBIntensity().catch(error => {
      console.log('get cell B intensity error')
      console.log(error)
    })
    return this.property.cellBIntensity
  }

  async getPressure() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetPressure')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.pressure.value = Number(parts[5])
      this.property.pressure.units = parts[2].concat(parts[3].replace(',', ''))
      this.property.pressure.time = time
    }
  }

  get pressure() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.pressure <= this.maxRefreshInterval) {
      return this.property.pressure
    } else {
      this.lastReadTime.pressure = Date.now()
    }

    this.getPressure().catch(error => {
      console.log('get pressure error')
      console.log(error)
    })
    return this.property.pressure
  }

  async getFlow(cell) {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetFlow', cell)
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp[0].toString())
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property['flow' + cell].value = Number(parts[2])
      this.property['flow' + cell].units = parts[3].replace('\r', '')
      this.property['flow' + cell].time = time
    }
  }

  get flow() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.flowa <= this.maxRefreshInterval) {
      return [this.property.flowa, this.property.flowb]
    } else {
      this.lastReadTime.flowa = Date.now()
    }

    this.getFlow('a').catch(error => {
      console.log('get flow a error')
      console.log(error)
    })
    this.getFlow('b').catch(error => {
      console.log('get flow b error')
      console.log(error)
    })
    return [this.property.flowa, this.property.flowb]
  }

  async getO3Flow() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetO3Flow')
      console.log('command: ')
      console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    console.log('resp')
    console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(' ')
      this.property.o3Flow.value = Number(parts[2])
      this.property.o3Flow.units = parts[3].replace('\r', '')
      this.property.o3Flow.time = time
    }
  }

  get o3Flow() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.o3Flow <= this.maxRefreshInterval) {
      return this.property.o3Flow
    } else {
      this.lastReadTime.o3Flow = Date.now()
    }

    this.getO3Flow().catch(error => {
      console.log('get o3 flow error')
      console.log(error)
    })
    return this.property.o3Flow
  }

  async getRange() {
    var time
    var resp
    try {
      var command = this.commandBuffer('GetRange')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(/[ ]+/)
      this.property.range.value = Number(parts[2])
      this.property.range.units = parts[3].replace('\r', '')
      this.property.range.time = time
    }
  }

  convertRange(rangeDP) {
    var rangePPM = rangeDP.value
    if (rangeDP.units === 'ppb') {
      rangePPM /= 1000
    }
    for (var i = 0; i < commands.SetRange.optMeaning.length; i++) {
      var parts = commands.SetRange.optMeaning[i].split(' ')
      if (Number(parts[0]) === rangePPM) {
        return commands.SetRange.optMeaning[i]
      }
    }
    return 'UNKNOWN'
  }

  get range() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.range <= this.maxRefreshInterval) {
      return this.convertRange(this.property.range)
    } else {
      this.lastReadTime.range = Date.now()
    }

    this.getRange().catch(error => {
      console.log('get range error')
      console.log(error)
    })
    return this.convertRange(this.property.range)
  }

  async setRange(r) {
    // var time
    var resp
    try {
      var command = this.commandBuffer('SetRange', r)
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      // time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(/[ ]+/)
      console.log('Set range status: ' + parts[parts.length - 1])
    }
  }

  set range(val) {
    console.log('Setting range to')
    console.log(val)
    var index = commands.SetRange.optMeaning.findIndex(e => e === val)
    if (index === -1) {
      return
    } else {
      this.setRange(commands.SetRange.opts[index]).catch(error => {
        console.log('set range error')
        console.log(error)
      })
    }
  }

  get rangeList() {
    return commands.SetRange.optMeaning
  }

  async sampleGas() {
    // var time
    var resp
    try {
      var command = this.commandBuffer('SetSampleGas')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      // time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(/[ ]+/)
      console.log('Set sample gas status: ' + parts[parts.length - 1])
    }
  }

  setSampleGas() {
    this.sampleGas().catch(error => {
      console.log('sample gas error')
      console.log(error)
    })
  }

  async zeroGas() {
    // var time
    var resp
    try {
      var command = this.commandBuffer('SetZeroGas')
      // console.log('command: ')
      // console.log(command)
      resp = await this.serialControl.serial(command, false)
      // time = Date.now()
    } catch (error) {
      console.log(error)
      throw error
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      var parts = resp[0].toString().split(/[ ]+/)
      console.log('Set zero gas status: ' + parts[parts.length - 1])
    }
  }

  setZeroGas() {
    this.zeroGas().catch(error => {
      console.log('zero gas error')
      console.log(error)
    })
  }

  commandBuffer(shortDescription, arg) {
    if (Object.prototype.hasOwnProperty.call(commands, shortDescription)) {
      if (commands[shortDescription].opts !== undefined) {
        if (!commands[shortDescription].opts.includes(arg) || (commands[shortDescription].opts.length === 1 && arg.match(commands[shortDescription].opts[0]) === null)) {
          console.log('Command ' + shortDescription + ' does not have option:')
          console.log(arg)
          console.log('Available options:')
          console.log(Object.keys(commands[shortDescription].opts).join(' '))
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
    var id = Buffer.from([(this.id + 128)])
    var cmd = Buffer.from(cmdObj.cmd, 'utf8')
    var cmdBuf = Buffer.concat([id, cmd])
    if (Object.prototype.hasOwnProperty.call(cmdObj, 'opts')) {
      var optBuf = Buffer.from(' ' + arg, 'utf8')
      cmdBuf = Buffer.concat([cmdBuf, optBuf])
    }
    var endLineBuf = Buffer.from([0x0D])
    cmdBuf = Buffer.concat([cmdBuf, endLineBuf])
    return cmdBuf
  }
}

module.exports = {
  Device: Ozone49C,
  commandString: Ozone49C.commandBuffer,
}

// crc32('hello').toString(16)
// '3610a686'
/*
console.log('Waiting 4 s for serial line device')
setTimeout(() => {
  var r = new ad.Router({portPath: '/dev/ttyUSB3',baud: 9600, testFlag: false, timing: true, manufacturer: 'FTDI'})
  r.once('open', () => {
    console.log('Router open')
    var oz = new Ozone49C({router: r})
    setInterval(() => {
      console.log('Result')
      console.log(oz.range)
      // var tmp = oz.flow

    },3000)
  })

}, 4000)
*/
// tmp = this.o3
// tmp = this.gasMode
// tmp = this.o3Background
// tmp = this.temperatureCompensation
// tmp = this.pressureCompensation
// tmp = this.benchTemperature
// tmp = this.lampTemperature
// tmp = this.cellAIntensity
// tmp = this.cellBIntensity
// tmp = this.pressure
// tmp = this.flow
// tmp = this.o3Flow
// tmp = this.range

// voc.setLEDMode()
