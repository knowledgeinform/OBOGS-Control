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
const Influx = require('influx')
const bkup = require('./backup.js')

var databaseID = 'DatabaseFront'
var databasePath = 'config/' + databaseID

class DatabaseFront {
  constructor({id, Description = '', Details = '', Series = [{host: 'localhost', sets: [], availableSets: []}], testFlag = true}) {
    // super()
    this.ID = new ui.ShowUser({value: id})
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    this.datastreams = {refreshRate: 1000}
    this.updateable = []

    this.Series = {value: Series, type: ['output', 'undefined']}

    this.defaults = {value: {}, type: ['output', 'undefined']}
    this.defaults.value.dbname = 'lab_data'
    this.defaults.value.username = 'root'
    this.defaults.value.port = '8086'

    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })

    this.initialize()

    Object.defineProperty(this, 'downloadRange', {
      writable: true,
      value: {
        start: (d => new Date(d.setDate(d.getDate() - 1)))(new Date()),
        end: new Date(Date.now()),
      },
    })
    this['Download Range'] = new ui.ShowUser({value: this.downloadRange, type: ['output', 'dateRange']})
  }

  initialize() {
    // not currently used
    this.Series.value.forEach((_, i) => {
      this.addFields(i)
    })
  }

  validateSeriesSelection(indexHost, newSets, cb) {
    console.log('validating')
    this.getAvailableSeries(indexHost).then(setsOfSeries => {
      // console.log('host: ' + indexHost)
      // console.log('address: ' + this.Series.value[indexHost].host)
      // console.log(this.Series.value[indexHost].influx)
      // console.log('setsOfSeries')
      // console.log(setsOfSeries)
      this.Series.value[indexHost].availableSets = setsOfSeries
      newSets.forEach(set => {
        if (!setsOfSeries.includes(set)) {
          newSets.splice(newSets.indexOf(set), 1)
        }
      })
      console.log('New sets')
      this.Series.value[indexHost].sets = newSets
      if (cb !== undefined) {
        cb(newSets)
      }
    }).catch(error => {
      console.log('validate series error')
      console.log(error)
    })
    
  }

  async getAvailableSeries(indexHost) {
    if (Object.prototype.hasOwnProperty.call(this.Series.value[indexHost], 'influx')) {
      return await this.Series.value[indexHost].influx.getMeasurements(this.defaults.value.dbname)
    }
    return ['A', 'B', 'C', 'F']
  }

  updateAvailableSeries(indexHost) {
    var dbFrontEndKey = 'host ' + indexHost + ' Available Data Series'
    if (Object.prototype.hasOwnProperty.call(this, dbFrontEndKey)) {
      this.validateSeriesSelection(indexHost, this.Series.value[indexHost].sets)
    } else {
      Object.defineProperty(this, dbFrontEndKey, {
        enumerable: true,
        get: () => {
          this.validateSeriesSelection(indexHost, this.Series.value[indexHost].sets) // this will also update this.Series.value[indexHost].sets if necessary
          return new ui.ShowUser({value: JSON.stringify(this.Series.value[indexHost].availableSets), type: ['input', 'string']})
        },
      })
    }
  }

  addFields(indexHost) {
    this.Series.value[indexHost].influx = new Influx.InfluxDB('http://' + this.defaults.value.username + '@' + this.Series.value[indexHost].host + ':' + this.defaults.value.port)
    Object.defineProperty(this, 'host ' + indexHost, {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.Series.value[indexHost].host})
      },
      set: val => {
        if (val === 'localhost' || this.validateIP(val)) {
          this.Series.value[indexHost].host = val
          this.Series.value[indexHost].influx = new Influx.InfluxDB('http://' + this.defaults.value.username + '@' + this.Series.value[indexHost].host + ':' + this.defaults.value.port)
          this.updateAvailableSeries(indexHost)
          // Note NEVER use bkup.save in a getter because it will end up calling itself recursively and freezing the program
          bkup.save(this, databasePath)
        }
      },
    })
    Object.defineProperty(this, 'host ' + indexHost + ' Selected Data Series', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: JSON.stringify(this.Series.value[indexHost].sets)})
      },
      set: val => {
        console.log('series selection')
        console.log('val')
        try {
          var newSets = JSON.parse(val)
          console.log(newSets)
          if (Array.isArray(newSets)) {
            this.validateSeriesSelection(indexHost, newSets, checkedSets => {bkup.save(this, databasePath)})
            bkup.save(this, databasePath)
          } else {
            console.log('selection change error')
            console.log(newSets)
            console.log('not an array')
          }
        } catch (error) {
          console.log('setting selected data series error')
          console.log(error)
        }
        
      },
    })
    this.updateAvailableSeries(indexHost)
  }

  validateIP(ip) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)) {
      return (true)
    }
    console.log('You have entered an invalid IP address!')
    return (false)
  }
}

var databasemap = {A: {Series: [
  {host: 'localhost', sets: [], availableSets: []},
  {host: '192.12.3.204', sets: [], availableSets: []},
  {host: '192.12.3.14', sets: [], availableSets: []},
]}}

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing DatabaseFront')
    if (bkup.configExists(databasePath)) {
      // this should eventually be in a try-catch with a default config
      var loadMap = bkup.load(databasePath)
      Object.entries(loadMap).forEach(([key, value]) => {
        // specify bare-minimum amount that the config should have
        if (value.Series) {
          console.log(key)
          databasemap[key] = new DatabaseFront({id: key,
            Series: value.Series.value,
            testFlag: test,
            Description: value.Description.value,
            Details: value.Details.value,
          })
        } else {
          // did not have bare minimum so fail out loudly
          console.log('Configuration missing critical component(s):')
          console.log('value.Series')
          console.log(value)
        }
      })
    } else {
      // re-write mfcMap object into object of MFC classes
      Object.entries(databasemap).forEach(([key, value]) => {
        databasemap[key] = new DatabaseFront({id: key, Series: value.Series, testFlag: test})
        bkup.save(databasemap[key], databasePath)
      })
    }

    return
  },
  id: databaseID,
  obj: databasemap,
}

// async function f() {
//   var a = new DatabaseFront({id: 'A', Series: databasemap['A'].Series, testFlag: false})
//   var id = 0
//   setInterval(() => {
//     var dbkey = 'host ' + id + ' Available Data Series'
//     console.log(dbkey)
//     console.log(a[dbkey])
//   }, 3000)
// }

// f()
