const fs = require('fs')
const exec = require('child_process').execFile

/* try {
  /* const params = ['C:/Users/wellemp1/Documents/GitHub/obogs/obogs-control/src/AG-016841780 FTIR DATA 20141204 140315.LAB', 'output']
  exec('C:/Users/wellemp1/Documents/LabFileParser/LabFileParser/LabFileParser/bin/Debug/LabFileParser.exe', params, (err, data) => {
    if (err) {
      console.log('FAIL')
    } else console.log('SUCCESS')
  })

} catch (error) {
  console.error(error)
} */
module.exports = {
  convertInterferogram() {
    console.log('convertInterferogram')
    /* try {
      const params = ['C:/Users/wellemp1/Documents/GitHub/obogs/obogs-control/src/AG-016841780 FTIR DATA 20141204 140315.LAB', 'output']
      exec('C:/Users/wellemp1/Documents/LabFileParser/LabFileParser/LabFileParser/bin/Debug/LabFileParser.exe', params, (err, data) => {
        if (err) {
          console.log('FAIL')
        } else console.log('SUCCESS')
      })
    } catch (error) {
      console.error(error)
    } */
  },
}
