// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ad = require('./abstract-driver.js')
const db = require('./database.js')
const bkup = require('./backup.js')
const ui = require('./ui.js')
const adam = require('./adam-4019f.js')
const Controller = require('./node-pid.js')

class ControlAdam {
  constructor({address = '01',
    router,
    testFlag = false,
    services,
    server,
    configPath,
  }) {
    this.Address = {value: address} // added, capitalized and wrapped for backup.js/database.js
    this.device = new adam.Adam4019F({address, router, testFlag})
    this.configPath = configPath
    this.retryNumber = 0
    this.hidden = {
      processValue: [
        new ad.DataPoint({value: 0, units: 'C'}),
        new ad.DataPoint({value: 0, units: 'in'}),
        new ad.DataPoint({value: 0, units: 'gal'}),
        new ad.DataPoint({value: 0, units: 'C'}),
      ],
      setPoint: [
        new ad.DataPoint({value: 0, units: 'C'}),
        new ad.DataPoint({value: 0}),
        new ad.DataPoint({value: 0}),
        new ad.DataPoint({value: 0})
      ],
      controllerOutput: [
        new ad.DataPoint({value: 0, units: '0-1'}),
        new ad.DataPoint({value: 0}),
        new ad.DataPoint({value: 0}),
        new ad.DataPoint({value: 0})
      ],
      enable: false,
    }

    this.services = services
    this.server = server

    this.numberPVs = 4
    this.numberSPs = 1

    this.lockRefreshInterval = true
    this.maxRefreshInterval = 300

    this.loopInterval = 2000
    this.updateInterval = 7000
    this.lastUpdateTime = Date.now()

    this.ctr = new Controller({
      kp: -0.000_000_009_35,
      ki: 0.005,
      kd: 0,
      dt: this.loopInterval, // milliseconds
      outMin: 0,
      outMax: 1,
    })
    this.AdditionalFields = {
      // Enable: new ui.ShowUser({value: false, type: ['output', 'binary']}),
    }
    Object.defineProperty(this.AdditionalFields, 'Enable', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.hidden.enable, type: ['output', 'binary']})
      },
      set: val => {
        if (val === false) {
          // set the duty to 0 to prevent things from getting hot
          this.utilityDuty(0)
        }

        this.hidden.enable = val
      },
    })
    if (this.configPath !== undefined) {
      this.AdditionalFields.Database = new ui.ShowUser({
        value: [{
          id: 'Settings',
          obj: {0: new db.GUI({
            measurementName: 'adam_adc_basic',
            fields: ['SP0',
              'PV0',
              'CO0',
              'PV1',
              'PV2',
              'PV3',
            ],
            obj: this,
            testFlag: this.testFlag,
            objPath: this.configPath,
          })},
          path: this.configPath + '/' + db.path + '/' + bkup.fileName(this),
        }],
        type: ['output', 'link'],
      })
      this.getStaticSettings()
    }

    Object.defineProperty(this.AdditionalFields, 'k_p', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.ctr.kp, type: ['output', 'number']})
      },
      set: val => {
        this.ctr.kp = val
      },
    })
    Object.defineProperty(this.AdditionalFields, 'k_i', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.ctr.ki, type: ['output', 'number']})
      },
      set: val => {
        this.ctr.ki = val
      },
    })
    Object.defineProperty(this.AdditionalFields, 'k_d', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.ctr.kd, type: ['output', 'number']})
      },
      set: val => {
        this.ctr.kd = val
      },
    })

    setInterval(this.controlLoop.bind(this), this.loopInterval) // loop interval hard-coded for now
  }

  getStaticSettings() {
    var cMap = bkup.load(this.configPath)
    console.log('Loaded controller map')
    console.log(cMap)
    if (Object.prototype.hasOwnProperty.call(cMap, this.device.address)) {
      var thisObj = cMap[this.device.address]
      console.log('Loading static settings')
      console.log(thisObj)
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_p')) this.ctr.kp = thisObj.k_p.value
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_i')) this.ctr.ki = thisObj.k_i.value
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_d')) this.ctr.kd = thisObj.k_d.value
    }
  }

  controlLoop() {
    this.hidden.controllerOutput[0].value = this.ctr.update(this.PV0.value)
    this.hidden.controllerOutput[0].time = Date.now()
    if (this.AdditionalFields.Enable.value) {
      this.utilityDuty(this.hidden.controllerOutput[0].value)
    }
  }

  utilityDuty(val) {
    console.log('Updating PWM to:', val)
    var call = 'api/Valves/02/Valve 1 Duty'
    if (!this.testFlag && Date.now() - this.lastUpdateTime >= this.updateInterval || val === 0) {
      this.lastUpdateTime = Date.now()
      this.postVal(call, val)
    }
  }

  findSubObj(callkey, obj) {
    var retObj
    // console.log('find subobj')
    if (obj === undefined) {
      return undefined
    }

    Object.entries(obj).forEach(([key, value]) => {
      // console.log(key)
      if (callkey === key) {
        retObj = value
      }
    })
    return retObj
  }

  postVal(call, val) {
    var callParts = call.split('/')
    if (this.testFlag) console.log(callParts)
    // callParts[0] == 'api'
    var topObj
    // var path
    var serviceIndex
    this.services.forEach((item, i) => {
      if (this.testFlag) console.log(item.id)
      if (item.id === callParts[1]) {
        serviceIndex = i
        topObj = item.obj
        // path = item.path
      }
    })
    if (this.testFlag) console.log(topObj)
    var componentObj = this.findSubObj(callParts[2], topObj) // e.g. valves -> 0
    if (this.testFlag) console.log(componentObj)
    var paramObj = this.findSubObj(callParts[3], componentObj) // e.g. valves -> 0 -> State
    if (this.testFlag) console.log(paramObj)
    if (paramObj === undefined) {
      console.log('Invalid API call!')
      console.log('NOT EXECUTING!')
      console.log(call)
      console.log(val)
      return
    }

    if (this.server) {
      this.server.handlePost({
        key: callParts[2],
        value: componentObj,
        subkey: callParts[3],
        subvalue: paramObj,
        service: this.services[serviceIndex],
        body: val,
        res: {
          send: () => {},
          json: () => {},
          status: () => {
            console.log('Mode Post Error')
            return {
              send: error => {
                console.log(error)
              },
            }
          },
        },
        basePath: '', // note: this would need to be filled in to use links
      })
    }
  }

  get CO0() {
    return this.hidden.controllerOutput[0]
  }

  get SP0() {
    return this.hidden.setPoint[0]
  }

  set SP0(val) {
    this.hidden.setPoint[0].value = val
    this.ctr.setTarget(val)
    this.hidden.setPoint[0].time = Date.now()
  }

  get PV0() {
    if (Date.now() - this.hidden.processValue[0].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[0]
    }

    this.device.getChannelInput(5).then(() => { // channel 5 is probably the bleed air thermocouple
      this.hidden.processValue[0] = this.device.hidden.channels[5].input
    }).catch(error => {
      console.log('get PV0 error')
      console.log(error)
    })
    return this.hidden.processValue[0]
  }

  get PV1() {
    if (Date.now() - this.hidden.processValue[1].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[1]
    }

    this.device.getChannelInput(0).then(() => { // probably 4-20 mA level sensor
      var current = this.device.hidden.channels[0].input.value
      // console.log(`Level Sensor Current: ${current*1000/120}`)
      this.hidden.processValue[1].time = this.device.hidden.channels[0].input.time
      this.hidden.processValue[2].time = this.device.hidden.channels[0].input.time

      // this.hidden.processValue[1].value = ((0 - 21.13) / (20 - 4) * (current - 4)) + 21.13 // mA --> inches
      // this.hidden.processValue[2].value = (-0.559_097 * (current)) + 11.838_937_26 // mA --> gal
      this.hidden.processValue[1].value = ((0 - 16) / (20.2-4) * ((current*1000/120) - 20.2)) // mA --> inches
      this.hidden.processValue[2].value = ((0 - 5) / (20.2-9.21) * ((current*1000/120) - 20.2)) // mA --> gal
    }).catch(error => {
      console.log('get PV1 error')
      console.log(error)
    })
    return this.hidden.processValue[1]
  }

  get PV2() {
    if (Date.now() - this.hidden.processValue[2].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[2]
    }

    this.device.getChannelInput(0).then(() => { // probably 4-20 mA level sensor
      var current = this.device.hidden.channels[0].input.value
      this.hidden.processValue[1].time = this.device.hidden.channels[0].input.time
      this.hidden.processValue[2].time = this.device.hidden.channels[0].input.time

      // this.hidden.processValue[1].value = ((0 - 21.13) / (20 - 4) * (current - 4)) + 21.13 // mA --> inches
      // this.hidden.processValue[2].value = (-0.559_097 * (current)) + 11.838_937_26 // mA --> gal

      this.hidden.processValue[1].value = ((0 - 16) / (20.2-4) * ((current*1000/120) - 20.2)) // mA --> inches
      this.hidden.processValue[2].value = ((0 - 5) / (20.2-9.21) * ((current*1000/120) - 20.2)) // mA --> gal
    }).catch(error => {
      console.log('get PV2 error')
      console.log(error)
    })
    return this.hidden.processValue[2]
  }

  get PV3() {
    if (Date.now() - this.hidden.processValue[3].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[3]
    }

    this.device.getChannelInput(6).then(() => { // channel 6 is probably humidifier
      this.hidden.processValue[3] = this.device.hidden.channels[6].input
    }).catch(error => {
      console.log('get PV3 error')
      console.log(error)
    })
    return this.hidden.processValue[3]
  }

  initialize() {
    try {
      // pulls in the units for temperature (C)
      this.device.getChannelType(5)
      this.device.getChannelType(6)
    } catch (error) {
      console.log('error getting channel 6 type on init')
      console.log(error)
      var retryWait = 2
      if (this.retryNumber < 4) {
        this.retryNumber += 1
        console.log('retrying in', retryWait, 'seconds')
        setTimeout(this.initialize.bind(this), retryWait * 1000)
      }
    }
  }
}

module.exports = {
  Device: ControlAdam,
}
