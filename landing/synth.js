/* Synth: the keyboard along the bottom of the page (Figma "MiDi").
 * It hides below the window's edge as an easter egg and rises when the pointer
 * finds it. Keys sit back at low opacity; hovering one lifts it, pressing plays a note.
 * Press and slide across the keys for a glissando. Middle C sits in the middle.
 */
(function () {
  'use strict';

  const wrap = document.getElementById('synth-keys');
  if (!wrap) return;

  const WHITE_W = 48.6, PITCH = 50.63, BLACK_W = 32.4, BLACK_X = 32.4; // Figma key metrics
  const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const HAS_BLACK = [true, true, false, true, true, true, false]; // C D (E) F G A (B)

  // ------------------------------------------------------------ sound
  let ac = null, out = null;
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
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
      o.start(t);
      return o;
    });
    filt.connect(amp); amp.connect(out);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.22, t + 0.3);
    voices.set(key, { amp, oscs });
    key.classList.add('is-down');
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

  // rise on hover; sink back a moment after the pointer leaves (unless a key is held)
  const board = document.getElementById('synth');
  let sinkTimer = 0;
  const isUp = () => board.classList.contains('is-up');
  function rise() { clearTimeout(sinkTimer); board.classList.add('is-up'); }
  function sink(delay) {
    clearTimeout(sinkTimer);
    sinkTimer = setTimeout(() => { if (!held.size) board.classList.remove('is-up'); }, delay);
  }
  board.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') rise(); });
  board.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') sink(700); });
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' && isUp() && !board.contains(e.target)) sink(0);
  });

  wrap.addEventListener('pointerdown', e => {
    // on touch, the first tap only brings the keyboard up
    if (!isUp()) { e.preventDefault(); rise(); return; }
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

  build();
  new ResizeObserver(build).observe(wrap);
})();
