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
const voc = require('./voc.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')

var hcdID = 'HCDs'
var hcdPath = 'config/' + hcdID

class HCD {
  constructor({id, Description = '', Details = '', type = 'VOC TRAQ', router, testFlag = true, debugTest}) {
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
    this['HCD Type'] = new ui.ShowUser({value: type})
    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: {},
    })
    if (type === 'VOC TRAQ') {
      this.hidden = new voc.Device({router: router, testFlag: testFlag, debugTest: debugTest})
    } else {
      console.log('UKNOWN HCD TYPE')
      console.log(type)
    }
    Object.defineProperty(this, 'Concentration', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.Concentration, type: ['input', 'datapoint']}))
      },
    })
    Object.defineProperty(this, 'Status', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.Status, type: ['input', 'string']}))
      },
    })
    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 1000}
    this.updateable = []
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'HCD_basic',
          fields: ['Concentration'],
          obj: this,
          testFlag: this.testFlag,
          objPath: hcdPath,
        })},
        path: hcdPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
    // Object.defineProperty(this, 'Port', {
    //   enumerable: true,
    //   get: function () {
    //     if (this.testFlag) console.log(this.hidden.router.portPath)
    //     // if (this.testFlag) console.log(val)
    //
    //     return (new ui.ShowUser({value: this.hidden.router.portPath, type: ['output', 'list']}))
    //   },
    //   set: function (val) {
    //     if (debugTest || testFlag) console.log('New Port')
    //     if (debugTest || testFlag) console.log(val)
    //
    //     // only reopen if it's different
    //     if (val !== this.hidden.router.portPath) {
    //       var dbState = this.Database.value[0].obj['0'].Enable.value
    //       this.Database.value[0].obj['0'].Enable = false
    //       if (debugTest || testFlag) console.log('dbState')
    //       if (debugTest || testFlag) console.log(dbState)
    //       this.hidden.stopListening('Reopening Port')
    //       this.hidden.router.reopen({portPath: val})
    //
    //       // since reading concentration is completely passive (i.e. no serial line
    //       // communication, just a simple time-out should be enough)
    //       setTimeout(() => {
    //         if (debugTest || testFlag) console.log('dbState')
    //         if (debugTest || testFlag) console.log(dbState)
    //         this.Database.value[0].obj['0'].Enable = dbState
    //         this.hidden.listen()
    //       }, 2000)
    //     }
    //   },
    // })
    // Object.defineProperty(this, 'Portlist', {
    //   get: function () {
    //     return this.hidden.router.PortList
    //   },
    // })
  }

  initialize() {
    // not currently used
    this.hidden.startMeasuring()
  }
}

var hcdmap = {}
var hcdList = ['A']
var ports = ['/dev/ttyUSB2']
var serialLineSerials = ['AL02ZPOO']

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing HCDs')
    var i = 0
    for (i = 0; i < hcdList.length; i++) {
      var hcd = hcdList[i]
      var router = new ad.Router({portPath: ports[i], baud: 115200, testFlag: test, timing: true, manufacturer: 'FTDI', seriallineSerial: serialLineSerials[i]})
      if (!test) {
        try {
          await router.openPort()
        } catch (error) {
          console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
          throw error
        }
      }
      hcdmap[hcd] = new HCD({id: hcd, type: 'VOC TRAQ', testFlag: test, router: router, debugTest: false})
    }

    return
  },
  id: hcdID,
  obj: hcdmap,
}
