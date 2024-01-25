/* eslint-disable no-unused-vars */
const fs = require('fs').readFile
const options = require('./config/options.js')
let collection = options.mongo.collection
const interferogram = options.sampleInterferogram
const mongoConn = require('./MongoConnection')
// const convertInterferogram = require('./convert-interferogram')

function addInterferogram(test) {
  const dbConn = mongoConn.getConnection()
  if (!dbConn) {
    console.log('error')
    return
  }
  const datetime = new Date()
  const thing = {time: datetime, graph: interferogram}
  dbConn.collection('testObegs').insertOne(thing)
  .then(result => {
  }).catch(error => {
    console.log(error)
  })
}

// function addNewInterferogram() {
//   // console.log('test1')
//   convertInterferogram.convertInterferogram()
//   // console.log('test2')
//   /* fs.readfile('output', function (err, data) {
//     console.log('test3')
//     if (err) throw err
//     console.log('test4')
//     let obj = {}
//     console.log('test5')
//     let splitted = data.toString().split('\n')
//     /* for (let i = 0; i < splitted.length; i++) {
//       let splitLine = splitted[i].split(':')
//       obj[splitLine[0]] = splitLine[1].trim()
//     }
//     console.log(splitted)
//   }) */
// }

function addData(input) {
  const dbConn = mongoConn.getConnection()
  if (!dbConn) {
    console.log('error')
    return
  }
  if (input[0].measurement) {
    collection = input[0].measurement
  } else {
    console.log('Mongo Updater Error: No measurement found')
    console.log(input)
    collection = 'Undefined'
  }
  var myobj = input
  dbConn.collection(collection).insertMany(myobj, {ordered: false}).catch(error => {
    // console.log('MongoDB Insertion error')
    // console.log(error)
  })
}

// setInterval(addInterferogram, 10000)
// addNewInterferogram()

module.exports = {
  processMeasurement(measurement) {
    if (measurement) {
      addData(measurement)
    }
  },
  async initializeIndex(measurement) {
    const dbConn = mongoConn.getConnection()
    if (!dbConn) {
      console.log('error')
      return
    }
    console.log('measurement', measurement)
    var collections = await dbConn.listCollections().toArray()
    var collectionAlreadyMade = false
    collections.forEach(collection => {
      if (collection.name.includes(measurement)) collectionAlreadyMade = true
    })
    console.log('Collection already made:', collectionAlreadyMade)
    if (!collectionAlreadyMade) await dbConn.createCollection(measurement)

    var indices = await dbConn.collection(measurement).listIndexes().toArray()
    var indexAlreadyMade = false
    indices.forEach(index => {
      if (index.name.includes('timestamp')) indexAlreadyMade = true
    });
    console.log('mongodb indices for', measurement, indices)
    console.log('Already made:',indexAlreadyMade)
    if (!indexAlreadyMade) dbConn.collection(measurement).createIndex({ 'timestamp': 1 })
  },
  addInterferogramB(interferogram) {
    if (interferogram) {
      addInterferogram(interferogram)
    }
  },
}
