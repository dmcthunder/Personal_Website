/* Synth: the keyboard along the bottom of the page (Figma "MiDi").
 * A half-size, dimmed easter egg that stays put along the bottom edge. Keys sit
 * back at low opacity; hovering one lifts it, pressing plays a note.
 * Press and slide across the keys for a glissando. Middle C sits in the middle.
 */
(function () {
  'use strict';

  const wrap = document.getElementById('synth-keys');
  if (!wrap) return;

  // Figma key metrics at half size (white 48.6 × 241, pitch 50.63, black 32.4 × 160)
  const WHITE_W = 24.3, PITCH = 25.32, BLACK_W = 16.2, BLACK_X = 16.2;
  const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const HAS_BLACK = [true, true, false, true, true, true, false]; // C D (E) F G A (B)

  // ------------------------------------------------------------ sound
  let ac = null, out = null;
  function audio() {
    if (ac) { if (ac.state !== 'running') ac.resume(); return ac; }
    // ask for the shortest output buffer the device allows
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ac = new AC({ latencyHint: 0 }); } catch (e) {
      try { ac = new AC(); } catch (e2) { return null; }
    }
    out = ac.createGain();
    out.gain.value = 0.22;
    // a short, soft echo so single notes feel like an instrument rather than a beep
    const delay = ac.createDelay(1);
    const fb = ac.createGain();
    const wet = ac.createGain();
    delay.delayTime.value = 0.24; fb.gain.value = 0.28; wet.gain.value = 0.22;
    out.connect(ac.destination);
    out.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
    return ac;
  }

  const voices = new Map(); // key element → voice
  function noteOn(key) {
    const ctx = audio();
    if (!ctx || voices.has(key)) return;
    const f = 261.63 * Math.pow(2, (+key.dataset.semi) / 12);
    key.classList.add('is-down');
    const t = ctx.currentTime;
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 4;
    filt.frequency.setValueAtTime(Math.min(9000, f * 14), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(500, f * 3), t + 0.35);
    const oscs = [['sawtooth', -6, 0.5], ['sawtooth', 6, 0.5], ['triangle', 0, 0.6]].map(([type, cents, g]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = cents; og.gain.value = g;
      o.connect(og); og.connect(filt);
      o.start();
      return o;
    });
    filt.connect(amp); amp.connect(out);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.22, t + 0.3);
    voices.set(key, { amp, oscs });
  }
  function noteOff(key) {
    const v = voices.get(key);
    key.classList.remove('is-down');
    if (!v) return;
    voices.delete(key);
    const t = ac.currentTime;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(Math.max(0.0001, v.amp.gain.value), t);
    v.amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    v.oscs.forEach(o => o.stop(t + 0.65));
  }

  // ------------------------------------------------------------ keys
  let builtFor = 0;
  function build() {
    const w = wrap.clientWidth;
    if (!w || w === builtFor) return;
    builtFor = w;
    wrap.textContent = '';
    // C4's white key is centred on the page; fill outwards until both edges are covered
    const c4x = w / 2 - WHITE_W / 2;
    const from = Math.floor(-c4x / PITCH) - 1;
    const to = Math.ceil((w - c4x) / PITCH) + 1;
    const frag = document.createDocumentFragment();
    for (let n = from; n <= to; n++) {
      const deg = ((n % 7) + 7) % 7;
      const oct = Math.floor(n / 7);
      const x = c4x + n * PITCH;
      frag.appendChild(makeKey('white', x, oct * 12 + WHITE_STEPS[deg]));
      if (HAS_BLACK[deg]) frag.appendChild(makeKey('black', x + BLACK_X, oct * 12 + WHITE_STEPS[deg] + 1));
    }
    wrap.appendChild(frag);
  }

  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  function makeKey(kind, x, semi) {
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'key key--' + kind;
    k.style.left = x + 'px';
    k.dataset.semi = semi;
    k.tabIndex = -1;
    k.setAttribute('aria-label', NAMES[((semi % 12) + 12) % 12] + (4 + Math.floor(semi / 12)));
    return k;
  }

  // ------------------------------------------------------------ input
  let pressing = null; // pointerId while a finger or button is down on the board
  const held = new Map(); // pointerId → key

  function keyAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.classList && el.classList.contains('key') && wrap.contains(el) ? el : null;
  }

  let hovered = null;
  function setHover(k) {
    if (k === hovered) return;
    if (hovered) hovered.classList.remove('is-hover');
    hovered = k;
    if (k) k.classList.add('is-hover');
  }

  wrap.addEventListener('pointerdown', e => {
    const k = keyAt(e);
    if (!k) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId); // keep the glissando going even off the board
    pressing = e.pointerId;
    held.set(e.pointerId, k);
    if (e.pointerType === 'mouse') setHover(k);
    noteOn(k);
  });

  wrap.addEventListener('pointermove', e => {
    const k = keyAt(e);
    if (e.pointerType === 'mouse') setHover(k);
    if (!held.has(e.pointerId)) return;
    const prev = held.get(e.pointerId);
    if (k === prev) return;
    if (prev) noteOff(prev);
    held.set(e.pointerId, k);
    if (k) noteOn(k);
  });

  function release(e) {
    const k = held.get(e.pointerId);
    if (k) noteOff(k);
    held.delete(e.pointerId);
    if (pressing === e.pointerId) pressing = null;
    if (e.pointerType !== 'mouse' || e.type === 'pointercancel') setHover(null);
    else setHover(keyAt(e));
  }
  wrap.addEventListener('pointerup', release);
  wrap.addEventListener('pointercancel', release);
  wrap.addEventListener('pointerleave', e => { if (!held.has(e.pointerId)) setHover(null); });
  window.addEventListener('blur', () => { voices.forEach((v, k) => noteOff(k)); held.clear(); });

  // Browsers only start audio after a gesture, and the first start takes a
  // moment. Warm the engine up on the first tap or key anywhere on the page so
  // the keyboard is already live by the time someone reaches it.
  function warm() {
    if (audio()) ['pointerdown', 'keydown'].forEach(t => document.removeEventListener(t, warm, true));
  }
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, warm, true));

  build();
  new ResizeObserver(build).observe(wrap);
})();
