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

var oxiID = 'Oxigraf'
var oxiPath = 'config/' + oxiID

class Oxigraf {
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
        timeout: 300,
        debugTest: this.debugTest,
      }),
    })
    /// ////////////////////////////////////////////////////////////////////////////
    Object.defineProperty(this, 'hiddenConcentration', {
      writable: true,
      value: new ad.DataPoint({units: '%'}),
    })
    Object.defineProperty(this, 'Concentration', {
      enumerable: true,
      get: () => {
        this.getConcentration().catch(error => {
          console.log('get oxigraf concentration error')
          console.log(error)
          this.hiddenStatus = error.toString()
        })
        return (new ui.ShowUser({value: this.hiddenConcentration, type: ['input', 'datapoint']}))
      },
    })
    /// ////////////////////////////////////////////////////////////////////////////
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

    /// ////////////////////////////////////////////////////////////////////////////
    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 500}
    this.updateable = []
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'Oxigraf_basic',
          fields: ['Concentration'],
          obj: this,
          testFlag: this.testFlag,
          objPath: oxiPath,
        })},
        path: oxiPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
  }

  async getConcentration() {
    var command = Buffer.from('1b', 'hex') + Buffer.from('R0,1;')
    var resp = await this.serialControl.serial(command, false, 300)
    resp = resp[0].toString()
    if (resp.includes('\r\n')) {
      var split = resp.split(' ')
      // console.log(split)
      this.hiddenConcentration.value = Number(split[split.length - 1].replace('\r\n', '')) / 100.0
      this.hiddenConcentration.time = Date.now()
      this.hiddenStatus = 'Connected'
    }
  }

  initialize() {
    // not currently used
  }
}

var oximap = {}
var oxiList = ['A']
var ports = ['COM23']
var seriallineSerials = ['ST215667B']
// var pnpIds = ['FTDIBUS\\VID_0403+PID_6011+ST215667B\\0000']

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing Oxigrafs')
    var i = 0
    for (i = 0; i < oxiList.length; i++) {
      var oxi = oxiList[i]
      var router = new ad.Router({
        portPath: ports[i],
        baud: 9600,
        testFlag: test,
        timing: true,
        manufacturer: 'FTDI',
        seriallineSerial: 'ST215667B',
        // pnpId: 'FTDIBUS\\VID_0403+PID_6011+ST215667B\\0000'
      })
      if (!test) {
        try {
          await router.openPort()
        } catch (error) {
          console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
          throw error
        }
      }
      oximap[oxi] = new Oxigraf({id: oxi, testFlag: test, router: router, debugTest: false})
    }

    return
  },
  id: oxiID,
  obj: oximap,
}

// async function f() {
//   var test = false
//   for (i = 0; i < oxiList.length; i++) {
//     var oxi = oxiList[i]
//     var router = new ad.Router({portPath: ports[i], baud: 9600, testFlag: test, timing: true, manufacturer: 'Prolific', seriallineSerial: serialLineSerials[i]})
//     if (!test) {
//       try {
//         await router.openPort()
//       } catch (error) {
//         console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
//         throw error
//       }
//     }
//     oximap[oxi] = new Oxigraf({id: oxi, testFlag: test, router: router, debugTest: true})
//   }

//   setInterval(() => {
//     console.log(oximap['A'].Concentration)
//   }, 500)
// }

// console.log('Waiting 4 s for serial devices')
// setTimeout(f, 4000)
