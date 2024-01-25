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
 * @version 3.0
 * TEC MANUAL: https://tetech.com/files/temperature_controller/TC-720_MANUAL.pdf
 * PAGE 88 - USB COMMUNICATION COMMANDS
 * Methods Included:
 *  - Get Set-Point Temperature
 *  - Set Set-Point Temperature
 *  - Get Output Power
 *  - Get Thermistor 1
 *  - Get Thermistor 2
 *  - Set Output
 */
const ui = require('./ui.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')

var tcID = 'TEC'
var tcPath = 'config/' + tcID

var stx = '*'
var etx = '\r'
var ack = '^'

class TC {
  constructor({
    id,
    Description = '',
    Details = 'Setpoint controls Thermistor 1; Power toggle button has 5-second response time',
    router,
    testFlag = true,
    debugTest,
  }) {
    this.ID = new ui.ShowUser({ value: id })
    this.Description = new ui.ShowUser({ value: Description })
    this.Details = new ui.ShowUser({ value: Details })
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
        timeout: 600,
        debugTest: this.debugTest,
      }),
    })
    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: {
        status: 'Undefined',
        outputEnable: false,
        setPointTemperature: new ad.DataPoint({ units: '˚C' }),
        outputPower: new ad.DataPoint({ units: '%' }),
        sensor1Temperature: new ad.DataPoint({ units: '˚C' }),
        sensor2Temperature: new ad.DataPoint({ units: '˚C' }),
      }
    })
    Object.defineProperty(this, 'Status', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({ value: this.hidden.status, type: ['input', 'string'] }))
      },
    })

    Object.defineProperty(this, 'TEC Power', {
      enumerable: true,
      get: () => {
        this.getOutputState().catch(error => {
          console.log(this.ID.value + ' power output value error ')
          console.log(error)
          this.hidden.status = error.toString()
        })
        return new ui.ShowUser({ value: this.hidden.outputEnable, type: ['output', 'binary'] });

      },
      set: val => {
        this.setOutput(val).catch(error => {
          console.log(this.ID.value + ' Power Output Control Error ')
          console.log(error)
          this.hidden.status = error.toString()
        })
      }
    })

    Object.defineProperty(this, 'Set Point Temperature', {
      enumerable: true,
      get: () => {
        this.getSetPointTemperature().catch(error => {
          console.log(this.ID.value + ' get TEC temperature error')
          console.log(error)
        })
        return (new ui.ShowUser({ value: this.hidden.setPointTemperature, type: ['output', 'datapoint'] }))
      },
      set: temperature => {
        temperature = Number(temperature)
        if (temperature < 0 || temperature > 50) return
        this.setSPTemperature(temperature).then(() => {
          this.hidden.status = 'Connected'
        }).catch(error => {
          console.log(this.ID.value + ' SET temperature ERROR')
          console.log(error)
          this.hidden.status = error.toString()
        })
      },
    })

    Object.defineProperty(this, 'Power Output', {
      enumerable: true,
      get: () => {
        this.getoutputPower().catch(error => {
          console.log(this.ID.value + ' Output Power error')
          console.log(error)
          this.hidden.status = error.toString()
        })
        return (new ui.ShowUser({ value: this.hidden.outputPower, type: ['input', 'datapoint'] }))
      },
    })
    Object.defineProperty(this, 'Thermistor 1', {
      enumerable: true,
      get: () => {
        this.getThermistor1().catch(error => {
          console.log(this.ID.value + ' Thermistor 1 error')
          console.log(error)
          this.hidden.status = error.toString()
        })
        return (new ui.ShowUser({ value: this.hidden.sensor1Temperature, type: ['input', 'datapoint'] }))
      },
    })
    Object.defineProperty(this, 'Thermistor 2', {
      enumerable: true,
      get: () => {
        this.getThermistor2().catch(error => {
          console.log(this.ID.value + ' Thermistor 2 error')
          console.log(error)
          this.hidden.status = error.toString()
        })
        return (new ui.ShowUser({ value: this.hidden.sensor2Temperature, type: ['input', 'datapoint'] }))
      },
    })

    this.datastreams = { refreshRate: 6000 }
    this.updateable = ['TEC Power']
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {
          0: new db.GUI({
            measurementName: 'TC_basic',
            fields: ['TEC Power', 'Thermistor 1', 'Thermistor 2', 'Power Output', 'Set Point Temperature'],
            obj: this,
            testFlag: this.testFlag,
            objPath: tcPath,
            readRate: 5000,
          })
        },
        path: tcPath + '/' + db.path + '/' + bkup.fileName(this),
      }],
      type: ['output', 'link'],
    })
  }

  calculateAndAddChecksum(buf) {
    var input2 = [...Buffer.from(buf)] // converts ascii array to numeric array
    var truncSumHEX_ascii = (input2.reduce((partialSum, a) => partialSum + a, 0) & 0xFF).toString(16) // & 0xFF truncates the sum to least significant 8 bits
    return buf + truncSumHEX_ascii
  }

  validateResponse(ddddss, resp) {
    var ddddss_resp = resp.replace(stx, '').replace(ack, '')
    return ddddss === ddddss_resp
  }

  /**
 * Output Enable method (p. 95, command 28)
 * Write Command: 30
 * Read Command: 64
 * Interpret: 0 == OFF
 *            1 == ON
 * Be sure that OUTPUT ENABLE has been set to ON; otherwise,
 * the program will run but the percent output power will remain
 * at 0%
 */

  async getOutputState() {
    var getOutputStateCmd = stx + '6400002a' + etx
    var resp = await this.serialControl.serial(getOutputStateCmd, 600)
    if (resp) {
      resp = resp[0]
      var outputEnabled = Buffer.compare(resp, Buffer.from('2a3030303163315e', 'hex')) === 0;
      this.hidden.outputEnable = outputEnabled;
      this.hidden.status = 'Connected'
    } else {
      this.hidden.status = this.ID.value + ' No response recieved from serial port '
    }
  }

  async setOutput(val) {
    if (val == true) {
      var enableOutputCmd = stx + '30000124' + etx
      this.hidden.status = 'Trying to set output state to ON'
      this.serialControl.serial(enableOutputCmd, false).then(() => {
        this.hidden.status = 'Connected'
      }).catch(error => {
        console.log(this.ID.value + ' Error in enabling power')
        console.log(error)
      })
    } else {
      var disableOutputCmd = stx + '30000023' + etx
      this.hidden.status = 'Trying to set output state to OFF'
      this.serialControl.serial(disableOutputCmd, false).then(() => {
        this.hidden.status = 'Connected'
      }).catch(error => {
        console.log(this.ID.value + ' Error in disabling power')
        console.log(error)
      })
    }
  }

  async getSetPointTemperature() {
    var input1 = '500000'
    var command = this.calculateAndAddChecksum(input1)
    command = stx + command + etx
    var resp = await this.serialControl.serial(command, false, 200)
    var valHexAscii = resp[0].toString().slice(1, 5)
    var val = Buffer.from(valHexAscii, 'hex').readInt16BE()
    val = val / 100
    this.hidden.setPointTemperature.value = Number(val)
    this.hidden.setPointTemperature.time = Date.now()
    this.hidden.status = 'Connected'
  }

  /**
   * To write a command to a controller, the controlling computer must send the following
   * ASCII characters: (stx)(CCDDDDSS)(etx)
   * Control command, CC, for "FIXED DESIRED CONTROL SETTING" IS 1c
   * Multiply the desired set-point temperature by 100
   * Convert decimal to hexadecimal and add on leading zeros to make the four
   * character send value DDDD
   */

  async setSPTemperature(temperatureInput) {
    var temperature = (temperatureInput * 100).toString(16).padStart(4, '0') // Convert number to a hexadecimal string
    if (temperatureInput < 0) temperature = (0x10000 - (temperatureInput * -100)).toString(16).padStart(4, '0') // 2^16 = 0x10000
    var controllerCommand = '1c'
    var input1 = controllerCommand.concat(temperature)
    var command = this.calculateAndAddChecksum(input1)

    command = stx + command + etx
    var res = await this.serialControl.serial(command, false, 100)
    // add ack check
    this.hidden.setPointTemperature.time = Date.now()
    this.hidden.setPointTemperature.value = temperatureInput
    this.hidden.status = 'Connected'
    console.log(res)
  }

  /**
   * Power Output
   * Write Command: NA
   * Read Command: 02
   * Interpret: Convert the returned hexadecimal value to decimal. 511 base 10 represents 100% output(heating)/
   * -511 base 10 represents -100% output(cooling)
   */
  async getoutputPower() {
    this.hidden.outputPower.time = Date.now()
    var input1 = '020000'
    var command = this.calculateAndAddChecksum(input1)
    command = stx + command + etx
    var resp = await this.serialControl.serial(command, false, 200)
    var valHexAscii = resp[0].toString().slice(1, 5)
    var val = Buffer.from(valHexAscii, 'hex').readInt16BE()
    val = 100 + (val - 511) * ((-100 - 100) / (-511 - 511))
    this.hidden.outputPower.value = Number(val)
    this.hidden.outputPower.time = Date.now()
    this.hidden.status = 'Connected'
  }

  /**
   * Read the actual temperature of the control thermistor (p. 91, command 6)
   * The control command, CC, for "INPUT1" sensor temperature is 01
   * There is no send value, so we calculate the checksum (SS) by adding the ascii values of the
   * characters 0,1,0,0,0,0
   */

  /**
   * Read the actual temperature of the control thermistor
   * The control command, CC, for "INPUT1" sensor temperature is 01
   * There is no send value, so we calculate the checksum (SS) by adding the ascii values of the
   * characters 0,1,0,0,0,0
   */
  async getThermistor1() {
    var input1 = '010000'
    var command = this.calculateAndAddChecksum(input1)
    command = stx + command + etx
    var resp = await this.serialControl.serial(command, false, 200)
    var valHexAscii = resp[0].toString().slice(1, 5)
    var val = Buffer.from(valHexAscii, 'hex').readInt16BE()
    val = val / 100
    this.hidden.sensor1Temperature.value = Number(val)
    this.hidden.sensor1Temperature.time = Date.now()
    this.hidden.status = 'Connected'
  }
  //     /**
  //      * Read the actual temperature of the other thermistor
  //      * The control command, CC, for "INPUT2" sensor temperature is 04
  //      * There is no send value, so we calculate the checksum (SS) by adding the ascii values of the
  //      * characters 0,4,0,0,0,0
  //      */
  async getThermistor2() {
    var input1 = '040000'
    var command = this.calculateAndAddChecksum(input1)
    command = stx + command + etx
    var resp = await this.serialControl.serial(command, false, 200)
    var valHexAscii = resp[0].toString().slice(1, 5)
    var val = Buffer.from(valHexAscii, 'hex').readInt16BE()
    val = val / 100
    this.hidden.sensor2Temperature.value = Number(val)
    this.hidden.sensor2Temperature.time = Date.now()
    this.hidden.status = 'Connected'
  }

  initialize() {
    // initialize
  }
}

var tcMap = {}
// var tcList = ['HFVG', 'LFVG']
var tcList = ['HFVG', 'LFVG', 'Sorbent']

module.exports = {
  initialize: async function (test) {
    // test = false // set false - runs system in development mode
    var router = [
      new ad.Router({
        portPath: 'COM1',
        baud: 230400,
        testFlag: test,
        timing: true,
        manufacturer: 'FTDI',
        seriallineSerial: 'AQ00VDL8',
      }),
      new ad.Router({
        portPath: 'COM1',
        baud: 230400,
        testFlag: test,
        timing: true,
        manufacturer: 'FTDI',
        seriallineSerial: 'AG0JO6EW',
      }),
      new ad.Router({
        portPath: 'COM2',
        baud: 230400,
        testFlag: test,
        timing: true,
        manufacturer: 'FTDI',
        seriallineSerial: 'AG0JM7TN',
      })
    ]
    var i = 0
    for (i = 0; i < tcList.length; i++) {
      var tc = tcList[i]
      if (!test) {
        try {
          await router[i].openPort()
        } catch (error) {
          console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
          throw error
        }
      }
      tcMap[tc] = new TC({ id: tc, testFlag: test, router: router[i], debugTest: false })
    }

    return
  },
  id: tcID,
  obj: tcMap
}
