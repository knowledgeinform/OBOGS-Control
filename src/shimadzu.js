/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED "AS IS." JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const usb = require('usb')
const process = require('process')
const fft = require('fft.js')
// const fs = require('fs')
const ad = require('./abstract-driver.js')
const ui = require('./ui.js')
const db = require('./database.js')
const bkup = require('./backup.js')

var sampleInterferogram = require('./sampleInterferogram.json')
var samplePowerSpectrum = require('./samplePowerSpectrum.json')

var commands = {
  STARTSTOP: '0102070000000000', // [1,2,7]+[0]*5
  STATUS: '0102150000000000', // [1,2,21]+[0]*5
  APERTURE: '01028A00020000000000', // [1,2,138,0,2,0,0,0] //last digit: 0 = auto, 5 = full open
  NAME: '0102210000000000', // [1,2,33]+[0]*5
  SERIALNO: '0102160000000000', // [1,2,22]+[0]*5
  PING: '0102000000000000', // [1,2] + [0]*6
  POSTREQ: '75A4006A00000000000000000000000000000000000000000000000000000000000000000000', // [117,164,0,106]+[0]*34
  PIEZO: '0102010040000000000000400003001C000100010000006500000001000000000069' + '75A4006A00000000000000000000000000000000000000000000000000000000000000000000',
  POWERSPEC: '0102020040000000000000400005001C000100010005000000000001000000000069' + '75A4006A00000000000000000000000000000000000000000000000000000000000000000000',
  BACKGROUND: '0102020040000000000000400003001C000500000005000000000001000000000000' + '75A4006A00000000000000000000000000000000000000000000000000000000000000000000',
  SPECTRUM: '0102010040000000000000400003001C000500000005000000000001000000000000' + '75A4006A00000000000000000000000000000000000000000000000000000000000000000000',
  DATAREADY: '010219000400000000000040', // [1,2,25,0,4,0,0,0,0,0,0]
  BKGREADY: '01021A000400000000000040',
  PSPEC: '01021200080000000000000000002044', // [1,2,18,0,8,0,0,0,0,0,0,0,0,0,32,68]
  IGRAM: '01021100080000000000000000008044', // [1,2,17,0,8,0,0,0,0,0,0,0,0,0,128,68]
  MYSTERY: '01020E0000000000', // [1,2,14,0,0,0,0,0]
}

function delay(t, val) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(val)
    }, t)
  })
}

class PromiseQueue {
  constructor({maxQueueLength = 100,
    queueName = 'Shimadzu queue',
    interMessageWait = 0,
    debugTest = false,
    func, // function that must be executed synchronously
  }) {
    this.maxQueueLength = maxQueueLength
    this.queue = []
    this.queueName = queueName
    this.interMessageWait = interMessageWait
    this.debugTest = debugTest
    this.func = func
  }

  interMessageDelay() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, this.interMessageWait)
    })
  }

  send(command, timeout) {
    if (this.queue.length > this.maxQueueLength) {
      console.log('Too many router commands queued for ' + this.queueName)
      console.log('Queue size: ' + this.maxQueueLength)
      throw new Error('Too many router commands queued')
    } else {
      if (this.debugTest) {
        console.log('queue length')
        console.log(this.queue.length)
        console.log('Command')
        console.log(command)
      }
    }
    // console.log('queue length: ' + this.queue.length.toString())
    var lastPromise = this.queue[this.queue.length - 1]
    var cmdPromise = async lastPromise => {
      if (lastPromise) {
        try {
          await lastPromise
          if (this.interMessageWait > 0) {
            await this.interMessageDelay()
          }
        } catch (error) {
          // last promise error'd out --> the next command probably doesn't care
        }
        var indexOfLP = this.queue.indexOf(lastPromise)
        if (indexOfLP >= 0) {
          // console.log('removing last promise')
          // remove the last Promise from the queue
          this.queue.splice(indexOfLP, 1)
        } else {
          throw new Error('Big problem in router queue where last promise could not be found')
        }
      } else {
        // console.log('last promise not defined')
      }

      var resp
      resp = await this.func(command, timeout)
      if (this.debugTest) console.log('serial resp')
      if (this.debugTest) console.log(resp)
      return resp
    }
    // console.log('pushing promise onto queue')
    this.queue.push(cmdPromise(lastPromise))

    return this.queue[this.queue.length - 1]
  }
}

class Shimadzu {
  constructor({testFlag = false,
    debugTest = false,
    maxRefreshInterval = 5000,
    configPath,
  }) {
    this.ID = new ui.ShowUser({value: 'Shimadzu'}) // for database.js/backup.js
    this.configPath = configPath
    this.testFlag = testFlag
    this.numberSize = 4 // 32-bit floats from the shimadzu
    this.status = 'Disconnected'
    console.log('Be sure to have the IR\'s USB plugged in BEFORE turning on its activation switch')
    console.log('Only plug Shimadzu directly into laptop (not through docking station).')
    console.log('Otherwise, BLUE SCREEN OF DEATH will occur.')
    process.on('exit', this.close.bind(this))
    this.connect()
    // usb.usb.on('attach', this.connect.bind(this))
    // usb.usb.on('detach', this.disconnect.bind(this))
    this.init = true
    this.msgQ = []
    this.msgQMax = 20
    this.pq = new PromiseQueue({func: this.write.bind(this), debugTest: debugTest, interMessageWait: 200})
    this.property = {}
    this.property.lastRawBackgroundI = new ad.DataPoint({value: []})
    this.property.lastRawSpectrumI = new ad.DataPoint({value: []})
    this.property.lastBackgroundI = new ad.DataPoint({value: []})
    this.property.lastSpectrumI = new ad.DataPoint({value: []})
    this.property.lastBackgroundSpectrum = new ad.DataPoint({value: []})
    this.property.lastSpectrum = new ad.DataPoint({value: []})
    this.property.lastBackgroundPowerSpectrum = new ad.DataPoint({value: []})
    this.property.lastPowerSpectrum = new ad.DataPoint({value: []})
    this.property.lampSpectrum = false
    this.property.zeroSpectrum = false
    this.property.analyte = 'NONE'

    this.lockRefreshInterval = true
    this.maxRefreshInterval = maxRefreshInterval
    this.lastReadTime = {}
    this.lastReadTime.background = Date.now()
    this.lastReadTime.spectrum = Date.now()

    this.fullRange = 7.898894154818326e+03 // The max 1/cm is defined by the mirror step, which we assume is based on a HeNe laser
    this.setResolution(3) // default

    if (this.configPath !== undefined) {
      this.AdditionalFields = {}
      this.AdditionalFields.Database = new ui.ShowUser({
        value: [{
          id: 'Settings',
          obj: {0: new db.GUI({
            measurementName: 'shimadzu_IR_basic',
            fields: ['interferogram',
              'spectrum',
              'wavenumbers'],
            tags: ['lampSpectrum', 'zeroSpectrum', 'analyte'],
            obj: this,
            testFlag: this.testFlag,
            objPath: this.configPath,
            units: 's',
            readRate: 5,
          })},
          path: this.configPath + '/' + db.path + '/' + bkup.fileName(this),
        }],
        type: ['output', 'link'],
      })
    }
  }

  get lampSpectrum() {
    return this.property.lampSpectrum
  }

  set lampSpectrum(val) {
    this.property.lampSpectrum = val
  }

  get zeroSpectrum() {
    return this.property.zeroSpectrum
  }

  set zeroSpectrum(val) {
    this.property.zeroSpectrum = val
  }

  get analyte() {
    return this.property.analyte
  }

  set analyte(val) {
    this.property.analyte = val
  }

  printError(msg, error) {
    this.status = msg
    console.log(msg)
    console.log(error)
    this.testFlag = true
  }

  get interferogram() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.spectrum <= this.maxRefreshInterval) {
      return this.property.lastSpectrumI
    }

    this.lastReadTime.spectrum = Date.now()

    this.readSpectrum().catch(error => {
      console.log('get spectrum error')
      console.log(error)
    })

    return this.property.lastSpectrumI
  }

  get spectrum() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.spectrum <= this.maxRefreshInterval) {
      return this.property.lastPowerSpectrum
    }

    this.lastReadTime.spectrum = Date.now()

    this.readSpectrum().catch(error => {
      console.log('get spectrum error')
      console.log(error)
    })
    return this.property.lastPowerSpectrum
  }

  get backgroundInterferogram() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.background <= this.maxRefreshInterval) {
      return this.property.lastBackgroundI
    }

    this.lastReadTime.background = Date.now()

    this.readBackground().catch(error => {
      console.log('get background error')
      console.log(error)
    })
    return this.property.lastBackgroundI
  }

  get background() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.background <= this.maxRefreshInterval) {
      return this.property.lastBackgroundPowerSpectrum
    }

    this.lastReadTime.background = Date.now()

    this.readBackground().catch(error => {
      console.log('get background error')
      console.log(error)
    })
    return this.property.lastBackgroundPowerSpectrum
  }

  defaultDataCB(error, data) {
    console.log('in cb')
    if (error) {
      console.log('in error')
      console.log(error)
      throw error
    }
    if (data) {
      console.log('in data')
      console.log(data)
      return data
    }
  }

  async write(msg, dataCB = this.defaultDataCB, timeout = 200) {
    msg = Buffer.from(msg, 'hex')
    this.dev.interfaces[0].endpoints[0].timeout = timeout
    this.dev.interfaces[0].endpoints[1].timeout = timeout

    this.dev.interfaces[0].endpoints[1].transfer(150000, dataCB)
    this.dev.interfaces[0].endpoints[0].transfer(msg, error => {
      // console.log('out cb')
      if (error) {
        console.log('out error')
        throw error
        // console.log(error)
      }
    })
  }

  getStatus() {
    this.pq.send(commands.STATUS, (error, data) => {
      if (data) {
        console.log(data)
        this.property.status = data
      }
      if (error) {
        console.log('status error')
        console.log(error)
      }
    }).catch(error => {
      console.log('status error')
      console.log(error)
    })
  }

  name() {
    this.pq.send(commands.NAME, (error, data) => {
      if (data) {
        console.log(data)
        this.property.name = data.toString('utf8',7)
      }
      if (error) {
        console.log('name error')
        console.log(error)
      }
    }).catch(error => {
      console.log('name error')
      console.log(error)
    })
  }

  serialNumber() {
    this.pq.send(commands.SERIALNO, (error, data) => {
      if (data) {
        console.log(data)
        this.property.serialNumber = data.toString('utf8',7)
      }
      if (error) {
        console.log('serial number error')
        console.log(error)
      }
    }).catch(error => {
      console.log('serial number error')
      console.log(error)
    })
  }

  startStop() {
    this.pq.send(commands.STARTSTOP, (error, data) => {
      if (data) {
        console.log(data)
        this.property.startStop = data
      }
      if (error) {
        console.log('start stop error')
        console.log(error)
      }
    }).catch(error => {
      console.log('start stop error')
      console.log(error)
    })
  }

  ping() {
    this.pq.send(commands.PING, (error, data) => {
      if (data) {
        console.log(data)
        this.property.ping = data
      }
      if (error) {
        console.log('ping error')
        console.log(error)
      }
    }).catch(error => {
      console.log('ping error')
      console.log(error)
    })
  }

  setAperture(setting) {
    var command = commands.APERTURE
    var b = Buffer.from(command, 'hex')
    b[9] = setting
    command = b.toString('hex')
    this.pq.send(command, (error, data) => {
      if (data) {
        console.log(data)
        this.property.aperture = data
      }
      if (error) {
        console.log('aperture error')
        console.log(error)
      }
    }).catch(error => {
      console.log('aperture error')
      console.log(error)
    })
  }

  piezoTest(setting) {
    var command = commands.PIEZO
    var b = Buffer.from(command, 'hex')
    b[23] = setting
    command = b.toString('hex')
    this.pq.send(command, (error, data) => {
      if (data) {
        console.log(data)
        this.property.piezo = data
      }
      if (error) {
        console.log('piezo error')
        console.log(error)
      }
    }).catch(error => {
      console.log('piezo error')
      console.log(error)
    })
  }

  async setupInterferogram() {
    var nRecovered = 0
    console.log('setup interferogram')
    while (nRecovered < 1 && !this.testFlag) {
      await this.pq.send(commands.DATAREADY, (error, data) => {
        if (data) {
          console.log(data)
          this.nPts = 256 * data[14]
          nRecovered = data[19]
        }
        if (error) {
          console.log('setupInterferogram dataready error')
          console.log(error)
        }
      }).catch(error => {
        console.log('setupInterferogram dataready error')
        console.log(error)
      })
    }

    if (this.nPts > 0) {
      await this.pq.send(commands.IGRAM, (error, data) => {
        if (data) {
          console.log(data)
          this.property.setupInterferogram = data.subarray(72)
        }
        if (error) {
          console.log('setupInterferogram IGRAM error')
          console.log(error)
        }
      }, 1000).catch(error => {
        console.log('setupInterferogram IGRAM error')
        console.log(error)
      })
    }
  }

  setResolution(res) {
    // Resolution parameter is inverted, ie res 5 = 65536/2^5 is lower than res 3
    this.property.currentResolution = res
    var nPts = Math.floor(65536 / Math.pow(2,res))
    var step = this.fullRange / (nPts / 2)
    this.nu = []
    for (var i = 0; i < nPts / 2; i++) {
      this.nu.push(i * step)
    }
    this.hasBackground = false
    this.f = new fft(nPts)
  }

  get wavenumbers() {
    return new ad.DataPoint({value: this.nu, units: '1/cm'})
  }

  async readSpectrum(nSamples = 1) {
    // nSamples = number of collections to run (and average)
    // res = spectrum resolution: total igram pts = 65536/(2^res). E.g. 5->2048 pts, 3->8192 pts

    // Don't understand this operation yet. Getting some data and parroting it back as a cmd
    /* writeRead(MYSTERY, 172);
    reply[2] = 15;
    writeRead(reply, 8); */

    // Power spectrum test
    // nSamples = 1; // TBD, add averaging to processSpectrum
    var message = commands.SPECTRUM
    var b = Buffer.from(message, 'hex')
    b[17] = nSamples
    b[13] = this.property.currentResolution
    message = b.toString('hex')

    await this.pq.send(message, (error, data) => {
      if (data) {
        console.log(data)
        this.property.spectrumM = data.subarray(72)
      }
      if (error) {
        this.status = 'readSpectrum message error inner'
        console.log(this.status)
        console.log(error)
      }
    }).catch(error => {
      this.printError('readSpectrum message error outer', error)
      if (this.testFlag) {
        this.property.lastSpectrumI.value = sampleInterferogram
        this.property.lastSpectrumI.time = Date.now()
        var last = Math.round(samplePowerSpectrum.length / 2)
        this.property.lastPowerSpectrum.value = samplePowerSpectrum.slice(0, last)
        this.property.lastPowerSpectrum.time = this.property.lastSpectrumI.time
      }
    })
    var nRecovered = 0

    while (nRecovered < 1 && !this.testFlag) {
      await this.pq.send(commands.DATAREADY, (error, data) => {
        if (data) {
          console.log(data)
          this.nPts = 256 * data[14]
          nRecovered = data[19]
        }
        if (error) {
          console.log('readSpectrum dataready error')
          console.log(error)
        }
      }).catch(error => {
        console.log('readSpectrum dataready error')
        console.log(error)
      })
    }

    if (this.nPts > 0) {
      await this.pq.send(commands.IGRAM, (error, data) => {
        if (data) {
          console.log('interferogram')
          console.log(data)
          this.property.lastRawSpectrumI.time = Date.now()
          this.property.lastRawSpectrumI.value = data.subarray(72)
          this.processSpectrum(false)
        }
        if (error) {
          console.log('readSpectrum IGRAM error')
          console.log(error)
        }
      }, 1000).catch(error => {
        console.log('readSpectrum IGRAM error')
        console.log(error)
      })
    }
  }

  async readBackground(nSamples = 1) {
    // nSamples = number of collections to run (and average)
    // res = spectrum resolution: total igram pts = 65536/(2^res). E.g. 5->2048 pts, 3->8192 pts

    // Don't understand this operation yet. Getting some data and parroting it back as a cmd. Maybe some register
    // gets reset if the status isn't right.
    /* writeRead(MYSTERY, 172);
    reply[2] = 15;
    writeRead(reply, 8); */

    // Power spectrum test
    //  nSamples = 1; // TBD, add averaging to processSpectrum
    var message = commands.BACKGROUND
    var b = Buffer.from(message, 'hex')
    b[17] = nSamples
    b[13] = this.property.currentResolution
    message = b.toString('hex')

    await this.pq.send(message, (error, data) => {
      if (data) {
        console.log(data)
        this.property.backgroundM = data.subarray(72)
      }
      if (error) {
        console.log('readBackground message error')
        console.log(error)
      }
    }).catch(error => {
      console.log('readBackground message error')
      console.log(error)
    })
    var nRecovered = 0

    while (nRecovered < 1 && !this.testFlag) {
      await this.pq.send(commands.BKGREADY, (error, data) => {
        if (data) {
          console.log(data)
          this.nPts = 256 * data[14]
          nRecovered = data[19]
        }
        if (error) {
          console.log('readBackground BKGREADY error')
          console.log(error)
        }
      }).catch(error => {
        this.printError('readBackground BKGREADY error', error)
        if (this.testFlag) {
          this.property.lastBackgroundI.value = sampleInterferogram
          this.property.lastBackgroundI.time = Date.now()
          var last = Math.round(samplePowerSpectrum.length / 2)
          this.property.lastBackgroundPowerSpectrum.value = samplePowerSpectrum.slice(0, last)
          this.property.lastBackgroundPowerSpectrum.time = this.property.lastBackgroundI.time
        }
      })
    }

    if (this.nPts > 0) {
      await this.pq.send(commands.PSPEC, (error, data) => {
        if (data) {
          console.log('background interferogram')
          console.log(data)
          this.property.lastRawBackgroundI.time = Date.now()
          this.property.lastRawBackgroundI.value = data.subarray(72)
          this.processSpectrum(true)
        }
        if (error) {
          console.log('readBackground PSPEC error')
          console.log(error)
        }
      }).catch(error => {
        console.log('readBackground PSPEC error')
        console.log(error)
      })
    }
    this.hasBackground = true
  }

  processSpectrum(isBackground) {
    if (isBackground) {
      // console.log('lastRawBackgroundI.value.length / numberSize')
      // console.log(this.nPts)
      // console.log(this.property.lastRawBackgroundI.value.length)
      // console.log(this.property.lastRawBackgroundI.value.length / this.numberSize)
      this.property.lastBackgroundI.value = new Array(Math.round(this.property.lastRawBackgroundI.value.length / this.numberSize))
      // console.log('here')
      for (var i = 0, i2 = 0; i <= (this.property.lastRawBackgroundI.value.length - this.numberSize); i += this.numberSize, i2++) {
        this.property.lastBackgroundI.value[i2] = (this.property.lastRawBackgroundI.value.readInt32BE(i))
      }
      this.property.lastBackgroundI.time = this.property.lastRawBackgroundI.time
      // console.log('background interferogram')
      // console.log(this.property.lastBackgroundI.value)
    } else {
      this.property.lastSpectrumI.value = new Array(this.property.lastRawSpectrumI.value.length / this.numberSize)
      for (var i = 0, i2 = 0; i <= (this.property.lastRawSpectrumI.value.length - this.numberSize); i += this.numberSize, i2++) {
        this.property.lastSpectrumI.value[i2] = (this.property.lastRawSpectrumI.value.readInt32BE(i))
      }
      this.property.lastSpectrumI.time = this.property.lastRawSpectrumI.time
    }

    if (isBackground) {
      this.property.lastBackgroundSpectrum.value = this.fft(this.property.lastBackgroundI.value)
      this.property.lastBackgroundSpectrum.time = this.property.lastBackgroundI.time
    } else {
      this.property.lastSpectrum.value = this.fft(this.property.lastSpectrumI.value)
      // fs.writeFile('spectrum.txt', this.property.lastSpectrum.value.join('\n'), err => {
      //   if (err) {
      //     console.log(err)
      //   }
      // })
      this.property.lastSpectrum.time = this.property.lastSpectrumI.time
    }

    this.toPower(isBackground)
  }

  fft(realArray) {
    var out = this.f.createComplexArray()
    this.f.realTransform(out, realArray)
    return out
  }

  toPower(isBackground) {
    if (isBackground) {
      var backgroundPowerSpecLen = this.property.lastBackgroundSpectrum.value.length / 4

      this.property.lastBackgroundPowerSpectrum.value = new Array(backgroundPowerSpecLen)
      this.property.lastBackgroundPowerSpectrum.time = this.property.lastBackgroundSpectrum.time
      for (var i = 0, i2 = 0; i < backgroundPowerSpecLen; i++, i2 += 2) {
        this.property.lastBackgroundPowerSpectrum.value[i] = Math.sqrt(Math.pow(this.property.lastBackgroundSpectrum.value[i2], 2) + Math.pow(this.property.lastBackgroundSpectrum.value[i2 + 1], 2))
      }
    } else {
      var powerSpecLen = this.property.lastSpectrum.value.length / 4

      this.property.lastPowerSpectrum.value = new Array(powerSpecLen)
      this.property.lastPowerSpectrum.time = this.property.lastSpectrum.time
      for (var i = 0, i2 = 0; i < powerSpecLen; i++, i2 += 2) {
        this.property.lastPowerSpectrum.value[i] = Math.sqrt(Math.pow(this.property.lastSpectrum.value[i2], 2) + Math.pow(this.property.lastSpectrum.value[i2 + 1], 2))
      }
      // fs.writeFile('powerSpec.txt', this.property.lastBackgroundPowerSpectrum.value.join('\n'), err => {
      //   if (err) {
      //     console.log(err)
      //   }
      // })
    }
  }

  async powerSpectrum() {
    var nRecovered = 0
    console.log('setup power spectrum')
    await this.pq.send(commands.POWERSPEC, (error, data) => {
      if (data) {
        console.log(data)
        this.property.setupPowerSpectrum = data
      }
      if (error) {
        console.log('setupPowerSpectrum powerspec error')
        console.log(error)
      }
    }, 1000).catch(error => {
      console.log('setupPowerSpectrum powerspec error')
      console.log(error)
    })
    while (nRecovered < 1 && !this.testFlag) {
      await this.pq.send(commands.BKGREADY, (error, data) => {
        if (data) {
          console.log(data)
          this.nPts = 256 * data[14]
          nRecovered = data[19]
        }
        if (error) {
          console.log('setupPowerSpectrum BKGREADY error')
          console.log(error)
        }
      }).catch(error => {
        console.log('setupPowerSpectrum BKGREADY error')
        console.log(error)
      })
    }

    if (this.nPts > 0) {
      await this.pq.send(commands.PSPEC, (error, data) => {
        if (data) {
          console.log('pspec')
          console.log(data)
          this.property.setupPSpec = data.subarray(7)
        }
        if (error) {
          console.log('setupPowerSpectrum PSPEC error')
          console.log(error)
        }
      }).catch(error => {
        console.log('setupPowerSpectrum PSPEC error')
        console.log(error)
      })
    }
  }

  connect() {
    console.log('connecting')
    this.dev = usb.findByIds(0x141F, 0x1005)
    if (this.dev) {
      this.dev.open()
      this.claimInterfaces()
      if (this.init) {
        this.setupEvents()
        this.init = false
      }
      this.status = 'Connected'
    } else {
      // set the testFlag true if the device is not found
      this.testFlag = true
      this.status = 'Disconnected'
    }
  }

  setupEvents() {
    this.dev.interfaces[0].endpoints[0].transferType = usb.LIBUSB_TRANSFER_TYPE_BULK
    this.dev.interfaces[0].endpoints[1].transferType = usb.LIBUSB_TRANSFER_TYPE_BULK
    this.dev.interfaces[0].endpoints[0].timeout = 200
    this.dev.interfaces[0].endpoints[1].timeout = 200

    this.dev.interfaces[0].endpoints[0].on('error', data => {
      console.log('out endpoint error')
      console.log(data)
    })
    this.dev.interfaces[0].endpoints[1].on('error', data => {
      console.log('in endpoint error')
      console.log(data)
    })
    this.dev.interfaces[0].endpoints[1].on('data', data => {
      console.log('data')
      console.log(data)
      this.process(data)
    })
  }

  process(data) {
    console.log('processing data')
    console.log(data)
  }

  claimInterfaces() {
    // this.dev.setConfiguration(1) // sets the configuration
    // console.log(this.dev.interfaces)
    // console.log(this.dev.interfaces[0].isKernelDriverActive())
    this.dev.interfaces[0].claim()
    // console.log(this.dev.interfaces[0].endpoints[0].direction)
    // console.log(this.dev.interfaces[0].endpoints[1].direction)
  }

  async setup() {
    // this.write(commands.STARTSTOP)
    // this.write(commands.NAME)
    // this.write(commands.PING)
    // this.write(commands.STATUS)
    // this.write(commands.STATUS)
    // this.write(commands.SERIALNO)
    this.startStop()
    this.name()
    this.ping()
    this.getStatus()
    this.getStatus()
    this.serialNumber()
    this.setAperture(0)

    this.piezoTest(101)

    try {
      // await delay(1000)
      await this.setupInterferogram()

      this.piezoTest(102)
      // await delay(1000)
      await this.setupInterferogram()

      this.setAperture(0)
      await delay(1000)
      await this.powerSpectrum()
      await delay(200)
      console.log(this.property)
    } catch (error) {
      console.log('Shimadzu setup error')
      console.log(error)
    }
  }

  close() {
    if (this.dev != undefined) this.dev.close()
    process.exit()
  }
}

// // console.log(usb)
// devs = usb.getDeviceList()
// console.log(devs)
// dev = usb.findByIds(0x141F, 0x1005)
// console.log(dev)

// dev.open()

// console.log(dev.interfaces)

// console.log(commands.STATUS)

module.exports = {
  Device: Shimadzu,
}

// async function f() {
//   // s.setup()
//   var s = new Shimadzu(true)
//   try {
//     await s.setup()
//     setTimeout(() => {
//       console.log(s.background)
//       setInterval(() => {
//         console.log(s.spectrum)
//       }, 6000)
//     }, 5000)
//   } catch (error) {
//     console.log('manual error')
//     console.log(error)
//   }
// }
//
// setTimeout(f, 1000)
// s.getStatus()
