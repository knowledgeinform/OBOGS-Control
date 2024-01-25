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

const EventEmitter = require('events')
const util = require('util')
const superagent = require('superagent')

class Kikusui extends EventEmitter {
  constructor({address = '192.12.3.143', load_msg = null, hwopt, g_wsToken = 0, testFlag = false}) {
    super()
    this.testFlag = testFlag
    this.address = address
    this.load_msg = load_msg
    this.hwopt = hwopt
    this.g_wsToken = g_wsToken

    this.outputState = false
  }

  modelInfo() {
    superagent
    .get(this.address + '/php/model_info.php')
    .then(res => {
      console.log('Response')
      if (res.statusCode === 200) {
        // console.log(res.text)
        var mi = JSON.parse(res.text)
        console.log(mi)
        Object.entries(mi).forEach(([key, value]) => {
          this[key] = value
        })
      }
    })
    .catch(error => {
      console.log('ERROR!!!!')
      console.error(error)
    })
  }

  networkInfo() {
    // continuously query network_info
    superagent
    .get(this.address + '/php/network_info.php')
    .then(res => {
      if (res.status === 200) {
        var ni = JSON.parse(res.text)
        console.log(ni)
        Object.entries(ni).forEach(([key, value]) => {
          this[key] = value
        })
      }
    })
    .catch(error => {
      console.log('ERROR!!!!')
      console.error(error)
    })
  }

  configInfo() {
    // continuously query config_info
    superagent
    .get(this.address + '/php/preference_info.php')
    .then(res => {
      if (res.status === 200) {
        var pi = JSON.parse(res.text)
        console.log(pi)
        Object.entries(pi).forEach(([key, value]) => {
          this[key] = value
        })
        // now update the GUI
        console.log('GOT HERE!!!')
        // updateGui(mi, ni, pi)
        //
        // // hide the spinning wheel
        // hideSpinningWheel()
      }
    })
    .catch(error => {
      console.log('ERROR!!!!')
      console.error(error)
    })
  }

  // The updater function for the virtual LCD screen
  update(cb, err_cb) {
    // Ajax needed for acquiring the LOAD on/off state
    var qry = ':DIAG:FP:MEAS?;WS?'
    // This query returns outp, oper, ques
    this.scpi_set_and_feedback(qry, true, 10, (res, tag) => {
      // console.log('inside update screens cb')
      if (tag !== 10) return

      // ioRefresh(1) //IO indicator, an evidence of active IO

      if (res.length >= 256) {
        // the resonse is normally around 276 bytes

        var tokens = res.split(/[,\n]/)
        if ((tokens !== undefined) && (tokens.length >= 29)) {
          // the tokens mush have 29 or 30 elements

          var meas_data = tokens.slice(0, 18)
          var fp_stat = tokens.slice(18)

          // update meas & stat values
          this._update_meas_pane(meas_data, fp_stat)
        }
      }

      // Turn IO indicator off after 50ms
      // setTimeout('ioRefresh(0)', 50)
      // Call back the specified CB func
      if (cb !== undefined) {
        cb()
      }
      // setTimeout('updateScreen()', 500)
    }, err_cb)
  }

  _update_meas_pane(meas_data, fp_stat) {
    // console.log('inside update and measure pane')
    // console.log(fp_stat)
    this.outp = Number(fp_stat[0])
    // this.protective = Number(fp_stat[1])
    this.prot_sts = fp_stat[2]
    this.ammtr = fp_stat[3]
    this.overload = Number(fp_stat[4])
    this.range_auto = Number(fp_stat[5])
    this.range = Number(fp_stat[6])
    this.couple = fp_stat[7]
    // this.fVolt = parseFloat(fp_stat[8])
    // this.fVoltOffs = parseFloat(fp_stat[9])
    // this.fFreq = parseFloat(fp_stat[10])
    this.errcuesz = Number(fp_stat[11])

    this.Idc = parseFloat(meas_data[0])
    this.Iac = parseFloat(meas_data[1])
    this.Irms = parseFloat(meas_data[2])
    this.Ipk = parseFloat(meas_data[3])
    this.Ipkh = parseFloat(meas_data[4])
    // this.Icf = parseFloat(meas_data[5])

    this.Wdc = parseFloat(meas_data[6])
    this.Wac = parseFloat(meas_data[7])
    // this.VAac = parseFloat(meas_data[8])
    // this.VARac = parseFloat(meas_data[9])
    // this.PFac = parseFloat(meas_data[10])
    this.Wacdc = parseFloat(meas_data[11])
    // this.VAacdc = parseFloat(meas_data[12])
    // this.VARacdc = parseFloat(meas_data[13])
    // this.PFacdc = parseFloat(meas_data[14])
    this.Vdc = parseFloat(meas_data[15])
    this.Vac = parseFloat(meas_data[16])
    this.Vrms = parseFloat(meas_data[17])
    this.emit('updated')
  }

  scpi_set_and_feedback_simple(cmd, cb) {
    return this.scpi_set_and_feedback(cmd, false, 0, cb)
  }

  scpi_set_and_feedback(cmd, hasQuery, tag, cb, err_cb) {
    // console.log('inside scpi set and feedback')
    // console.log(cmd)
    if (typeof hasQuery === 'undefined') {
      hasQuery = false
    }
    if (typeof tag === 'undefined') {
      tag = 0
    }

    var t = {
      token: this.g_wsToken,
      tag: tag,
      hasQuery: hasQuery,
      scpi: cmd,
      ioTimeout: 3000,
    }

    var enc = JSON.stringify(t)

    if (typeof this.timeouts === 'undefined') {
      this.timeouts = false
    }
    // console.log('about to launch query')
    if (!this.timeouts) {
      superagent
      .post(this.address + '/php/scpi_write_read.php')
      .timeout({response: 3000})
      .send(enc)
      .then(res => {
        // console.log('res')
        // console.log(res)
        if (res.text.match(/{\"tag\":\d*,\"scpi\":\".*}/)) {
          // simply validate JSON format, which mush have 'tag' and 'scpi' properties
          var j = JSON.parse(res.text)
          // console.log('j')
          // console.log(j)
          if ((j !== undefined) && (cb !== undefined)) {
            cb(j.scpi, j.tag)
          }
        }
      })
      .catch(error => {
        console.log('ERROR!!!!')
        // this.emit('error', error)
        console.error(error)
        if (error.status === 504) {
          console.log('Connection to the unit timed out.')
          this.timeouts = true
        }
        if (err_cb !== undefined) {
          err_cb(error)
        }
      })
    }
  }

  reauth() {
    superagent
    .post(this.address + '/php/try_auth.php')
    .then(res => {
      if (res.status === 200) {
        var wi = JSON.parse(res.text)
        this.g_wsToken = wi.wsToken
        if (wi.wsToken === 0) {
          console.log('Not authenticated -- I believe')
          // stuff about authentication vs no authentication
          // $('.authed').css('display', 'none')
          // $('.unauthed').css('display', 'none')
          return
        }
        console.log('Authenticated')
        this.emit('authenticated')
        // $('.authed').css('display', 'block')
        // $('.unauthed').css('display', 'none')
      }
    })
    .catch(error => {
      console.log('Authentication Error')
      console.log(error)
      // this.emit('error', error)
      if (error.status === 403) {
        // console.log()
        // $('.authed').css('display', 'none')
        // $('.unauthed').css('display', 'block')
      }
    })
  }

  fillInExample() {
    this.manufacturer = 'KIKUSUI'
    this.model = 'PCR500MA'
    this.model_id = 0
    this.serial = 'AQ002408'
    this.revision = ' 2.01'
    this.productDescription = 'AC Power Supply'
    this.iviDriverIdentifier = 'KikusuiPcrma'
    this.HwAdr = '00:0F:CE:01:2D:1B'
    this.UsbVid = 2878
    this.UsbPid = 4176
    this.calStatus = 'Calibrated'
    this.calDate = '02/03/2020'
    this.hwOption = ''
    this.swOption = ''
    this.dhcpEnabled = false
    this.adnsEnabled = true
    this.mdnsEnabled = true
    this.webctlEnabled = 1
    this.IpAdr = '192.12.3.143'
    this.NetMask = '255.255.0.0'
    this.DefGW = '0.0.0.0'
    this.PriDNS = '0.0.0.0'
    this.SecDNS = '0.0.0.0'
    this.PriWINS = '0.0.0.0'
    this.SecWINS = '0.0.0.0'
    this.telnetPort = 5024
    this.scpirawPort = 5025
    this.hislipPort = 4880
    this.GpAdr = 5
    this.siclname = 'gpib0'
    this.hostname = 'PCR500MA-02408'
    this.description = 'KIKUSUI PCR500MA AC Power Supply - AQ002408'
    this.secured = 0
    this.IpAssign = 'Manual'
    this.mdnsHostname = 'PCR500MA-02408.local.'
    this.ddnsHostname = ''
    this.nbnsHostname = 'PCR500MA-02408 '
    this.domain = ''
    this.lanIdentify = false
    this.timeouts = false
    this.outp = 0
    this.prot_sts = 'NOER'
    this.ammtr = 'RMS'
    this.overload = 0
    this.range_auto = 0
    this.range = 0
    this.couple = 'AC'
    this.errcuesz = 0
    this.Idc = -0.00076373
    this.Iac = 0.00442535
    this.Irms = 0.00449077
    this.Ipk = 0.0106347
    this.Ipkh = 0.015702
    this.Wdc = 0
    this.Wac = 0
    this.Wacdc = 0
    this.Vdc = 0.0185063
    this.Vac = 0.0378659
    this.Vrms = 0.0421463
  }



  //Queries Kikusui for outputState, emits 'outputState' event w/ state resp
  getOutput() {
    var cmds = ':OUTP?'
    this.scpi_set_and_feedback(cmds, true, 0,
      (resp, tag) => {

        // console.log(this)
        // console.log(`getOutput() Response:`)
        // console.log(resp)
        this.outputState = resp.includes('1')
      }
    )
  }

  setOutput(sel) {
    var cmds = [':OUTP 0', ':OUTP 1']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      (resp, tag) => {
        var result = resp.includes('1')
        // console.log(`Set Output Result: ${resp}`)
      }
    )
  }


  OnSelVoltRang(sel) {
    var cmds = ['VOLT:RANG 155', 'VOLT:RANG 310', 'VOLT:RANG:AUTO ON']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnSelOutpCoup(sel) {
    var cmds = ['OUTP:COUP AC', 'OUTP:COUP DC', 'OUTP:COUP ACDC', 'OUTP:COUP EXTAC', 'OUTP:COUP EXTDC']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnClickVoltEnter(txtObj, txtObjLo, txtObjHi) {
    if (!this.validateNumInput(txtObjHi) || !this.validateNumInput(txtObjLo) || !this.validateNumInput(txtObj)) {
      console.log('Invalid number expression')
      return
    }
    var argImm = parseFloat(txtObj.val())
    var argLimLo = parseFloat(txtObjLo.val())
    var argLimHi = parseFloat(txtObjHi.val())
    var cmd

    cmd = util.format('VOLT %s,%s,%s', argImm, argLimLo, argLimHi)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnClickVoltOffsEnter(txtObj, txtObjLo, txtObjHi) {
    if (!this.validateNumInput(txtObjHi) || !this.validateNumInput(txtObjLo) || !this.validateNumInput(txtObj)) {
      console.log('Invalid number expression')
      return
    }
    var argImm = parseFloat(txtObj.val())
    var argLimLo = parseFloat(txtObjLo.val())
    var argLimHi = parseFloat(txtObjHi.val())
    var cmd

    cmd = util.format('VOLT:OFFS %s,%s,%s', argImm, argLimLo, argLimHi)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnClickFreqEnter(txtObj, txtObjLo, txtObjHi) {
    if (!this.validateNumInput(txtObjHi) || !this.validateNumInput(txtObjLo) || !this.validateNumInput(txtObj)) {
      console.log('Invalid number expression')
      return
    }
    var argImm = parseFloat(txtObj.val())
    var argLimLo = parseFloat(txtObjLo.val())
    var argLimHi = parseFloat(txtObjHi.val())
    var cmd

    cmd = util.format('FREQ %s,%s,%s', argImm, argLimLo, argLimHi)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnTrigSyncSour(chkObj) {
    var cmd = chkObj.isChecked() ? 'TRIG:SYNC:SOUR PHAS' : 'TRIG:SYNC:SOUR IMM'
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnClickTrigSyncPhasEnter(txtObj) {
    if (!this.validateNumInput(txtObj)) {
      console.log('Invalid number expression')
      return
    }
    var arg = parseFloat(txtObj.val())
    var cmd = util.format(':TRIG:SYNC:PHAS:ON %s', arg)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_SET()
      // }
    )
  }

  OnSelOCPLimit(sel) {
    // 0:limit 1:trip
    var cmds = [':CURR:PROT:STAT 0', ':CURR:PROT:STAT 1']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   // this.OnClickRefresh_PROTECT()
      // }
    )
  }

  OnClickCurrLimitACEnter(txtObj) {
    if (!this.validateNumInput(txtObj)) {
      console.log('Invalid number expression')
      return
    }
    var arg = parseFloat(txtObj.val())
    var cmd = util.format(':CURR %s', arg)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   // OnClickRefresh_PROTECT()
      // }
    )
  }

  OnClickCurrLimitDCEnter(txtObj) {
    if (!this.validateNumInput(txtObj)) {
      console.log('Invalid number expression')
      return
    }
    var arg = parseFloat(txtObj.val())
    var cmd = util.format(':CURR:OFFS %s', arg)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_PROTECT()
      // }
    )
  }

  OnClickProtAlarmClear() {
    var cmd = util.format(':OUTP:PROT:CLE')
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_PROTECT()
      // }
    )
  }

  OnSelectMeasAvg(txtObj) {
    var cmd = util.format(':SENS:AVER %s', txtObj.val())
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnSelectAmmeter(sel) {
    // 0:RMS 1:AVG 2:PEAK 3:WATT
    var cmds = [':DISP:AMM RMS', ':DISP:AMM AVG', ':DISP:AMM PEAK', ':DISP:AMM WATT']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnClickCurrPeakHoldClear() {
    var cmd = ':SENS:CURR:HOLD:CLE'
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnSelectCurrHoldPeriod(sel) {
    // 0:short 1:long
    var cmds = [':SENS:CURR:HOLD SHORT', ':SENS:CURR:HOLD LONG']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnSelectErrorTrace(sel) {
    // 0:off 1:on
    var cmds = [':SYST:CONF:TRAC 0', ':SYST:CONF:TRAC 1']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnSelectPowerOnState(sel) {
    // 0:Reset 1:RCL0 2:Auto
    var cmds = [':OUTP:PON:STAT RST', ':OUTP:PON:STAT RCL0', ':OUTP:PON:STAT AUTO']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnClickMemomryRecall(txtObj) {
    var cmd = util.format('*RCL %s', txtObj.val())
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnClickMemomryStore(txtObj) {
    var cmd = util.format('*SAV %s', txtObj.val())
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_CONFIG()
      // }
    )
  }

  OnSelPanelKeylock(sel) {
    var cmd = util.format(':SYST:KLOC %s', sel)
    this.scpi_set_and_feedback(cmd, false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_SYST()
      // }
    )
  }

  OnSelPanelRemote(sel) {
    // 0:LOCal 1:REMote 2:RWLock
    var cmds = [':SYST:COMM:RLST LOC', ':SYST:COMM:RLST REM', ':SYST:COMM:RLST RWL']
    this.scpi_set_and_feedback(cmds[sel], false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_SYST()
      // }
    )
  }

  OnClickPanelReset() {
    this.scpi_set_and_feedback('*RST', false, 0,
      // function (resp, tag) {
      //   OnClickRefresh_SYST()
      // }
    )
  }

  validateNumInput(txtObj) {
    var txt = txtObj.val()
    if (txt.match(/^[-+]?[0-9]*\.?[0-9]+?(E[-+]?[0-9]+)?$/i)) {
      return true
    } else {
      txtObj.select()
      return false
    }
  }

  initialize() {
    if (this.testFlag) {
      // fill in important parts of object
      this.fillInExample()
      this.emit('authenticated')
    } else {
      this.modelInfo()
      this.networkInfo()
      this.configInfo()
      this.reauth()
      this.once('authenticated', () => {
        try{
          this.update()
        } catch (error) {
          console.log('update error')
          console.log(error)
        }
      })
    }
  }
}

module.exports = {
  Device: Kikusui,
}

// for actual device testing
// var k = new Kikusui({})
// k.initialize()
// setInterval(() => {
//   console.log('Updating')
//   try {
//     k.update()
//   } catch (error) {
//     console.log('update error')
//     console.log(error)
//   }
//   setTimeout(() => {
//     console.log(k)
//   }, 500)
// }, 1000)
