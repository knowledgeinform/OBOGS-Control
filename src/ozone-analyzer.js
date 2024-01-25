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

const db = require('./database.js')
const ui = require('./ui.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
const ozone49C = require('./ozone49-c.js')
const ozone49iq = require('./ozone49-iq.js')

var ozoneAnalyzerID = 'OzoneAnalyzer'
var ozoneAnalyzerPath = 'config/' + ozoneAnalyzerID

class OzoneAnalyzer {
  constructor({
    id,
    // Description = '',
    // Details = '',
    type = 'Thermo49C',
    testFlag = true,
    router,
  }) {
    // super()
    this.ID = new ui.ShowUser({value: id})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    this['Ozone Analyzer Type'] = new ui.ShowUser({value: type})
    // hidden defined here to avoid being enumerated
    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: {},
    })
    if (type === 'Thermo49C') {
      this.hidden = new ozone49C.Device({id: Number(this.ID.value), testFlag: testFlag, router: router})
    } else if (type === 'Thermo49iQ') {
      this.hidden = new ozone49iq.Device({host: this.ID.value, testFlag: testFlag})
    } else {
      console.log('UKNOWN OZONE ANALYZER TYPE')
      console.log(type)
      return
    }
    // note that in value, the path is intentionally left undefined for now
    this.datastreams = {refreshRate: 12000}
    this.updateable = ['Range']
    Object.defineProperty(this, 'O3 Concentration', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.o3, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'O3 Background', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.o3Background, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Bench Temperature', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.benchTemperature, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Lamp Temperature', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.lampTemperature, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Cell A Intensity', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.cellAIntensity, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Cell B Intensity', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.cellBIntensity, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Chamber Pressure', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.pressure, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Flow A', {
      enumerable: true,
      get: function () {
        var ret = this.hidden.flow
        return new ui.ShowUser({value: ret[0], type: ['input', 'datapoint']})
        // return new ui.ShowUser({value: this.hidden., type: ['input', 'datapoint']})
      },
    })
    if (this.hidden.status) {
      Object.defineProperty(this, 'Status', {
        enumerable: true,
        get: () => {
          return new ui.ShowUser({value: this.hidden.status, type: ['input', 'string']})
        }
      })
    }
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'ozoneAnalyzer_basic2',
          fields: ['O3 Concentration',
            'O3 Background',
            'Bench Temperature',
            'Lamp Temperature',
            'Cell A Intensity',
            'Cell B Intensity',
            'Chamber Pressure',
            'Flow A'],
          obj: this,
          testFlag: this.testFlag,
          objPath: ozoneAnalyzerPath,
          units: 's',
          readRate: 10,
        })},
        path: ozoneAnalyzerPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
  }
}

var ozoneAnalyzerMap = {}
var addresses = ['192.12.3.149']

module.exports = {
  initialize: async function (test) {
    console.log('intializing ozone analyzers')
    // test = false
    addresses.forEach((address, i) => {
      ozoneAnalyzerMap[address] = new OzoneAnalyzer({id: address, type: 'Thermo49iQ', testFlag: test})
    })
  },
  id: ozoneAnalyzerID,
  obj: ozoneAnalyzerMap,
}
