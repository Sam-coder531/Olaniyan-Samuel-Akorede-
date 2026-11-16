import { getChordFreqs, getDegreeFreq } from "./music";
import {
  BeatPattern,
  InstrumentId,
  MasterParams,
  ScaleId,
  StepVelocity,
} from "./types";

interface AudioGraph {
  dryInput: GainNode;
  spaceSend: GainNode;
  driveShaper: WaveShaperNode;
  filter: BiquadFilterNode;
  delayL: DelayNode;
  delayR: DelayNode;
  spaceReturn: GainNode;
  masterGain: GainNode;
  analyser?: AnalyserNode;
  noiseBuffer: AudioBuffer;
}

export interface TriggerEvent {
  instrument: InstrumentId;
  step: number;
  velocity: StepVelocity;
  timestamp: number;
}

function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function makePlateImpulse(ctx: BaseAudioContext, seconds = 1.85): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Smooth early-reflection bloom + exponential warm studio tail
      const env = Math.pow(1 - t, 2.7) * (1 - Math.exp(-i / (ctx.sampleRate * 0.008)));
      const white = Math.random() * 2 - 1;
      lp = lp * 0.62 + white * 0.38; // Warm analog plate damping
      data[i] = lp * env * 0.7;
    }
  }
  return impulse;
}

function makeSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const k = 1 + drive * 14;
  const norm = Math.tanh(k);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

function filterValueToHz(v: number): number {
  const clamped = Math.max(0.02, Math.min(1, v));
  // Exponential mapping: 220 Hz -> 19,500 Hz
  return 220 * Math.pow(19500 / 220, clamped);
}

function filterValueToQ(v: number): number {
  // Subtle musical resonance bump in mid-sweep for DJ filter throws
  const mid = 1 - Math.abs(v - 0.5) * 2;
  return 0.75 + Math.max(0, mid) * 2.4;
}

function buildMasterGraph(
  ctx: BaseAudioContext,
  master: MasterParams,
  withAnalyser: boolean
): AudioGraph {
  const dryInput = ctx.createGain();
  dryInput.gain.value = 0.85;

  const spaceSend = ctx.createGain();
  spaceSend.gain.value = 0.85;

  const driveShaper = ctx.createWaveShaper();
  driveShaper.curve = makeSaturationCurve(master.drive);
  driveShaper.oversample = "2x";

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterValueToHz(master.filter);
  filter.Q.value = filterValueToQ(master.filter);

  // Stereo studio plate reverb
  const convolver = ctx.createConvolver();
  convolver.buffer = makePlateImpulse(ctx);

  const reverbTone = ctx.createBiquadFilter();
  reverbTone.type = "highpass";
  reverbTone.frequency.value = 210;

  // Synced dotted-eighth stereo ping-pong delay
  const sixteenth = 60 / master.bpm / 4;
  const dottedEighth = Math.min(0.85, sixteenth * 3);

  const delayL = ctx.createDelay(1.2);
  const delayR = ctx.createDelay(1.2);
  delayL.delayTime.value = dottedEighth;
  delayR.delayTime.value = dottedEighth;

  const fbL = ctx.createGain();
  const fbR = ctx.createGain();
  fbL.gain.value = 0.28;
  fbR.gain.value = 0.28;

  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "bandpass";
  delayFilter.frequency.value = 1450;
  delayFilter.Q.value = 0.7;

  const merger = ctx.createChannelMerger(2);
  const delayMix = ctx.createGain();
  delayMix.gain.value = 0.34;

  spaceSend.connect(delayFilter);
  delayFilter.connect(delayL);
  delayL.connect(fbL);
  fbL.connect(delayR);
  delayR.connect(fbR);
  fbR.connect(delayL);
  delayL.connect(merger, 0, 0);
  delayR.connect(merger, 0, 1);
  merger.connect(delayMix);

  const spaceReturn = ctx.createGain();
  spaceReturn.gain.value = master.space * 0.72;

  spaceSend.connect(reverbTone);
  reverbTone.connect(convolver);
  convolver.connect(spaceReturn);
  delayMix.connect(spaceReturn);

  // Sum dry + wet into tape saturation -> DJ filter -> glue compressor -> master
  dryInput.connect(driveShaper);
  spaceReturn.connect(driveShaper);
  driveShaper.connect(filter);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.14;

  const masterGain = ctx.createGain();
  masterGain.gain.value = master.volume * 0.92;

  filter.connect(compressor);
  compressor.connect(masterGain);

  let analyser: AnalyserNode | undefined;
  if (withAnalyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
  } else {
    masterGain.connect(ctx.destination);
  }

  return {
    dryInput,
    spaceSend,
    driveShaper,
    filter,
    delayL,
    delayR,
    spaceReturn,
    masterGain,
    analyser,
    noiseBuffer: makeNoiseBuffer(ctx),
  };
}

function triggerVoice(
  ctx: BaseAudioContext,
  graph: AudioGraph,
  instrument: InstrumentId,
  time: number,
  velocity: StepVelocity,
  trackVolume: number,
  noteDegree: number,
  scale: ScaleId
): void {
  if (velocity === 0 || trackVolume <= 0.001) return;
  const isAccent = velocity === 2;
  const velGain = (isAccent ? 1.0 : 0.68) * trackVolume;

  switch (instrument) {
    case "logdrum": {
      // Authentic Amapiano / Afro sub-wood log drum:
      // Pitched sine sub + 2.98x hollow-wood FM knock + crisp mallet transient
      const baseFreq = getDegreeFreq(scale, noteDegree, 0);
      // Keep fundamental squarely in chest-hitting 58-135 Hz register
      const freq = baseFreq > 135 ? baseFreq * 0.5 : baseFreq;
      const dur = isAccent ? 0.44 : 0.32;

      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq * (isAccent ? 2.15 : 1.75), time);
      carrier.frequency.exponentialRampToValueAtTime(freq, time + 0.036);
      carrier.frequency.exponentialRampToValueAtTime(freq * 0.94, time + dur);

      // FM modulator for unmistakable hollow wooden log knock
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.setValueAtTime(freq * 2.96, time);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freq * (isAccent ? 2.8 : 1.7), time);
      modGain.gain.exponentialRampToValueAtTime(0.01, time + 0.055);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      // Warm harmonic overtone so it translates on laptop & phone speakers
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(freq * 2, time);
      body.frequency.exponentialRampToValueAtTime(freq * 1.98, time + 0.12);

      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(velGain * 0.24, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.0008, time + 0.14);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(velGain * 0.86, time + 0.003);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      carrier.connect(amp);
      body.connect(bodyGain);
      bodyGain.connect(graph.dryInput);
      amp.connect(graph.dryInput);

      // Subtle room send on the wooden knock
      const send = ctx.createGain();
      send.gain.value = 0.14;
      bodyGain.connect(send);
      send.connect(graph.spaceSend);

      carrier.start(time);
      mod.start(time);
      body.start(time);
      carrier.stop(time + dur + 0.02);
      mod.stop(time + 0.08);
      body.stop(time + 0.16);
      break;
    }

    case "kick": {
      const dur = 0.31;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isAccent ? 158 : 136, time);
      osc.frequency.exponentialRampToValueAtTime(50, time + 0.044);
      osc.frequency.exponentialRampToValueAtTime(42, time + dur);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(velGain * 0.92, time + 0.0025);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      // Soft felt beater click
      const click = ctx.createBufferSource();
      click.buffer = graph.noiseBuffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = "lowpass";
      clickFilter.frequency.value = isAccent ? 850 : 600;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(velGain * 0.22, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);

      osc.connect(amp);
      amp.connect(graph.dryInput);
      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(graph.dryInput);

      osc.start(time);
      click.start(time);
      osc.stop(time + dur + 0.02);
      click.stop(time + 0.02);
      break;
    }

    case "rim": {
      // Classic Lagos Afrobeats wood rim / clave knock
      const osc1 = ctx.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(isAccent ? 485 : 455, time);
      osc1.frequency.exponentialRampToValueAtTime(340, time + 0.032);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(isAccent ? 1720 : 1580, time);
      osc2.frequency.exponentialRampToValueAtTime(1180, time + 0.024);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(velGain * 0.56, time);
      toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.048);

      const noise = ctx.createBufferSource();
      noise.buffer = graph.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = isAccent ? 2150 : 1850;
      bp.Q.value = 3.2;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(velGain * 0.52, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.034);

      const rimSend = ctx.createGain();
      rimSend.gain.value = isAccent ? 0.34 : 0.2;

      osc1.connect(toneGain);
      osc2.connect(toneGain);
      toneGain.connect(graph.dryInput);
      toneGain.connect(rimSend);

      noise.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(graph.dryInput);
      noiseGain.connect(rimSend);
      rimSend.connect(graph.spaceSend);

      osc1.start(time);
      osc2.start(time);
      noise.start(time);
      osc1.stop(time + 0.055);
      osc2.stop(time + 0.055);
      noise.stop(time + 0.042);
      break;
    }

    case "shekere": {
      // Woven calabash gourd shaker — organic bead attack & crisp high shimmer
      const dur = isAccent ? 0.095 : 0.058;
      const src = ctx.createBufferSource();
      src.buffer = graph.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3400;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = isAccent ? 7900 : 6400;
      bp.Q.value = 1.15;

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(velGain * 0.46, time + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      const pan = ctx.createStereoPanner();
      pan.pan.value = isAccent ? 0.22 : -0.18;

      src.connect(hp);
      hp.connect(bp);
      bp.connect(amp);
      amp.connect(pan);
      pan.connect(graph.dryInput);

      const send = ctx.createGain();
      send.gain.value = 0.14;
      pan.connect(send);
      send.connect(graph.spaceSend);

      src.start(time, (time * 37) % 0.7);
      src.stop(time + dur + 0.01);
      break;
    }

    case "conga": {
      // Warm hand-struck open conga & accented slap
      const dur = isAccent ? 0.21 : 0.17;
      const startFreq = isAccent ? 285 : 220;
      const endFreq = isAccent ? 205 : 172;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.032);
      osc.frequency.exponentialRampToValueAtTime(endFreq * 0.96, time + dur);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(velGain * 0.68, time + 0.003);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      // Palm skin slap
      const slap = ctx.createBufferSource();
      slap.buffer = graph.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = isAccent ? 1250 : 880;
      bp.Q.value = 2.4;
      const slapGain = ctx.createGain();
      slapGain.gain.setValueAtTime(velGain * (isAccent ? 0.36 : 0.16), time);
      slapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

      const pan = ctx.createStereoPanner();
      pan.pan.value = -0.25;

      osc.connect(amp);
      amp.connect(pan);
      slap.connect(bp);
      bp.connect(slapGain);
      slapGain.connect(pan);
      pan.connect(graph.dryInput);

      const send = ctx.createGain();
      send.gain.value = 0.24;
      pan.connect(send);
      send.connect(graph.spaceSend);

      osc.start(time);
      slap.start(time);
      osc.stop(time + dur + 0.02);
      slap.stop(time + 0.03);
      break;
    }

    case "gangan": {
      // Yoruba Gangan (Talking Drum) — vocal tension-cord pitch glide
      const targetFreq = getDegreeFreq(scale, noteDegree, 1);
      const dur = isAccent ? 0.34 : 0.23;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      if (isAccent) {
        // Expressive upward squeeze then warm release ("gàn-gán!")
        osc.frequency.setValueAtTime(targetFreq * 0.82, time);
        osc.frequency.exponentialRampToValueAtTime(targetFreq * 1.16, time + 0.085);
        osc.frequency.exponentialRampToValueAtTime(targetFreq * 0.98, time + dur);
      } else {
        osc.frequency.setValueAtTime(targetFreq * 1.08, time);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, time + 0.055);
      }

      const overtone = ctx.createOscillator();
      overtone.type = "triangle";
      overtone.frequency.setValueAtTime(targetFreq * 1.5, time);
      if (isAccent) {
        overtone.frequency.exponentialRampToValueAtTime(targetFreq * 1.72, time + 0.085);
      }
      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(velGain * 0.2, time);
      overGain.gain.exponentialRampToValueAtTime(0.0008, time + 0.11);

      // Curved wooden beater attack on goatskin
      const stick = ctx.createBufferSource();
      stick.buffer = graph.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1100;
      bp.Q.value = 2.8;
      const stickGain = ctx.createGain();
      stickGain.gain.setValueAtTime(velGain * 0.28, time);
      stickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(velGain * 0.66, time + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      const pan = ctx.createStereoPanner();
      pan.pan.value = 0.24;

      osc.connect(amp);
      overtone.connect(overGain);
      overGain.connect(amp);
      stick.connect(bp);
      bp.connect(stickGain);
      stickGain.connect(pan);
      amp.connect(pan);

      pan.connect(graph.dryInput);
      const send = ctx.createGain();
      send.gain.value = 0.32;
      pan.connect(send);
      send.connect(graph.spaceSend);

      osc.start(time);
      overtone.start(time);
      stick.start(time);
      osc.stop(time + dur + 0.02);
      overtone.stop(time + 0.13);
      stick.stop(time + 0.025);
      break;
    }

    case "rhodes": {
      // Warm Fender Rhodes MkI 9th chord voicing with delicate bell tine
      const freqs = getChordFreqs(scale, noteDegree);
      const dur = isAccent ? 0.92 : 0.62;
      const perVoice = (velGain * 0.24) / Math.sqrt(freqs.length / 3);

      const chordBus = ctx.createBiquadFilter();
      chordBus.type = "lowpass";
      chordBus.frequency.setValueAtTime(isAccent ? 2800 : 1950, time);
      chordBus.frequency.exponentialRampToValueAtTime(820, time + dur);

      const busGain = ctx.createGain();
      busGain.gain.setValueAtTime(0.001, time);
      busGain.gain.linearRampToValueAtTime(1.0, time + 0.01);
      busGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      chordBus.connect(busGain);
      busGain.connect(graph.dryInput);

      const send = ctx.createGain();
      send.gain.value = 0.52;
      busGain.connect(send);
      send.connect(graph.spaceSend);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(f, time);
        osc.detune.value = (idx - 2) * 2.5; // Gentle analog chorus warmth

        const vGain = ctx.createGain();
        vGain.gain.value = idx === 0 ? perVoice * 1.15 : perVoice * 0.85;

        osc.connect(vGain);
        vGain.connect(chordBus);
        osc.start(time + idx * 0.006); // Subtle human strum roll
        osc.stop(time + dur + 0.03);

        if (isAccent && idx === freqs.length - 1) {
          // Rhodes metallic tine sparkle on top note
          const tine = ctx.createOscillator();
          tine.type = "sine";
          tine.frequency.setValueAtTime(f * 4, time);
          const tineGain = ctx.createGain();
          tineGain.gain.setValueAtTime(perVoice * 0.24, time);
          tineGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.14);
          tine.connect(tineGain);
          tineGain.connect(chordBus);
          tine.start(time + idx * 0.006);
          tine.stop(time + 0.16);
        }
      });
      break;
    }

    case "kalimba": {
      // Sparkling African thumb-piano tine pluck with stereo echo tail
      const freq = getDegreeFreq(scale, noteDegree, 2);
      const dur = isAccent ? 0.52 : 0.36;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      // Characteristic clamped-tine metallic overtone (~6.15x fundamental)
      const tine = ctx.createOscillator();
      tine.type = "sine";
      tine.frequency.setValueAtTime(freq * 6.15, time);
      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(velGain * (isAccent ? 0.14 : 0.08), time);
      tineGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.042);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(velGain * 0.44, time + 0.003);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      const pan = ctx.createStereoPanner();
      pan.pan.value = ((noteDegree % 5) - 2) * 0.16;

      osc.connect(amp);
      tine.connect(tineGain);
      tineGain.connect(amp);
      amp.connect(pan);
      pan.connect(graph.dryInput);

      const send = ctx.createGain();
      send.gain.value = 0.62;
      pan.connect(send);
      send.connect(graph.spaceSend);

      osc.start(time);
      tine.start(time);
      osc.stop(time + dur + 0.02);
      tine.stop(time + 0.05);
      break;
    }
  }
}

export class AkoredeAudioEngine {
  private ctx: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private pattern: BeatPattern | null = null;

  private isPlaying = false;
  private globalTick = 0;
  private nextNoteTime = 0;
  private schedulerTimer: number | null = null;
  private visualTimers: number[] = [];

  public onStepChange?: (globalTick: number) => void;
  public onTrigger?: (event: TriggerEvent) => void;

  private ensureContext(master: MasterParams): {
    ctx: AudioContext;
    graph: AudioGraph;
  } {
    if (!this.ctx || !this.graph) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.graph = buildMasterGraph(this.ctx, master, true);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return { ctx: this.ctx, graph: this.graph };
  }

  public syncPattern(pattern: BeatPattern): void {
    this.pattern = pattern;
    if (!this.ctx || !this.graph) return;

    const now = this.ctx.currentTime;
    const { master } = pattern;
    this.graph.filter.frequency.setTargetAtTime(
      filterValueToHz(master.filter),
      now,
      0.025
    );
    this.graph.filter.Q.setTargetAtTime(
      filterValueToQ(master.filter),
      now,
      0.025
    );
    this.graph.spaceReturn.gain.setTargetAtTime(
      master.space * 0.72,
      now,
      0.03
    );
    this.graph.masterGain.gain.setTargetAtTime(
      master.volume * 0.92,
      now,
      0.02
    );
    this.graph.driveShaper.curve = makeSaturationCurve(master.drive);

    const dottedEighth = Math.min(0.85, (60 / master.bpm / 4) * 3);
    this.graph.delayL.delayTime.setTargetAtTime(dottedEighth, now, 0.06);
    this.graph.delayR.delayTime.setTargetAtTime(dottedEighth, now, 0.06);
  }

  public start(pattern: BeatPattern): void {
    this.pattern = pattern;
    const { ctx } = this.ensureContext(pattern.master);
    this.syncPattern(pattern);

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.globalTick = 0;
    this.nextNoteTime = ctx.currentTime + 0.045;

    const scheduleAheadSec = 0.11;
    const lookaheadMs = 25;

    const tickScheduler = () => {
      if (!this.isPlaying || !this.ctx || !this.graph || !this.pattern) return;

      while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadSec) {
        this.scheduleTick(this.globalTick, this.nextNoteTime);
        const sixteenth = 60 / this.pattern.master.bpm / 4;
        // Swing delays odd 16th steps and shortens the return into even 16ths
        const swingOffset = (this.pattern.master.swing / 100) * 0.45 * sixteenth;
        const delta =
          this.globalTick % 2 === 0
            ? sixteenth + swingOffset
            : sixteenth - swingOffset;
        this.nextNoteTime += Math.max(0.03, delta);
        this.globalTick++;
      }
    };

    tickScheduler();
    this.schedulerTimer = window.setInterval(tickScheduler, lookaheadMs);
  }

  private scheduleTick(tick: number, time: number): void {
    if (!this.ctx || !this.graph || !this.pattern) return;
    const p = this.pattern;
    const hasSolo = p.tracks.some((t) => t.solo);
    const firedEvents: TriggerEvent[] = [];

    for (const track of p.tracks) {
      const audible = hasSolo ? track.solo : !track.muted;
      if (!audible) continue;

      const step = tick % track.length;
      const vel = track.steps[step] ?? 0;
      if (vel > 0) {
        const note = track.notes[step] ?? 0;
        triggerVoice(
          this.ctx,
          this.graph,
          track.id,
          time,
          vel,
          track.volume,
          note,
          p.master.scale
        );
        firedEvents.push({
          instrument: track.id,
          step,
          velocity: vel,
          timestamp: performance.now(),
        });
      }
    }

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    const timer = window.setTimeout(() => {
      if (!this.isPlaying) return;
      this.onStepChange?.(tick);
      const nowMs = performance.now();
      for (const ev of firedEvents) {
        this.onTrigger?.({ ...ev, timestamp: nowMs });
      }
    }, delayMs);
    this.visualTimers.push(timer);
    if (this.visualTimers.length > 32) {
      this.visualTimers.splice(0, this.visualTimers.length - 32);
    }
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    for (const t of this.visualTimers) {
      window.clearTimeout(t);
    }
    this.visualTimers = [];
  }

  public audition(
    instrument: InstrumentId,
    pattern: BeatPattern,
    velocity: StepVelocity = 2,
    noteOverride?: number
  ): number {
    const { ctx, graph } = this.ensureContext(pattern.master);
    this.syncPattern(pattern);
    const track = pattern.tracks.find((t) => t.id === instrument);
    const vol = track ? Math.max(0.55, track.volume) : 0.8;
    const step = track ? Math.max(0, this.globalTick - 1) % track.length : 0;
    const note = noteOverride ?? track?.notes[step] ?? 0;

    triggerVoice(
      ctx,
      graph,
      instrument,
      ctx.currentTime + 0.004,
      velocity,
      vol,
      note,
      pattern.master.scale
    );

    this.onTrigger?.({
      instrument,
      step,
      velocity,
      timestamp: performance.now(),
    });
    return step;
  }

  public getCurrentTick(): number {
    return Math.max(0, this.globalTick - 1);
  }

  public getAnalyser(): AnalyserNode | null {
    return this.graph?.analyser ?? null;
  }

  public dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.graph = null;
    }
  }
}

/**
 * Renders `bars` bars (16 steps per bar) of `pattern` through the exact studio
 * synthesis & master FX chain via OfflineAudioContext, returning a downloadable
 * 16-bit 44.1kHz stereo WAV Blob.
 */
export async function renderPatternToWavBlob(
  pattern: BeatPattern,
  bars = 4
): Promise<Blob> {
  const sampleRate = 44100;
  const totalSteps = bars * 16;
  const sixteenth = 60 / pattern.master.bpm / 4;
  const swingOffset = (pattern.master.swing / 100) * 0.45 * sixteenth;
  const loopDuration = totalSteps * sixteenth;
  const tailSeconds = 1.4;
  const totalFrames = Math.ceil((loopDuration + tailSeconds) * sampleRate);

  const offline = new OfflineAudioContext(2, totalFrames, sampleRate);
  const graph = buildMasterGraph(offline, pattern.master, false);
  const hasSolo = pattern.tracks.some((t) => t.solo);

  let cursor = 0.02;
  for (let tick = 0; tick < totalSteps; tick++) {
    for (const track of pattern.tracks) {
      const audible = hasSolo ? track.solo : !track.muted;
      if (!audible) continue;
      const step = tick % track.length;
      const vel = track.steps[step] ?? 0;
      if (vel > 0) {
        triggerVoice(
          offline,
          graph,
          track.id,
          cursor,
          vel,
          track.volume,
          track.notes[step] ?? 0,
          pattern.master.scale
        );
      }
    }
    cursor +=
      tick % 2 === 0 ? sixteenth + swingOffset : sixteenth - swingOffset;
  }

  // Smooth fade-out across tail so export ends click-free
  graph.masterGain.gain.setValueAtTime(
    pattern.master.volume * 0.92,
    loopDuration + 0.1
  );
  graph.masterGain.gain.linearRampToValueAtTime(
    0.0001,
    loopDuration + tailSeconds - 0.05
  );

  const rendered = await offline.startRendering();
  return audioBufferToWav(rendered);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}
