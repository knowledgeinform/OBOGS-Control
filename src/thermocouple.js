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

const uldaq = require('@qlc/uldaq')

// console.log(uldaq.getDaqDeviceInventory())

// console.log(uldaq.connectDaqDevice(0))
// console.log(uldaq.aiSetConfig(0, uldaq.config.AiConfigItem.AI_CFG_CHAN_TC_TYPE.value, 0, uldaq.config.AiConfigItem.AI_CFG_CHAN_TC_TYPE.options.TC_K))

// setInterval(() => {
//     console.log(uldaq.TIn(0))
// }, 1000)

const ui = require('./ui.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')

var tcID = 'Thermocouple'
var tcPath = 'config/' + tcID

class Thermocouple {
  constructor({id, Description = '', Details = '', router, testFlag = true, debugTest = false, uniqueId}) {
    // super()
    if (!testFlag) {
        uldaq.connectDaqDevice(Number(id))
        uldaq.aiSetConfig(Number(id), uldaq.config.AiConfigItem.AI_CFG_CHAN_TC_TYPE.value, 0, uldaq.config.AiConfigItem.AI_CFG_CHAN_TC_TYPE.options.TC_K)
    }
    this.ID = new ui.ShowUser({value: id})
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    this.uniqueId = new ui.ShowUser({value: uniqueId})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    Object.defineProperty(this, 'debugTest', {
      writable: true,
      value: debugTest,
    })

    /// ////////////////////////////////////////////////////////////////////////////
    Object.defineProperty(this, 'hiddenTemperature', {
      writable: true,
      value: new ad.DataPoint({units: '˚C'}),
    })
    Object.defineProperty(this, 'Temperature', {
      enumerable: true,
      get: () => {
        this.getTemperature()
        return (new ui.ShowUser({value: this.hiddenTemperature, type: ['input', 'datapoint']}))
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
    this.datastreams = {refreshRate: 300}
    this.updateable = []
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'Thermocouple_basic',
          fields: ['Temperature'],
          obj: this,
          testFlag: this.testFlag,
          objPath: tcPath,
        })},
        path: tcPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
  }

  async getTemperature() {
    try {
        this.hiddenTemperature.value = uldaq.TIn(Number(this.ID.value))
        this.hiddenTemperature.time = Date.now()
        this.hiddenStatus = 'Connected'
    } catch (error) {
        if (this.testFlag) {
            this.hiddenTemperature.value = Math.random()*10
            this.hiddenTemperature.time = Date.now()
            this.hiddenStatus = 'Testing'
        } else {
            console.error('Get temperature error')
            console.error(this.ID.value, this.uniqueId.value)
            this.hiddenStatus = error.toString()
        }
    } 
  }

  initialize() {
    // not currently used
  }
}

var tcmap = {}
var uniqueIds = ['2134319', '21342B6']

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing Thermocouples')
    var daqInventory = uldaq.getDaqDeviceInventory()
    var i = 0
    for (i = 0; i < uniqueIds.length; i++) {
        var filterMatch = daqInventory.filter(daq => daq.uniqueId === uniqueIds[i])
        if (filterMatch.length > 0) {
            for (var i2 = 0; i2 < daqInventory.length; i2++) {
                if (daqInventory[i2].uniqueId === uniqueIds[i]) {
                    tcmap[i] = new Thermocouple({id: i2.toString(), testFlag: test, debugTest: false, uniqueId: uniqueIds[i]})
                }
            }
        } else {
            console.log('THERMOCOUPLE: ', uniqueIds[i], ' NOT FOUND!!')
            if (test) {
                tcmap[i] = new Thermocouple({id: i.toString(), testFlag: test, debugTest: false, uniqueId: uniqueIds[i]})
            }
        }
    }
    return
  },
  id: tcID,
  obj: tcmap,
}

// var daqInventory = uldaq.getDaqDeviceInventory()
// console.log(daqInventory)