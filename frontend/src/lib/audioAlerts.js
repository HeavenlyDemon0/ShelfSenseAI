/**
 * ShelfSense AI — Web Audio Synthesizer
 * Generates modern procedural chimes using the browser Web Audio API
 * (Zero external audio file dependencies, zero CORS issues)
 */

class SoundEffects {
  constructor() {
    this.ctx = null
    this.enabled = true
  }

  _initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  playSuccess() {
    if (!this.enabled) return
    try {
      this._initContext()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5

      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    } catch (e) {}
  }

  playAlert() {
    if (!this.enabled) return
    try {
      this._initContext()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now) // A4
      osc.frequency.setValueAtTime(370, now + 0.1) // F#4
      osc.frequency.setValueAtTime(440, now + 0.2) // A4

      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.45)
    } catch (e) {}
  }

  playDispatch() {
    if (!this.enabled) return
    try {
      this._initContext()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08) // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16) // G5
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.24) // C6

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.40)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.40)
    } catch (e) {}
  }
}

export const soundEffects = new SoundEffects()

