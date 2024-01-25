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

const ad = require('./abstract-driver.js')

class Channel {
  constructor() {
    this.state = new ad.DataPoint({value: false, time: Date.now()})
  }
}


class Adam4168C {
  constructor({address = '01', router, testFlag = false}) {
    this.address = address
    this.router = router
    this.testFlag = testFlag

    this.serialControl = new ad.SerialControl({
      router: this.router,
      testFlag: this.testFlag,
      debugTest: false,
      timeout: 300,
      interMessageWait: 100,
    })

    this.numberChannels = 8


    this.hidden = {}
    this.hidden.configuration = new ad.DataPoint({})
    this.hidden.channels = []
    for (var channel = 0; channel < this.numberChannels; channel++) {
      this.hidden.channels[channel] = new Channel()
    }
  }

  validCommand(response) {
    return response[0] === '!'
  }


  //Requests all channel states from module and stores value in each channel 
  async getChannelStates() {
    var msg = '$' + this.address + '6' + '\r'
    var ret
    try {
      ret = await this.serialControl.serial(msg)
      // console.log(`Printing getChannelState return: ${ret}`)
      // console.log(ret)
      // var sampled_time = Date.now()
      var parts = ret[0].split('!')[1]
      var hex = parts.slice(0,2)
      var bitmap = parseInt(hex, 16).toString(2).padStart(8,'0') //converts two-char hex to binary bitmap
      for (var channel = 0; channel < this.numberChannels; channel++){
        // this.hidden.channels[channel].state.time = sampled_time
        this.hidden.channels[channel].state.value = Boolean(Number(bitmap[7-channel])) //channels[0] = bitmap[7], channels[1] = bitmap[6], etc...
        // console.log(`Printing channel ${channel}: ${this.hidden.channels[channel].state.value}`)
      }
      // console.log(`getChannelStates: ${bitmap}`)

    } catch (error) {
      console.log('get channel states error')
      console.log(error)
    }
  }


  //Sets individual channel i to state and updates channels[i].state if succesful 
  async setChannelState(i, _state) {
    i = Number(i)
    _state = Number(_state)
    var msg = '#' + this.address + '1' + i.toString() + '0' + _state.toString() + '\r'
    // console.log(`setChannelState msg: ${msg}`)
    var ret 
    try {
        if (i >= this.numberChannels) throw new Error('Invalid channel number')
        ret = await this.serialControl.serial(msg)
        var validReturn = ret[0][0] === '!'
        if (!validReturn) throw new Error("Invalid Command")

        // this.hidden.channels[i].state.time = Date.now()
        this.hidden.channels[i].state.value = _state
    }
    catch (error) {
        console.log('set channel state error')
        console.log(error)
    }
  }


  async getConfiguration() {
    var msg = '$' + this.address + '2\r'
    var ret
    try {
      ret = await this.serialControl.serial(msg)
      if (!this.validCommand(ret[0])) throw new Error('Invalid Command')
      // this.hidden.configuration.time = Date.now()
      this.hidden.configuration.value = ret[0]
    } catch (error) {
      console.log('get configuration error')
      console.log(error)
    }
  }
}

module.exports = {
  Adam4168C: Adam4168C,
}

// async function f() {
//   var router = new ad.Router({
//     portPath: 'COM15',
//     testFlag: false,
//     maxQueueLength: 100,
//     baud: 9600,
//     manufacturer: 'FTDI',
//     // manufacturer: 'Prolific Technology Inc.',
//     seriallineSerial: 'FTVAHE4V',
//   })

//   await router.openPort()

//   var dev = new Adam4168C({address: '01', router: router, testFlag: false})
//   var state = 0

//   setInterval(() => {
//     for (var channel = 0; channel < dev.numberChannels; channel++) {
//       if (channel === 0) {
//         dev.getChannelStates()
        
        
//         switch(state) {
//           case 0:
//             state = 1
//             break
//           case 1:
//             state = 0
//             break
//         }
//         console.log(state)
//         dev.setChannelState(0,state)
//       }
      
      
      
//     }
//   }, 1000)
// }

// console.log('Waiting 4 s before starting serial')

// setTimeout(() => {
//   f()
// }, 4000)
