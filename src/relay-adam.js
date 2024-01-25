// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ad = require('./abstract-driver.js')
const db = require('./database.js')
const bkup = require('./backup.js')
const ui = require('./ui.js')
const adam = require('./adam-4168C.js')


class RelayAdam {
    constructor({ address = '01',
        router,
        testFlag = false,
        services,
        server,
        configPath,
    }) {
        this.Address = { value: address } // added, capitalized and wrapped for backup.js/database.js
        this.device = new adam.Adam4168C({ address, router, testFlag })
        this.configPath = configPath
        this.retryNumber = 0

        //Where data is updated to and stored in hidden variable, numerPVs is the link to output in "controllers.js"
        this.hidden = {
            valveStates: [new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false }),
            new ad.DataPoint({ value: false })],
        }


        this.maxRefreshInterval = 1000

        this.numberVSs = 8

        Object.defineProperty(this, 'VS0', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[0]
            },

            set: val => {
                this.hidden.valveStates[0].value = val
                this.hidden.valveStates[0].time = Date.now()
                this.device.setChannelState(0, val)
            }
        })

        Object.defineProperty(this, 'VS1', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[1]
            },

            set: val => {
                this.hidden.valveStates[1].value = val
                this.hidden.valveStates[1].time = Date.now()
                this.device.setChannelState(1, val)
            }
        })

        Object.defineProperty(this, 'VS2', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[2]
            },

            set: val => {
                this.hidden.valveStates[2].value = val
                this.hidden.valveStates[2].time = Date.now()
                this.device.setChannelState(2, val)
            }
        })

        Object.defineProperty(this, 'VS3', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[3]
            },

            set: val => {
                this.hidden.valveStates[3].value = val
                this.hidden.valveStates[3].time = Date.now()
                this.device.setChannelState(3, val)
            }
        })

        Object.defineProperty(this, 'VS4', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[4]
            },

            set: val => {
                this.hidden.valveStates[4].value = val
                this.hidden.valveStates[4].time = Date.now()
                this.device.setChannelState(4, val)
            }
        })

        Object.defineProperty(this, 'VS5', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[5]
            },

            set: val => {
                this.hidden.valveStates[5].value = val
                this.hidden.valveStates[5].time = Date.now()
                this.device.setChannelState(5, val)
            }
        })

        Object.defineProperty(this, 'VS6', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[6]
            },

            set: val => {
                this.hidden.valveStates[6].value = val
                this.hidden.valveStates[6].time = Date.now()
                this.device.setChannelState(6, val)
            }
        })

        Object.defineProperty(this, 'VS7', {
            enumerable: true,
            get: () => {
                return this.hidden.valveStates[7]
            },

            set: val => {
                this.hidden.valveStates[7].value = val
                this.hidden.valveStates[7].time = Date.now()
                this.device.setChannelState(7, val)
            }
        })


        this.services = services
        this.server = server



        this.AdditionalFields = {
            Enable: new ui.ShowUser({ value: false, type: ['output', 'binary'] }),
        }


        // if (this.configPath !== undefined) {
        //     this.AdditionalFields.Database = new ui.ShowUser({
        //         value: [{
        //             id: 'Settings',
        //             obj: {
        //                 0: new db.GUI({
        //                     measurementName: 'adam_relay',
        //                     fields: ['VS0'],
        //                     obj: this,
        //                     testFlag: this.testFlag,
        //                     objPath: this.configPath,
        //                 })
        //             },
        //             path: this.configPath + '/' + db.path + '/' + bkup.fileName(this),
        //         }],
        //         type: ['output', 'link'],
        //     })
        //     this.getStaticSettings()
        // }

    }


    getStaticSettings() {
        var vMap = bkup.load(this.configPath)
        console.log('Loaded valves map')
        console.log(vMap)
    }




    initialize() {
        this.device.getChannelStates().then(() => {
            for (var channel = 0; channel < this.numberVSs; channel++) {
                this.hidden.valveStates[channel].value = this.device.hidden.channels[channel].state.value
                // console.log('\n\n\nTESTETSTEST\n\n\n')
                // console.log(`TestTestTest: ${this.device.hidden.channels[channel].state.value}`)
                this.hidden.valveStates[channel].time = Date.now()
            }
            // console.log(JSON.stringify(this.hidden.valveStates))
        }).catch(error => {
            console.log('Update VS error')
            console.log(error)
        })

    }
}



module.exports = {
    Device: RelayAdam,
}
