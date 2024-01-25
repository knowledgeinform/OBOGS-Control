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

const kikusui = require('./kikusui.js')
const db = require('./database.js')
const ui = require('./ui.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
// const EventEmitter = require('events')

var powerSupplyID = 'PowerSupplies'
var powerSupplyPath = 'config/' + powerSupplyID

var linker = {
  Idc: 'DC Current',
  Iac: 'AC Current',
  Irms: 'RMS Current',
  Ipk: 'Peak Current',
  Ipkh: 'PeakH Current',
  Wdc: 'DC Power',
  Wac: 'AC Power',
  Wacdc: 'ACDC Power',
  Vdc: 'DC Volts',
  Vac: 'AC Volts',
  Vrms: 'RMS Volts',
}

class PowerSupply {
  constructor({id, Description = '', Details = '', type = 'kikusui', testFlag = true}) {
    // super()
    this.ID = new ui.ShowUser({value: id})
    
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    this['PS Type'] = new ui.ShowUser({value: type})

    // hidden defined here to avoid being enumerated
    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: {},
    })
    if (type === 'kikusui') {
      this.hidden = new kikusui.Device({address: this.ID.value, testFlag: testFlag})
    } else {
      console.log('UKNOWN POWER-SUPPLY TYPE')
      console.log(type)
    }

    // Eunmerable --> this.Output updates gui after quering Kikusui outputState. Sets outputState from user input through GUI.
    Object.defineProperty(this, 'Output', {
      enumerable: true,
      get: () => {
        this.hidden.getOutput()
        // console.log(`PS outputState: ${this.hidden.outputState} \n`)
        return (new ui.ShowUser({value: this.hidden.outputState, type: ['output', 'binary']}))
      },
      set: (val) => {
        this.hidden.outputState = val
        if (val == true){
          // console.log(`Attempting --> Set Output: ${val} \n\n\n`)
          this.hidden.setOutput(1)
        } else{
          // console.log(`Attempting --> Set Output: ${val} \n\n\n`)
          this.hidden.setOutput(0)
        }
      }
    })

    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 1000}
    this.updateable = ['Output']
    Object.defineProperty(this, 'updateTimer', {
      writable: true,
    })
    this.initialize()
    this['DC Current'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'A'}), type: ['input', 'datapoint']})
    this['AC Current'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'A'}), type: ['input', 'datapoint']})
    this['RMS Current'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'A'}), type: ['input', 'datapoint']})
    this['Peak Current'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'A'}), type: ['input', 'datapoint']})
    this['PeakH Current'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'A'}), type: ['input', 'datapoint']})
    this['DC Power'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'W'}), type: ['input', 'datapoint']})
    this['AC Power'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'W'}), type: ['input', 'datapoint']})
    this['ACDC Power'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'W'}), type: ['input', 'datapoint']})
    this['DC Volts'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'V'}), type: ['input', 'datapoint']})
    this['AC Volts'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'V'}), type: ['input', 'datapoint']})
    this['RMS Volts'] = new ui.ShowUser({value: new ad.DataPoint({value: 0, units: 'V'}), type: ['input', 'datapoint']})
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'powersupply_basic',
          fields: ['DC Current',
            'AC Current',
            'RMS Current',
            'Peak Current',
            'PeakH Current',
            'DC Power',
            'AC Power',
            'ACDC Power',
            'DC Volts',
            'AC Volts',
            'RMS Volts'],
          obj: this,
          testFlag: this.testFlag,
          objPath: powerSupplyPath,
        })},
        path: powerSupplyPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
  }

  update() {
    Object.entries(this.hidden).forEach(([key, value]) => {
      if (linker[key] !== undefined) {
        this[linker[key]].value.value = value
        this[linker[key]].value.time = Date.now()
      }
    })
  }

  onError(e) {
    console.log('Power supply Error detected')
    console.log(e)
    // console.log(this.Database.value[0].obj['0'].Enable)
    if (this.hiddenDBstate === undefined) {
      Object.defineProperty(this, 'hiddenDBstate', {
        writable: true,
        value: this.Database.value[0].obj['0'].Enable.value,
      })
    }
    if (this.Database.value[0].obj['0'].Enable.value) {
      this.Database.value[0].obj['0'].Enable = false
    }
    if (this.updateTimer !== undefined) {
      // this is probably overkill, but it couldn't hurt
      clearTimeout(this.updateTimer)
    }
    setTimeout(() => {
      this.hidden.reauth()
    }, 5000)
  }

  initialize() {
    this.hidden.on('updated', () => {
      // console.log('Updating')
      this.update()
      this.updateTimer = setTimeout(() => {
        this.hidden.update(undefined, this.onError.bind(this))
      }, 200)
    })
    this.hidden.on('authenticated', () => {
      this.hidden.update()
      if (this.hiddenDBstate !== undefined) {
        this.Database.value[0].obj['0'].Enable = this.hiddenDBstate
      }
    })
    if (!this.testFlag) {
      this.hidden.initialize()
    }
  }
}

var powerSupplyMap = {}
var addresses = ['192.12.3.143']

module.exports = {
  initialize: function (test) {
    return new Promise(resolve => {
      // test = false
      console.log('intializing power supplies')
      addresses.forEach(address => {
        powerSupplyMap[address] = new PowerSupply({id: address, type: 'kikusui', testFlag: test})
      })

      return resolve()
    })
  },
  id: powerSupplyID,
  obj: powerSupplyMap,
}

// Add link to power-supply control page
