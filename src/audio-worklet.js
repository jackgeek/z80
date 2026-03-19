// AudioWorklet processor for ZX Spectrum beeper output
// Runs on a dedicated audio thread — keeps audio processing off the main thread
class BeeperProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(8192);
    this.head = 0;
    this.tail = 0;
    // High-pass filter state (removes DC offset from 1-bit beeper)
    this.hpfPrevInput = 0;
    this.hpfPrevOutput = 0;

    this.port.onmessage = (e) => {
      const samples = e.data;
      let head = this.head;
      let tail = this.tail;
      for (let i = 0; i < samples.length; i++) {
        this.ring[head] = samples[i];
        head = (head + 1) & 8191;
        if (head === tail) tail = (tail + 1) & 8191;
      }
      this.head = head;
      this.tail = tail;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0][0];
    if (!output) return true;

    const alpha = 0.995;
    let prevIn = this.hpfPrevInput;
    let prevOut = this.hpfPrevOutput;
    let tail = this.tail;
    const head = this.head;

    for (let i = 0; i < output.length; i++) {
      if (head !== tail) {
        const raw = this.ring[tail];
        tail = (tail + 1) & 8191;
        prevOut = alpha * (prevOut + raw - prevIn);
        prevIn = raw;
        output[i] = prevOut * 0.5;
      } else {
        prevOut *= 0.99;
        output[i] = 0;
      }
    }

    this.hpfPrevInput = prevIn;
    this.hpfPrevOutput = prevOut;
    this.tail = tail;
    return true;
  }
}

registerProcessor('beeper-processor', BeeperProcessor);
