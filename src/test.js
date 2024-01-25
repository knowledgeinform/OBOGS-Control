const {SerialPort} = require('serialport')
const {ReadlineParser} = require('@serialport/parser-readline')
// console.log(CustomParser)
var port = new SerialPort({path: 'COM4', baudRate: 115200})

var parser = port.pipe(new ReadlineParser({ delimiter: '\r\n'}))

parser.on('data', d => {console.log(d)})

setInterval(() => {
    console.log('writing port')
    port.write('<q>\r', err => {
        if (err) {
            console.log('err', err)
        }
    })
}, 50)