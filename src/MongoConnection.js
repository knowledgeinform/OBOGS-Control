/* eslint-disable unicorn/filename-case */
/**
 * MongoConnection
 *
 * @description :: Server-side logic for managing Platformmanagers
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

const MongoClient = require('mongodb').MongoClient
// Connection url
const url = 'mongodb://127.0.0.1:27017'

const dbName = 'podDataStore'

var client = null
var dbConn = null
var connectionFailure = false
const options = {
  reconnectInterval: 5000,
  reconnectTries: 100,
}

function connect() {
  MongoClient.connect(url, options).then(conn => {
    client = conn
    dbConn = client.db(dbName)
    connectionFailure = false

    client.on('reconnect', () =>  {
      connectionFailure = false
    })
    client.on('close', () => {
      connectionFailure = true
    })
  }).catch(error => {
    connectionFailure = true
    console.log(error)
    console.log('MONGO_CONNECTION_FAIL')
    setTimeout(connect) // MongoClient does not retry the initial connection
  })
}

connect()

module.exports = {
  getConnection() {
    // console.log('getConnection reached')
    return connectionFailure ? null : dbConn
  },
}
