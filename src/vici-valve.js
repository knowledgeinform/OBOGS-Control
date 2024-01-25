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

const ui = require('./ui.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')

var viciID = 'ViciValve'
var viciPath = 'config/' + viciID

class ViciValve {
  constructor({id, Description = '', Details = '', router, testFlag = true, debugTest = false}) {
    // super()
    this.ID = new ui.ShowUser({value: id})
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    Object.defineProperty(this, 'debugTest', {
      writable: true,
      value: debugTest,
    })

    Object.defineProperty(this, 'serialControl', {
      writable: true,
      value: new ad.SerialControl({
        router: router,
        testFlag: this.testFlag,
        timeout: 200,
        debugTest: this.debugTest,
      }),
    })

    Object.defineProperty(this, 'hiddenPosition', {
      writable: true,
      value: new ad.DataPoint({units: ''}),
    })
    Object.defineProperty(this, 'Position', {
      enumerable: true,
      get: () => {
        this.getPosition().then(() => {
          this.hiddenStatus = 'Connected'
        }).catch(error => {
          console.log('get vici position error')
          console.log(error)
          this.hiddenStatus = error.toString()
        })
        return (new ui.ShowUser({value: this.hiddenPosition, type: ['output', 'datapoint']}))
      },
      set: position => {
        position = Number(position)
        if (position >= 1 && position <= 6) {
          this.setPosition(position).then(() => {
            this.hiddenStatus = 'Connected'
          }).catch(error => {
            console.log('set vici position error')
            console.log(error)
            this.hiddenStatus = error.toString()
          })
        }
      },
    })

    Object.defineProperty(this, 'hiddenStatus', {
      writable: true,
      value: 'Disconnected',
    })
    Object.defineProperty(this, 'Status', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hiddenStatus, type: ['input', 'string']}))
      },
    })

    Object.defineProperty(this, 'hiddenCycle', {
      writable: true,
      value: {state: false, timer: undefined, interval: 2000, position: 1, maxPosition: 6},
    })
    Object.defineProperty(this, 'Max Cycle Position', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.hiddenCycle.maxPosition, type: ['output', 'number']})
      },
      set: val => {
        if (val >= 1 && val <= 6) {
          // not going to worry about the cycle temporarily being out of a given range
          // that is, the system won't try to move the valve to be in the range
          this.hiddenCycle.maxPosition = val
        }
      },
    })
    Object.defineProperty(this, 'Position Interval', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: new ad.DataPoint({value: this.hiddenCycle.interval, units: 'ms'}), type: ['output', 'datapoint']})
      },
      set: val => {
        if (val >= 2000) {
          this.stopCycleTimer()
          this.hiddenCycle.interval = val
          if (this.hiddenCycle.state) {
            this.startCycleTimer()
          }
        }
      },
    })
    Object.defineProperty(this, 'Cycle', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.hiddenCycle.state, type: ['output', 'binary']})
      },
      set: val => {
        this.hiddenCycle.state = val
        if (val) {
          this.hiddenCycle.state = val
          this.startCycleTimer()
        } else {
          this.stopCycleTimer()
        }
      },
    })

    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 300} // in ms
    this.updateable = ['Position']
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'ViciValve_basic',
          fields: ['Position'],
          obj: this,
          testFlag: this.testFlag,
          objPath: viciPath,
        })},
        path: viciPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
  }

  startCycleTimer() {
    if (this.hiddenCycle.timer !== undefined) {
      // always attempt to stop the timer before starting it
      this.stopCycleTimer()
    }
    this.hiddenCycle.timer = setInterval(this.cycleValve.bind(this), this.hiddenCycle.interval)
  }

  stopCycleTimer() {
    if (this.hiddenCycle.timer !== undefined) {
      clearInterval(this.hiddenCycle.timer)
    }
  }

  cycleValve() {
    this.hiddenCycle.position = this.hiddenCycle.position + 1
    if (this.hiddenCycle.position > this.hiddenCycle.maxPosition) {
      this.hiddenCycle.position = 1
    }
    this.setPosition(this.hiddenCycle.position)
  }

  async getPosition() {
    var command = 'CP\r\n'
    var resp = await this.serialControl.serial(command, false, 800)
    // console.log('resp')
    // console.log(resp)
    var pos = resp[0].replace('CP', '')
    // console.log('pos: ' + pos)
    this.hiddenPosition.value = Number(pos)
    this.hiddenPosition.time = Date.now()
  }

  async setPosition(position) {
    var command = 'GO0' + position + '\r\n'
    // console.log('setting')
    // console.log(command)
    this.serialControl.serial(command, false, 50).then(() => {
      this.hiddenStatus = 'Connected'
    }).catch(error => {
      // this command doesn't give a response, so just set a short timeout and catch the error
    })
  }

  initialize() {
    // not currently used
  }
}

var vicimap = {}
var viciList = ['Chemical Sampling','Sorbent Test']
// var ports = ['COM24','COM25']
// var manufacturers = ['FTDI','FTDI']
// var seriallineSerials = ['ST215667','ST215668']
// var pnpIds = ['FTDIBUS\\VID_0403+PID_6011+ST215667A\\0000','FTDIBUS\\VID_0403+PID_6011+ST215668C\\0000']

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing ViciValves')
    var routers = [
        new ad.Router({
        portPath: 'COM24',
        baud: 9600,
        testFlag: test,
        delimiter: '\r',
        manufacturer: 'FTDI',
        seriallineSerial: 'ST215667',
        // pnpId: 'FTDIBUS\\VID_0403+PID_6011+ST215667A\\0000',
      }),
      new ad.Router({
        portPath: 'COM25',
        baud: 9600,
        testFlag: test,
        delimiter: '\r',
        manufacturer: 'FTDI',
        seriallineSerial: 'ST215668C',
        // pnpId: 'FTDIBUS\\VID_0403+PID_6011+ST215668C\\0000',
      })
    ]
    var i = 0
    for (i = 0; i < viciList.length; i++) {
      var vici = viciList[i]
      if (!test) {
        try {
          await routers[i].openPort()
        } catch (error) {
          console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
          throw error
        }
      }
      vicimap[vici] = new ViciValve({id: vici, testFlag: test, router: routers[i], debugTest: false})
    }

    return
  },
  id: viciID,
  obj: vicimap,
  path: viciPath,
}

// async function f() {
//   test = false
//   console.log('intializing ViciValves')
//   var i = 0
//   for (i = 0; i < viciList.length; i++) {
//     var vici = viciList[i]
//     var router = new ad.Router({portPath: ports[i], baud: 9600, testFlag: test, delimiter: '\r', manufacturer: 'Prolific', seriallineSerial: serialLineSerials[i]})
//     if (!test) {
//       try {
//         await router.openPort()
//       } catch (error) {
//         console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
//         throw error
//       }
//     }
//     vicimap[vici] = new ViciValve({id: vici, testFlag: test, router: router, debugTest: true})
//   }
//   var position = 1
//   setInterval(() => {
//     console.log(vicimap['A'].Position)
//     vicimap['A'].Position = position
//     position = position + 1
//     if (position > 6) {
//       position = 1
//     }
//   }, 2000)
// }

// console.log('Waiting 4 s for serial devices')
// setTimeout(f, 4000)
