import { getWasm, getMemory } from '../emulator/state.js';

let audioCtx = null;
let audioWorkletNode = null;
let audioScriptNode = null;
let useWorklet = false;
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_SAMPLES_PER_FRAME = 882;
const AUDIO_RING_SIZE = 8192;
const audioRing = new Float32Array(AUDIO_RING_SIZE);
let audioRingHead = 0;
let audioRingTail = 0;
let hpfPrevInput = 0;
let hpfPrevOutput = 0;
const HPF_ALPHA = 0.995;
let cachedAudioBase = 0;
const audioPostBuf = new Float32Array(AUDIO_SAMPLES_PER_FRAME);

export async function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return;
  }

  audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });

  try {
    await audioCtx.audioWorklet.addModule('audio-worklet.js');
    audioWorkletNode = new AudioWorkletNode(audioCtx, 'beeper-processor');
    audioWorkletNode.connect(audioCtx.destination);
    useWorklet = true;
  } catch (e) {
    useWorklet = false;
    audioScriptNode = audioCtx.createScriptProcessor(2048, 0, 1);
    audioScriptNode.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) {
        let raw = 0;
        if (audioRingHead !== audioRingTail) {
          raw = audioRing[audioRingTail];
          audioRingTail = (audioRingTail + 1) & (AUDIO_RING_SIZE - 1);
        }
        hpfPrevOutput = HPF_ALPHA * (hpfPrevOutput + raw - hpfPrevInput);
        hpfPrevInput = raw;
        output[i] = hpfPrevOutput * 0.5;
      }
    };
    audioScriptNode.connect(audioCtx.destination);
  }

  audioCtx.resume();
}

['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => initAudio(), { passive: true });
});

export function pushAudioFrame() {
  const wasm = getWasm();
  const memory = getMemory();
  if (!audioCtx || !wasm || audioCtx.state !== 'running') return;

  if (!cachedAudioBase) {
    cachedAudioBase = wasm.getAudioBaseAddr();
  }

  const sampleCount = wasm.getAudioSampleCount();
  const samples = new Uint8Array(memory.buffer, cachedAudioBase, sampleCount);

  if (useWorklet) {
    for (let i = 0; i < sampleCount; i++) {
      audioPostBuf[i] = samples[i] !== 0 ? 1.0 : 0.0;
    }
    const msg = new Float32Array(audioPostBuf.buffer, 0, sampleCount);
    audioWorkletNode.port.postMessage(msg);
  } else {
    for (let i = 0; i < sampleCount; i++) {
      const val = samples[i] !== 0 ? 1.0 : 0.0;
      audioRing[audioRingHead] = val;
      audioRingHead = (audioRingHead + 1) & (AUDIO_RING_SIZE - 1);
      if (audioRingHead === audioRingTail) {
        audioRingTail = (audioRingTail + 1) & (AUDIO_RING_SIZE - 1);
      }
    }
  }
}
