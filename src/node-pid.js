/**
 *  PID Controller.
 */
class Controller {
  constructor(kp, ki, kd, dt, outMax, outMin) {
    var iMax
    if (typeof kp === 'object') {
      var options = kp
      this.kp = (typeof options.kp === 'number') ? options.kp : 1
      this.ki = (typeof options.ki === 'number') ? options.ki : 1
      this.kd = (typeof options.kd === 'number') ? options.kd : 0
      this.dt = (typeof options.dt === 'number') ? options.dt : 1000
      this.outMax = (typeof options.outMax === 'number') ? options.outMax : 100
      this.iMax = (typeof options.iMax === 'number') ? options.iMax : this.outMax
      this.outMin = (typeof options.outMin === 'number') ? options.outMin : -100
    } else {
      // PID constants
      this.kp = (typeof kp === 'number') ? kp : 1
      this.ki = ki || 0
      this.kd = kd || 0
      this.outMax = outMax || 100
      this.outMin = outMin || -100
      // Interval of time between two updates
      // If not set, it will be automatically calculated
      this.dt = dt || 0

      // Maximum absolute value of sumError
      this.iMax = iMax || this.outMax
    }

    this.dError = 0
    this.dErrorIndex = 0
    this.dErrorLen = 10
    this.dErrorArr  = new Array(this.dErrorLen).fill(0)

    this.ITerm = 0
    this.lastError = 0
    this.lastTime  = 0

    this.target    = 0 // default value, can be modified with .setTarget
  }

  setTarget(target) {
    this.target = target
  }

  update(currentValue) {
    this.currentValue = currentValue

    // Calculate dt
    var dt = this.dt
    if (!dt) {
      var currentTime = Date.now()
      dt = this.lastTime === 0 ? 0 : (currentTime - this.lastTime) / 1000
      this.lastTime = currentTime
    }

    if (typeof dt !== 'number' || dt === 0) {
      dt = 1
    }

    var error = (this.target - this.currentValue)
    this.ITerm += this.ki * error * dt

    if (this.ITerm > this.outMax) {
      this.ITerm = this.outMax
    } else if (this.ITerm < this.outMin) {
      this.ITerm = this.outMin
    }

    this.dErrorArr[this.dErrorIndex] = (error - this.lastError) / dt
    this.dErrorIndex = (this.dErrorIndex + 1) % this.dErrorLen
    var dErrorSum  = 0
    for (var derr of this.dErrorArr) {
      dErrorSum += derr
    }

    this.dError = dErrorSum / this.dErrorLen

    this.lastError = error
    // console.log('Controller updating')
    // console.log(this.kp)
    // console.log(error)
    // console.log(this.ki)
    // console.log(this.ITerm)
    // console.log(this.kd)
    // console.log(this.dError)
    var MV = (this.kp * error) + this.ITerm + (this.kd * this.dError)
    if (MV > this.outMax) {
      MV = this.outMax
    }

    if (MV < this.outMin) {
      MV = this.outMin
    }

    return MV
  }

  reset() {
    this.sumError  = 0
    this.lastError = 0
    this.lastTime  = 0
  }
}

module.exports = Controller
