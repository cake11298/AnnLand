import { MELODY, midiToHz } from './game/melody.js';

let ctx = null, master = null, muted = false;
const VOL = 0.6;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : VOL;
}
export const isMuted = () => muted;

function note(midi, start, dur, { type = 'triangle', vol = 0.16 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  const len = Math.max(0.25, dur);
  o.type = type;
  o.frequency.value = midiToHz(midi);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + len);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + len + 0.05);
}

function noise(dur, freq, vol, type = 'bandpass') {
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export function chime() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [84, 88, 91, 96].forEach((m, i) => note(m, t + i * 0.07, 0.6, { type: 'sine', vol: 0.12 }));
}
export function sparkle(i) {
  if (!ctx) return;
  const sc = [0, 2, 4, 7, 9];
  note(72 + sc[i % 5] + 12 * (Math.floor(i / 5) % 2), ctx.currentTime, 0.5, { type: 'sine', vol: 0.09 });
}
export function swell() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => note(m, t + i * 0.14, 2.2, { type: 'sine', vol: 0.08 }));
}
function glide(f0, f1, start, dur, type = 'triangle', vol = 0.12) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, start);
  o.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.7);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start); o.stop(start + dur + 0.05);
}
export function animal(kind) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (kind === 'cat') { glide(620, 900, t, 0.25, 'sine'); glide(900, 520, t + 0.22, 0.4, 'sine'); }
  else if (kind === 'dog') { glide(320, 180, t, 0.14, 'square', 0.07); glide(340, 190, t + 0.2, 0.14, 'square', 0.07); }
  else { [1200, 1500, 1300].forEach((f, i) => glide(f, f * 1.2, t + i * 0.09, 0.08, 'sine', 0.08)); }
}
export function breath() { if (ctx) noise(0.18, 1400, 0.06); }
export function puff() { if (ctx) noise(0.25, 900, 0.25); }
export function boom() { if (ctx) noise(0.7, 320, 0.35, 'lowpass'); }
export function honk() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const d of [0, 0.28]) { note(55, t + d, 0.2, { type: 'square', vol: 0.05 }); note(59, t + d, 0.2, { type: 'square', vol: 0.04 }); }
}
export function bell() {
  if (!ctx) return;
  const t = ctx.currentTime;
  note(88, t, 0.7, { type: 'sine', vol: 0.12 });
  note(88, t + 0.22, 0.9, { type: 'sine', vol: 0.1 });
}

export function playBirthdaySong() {
  if (!ctx) return 0;
  const beat = 0.46;
  let t = ctx.currentTime + 0.25;
  for (const [m, b] of MELODY) {
    note(m, t, b * beat * 0.95, { vol: 0.15 });
    note(m - 12, t, b * beat * 0.95, { type: 'sine', vol: 0.07 });
    t += b * beat;
  }
  return t - ctx.currentTime;
}
