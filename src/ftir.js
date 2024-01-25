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
// const db = require('./database.js')
// const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')
const shimadzu = require('./shimadzu.js')
const max = require('./max-ir.js')

var ftirID = 'FTIR'
var ftirPath = 'config/' + ftirID

function isSetter(obj, prop) {
  return Boolean(Object.getOwnPropertyDescriptor(obj, prop).set)
}

class FTIR {
  constructor({Type = 'shimadzu', Description = '', Details = '', testFlag = true, debugTest}) {
    // super()
    this.Type = new ui.ShowUser({value: Type})
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

    if (this.Type.value === 'shimadzu') {
      Object.defineProperty(this, 'hidden', {
        value: new shimadzu.Device({testFlag: this.testFlag, debugTest: this.debugTest, configPath: ftirPath}),
      })
    } else if (this.Type.value === 'max') {
      Object.defineProperty(this, 'hidden', {
        value: new max.Device({testFlag: this.testFlag, debugTest: this.debugTest, configPath: ftirPath, parent: this}),
      })
    } else {
      throw new Error('Invalid FTIR Type')
    }

    Object.defineProperty(this, 'Status', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.status, type: ['input', 'string']}))
      },
    })

    Object.defineProperty(this, 'Interferogram', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.interferogram, type: ['input', 'datapoint']}))
      },
    })

    Object.defineProperty(this, 'Spectrum', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.spectrum, type: ['input', 'datapoint']}))
      },
    })

    Object.defineProperty(this, 'Wavenumbers', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.wavenumbers, type: ['input', 'datapoint']}))
      },
    })

    this.Analytelist = ['NOT SET',
      'acetaldehyde',
      'acetone',
      'acrolein',
      'benzene',
      'butane',
      'carbon dioxide',
      'carbon monoxide',
      'chloromethane',
      'decene',
      'dichloromethane',
      'dichloroethylene',
      'ethanol',
      'ethylene',
      'formaldehyde',
      'heptane',
      'hexane',
      'hydrogen fluoride',
      'hydrogen peroxide',
      'm-xylene',
      'methanol',
      'methyl bromide',
      'nitric oxide',
      'nitrogen dioxide',
      'nitrous oxide',
      'octane',
      'ozone',
      'pentane',
      'propanal',
      'propyne',
      'toluene',
      'trichloroethylene']

    Object.defineProperty(this, 'analyteSelection', {
      writable: true,
      value: this.Analytelist[0],
    })
    Object.defineProperty(this, 'Analyte', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.analyte, type: ['output', 'list']}))
      },
      set: val => {
        this.analyteSelection = val
        this.hidden.analyte = this.analyteSelection
      },
    })

    Object.defineProperty(this, 'Lamp Spectrum', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.lampSpectrum, type: ['output', 'binary']}))
      },
      set: val => {
        this.hidden.lampSpectrum = val
      },
    })

    Object.defineProperty(this, 'Zero Spectrum', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hidden.zeroSpectrum, type: ['output', 'binary']}))
      },
      set: val => {
        this.hidden.zeroSpectrum = val
      },
    })

    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 6000}
    this.updateable = []
    this.checkAdditionalFields()
    this.initialize()
  }

  checkAdditionalFields() {
    if (Object.prototype.hasOwnProperty.call(this.hidden, 'AdditionalFields')) {
      console.log('Found additional fields')
      console.log(this.hidden.AdditionalFields)
      Object.entries(this.hidden.AdditionalFields).forEach(([key]) => {
        Object.defineProperty(this, key, {
          enumerable: true,
          get: () => {
            return this.hidden.AdditionalFields[key]
          },
          set: val => {
            if (isSetter(this.hidden.AdditionalFields, key)) {
              this.hidden.AdditionalFields[key] = val
            } else {
              this.hidden.AdditionalFields[key].value = val
            }
          },
        })
      })
    }
  }

  initialize() {
    this.hidden.setup().catch(error => {
      console.log('FTIR intialization error')
      console.log(error)
    })
  }
}

var ftirmap = {max: {}}

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing FTIRs')

    Object.entries(ftirmap).forEach(([key, value]) => {
      ftirmap[key] = new FTIR({Type: key,
        testFlag: test,
        Description: value.Description,
        Details: value.Details,
      })
    })
    return
  },
  id: ftirID,
  obj: ftirmap,
  path: ftirPath,
}

// async function f() {
//   var test = false
//   for (i = 0; i < ftirList.length; i++) {
//     var ftir = ftirList[i]
//     var router = new ad.Router({portPath: ports[i], baud: 9600, testFlag: test, timing: true, manufacturer: 'Prolific', seriallineSerial: serialLineSerials[i]})
//     if (!test) {
//       try {
//         await router.openPort()
//       } catch (error) {
//         console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
//         throw error
//       }
//     }
//     ftirmap[ftir] = new FTIR({id: ftir, testFlag: test, router: router, debugTest: true})
//   }

//   setInterval(() => {
//     console.log(ftirmap['A'].Concentration)
//   }, 500)
// }

// console.log('Waiting 4 s for serial devices')
// setTimeout(f, 4000)
