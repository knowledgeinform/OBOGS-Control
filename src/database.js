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
const dbPath = require('./db-path.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
const Influx = require('influx')
const fs = require('fs')
// import {INanoDate} from 'influx'
// const { INanoDate } = require('influx')
const {Readable} = require('stream')
const homedir = require('os').homedir()
const path = require('path')

// Database changes
const query = require('./query-controller')

var databaseID = 'Database'
var databasePath = databaseID

/*
Use if the toISOString function doesn't quite work properly for the RFC3339
standard that InfluxDB uses
*/

// function ISODateString(d){
//  function pad(n){
//    return n<10 ? '0'+n : n
//  }
//  return (d.getUTCFullYear()+'-'+
//       pad(d.getUTCMonth()+1)+'-'+
//       pad(d.getUTCDate())+'T'+
//       pad(d.getUTCHours())+':'+
//       pad(d.getUTCMinutes())+':'+
//       pad(d.getUTCSeconds())+'Z')
// }

/*
schema: [
   {
     measurement: 'response_times',
     fields: {
       path: Influx.FieldType.STRING,
       duration: Influx.FieldType.INTEGER
     },
     tags: [
       'host'
     ]
   }
 ]
*/

// var toType = function(obj) {
//   return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
// }

function sameType(a, b) {
  var objectA = Object(a) === a
  var objectB = Object(b) === b
  if (objectA && objectB)
    return Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
  else if (!objectA && !objectB)
    return typeof a === typeof b
  else
    return false
}

function detectType(prop, obj) {
  // key types ui.ShowUser {value, type}
  // key types ad.Datapoint {value, units, time}
  var typeObj = {
    impliedTag: undefined,
    type: Influx.FieldType.FLOAT,
    value: undefined,
    units: undefined,
    timeStamp: undefined,
  }
  // check and remove wrapper units:
  var localObj = obj[prop]

  if (sameType(localObj, new ui.ShowUser({}))) {
    // console.log('ShowUser')
    typeObj = detectType('value', localObj)
    if (typeObj.impliedTag === 'ad.DataPoint') {
      typeObj.impliedTag = prop + '_units'
    } else if (typeObj.impliedTag === undefined) {
      // this case can be safely ignored
    } else {
      console.log('impliedTag field unknown')
      console.log(typeObj.impliedTag)
    }
  } else if (sameType(localObj, new ad.DataPoint({}))) {
    // Datapoint type always has a units field
    // console.log('datapoint')
    typeObj = detectType('value', localObj)
    typeObj.impliedTag = 'ad.DataPoint'
    typeObj.units = localObj.units
    typeObj.timeStamp = localObj.time
  } else if (Array.isArray(localObj)) {
    typeObj.type = 'Array'
    typeObj.value = localObj
  } else {
    if (typeof localObj === 'number') {
      typeObj.type = Influx.FieldType.FLOAT
      typeObj.value = localObj
    } else if (typeof localObj === 'string') {
      typeObj.type = Influx.FieldType.STRING
      typeObj.value = localObj
    } else if (typeof localObj === 'boolean') {
      typeObj.type = Influx.FieldType.BOOLEAN
      typeObj.value = localObj
    } else {
      console.log('Could not find property type')
      console.log(obj)
      console.log(prop)
      console.log(localObj)
      throw new Error('Could not find property type')
    }
  }
  return typeObj
}

/*
 function looks for such tags as ID, Index, etc. which the user will want at some
 point in the future, but is likely to forget
*/

function detectObjectSpecificImpliedTags(schemaTags, obj) {
  var tagsToCheckFor = ['id', 'ID', 'iD', 'Id', 'index', 'Index', 'INDEX']
  for (var tag of tagsToCheckFor) {
    if (Object.prototype.hasOwnProperty.call(obj, tag) && !schemaTags.includes(tag)) {
      schemaTags.push(tag)
    }
  }
}

function generateSchema({measurementName, fields, tags, obj}) {
  if (measurementName === undefined) {
    return
  }
  var schema = [{
    measurement: measurementName,
    fields: {},
    tags: [],
  }]

  var impliedTags = []
  for (var field of fields) {
    var dType = detectType(field, obj)
    if (dType.impliedTag === 'ad.DataPoint') {
      dType.impliedTag = field + '_units'
    }
    impliedTags.push(dType.impliedTag)
    Object.defineProperty(schema[0].fields, field, {
      enumerable: true,
      value: dType.type,
    })
  }
  schema[0].tags = tags
  var tag
  for (tag of impliedTags) {
    if (tag) {
      schema[0].tags.push(tag)
    }
  }
  detectObjectSpecificImpliedTags(schema[0].tags, obj)

  return schema
}

// Define a new class that extends the builin readable class in Node.js
// This class is used to create custom readbale streams of data
class StreamQueryC extends Readable {
  constructor({dbGUI}) {
    super()
    this.db = dbGUI
    this.lastResult = undefined
    this.chunkStart = this.db.downloadRange.start
  }

  _read(size) {
    this.chunkStart = ((this.lastResult) ? this.lastResult.timestamp : new Date(this.db.downloadRange.start).getTime())
    var q = this.db.query()
    var qAddition = ' limit ' + this.db.limit.toString() + ' offset ' + this.db.offset.toString()
    var qSend = q + qAddition
    this.db.testFlag = false

    // Creating boundary for the offset value
    if (this.db.testFlag) {
      if (this.db.offset <= 0) {
        console.log('Bumping up offset')
        this.db.offset = 65
      }
      console.log(this.db.offset)
      if (this.db.offset > 90) {
        this.db.offset = 0
        console.log(this.push(null))
      } else {
        console.log(this.push(String.fromCharCode(this.db.offset++)))
      }
    } else {
      // Calling query-controller.js
      // getDatabase(collectionName, startDate, endDate, limit, offset)
      console.log('from:',this.chunkStart,'to:',new Date(this.db.downloadRange.end).getTime())
      query.getDatabase(this.db.ID.value,this.chunkStart, new Date(this.db.downloadRange.end).getTime(),
        this.db.limit, this.db.offset).then(result => {
          // then.(result =>{ } starts a new promise once the promise returned from the asynchronous operation getDatabase is fulfilled
          // Push a stringified version of the result object onto a readable stream
          this.lastResult = result[result.length - 1]
          if (this.lastResult) {
            if (this.lastResult.timestamp) {
              console.log('this.lastResult.timestamp',this.lastResult.timestamp)
            } else {
              console.log('this.lastResult', this.lastResult)
            }
          }
          this.push(JSON.stringify(result))
          if (result.length < this.db.limit) {
            // If you are approaching the end of the query push null
            this.lastResult = undefined
            this.db.offset = 0
            this.push(null)
          } else {
            // Traverse through the data by incrementing the offset value by its limit
            this.db.offset += this.db.limit
          }
        }).catch(error => {
          console.log(error)
        }
      )

      try {
        console.log('Done writing to file.')
      } catch (error) {
        console.log('Error writing to file', error)
      }
    }
  }
}

const dbName = 'lab_data'

class DatabaseGUIC {
  constructor({measurementName, fields, tags = [], obj, batchWriteSize = 10, enable = false, units = 'ms', readRate = 500, testFlag, objPath, limit = 1500}) {
    // testFlag = false
    this.ID = new ui.ShowUser({value: measurementName})
    Object.defineProperty(this, 'hEnable', {
      writable: true,
      value: new ui.ShowUser({value: enable, type: ['output', 'binary']}),
    })
    if (objPath) {
      Object.defineProperty(this, 'path', {
        writable: true,
        value: (obj.parent) ? objPath + '/' + databaseID + '/' + bkup.fileName(obj.parent) + '/' + bkup.fileName(this) + '.json' : objPath + '/' + databaseID + '/' + bkup.fileName(obj) + '/' + bkup.fileName(this) + '.json',
      })
    }

    Object.defineProperty(this, 'Download Path', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: dbPath.path})
      },
      set: val => {
        dbPath.path = val
        // if (validPath(val)) {
        //
        // }
      },
    })
    // this['Download Path'] = new ui.ShowUser({value: path.join(homedir, 'Downloads')})

    Object.defineProperty(this, 'timer', {
      writable: true,
      value: setInterval(() => {}, 5000),
    })
    clearInterval(this.timer)

    Object.defineProperty(this, 'Enable', {
      enumerable: true,
      get: () => {
        return this.hEnable
      },
      set: val => {
        console.log('val')
        console.log(val)
        if (val) {
          // true --> on
          if (this.testFlag) console.log('refreshing timer')
          // clear it, in case someone had forgotten to disable it before re-enabling it
          clearInterval(this.timer)
          this.timer = setInterval(this.writeToDatabase.bind(this), this.msrate())
        } else {
          if (this.testFlag) console.log('clearing timer')
          clearInterval(this.timer)
        }
        this.hEnable.value = val
      },
    })

    Object.defineProperty(this, 'hunits', {
      writable: true,
      value: new ui.ShowUser({value: units, type: ['output', 'list']}),
    })

    Object.defineProperty(this, 'units', {
      enumerable: true,
      get: () => {
        return this.hunits
      },
      set: val => {
        this.hunits.value = val
        this['Read Interval'].value.units = this.hunits.value
      },
    })
    this.unitslist = ['ms', 's', 'min', 'hr', 'day']
    this['Read Interval'] = new ui.ShowUser({value: new ad.DataPoint({value: readRate, units: this.units.value}), type: ['output', 'datapoint']}) // ms

    Object.defineProperty(this, 'obj', {
      value: obj,
    })
    Object.defineProperty(this, 'fields', {
      value: fields,
    })
    Object.defineProperty(this, 'tags', {
      writable: true,
      value: tags,
    })
    this['Batch Write Size'] = new ui.ShowUser({value: batchWriteSize, type: ['output', 'number']})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    Object.defineProperty(this, 'measurements', {
      value: [],
      writable: true,
    })
    Object.defineProperty(this, 'downloadRange', {
      writable: true,
      value: {
        start: (d => new Date(d.setDate(d.getDate() - 1)))(new Date()),
        end: new Date(Date.now()),
      },
    })
    this['Download Range'] = new ui.ShowUser({value: this.downloadRange, type: ['output', 'dateRange']})
    Object.defineProperty(this, 'Preview', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: Date.now(), type: ['output', 'button']}))
      },
      set: ({res}) => {
        // query data
        // format as csv
        // initiate download
        res.send()
      },
    })
    Object.defineProperty(this, 'downloadAction', {
      writable: true,
      value: new ui.ShowUser({
        value: new ui.Action({name: 'download'}),
        type: ['output', 'button'],
      }),
    })
    Object.defineProperty(this, 'Download', {
      enumerable: true,
      get: () => {
        return this.downloadAction
      },
      set: ({res}) => {
        if (this.testFlag) console.log('inside setter')
        var streamQuery = new StreamQueryC({dbGUI: this})
        this.downloadAction.value.strFileName = this.ID.value + '-' +
          (new Date(this.downloadRange.start).toISOString()) + '-' +
          (new Date(this.downloadRange.end).toISOString()) + '.json'
        this.downloadAction.value.strMimeType = 'text/json'
        // this.queryRange()
        res.setHeader('Content-type', 'application/json')
        res.setHeader('File-Name', this.downloadAction.value.strFileName)
        streamQuery.once('end', () => {
          // streamQuery.unpipe(res)
          // streamQuery.destroy()
          // console.log('Done streaming')
          // streamQuery.unpipe()
          // streamQuery.pause()
          // streamQuery.destroy()
          // console.log(streamQuery.readableFlowing)
          // res.end()
        })
        // console.log(streamQuery)
        streamQuery.pipe(res)
        // streamQuery.resume()
        // console.log(streamQuery)
        // query data
        // format as csv
        // initiate download
      },
    })
    Object.defineProperty(this, 'limit', {
      value: limit, // assumes 200 bytes/measurement and 16 kB chunk --> # number of measurements per chunk
      // 80 was going extremely slow so trying 2000
    })
    Object.defineProperty(this, 'offset', {
      writable: true,
      value: 0,
    })
    Object.defineProperty(this, 'Plot', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: Date.now(), type: ['output', 'button']}))
      },
      set: ({res}) => {
        // query data
        // open new window
        // plot data
        // continuos plot/query?
        res.send()
      },
    })
    if (Object.prototype.hasOwnProperty.call(this.obj, 'hidden')) {
      console.log('obj has hidden')
      if (Object.prototype.hasOwnProperty.call(this.obj.hidden, 'maxRefreshInterval')) {
        console.log('obj has maxRefreshInterval')
        Object.defineProperty(this, 'Refresh Lock', {
          enumerable: true,
          get: () => {
            return new ui.ShowUser({value: this.obj.hidden.lockRefreshInterval, type: ['output', 'binary']})
          },
          set: val => {
            console.log('val')
            console.log(val)
            if (val) {
              // true --> on
              if (this.testFlag) console.log('Locking Refresh Interval')
            } else {
              if (this.testFlag) console.log('Unlocking Refresh Interval')
            }
            this.obj.hidden.maxRefreshInterval = this.msrate()
            this.obj.hidden.lockRefreshInterval = val
          },
        })
      }
    }
    // console.log(this)
    this.initialize(testFlag)
    // console.log(this)
    // this.extend(Readable)
    // console.log(this)
  }

  msrate() {
    var msrate = 500 // default
    if (this.units.value === 'ms') {
      msrate = this['Read Interval'].value.value
    } else if (this.units.value === 's') {
      msrate = this['Read Interval'].value.value * 1000
    } else if (this.units.value === 'min') {
      msrate = this['Read Interval'].value.value * 60 * 1000
    } else if (this.units.value === 'hr') {
      msrate = this['Read Interval'].value.value * 60 * 60 * 1000
    } else if (this.units.value === 'day') {
      msrate = this['Read Interval'].value.value * 24 * 60 * 60 * 1000
    } else {
      console.log('UNKNOWN units')
    }
    if (msrate > 2147483647) {
      msrate = 2147483647
    }
    // console.log('msrate: '+msrate)
    return msrate
  }

  initialize(test) {
    var schema = generateSchema({measurementName: this.ID, fields: this.fields, tags: this.tags, obj: this.obj})
    console.log(schema)
    // console.log(this)
    this.tags = schema[0].tags
    Object.defineProperty(this, 'Tags', {
      enumerable: true,
      value: new ui.ShowUser({value: this.tags.join(', ')}),
    })
    Object.defineProperty(this, 'Fields', {
      enumerable: true,
      value: new ui.ShowUser({value: Object.values(this.fields).join(', ')}),
    })
    this.loadConfiguration()
    // console.log(test)
    if (!test) {
      this.setupMongoDB()
      // Object.defineProperty(this, 'influx', {
      //   value: this.setUpInflux(schema),
      // })
    }
  }

  loadConfiguration() {
    console.log('Loading configuration from ' + this.path)
    if (this.path) {
      if (bkup.configExists(this.path)) {
        var loadMap = bkup.load(this.path)
        console.log('Attempting to load from file')
        Object.entries(loadMap).forEach(([, value]) => {
          if (value.units) {
            this.units = value.units.value
          }
          if (value['Read Interval']) {
            this['Read Interval'].value.value = value['Read Interval'].value.value
          }
          if (value['Batch Write Size']) {
            this['Batch Write Size'].value = value['Batch Write Size'].value
          }

          if (value['Refresh Lock'] && Object.prototype.hasOwnProperty.call(this, 'Refresh Lock')) {
            this.obj.hidden.maxRefreshInterval = this.msrate()
            this.obj.hidden.lockRefreshInterval = value['Refresh Lock'].value
          }

          if (value.Enable) {
            // set enable last
            // wait an extra 30 seconds to give serial-line devices (and other
            // slow devices) time to intiailize and settle
            setTimeout(() => {
              this.Enable = value.Enable.value
            }, 90000)
          }
        })
      } else {
        bkup.save(this, this.path)
      }
    }
  }

  query() {
    var start = Date.parse(this.downloadRange.start).toString() + '000000'
    var end = Date.parse(this.downloadRange.end).toString() + '000000'
    var q = `select * from ${this.ID.value} where time > '${Influx.toNanoDate(start).toNanoISOString()}' and time < '${Influx.toNanoDate(end).toNanoISOString()}'`
    return q
  }

  /*
  influx.writePoints([
      {
        measurement: 'tide',
        tags: {
          unit: locationObj.rawtide.tideInfo[0].units,
          location: locationObj.rawtide.tideInfo[0].tideSite,
        },
        fields: { height: tidePoint.height },
        timestamp: tidePoint.epoch,
      }
    ]
  */

  addMongoDBID(measurement) {
    return (+new Date(measurement.timestamp)).toString(36)
  }

  writeToDatabase() {
    // console.log('writeToDatabase', this.ID)
    var measurement = {
      measurement: this.ID.value,
      tags: {},
      fields: {},
    }

    // var lastDatapoint
    for (var tag of this.tags) {
      if (tag.slice(-6) !== '_units') {
        Object.defineProperty(measurement.tags, tag, {
          enumerable: true,
          value: detectType(tag, this.obj).value,
        })
      }
    }

    var detectResult
    for (var field of this.fields) {
      detectResult = detectType(field, this.obj)
      Object.defineProperty(measurement.fields, field, {
        enumerable: true,
        value: detectResult.value,
      })
      var time = detectResult.timeStamp
      if (time) {
        // lastDatapoint = time
        Object.defineProperty(measurement, 'timestamp', {
          enumerable: true,
          writable: true,
          value: time,
        })
      }
      if (detectResult.impliedTag) {
        if (detectResult.impliedTag === 'ad.DataPoint') {
          detectResult.impliedTag = field + '_units'
        }
        if (this.tags.includes(detectResult.impliedTag)) {
          // specifically identifying unknown units for databasing purposes
          var units = ((detectResult.units === '') ? 'Unknown' : detectResult.units)
          Object.defineProperty(measurement.tags, detectResult.impliedTag, {
            enumerable: true,
            value: units,
          })
        }
      }
    }
    // stuff about adding a time-stamp
    if (measurement.timestamp === undefined) {
      Object.defineProperty(measurement, 'timestamp', {
        enumerable: true,
        writable: true,
        value: Date.now(),
      })
    }

    // measurement reconstruction for MongoDB for easier data analysis
    measurement = {
      measurement: measurement.measurement, 
      ...measurement.fields, 
      ...measurement.tags,
      timestamp: measurement.timestamp,
    }
    measurement._id = this.addMongoDBID(measurement)
    this.measurements.push(measurement)
    if (this.measurements.length >= this['Batch Write Size'].value) {
      query.addMeasurement(this.measurements)
      this.measurements = []
    } /*
    if (!this.testFlag) {
      this.influx.writePoints(this.measurements)
      .then(() => {
        this.influx.writePoints(this.measurements)
        .then(() => {
          console.log('successful write')
        })
      })
    } */

  }

  setupMongoDB() {
    query.initializeCollectionAndIndices(this.ID.value)
  }

  setUpInflux(schema) {
    var influx = new Influx.InfluxDB({
      host: 'localhost',
      database: dbName,
      schema: schema,
    })
    console.log('setting up')
    console.log(influx)
    influx.getDatabaseNames()
    .then(names => {
      if (!names.includes(dbName)) {
        return influx.createDatabase(dbName).catch(error => console.log({error}))
      }
    })
    .then(() => {
      //
      // console.log('database found')
      // console.log(influx)
      return influx.createRetentionPolicy('3yr', {
        database: dbName,
        duration: '156w',
        replication: 1,
        isDefault: true}).catch(error => console.log({error}))
    })
    .catch(error => console.log({error}))

    return influx
  }
}

module.exports = {
  id: databaseID,
  path: databasePath,
  GUI: DatabaseGUIC,
}
