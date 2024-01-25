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

const ui = require('./ui.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
const adamRelay = require('./relay-adam.js')
const db = require('./database.js')

var valvesID = 'Valves'
var valvesPath = 'config/' + valvesID

class PWM {
    constructor({ parent, tag, interval = 4000, duty = 0.0 }) {
        this.parent = parent
        this.tag = tag
        Object.defineProperty(this, 'hiddenInterval', {
            value: new ad.DataPoint({ value: interval, units: 'ms' }),
            writable: true,
        })
        Object.defineProperty(this.parent, this.tag + ' Interval', {
            enumerable: true,
            get: () => {
                return new ui.ShowUser({ value: this.hiddenInterval, type: ['output', 'datapoint'] })
            },
            set: val => {
                // this pwm class isn't intended for intervals less than 32 ms
                if (val > 32 && val < 20_000) {
                    this.hiddenInterval.time = Date.now()
                    this.hiddenInterval.value = val
                    if (this.hiddenPWMmode) this.restartTimers()
                }
                
            }
        })

        Object.defineProperty(this, 'hiddenPWMmode', {
            value: false,
            writable: true,
        })
        Object.defineProperty(this, 'hiddenDuty', {
            value: new ad.DataPoint({ value: duty, units: '0-1' }),
            writable: true,
        })
        Object.defineProperty(this.parent, this.tag + ' Duty', {
            enumerable: true,
            get: () => {
                return new ui.ShowUser({ value: this.hiddenDuty, type: ['output', 'datapoint'] })
            },
            set: val => {
                if (val >= 0 && val <= 1) {
                    this.hiddenDuty.time = Date.now()
                    this.hiddenDuty.value = val
                    if (val == 0) {
                        this.stopTimers()
                    } else {
                        if (this.hiddenPWMmode) this.restartTimers()
                    }
                }
            }
        })


        Object.defineProperty(this, 'hiddenIntervalTimer', {
            value: undefined,
            writable: true,
        })
        Object.defineProperty(this, 'hiddenDutyTimer', {
            value: undefined,
            writable: true,
        })

        Object.defineProperty(this.parent, this.tag + ' PWM Mode', {
            enumerable: true,
            get: () => {
                return new ui.ShowUser({ value: this.hiddenPWMmode, type: ['output', 'binary'] })
            },
            set: val => {
                console.log('Setting PWM mode to')
                console.log(val)
                this.hiddenPWMmode = val
                if (this.hiddenPWMmode) {
                    // start interval timer
                    this.startTimers()
                } else {
                    // stop interval timer
                    this.stopTimers()
                }
            }
        })

        Object.defineProperty(this, 'utilityState', {
            value: new ui.ShowUser({ value: false, type: ['output', 'binary'] }),
            writable: true,
        })
        // Object.defineProperty(this, this.tag + 'State', {
        //     enumerable: true,
        //     get: () => {
        //         return this.utilityState
        //     },
        //     set: val => {
        //         if (this.hiddenPWMmode) return

        //         console.log('Setting Utility ' + this.Utility.value.toString() + ' to ' + val.toString())
        //         var pinMapIndex = pinMap.getIndexFromGPIO(this.GPIO.value)
        //         if (val) {
        //             rpio.write(pinMap.HeaderNumber[pinMapIndex], rpio.HIGH)
        //         } else {
        //             rpio.write(pinMap.HeaderNumber[pinMapIndex], rpio.LOW)
        //         }
        //         this.utilityState.value = val
        //         console.log('Utility State')
        //         console.log(this.utilityState)
        //         if (this.testFlag) console.log('Utility: ' + this.Utility + ' ' + val + ' (GPIO ' + this.GPIO.value +
        //             ' Header: ' + pinMap.HeaderNumber[pinMapIndex] + ' Info: ' + pinMap.Name[pinMapIndex] + ')')
        //     },
        // })

    }

    dutyOn() {
        var dutyLength = Math.round(this.hiddenInterval.value * this.hiddenDuty.value)
        if (dutyLength < 1) return

        this.parent[this.tag] = true
        // console.log('Turning on duty timer')
        // console.log(this.hiddenDutyTimer)
        this.hiddenDutyTimer = setTimeout(this.dutyOff.bind(this), dutyLength)
        // console.log(this.hiddenDutyTimer)
    }

    dutyOff() {
        this.parent[this.tag] = false
    }

    startTimers() {
        // console.log('Turning on interval timer')
        // console.log(this.hiddenIntervalTimer)
        this.hiddenIntervalTimer = setInterval(this.dutyOn.bind(this), this.hiddenInterval.value)
        // console.log(this.hiddenIntervalTimer)
    }

    restartTimers() {
        this.stopTimers()
        this.startTimers()
    }

    stopTimers() {
        // console.log('Stopping PWM timers for', this.tag)
        // console.log('Duty timer')
        // console.log(this.hiddenDutyTimer)
        // console.log('Interval timer')
        // console.log(this.hiddenIntervalTimer)
        this.dutyOff()
        if (this.hiddenIntervalTimer != undefined) {
            clearInterval(this.hiddenIntervalTimer)
        }
        if (this.hiddenDutyTimer != undefined) {
            clearTimeout(this.hiddenDutyTimer)
        }
    }

}


class ValveC {
    constructor({ router, Description, Details, testFlag = true, address, services, serverInstance, ID }) {
        // console.log(`\n\n\nADDRESS: ${JSON.stringify(address)}\n\n\n`)
        this.ID = new ui.ShowUser({ value: ID })
        this.address = new ui.ShowUser({ value: address })
        this.Description = new ui.ShowUser({ value: Description })
        this.Details = new ui.ShowUser({ value: Details })

        Object.defineProperty(this, 'testFlag', {
            writable: true,
            value: testFlag,
        })

        Object.defineProperty(this, 'hidden', {
            value: new adamRelay.Device({
                address: this.address.value,
                router: router,
                testFlag: testFlag,
                services: services,
                server: serverInstance,
                valvesPath: valvesPath,
            })
        })

        this.datastreams = { refreshRate: 4000 }
        this.updateable = []


        if (this.hidden.numberVSs) {
            var descriptor = []
            var name = []
            for (var i = 0; i < this.hidden.numberVSs; i++) {
                name.push('VS' + i.toString())
                descriptor.push('Valve ' + i.toString())
            }
            descriptor.forEach((d, i) => {
                Object.defineProperty(this, d, {
                    enumerable: true,
                    get: () => {
                        // console.log('Getting PV '+i)
                        // console.log(`Getting ${name[i]}: ${this.hidden[name[i]].value}`)
                        return (new ui.ShowUser({ value: this.hidden[name[i]].value, type: ['output', 'binary'] }))
                    },
                    set: val => {
                        // console.log(`Setting ${name[i]}: ${val}`)
                        this.hidden[name[i]] = val
                    }
                })
                Object.defineProperty(this, d + 'PWM Object', {
                    writable: true,
                    value: new PWM({ parent: this, tag: d, interval: (i + 2) * 1000 })
                })
            })
            this.Database = new ui.ShowUser({
                value: [{
                    id: 'Settings',
                    obj: {
                        0: new db.GUI({
                            measurementName: 'adam_relay_basic',
                            fields: descriptor,
                            obj: this,
                            testFlag: this.testFlag,
                            objPath: valvesPath,
                        })
                    },
                    path: valvesPath + '/' + db.path + '/' + bkup.fileName(this),
                }],
                type: ['output', 'link'],
            })
        }
    }
}


var valveMap = {
    '01': { Description: 'Relay Module #1 (Chemical Analysis)', Details: 'V0 = Max-IR/Exhaust; V1 = O2/Exhaust; V2 = O3/Exhaust; V3 = Sorbent Tube', address: '01' },
    '02': { Description: 'Relay Module #2', Details: 'On humidifier/bleed air shelf', address: '02' },
    '03': { Description: 'Relay Module #3 (Vapor Generator/Gas Dilution)', Details: 'V0 = HFVG; V1 = LFVG; V2 = Gas Mixer; V3 = O3 (Ozone) ; V4 = Product Air Test; V5 = Gas Dilution Waste', address: '03' },
}


// var ports = ['COM15','COM20','COM21']
// var seriallineSerials = ["FTVAHDUO","FTVAHE2O","FTVAHE4V"]
// var manufacturer = ['FTDI','FTDI','FTDI']
// var routers = {}

var port = 'COM21'
var seriallineSerial = 'ST215668' // A doesn't get an appended character
// var pnpId = 'FTDIBUS\\VID_0403+PID_6011+ST215668A\\0000'
var pnpId = undefined
var manufacturer = 'FTDI'
var router

module.exports = {
    initialize: async function (test, reinit, services, serverInstance) {
        console.log('Initializating Valves in valves.js')
        // test = false
        if (test === undefined) {
            test = false
        }

        // for (var i = 0; i < Object.keys(valveMap).length; i++) {
        //     routers[Object.keys(valveMap)[i]] = new ad.Router({
        //         portPath: NaN,
        //         baud: 9600,
        //         testFlag: test,
        //         manufacturer: manufacturer[i],
        //         seriallineSerial: seriallineSerials[i]
        //     })

        //     if (!test) {
        //         try {
        //             await routers[Object.keys(valveMap)[i]].openPort()
        //         } catch (error) {
        //             console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
        //             throw error
        //         }
        //     }
        // }


        router = new ad.Router({
            portPath: port,
            baud: 9600,
            testFlag: test,
            manufacturer: manufacturer,
            seriallineSerial: seriallineSerial,
            pnpId: pnpId,
        })

        if (!test) {
            try {
                await router.openPort()
            } catch (error) {
                console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
                throw error
            }
        }



        if (bkup.configExists(valvesPath)) {
            // this should eventually be in a try-catch with a default config
            var loadMap = bkup.load(valvesPath)
            Object.entries(loadMap).forEach(([key, value], i) => {
                // specify bare-minimum amount that the config should have
                // console.log(value)


                console.log(key)
                console.log(value)
                valveMap[key] = new ValveC({
                    router: router,
                    ID: key,
                    Description: value.Description.value,
                    Details: value.Details.value,
                    testFlag: test,
                    address: value.address.value,
                    services: services,
                    serverInstance: serverInstance,
                })

                setTimeout(() => {
                    console.log('Initializing Valve Control')
                    valveMap[key].hidden.initialize()
                }, 500)
                bkup.save(valveMap[key], valvesPath)
            })
        } else {
            // add details to valve map
            Object.entries(valveMap).forEach(([key, value], i) => {
                valveMap[key] = new ValveC({
                    router: router,
                    ID: key,
                    Description: value.Description,
                    Details: value.Details,
                    testFlag: test,
                    address: value.address,
                    services: services,
                    serverInstance: serverInstance
                })

                // console.log(valvesMap[key])
                setTimeout(() => {
                    console.log('Initializing Valve Control')
                    valveMap[key].hidden.initialize()
                }, 500)
                bkup.save(valveMap[key], valvesPath)

            })



        }


        return
    },
    id: valvesID,
    obj: valveMap,
    path: valvesPath,
}
