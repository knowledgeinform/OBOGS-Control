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
/**
 * @author Kat Moormann
 * @version 1.0
 * Pirani Manual: https://www.lesker.com/newweb/gauges/pdf/kjlc-mks-gp-925-manual.pdf
 * 925 MicroPirani Transducer
 * P/N: 925-11010
 * S/N: 925A041628
 * Methods Included:
 *  - Get Pressure
 *  - Set Atmospheric adjustment
 *  - Get Atmospheric adjustment
 */
 const ui = require('./ui.js')
 const db = require('./database.js')
 const ad = require('./abstract-driver.js')
 const bkup = require('./backup.js')

 var piraniID = '925 MicroPirani'
 var piraniPath = 'config/' + piraniID

 //_______________________________________________________________________________________________
class Pirani {
    constructor({id, Description = '', Details = '', router, testFlag = true, debugTest})
    {
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
//_______________________________________________________________________________________________
    Object.defineProperty(this, 'hiddenPressure', {
        writable: true,
        value: new ad.DataPoint({units: 'torr'}),
      })

      Object.defineProperty(this, 'Pressure', {
        enumerable: true,

        get: () => {
            this.getPressure().then(() => {
                this.hiddenStatus='Connected'
                }).catch(error => {
                      console.log('\n\nPirani Pressure Transducer error\n\n')
                      console.log(error)
                      this.hiddenStatus = error.toString()
              })
              return (new ui.ShowUser({value: this.hiddenPressure, type: ['input','datapoint']}))


        },
      })
//_______________________________________________________________________________________________
/**
 * Atmospheric Adjustment allows the user to adjust the MicroPirani full scale reading.
 * Vent the transducer to atmospheric pressure using the gas that corresponds to the gas calibration
 * setup. Atmospheric adjustment can only be executed with air or nitrogen.
 */
 Object.defineProperty(this, 'hiddenAtmosphericAdjustment', {
  writable: true,
  value: false,
})

Object.defineProperty(this, 'Atmospheric Adjustment', {
  enumerable: true,
  get: () => {
        return (new ui.ShowUser({value: this.hiddenAtmosphericAdjustment, type: ['output','binary']}))
  },

  set: (val) => {
    this.hiddenAtmosphericAdjustment = val

    if(val ===true)
    {
      // 760 torr - TBD
      var enable = '@253ATM!7.60E+2;FF'
      this.serialControl.serial(enable).catch(error=>{
        console.log(" \n\n Enable ERROR \n\n ")
        console.log(error)
      })
    } else
    {
      console.log('nothing')
    }
  }

})
//_______________________________________________________________________________________________
/**
 * The 925 is per factory default calibrated for reading in Nitrogen gas.
 * When exposed to atmospheric air the transducer will read higher values
 * typical 900 Torr at ambient pressure.
 */
 Object.defineProperty(this, 'hiddenDefaultSetting', {
  writable: true,
  value: false,
})

Object.defineProperty(this, 'Factory Default', {
  enumerable: true,
  get: () => {
        return (new ui.ShowUser({value: this.hiddenDefaultSetting, type: ['output','binary']}))
  },

  set: (val) => {
    this.hiddenDefaultSetting = val

    if(val ===true)
    {
      var enable = '@253FD!ALL;FF'
      this.serialControl.serial(enable).catch(error=>{
        console.log(" \n\n Enable ERROR \n\n ")
        console.log(error)
      })
    } else
    {
      console.log('nothing')
    }
  }

})
//_______________________________________________________________________________________________
    console.log(testFlag)
    this.datastreams = {refreshRate: 500}
    this.updateable = []
    console.log('here')
    this.initialize()
    this.Database = new ui.ShowUser({
    value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
        measurementName: 'Pirani_basic',
        fields: ['Pressure','Atmospheric Adjustment','Factory Default'],
        obj: this,
        testFlag: this.testFlag,
        objPath: piraniPath,
        })},
        path: piraniPath + '/' + db.path + '/' + bkup.fileName(this),
    }],
    type: ['output', 'link'],
    })
    }
//_______________________________________________________________________________________________
    async getPressure(){
        var command='@253PR4?;FF'
        var resp =await this.serialControl.serial(command, false, 200)
        resp = String(resp)
        resp = Number(resp.slice(7,15))
        this.hiddenPressure.value=Number(resp)
        this.hiddenPressure.time=Date.now()
        this.hiddenStatus='Connected'
    }

    initialize() {
         // initialize
         console.log('intiializing')
     }
}
//_______________________________________________________________________________________________
var piraniMap = {}
var piraniList = ['A']
var ports = ['COM25']
var seriallineSerials = ['ST215667']
var pnpIds = ['FTDIBUS\\VID_0403+PID_6011+ST215667D\\0000']

module.exports = {
    initialize: async function (test) {
      // test = false // set false - runs system in development mode
      console.log('intializing Pressure Transducer')
      var i = 0
      for (i = 0; i < piraniList.length; i++) {
        var pirani = piraniList[i]
        var router = new ad.Router({
          portPath: ports[i],
          baud: 9600,
          testFlag: test,
          timing: true,
          manufacturer: 'FTDI',
          seriallineSerial: seriallineSerials[i],
          pnpId: pnpIds[i],
        })
        if (!test) {
          try {
            await router.openPort()
          } catch (error) {
            console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
            throw error
          }
        }
        piraniMap[pirani] = new Pirani({id: pirani, testFlag: test, router: router, debugTest: false})
    }

return
  },
  id: piraniID,
  obj: piraniMap,
}
