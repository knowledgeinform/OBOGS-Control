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

const path = require('path')
const { exec } = require('child_process')
const maxPath = require('./max-path.js')
const ad = require('./abstract-driver.js')
const ui = require('./ui.js')
const superagent = require('superagent')
const fft = require('fft.js')
const db = require('./database.js')
const bkup = require('./backup.js')

class MaxIR {
  constructor({ testFlag = false,
    debugTest = false,
    maxRefreshInterval = 5000,
    address = 'localhost:3004',
    configPath,
    parent,
  }) {
    this.Address = { value: 'localhost:3004' } // wrapped up for backup filename
    this.parent = parent
    this.configPath = configPath
    this.hidden = {
      igram: new ad.DataPoint({ value: [] }),
      pspec: new ad.DataPoint({ value: [] }),
      labspec: new ad.DataPoint({ value: [] }),
      laserFrequency: new ad.DataPoint({ value: -1, units: 'cm^-1' }),
      pressure: new ad.DataPoint({ value: 1, units: 'atm' }),
      temperature: new ad.DataPoint({ value: 35, units: 'C' }),
      lampSpectrum: false,
      zeroSpectrum: false,
      analyte: 'NOT SET',
      estimatedConc: new ad.DataPoint({ units: 'ppm' }),
      latestFile: 'undefined',
      latestConvertedFile: 'undefined',
    }

    this.lastLength = -1
    this.testFlag = testFlag
    this.debugTest = debugTest
    this.hidden.lockRefreshInterval = false // included for database.js
    this.hidden.maxRefreshInterval = maxRefreshInterval
    this.lastRequestTime = Date.now()
    this.timeoutInterval = 15000

    this.AdditionalFields = { 'Laser Frequency': new ui.ShowUser({ value: this.hidden.laserFrequency, type: ['input', 'datapoint'] }) }

    Object.defineProperty(this.AdditionalFields, 'MAX Data Path', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: maxPath.path })
      },
      set: val => {
        maxPath.path = val
        // if (validPath(val)) {
        //
        // }
      },
    })

    Object.defineProperty(this.AdditionalFields, 'Latest LAB File', {
      enumerable: true,
      get: () => {
        this.getLatestFile()
        return new ui.ShowUser({ value: this.hidden.latestFile, type: ['input', 'string'] })
      }
    })

    Object.defineProperty(this.AdditionalFields, 'Pressure', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.hidden.pressure, type: ['input', 'datapoint'] })
      },
      set: val => {
        this.hidden.pressure.value = Number(val)
        this.hidden.pressure.time = Date.now()
      },
    })
    Object.defineProperty(this.AdditionalFields, 'Temperature', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.hidden.temperature, type: ['input', 'datapoint'] })
      },
      set: val => {
        this.hidden.temperature.value = Number(val)
        this.hidden.temperature.time = Date.now()
      },
    })

    Object.defineProperty(this.AdditionalFields, 'Concentration', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.hidden.estimatedConc, type: ['output', 'datapoint'] })
      },
      set: val => {
        this.estimatedConc = val
      }
    })

    Object.defineProperty(this.AdditionalFields, 'LAB Spectrum', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.labSpectrum, type: ['input', 'datapoint'] })
      }
    })

    if (this.configPath !== undefined) {
      this.AdditionalFields.Database = new ui.ShowUser({
        value: [{
          id: 'Settings',
          obj: {
            'max_IR_lab': new db.GUI({
              measurementName: 'max_IR_lab',
              fields: ['laserFrequency',
                'pressure',
                'temperature',
                'labSpectrum'],
              tags: ['lampSpectrum', 'zeroSpectrum', 'analyte'],
              obj: this,
              testFlag: this.testFlag,
              objPath: this.configPath,
              units: 's',
              readRate: 5,
              limit: 60, // 30 seemed a little slow, so bumping up to 60 (300 gave a terrible user-experience)
            }),
            'max_IR_x': new db.GUI({
              measurementName: 'max_IR_x',
              fields: ['laserFrequency',
                'pressure',
                'temperature',
                'interferogram'],
              tags: ['lampSpectrum', 'zeroSpectrum', 'analyte'],
              obj: this,
              testFlag: this.testFlag,
              objPath: this.configPath,
              units: 's',
              readRate: 5,
              limit: 60, // 30 seemed a little slow, so bumping up to 60 (300 gave a terrible user-experience)
            }),
            'max_IR_concentration_x': new db.GUI({
              measurementName: 'max_IR_concentration_x',
              fields: ['estimatedConc'],
              obj: this,
              testFlag: this.testFlag,
              objPath: this.configPath,
              units: 's',
              readRate: 2, // set to less than half the interval for the interferogram
            })
          },
          path: this.configPath + '/' + db.path + '/' + bkup.fileName(parent),
        }],
        type: ['output', 'link'],
      })
    }
    // Object.defineProperty(this, 'AdditionalFields', {
    //   writable: true,
    //   enumerable: true,
    //   value: {},
    // })

    // Object.defineProperty(this.AdditionalFields, 'Laser Frequency', {
    //   enumerate: true,
    //   get: () => {
    //     return new ui.ShowUser({value: this.hidden.laserFrequency, type: ['input', 'datapoint']})
    //   },
    //   set: val => {
    //     //
    //     console.log('MAX Error: Cannot set laser frequency')
    //   },
    // })
  }

  async getLatestFile() {
    console.log('Getting latest file')
    try {
      console.log(this.AdditionalFields['MAX Data Path'].value)
      var dir = await maxPath.latestRunDirectory(this.AdditionalFields['MAX Data Path'].value)
      console.log(dir)
      var f = await maxPath.latestFile(dir)
      this.hidden.latestFile = path.join(dir, f)
    } catch (error) {
      this.hidden.latestFile = 'undefined'
      console.log('Error getting latest MAX IR LAB file')
      console.log(error)
    }
  }

  async convertLatestLABFile() {
    try {
      if (this.hidden.latestConvertedFile === this.hidden.latestFile || this.hidden.latestFile === 'undefined') {
        return
      }
      // convert file
      exec('.\\LabFileParserPiper.exe \"' + this.hidden.latestFile + '\"', (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`)
          return
        }
        try {
          var labObj = JSON.parse(stdout)
          var date = new Date(labObj.dateTime)
          this.hidden.labspec.value = labObj.powerSpectrum
          this.hidden.labspec.time = date.getTime()
          this.hidden.pressure.value = labObj.pressure
          this.hidden.pressure.time = date.getTime()
          this.hidden.temperature.value = labObj.temperature
          this.hidden.temperature.time = date.getTime()
          this.hidden.laserFrequency.value = labObj.frequency
          this.hidden.laserFrequency.time = date.getTime()
        } catch (error) {
          console.log('Error parsing lab file')
          console.log(error)
        }
      })
      this.hidden.latestConvertedFile = this.hidden.latestFile
    } catch (error) {
      console.log('Error converting latest lab file')
      console.log(error)
    }
  }

  get labSpectrum() {
    this.getLatestFile().then(() => this.convertLatestLABFile())
    return this.hidden.labspec
  }

  get estimatedConc() {
    return this.hidden.estimatedConc
  }

  set estimatedConc(val) {
    console.log('max ir val')
    console.log(val)
    if (val.value && val.time && val.units) {
      this.hidden.estimatedConc = new ad.DataPoint(val)
    }
    // this.hidden.estimatedConc = val
  }

  get laserFrequency() {
    return this.hidden.laserFrequency
  }

  get lampSpectrum() {
    return this.hidden.lampSpectrum
  }

  set lampSpectrum(val) {
    this.hidden.lampSpectrum = val
  }

  get zeroSpectrum() {
    return this.hidden.zeroSpectrum
  }

  set zeroSpectrum(val) {
    this.hidden.zeroSpectrum = val
  }

  get analyte() {
    return this.hidden.analyte
  }

  set analyte(val) {
    this.hidden.analyte = val
  }

  get pressure() {
    return this.hidden.pressure
  }

  get temperature() {
    return this.hidden.temperature
  }

  get wavenumbers() {
    var nPts = this.hidden.pspec.value.length
    var step = this.hidden.laserFrequency.value / nPts
    this.nu = []
    for (var i = 0; i < nPts; i++) {
      this.nu.push(i * step)
    }
    return new ad.DataPoint({ value: this.nu, time: this.hidden.laserFrequency.time, units: '1/cm' })
  }

  get status() {
    if (Math.abs(this.hidden.igram.time - this.lastRequestTime) > this.timeoutInterval) {
      console.log('Not Updating', new Date(Date.now()))
      return 'Not Updating'
    } else {
      return 'Updating'
    }
  }

  async getInterferogram() {
    this.lastRequestTime = Date.now()
    superagent
      .get(this.Address.value + '/api/igram')
      .then(res => {
        if (res.status === 200) {
          var data = JSON.parse(res.text)
          // console.log(this.hidden)
          // console.log(data.metaData)
          this.hidden.igram.value = data.packet
          this.hidden.igram.time = data.time
          this.hidden.laserFrequency.value = data.metaData['Laser Frequency']
          this.hidden.laserFrequency.time = data.time
          if (data.packet.length !== this.lastLength) {
            this.lastLength = data.packet.length
            this.f = new fft(data.packet.length)
          }
          var transformedSpectrum = this.fft(this.hidden.igram.value)
          this.hidden.pspec.value = this.toPower(transformedSpectrum)
          this.hidden.pspec.time = this.hidden.igram.time
        }
      })
      .catch(error => {
        console.log('MAX-IR ERROR!!!!')
        console.error(error)
      })
  }

  toPower(transformedSpectrum) {
    var powerSpecLen = transformedSpectrum.length / 4
    var ret = new Array(powerSpecLen)

    for (var i = 0, i2 = 0; i < powerSpecLen; i++, i2 += 2) {
      ret[i] = Math.sqrt(Math.pow(transformedSpectrum[i2], 2) + Math.pow(transformedSpectrum[i2 + 1], 2))
    }
    return ret
  }

  fft(realArray) {
    var out = this.f.createComplexArray()
    this.f.realTransform(out, realArray)
    return out
  }

  get interferogram() {
    this.getInterferogram()
    return this.hidden.igram
  }

  get spectrum() {
    this.getInterferogram()
    return this.hidden.pspec
  }

  async setup() {
    // nothing for now
    console.log('setuping MAX')
  }
}

module.exports = {
  Device: MaxIR,
}
