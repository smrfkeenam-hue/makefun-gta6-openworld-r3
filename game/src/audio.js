// Sound effects, all generated with WebAudio oscillators — no audio files.
// Everything is lazy: the context only starts after the player's first
// keypress or click, and every call is safe when audio is off.
let ctx = null;
let master = null;
let engineNodes = null;
let sirenNodes = null;
let muted = false;

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.16;
}
export function isMuted() { return muted; }

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.16;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || !master) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* audio is best-effort */ }
}

export function sfxShot() { blip(900, 0.12, 'square', 0.5, 120); }
export function sfxPunch() { blip(160, 0.1, 'sine', 0.6, 60); }
export function sfxCrash() { blip(90, 0.25, 'sawtooth', 0.7, 40); }
export function sfxPickup() { blip(660, 0.09, 'sine', 0.5); setTimeout(() => blip(990, 0.12, 'sine', 0.5), 80); }
export function sfxCash() {
  blip(880, 0.1, 'sine', 0.5);
  setTimeout(() => blip(1174, 0.1, 'sine', 0.5), 90);
  setTimeout(() => blip(1568, 0.16, 'sine', 0.5), 180);
}
export function sfxMission() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.5), i * 110));
}
export function sfxBusted() { blip(440, 0.3, 'sawtooth', 0.5, 220); }
export function sfxEnterCar() { blip(300, 0.12, 'sine', 0.4, 500); }

// Continuous engine hum: one sawtooth through a lowpass, pitch follows speed.
export function engineStart() {
  if (!ctx || engineNodes) return;
  try {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 60;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(f).connect(g).connect(master);
    o.start();
    engineNodes = { o, g };
  } catch { engineNodes = null; }
}
export function engineUpdate(speedFrac, driving) {
  if (!engineNodes) return;
  try {
    const t = ctx.currentTime;
    engineNodes.o.frequency.setTargetAtTime(55 + speedFrac * 140, t, 0.08);
    engineNodes.g.gain.setTargetAtTime(driving ? 0.10 + speedFrac * 0.10 : 0, t, 0.1);
  } catch { /* ignore */ }
}
export function engineStop() {
  if (!engineNodes) return;
  try { engineNodes.o.stop(); } catch { /* ignore */ }
  engineNodes = null;
}

// Two-tone police siren while any cop is near.
export function sirenStart() {
  if (!ctx || sirenNodes) return;
  try {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.045;
    o.connect(g).connect(master);
    o.start();
    let high = true;
    const id = setInterval(() => {
      if (!sirenNodes) { clearInterval(id); return; }
      high = !high;
      try { o.frequency.setValueAtTime(high ? 700 : 950, ctx.currentTime); } catch { /* ignore */ }
    }, 450);
    sirenNodes = { o, id };
  } catch { sirenNodes = null; }
}
export function sirenStop() {
  if (!sirenNodes) return;
  try { clearInterval(sirenNodes.id); sirenNodes.o.stop(); } catch { /* ignore */ }
  sirenNodes = null;
}
