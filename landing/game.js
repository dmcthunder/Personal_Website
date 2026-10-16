/* Sweet Spaceship, landing edition.
 *
 * A single-player cut of github.com/dmcthunder/Sweet-Spaceship (Frontline mode)
 * that lives inside the #222 block on the landing page. Ship hull, enemy
 * interceptors, meteors, explosions and the Night Sector palette are ported
 * from the game; networking, rooms, packs and menus are left out.
 *
 * States: idle → launching → playing → (over) → closing → idle
 */
(function () {
  'use strict';

  // ------------------------------------------------------------ palette
  // Night Sector, from Sweet-Spaceship's SECTORS.night
  const SEC = {
    grid: 'rgba(120, 200, 150, 0.06)', star: 'rgba(200, 230, 210, 0.5)',
    enemy: '#4ADE80', enemyHit: '#86EFAC', bracket: '#2F6B45', tracer: '#4ADE80',
    meteor: '#5A6B60', meteorFill: 'rgba(90, 110, 100, 0.20)',
    hpTrack: 'rgba(255, 255, 255, 0.15)', hpFill: '#4ADE80'
  };
  // slot 0, the colour reserved for the room creator: Diogo's ship
  const SHIP = { main: '#FF76A2', soft: '#FFA8C4', deep: '#E85C8C', fade: '#FFD9E6' };

  // Dart hull, from Sweet-Spaceship's SHIP_HULLS.dart (nose at +x, units of s)
  const HULL = {
    canopy: [0.55, 0.05], gunY: 1.05, gunX: [-0.62, -0.2], engX: -1.02, engY: 0.14,
    pts: [[1.55,0],[0.35,-0.28],[-0.1,-0.3],[-0.55,-1.05],[-0.95,-1.05],[-0.75,-0.32],
          [-1.05,-0.22],[-1.05,0.22],[-0.75,0.32],[-0.95,1.05],[-0.55,1.05],[-0.1,0.3],[0.35,0.28]]
  };
  const METEOR_R = [11, 20, 32];
  const IDLE_SCALE = 1.5;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ audio (ported)
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(type, freq, dur, vol, slide) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  function noiseBurst(dur, vol) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start(t);
  }
  const sfx = {
    laser()     { beep('triangle', 880, 0.09, 0.03, 320); },
    explosion() { noiseBurst(0.35, 0.12); beep('sine', 180, 0.25, 0.06, 60); },
    hit()       { noiseBurst(0.2, 0.08); beep('sine', 120, 0.3, 0.08, 40); },
    down()      { noiseBurst(0.55, 0.16); beep('sine', 200, 0.5, 0.08, 30); },
    rock()      { noiseBurst(0.16, 0.06); beep('sine', 150, 0.14, 0.04, 80); },
    ready()     { beep('sine', 660, 0.12, 0.05); setTimeout(() => beep('sine', 990, 0.25, 0.05), 130); }
  };

  // ------------------------------------------------------------ setup
  const arena = document.getElementById('arena');
  if (!arena) return;
  const canvas = document.getElementById('arena-canvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('arena-start');
  const closeBtn = document.getElementById('arena-close');
  const overEl = document.getElementById('arena-over');
  const overScore = document.getElementById('over-score');
  const againBtn = document.getElementById('over-again');
  const overClose = document.getElementById('over-close');
  const heartsEl = document.getElementById('hud-hearts');
  const scoreEl = document.getElementById('hud-score');

  let W = 0, H = 0, dpr = 1;
  let state = 'idle';
  let stateT = 0;          // seconds in the current state
  let elapsed = 0;         // ms of play, drives difficulty like the original
  let stars = [], enemies = [], meteors = [], bullets = [], enemyBullets = [], particles = [];
  let score = 0, shake = 0;
  let spawnTimer = 900, meteorTimer = 2400;
  const keys = {};
  const stick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  let firePointer = null;
  const player = {
    x: 0, y: 0, vx: 0, vy: 0, r: 13, hearts: 3, invuln: 0, cooldown: 0,
    scale: IDLE_SCALE, trail: [], fromX: 0, fromY: 0, fromS: IDLE_SCALE
  };

  function homeX() { return W / 2; }
  function homeY() { return H / 2 - 6; }
  function battleX() { return Math.max(60, W * 0.16); }

  function resize() {
    const rect = arena.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    if (nw === W && nh === H) return;
    const sx = W ? nw / W : 1, sy = H ? nh / H : 1;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = nw * dpr;
    canvas.height = nh * dpr;
    // keep the world where it was, relative to the box, as it grows or shrinks
    if (W && H) {
      for (const list of [stars, enemies, meteors, bullets, enemyBullets, particles]) {
        for (const o of list) { o.x *= sx; o.y *= sy; if (o.y0 !== undefined) o.y0 *= sy; }
      }
      for (const t of player.trail) { t.x *= sx; t.y *= sy; }
      if (state === 'idle') { player.x = nw / 2; player.y = nh / 2 - 6; }
      else { player.x *= sx; player.y *= sy; }
    }
    W = nw; H = nh;
    if (!stars.length) initStars();
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: 0.4 + Math.random() * 1.4, v: 12 + Math.random() * 30 });
    }
  }

  // ------------------------------------------------------------ hearts / score
  function renderHearts() {
    heartsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('i');
      if (i >= player.hearts) h.className = 'is-lost';
      heartsEl.appendChild(h);
    }
  }
  function renderScore() { scoreEl.textContent = score; }

  // ------------------------------------------------------------ flow
  function setState(s) { state = s; stateT = 0; }

  function open() {
    if (state !== 'idle') return;
    ensureAudio();
    resetRun();
    arena.classList.add('is-open');
    arena.classList.remove('keys-faded');
    canvas.style.touchAction = 'none';
    player.fromX = player.x; player.fromY = player.y; player.fromS = player.scale;
    setState('launching');
    sfx.ready();
    wake();
    // centre the taller arena in the viewport once it has grown
    setTimeout(() => {
      const r = arena.getBoundingClientRect();
      const target = window.scrollY + r.top + r.height / 2 - window.innerHeight / 2;
      window.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? 'auto' : 'smooth' });
    }, 380);
    setTimeout(() => { if (state === 'playing' || state === 'launching') arena.classList.add('keys-faded'); }, 6000);
  }

  function close() {
    if (state === 'idle' || state === 'closing') return;
    for (const k in keys) keys[k] = false;
    stick.active = false; firePointer = null;
    overEl.hidden = true;
    // everything still flying burns out as the ship heads home
    for (const e of enemies) spawnExplosion(e.x, e.y, e.s * 0.6);
    for (const m of meteors) meteorDebris(m.x, m.y, m.r);
    enemies = []; meteors = []; bullets = []; enemyBullets = [];
    arena.classList.remove('is-open', 'keys-faded');
    canvas.style.touchAction = '';
    player.fromX = player.x; player.fromY = player.y; player.fromS = player.scale;
    player.invuln = 0;
    setState('closing');
    wake();
    startBtn.focus({ preventScroll: true });
  }

  function resetRun() {
    enemies = []; meteors = []; bullets = []; enemyBullets = [];
    score = 0; elapsed = 0; shake = 0;
    spawnTimer = 900; meteorTimer = 2400;
    player.hearts = 3; player.invuln = 0; player.cooldown = 0; player.vx = player.vy = 0;
    renderHearts(); renderScore();
  }

  function gameOver() {
    setState('over');
    overScore.textContent = score;
    overEl.hidden = false;
    againBtn.focus({ preventScroll: true });
  }

  function playAgain() {
    overEl.hidden = true;
    resetRun();
    player.fromX = player.x; player.fromY = player.y; player.fromS = 1;
    player.x = battleX(); player.y = H / 2;
    player.invuln = 1.2;
    setState('playing');
    canvas.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ spawning (ported)
  function spawnEnemy() {
    const big = Math.random() < 0.18;
    const s = big ? 30 : 20;
    const y = Math.max(60 + s, Math.min(H - 70 - s, 60 + Math.random() * (H - 130)));
    enemies.push({
      x: W + 40, y, y0: y, s,
      speed: (big ? 55 : 80) + Math.random() * 50 + Math.min(elapsed / 1000, 60),
      hp: big ? 3 : 1, maxHp: big ? 3 : 1, big,
      driftPhase: Math.random() * Math.PI * 2, driftAmp: 20 + Math.random() * 40,
      flash: 0, fireTimer: 2000 + Math.random() * 4000
    });
  }

  function makeMeteor(x, y, tier, vx, vy) {
    const pts = 8 + Math.floor(Math.random() * 4);
    const shape = [];
    for (let i = 0; i < pts; i++) shape.push(0.72 + Math.random() * 0.4);
    return { x, y, tier, r: METEOR_R[tier], vx, vy, age: 0,
      rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 1.6, shape };
  }

  function spawnMeteor() {
    const tier = Math.random() < 0.6 ? 2 : 1;
    const speed = 60 + Math.random() * 70;
    meteors.push(makeMeteor(W + 50, 60 + Math.random() * (H - 130), tier, -speed, (Math.random() - 0.5) * 30));
  }

  function enemyFire(e) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    enemyBullets.push({ x: e.x, y: e.y, vx: dx / d * 240, vy: dy / d * 240 });
  }

  // ------------------------------------------------------------ particles (ported)
  function spawnExplosion(x, y, s) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
      particles.push({ kind: 'seg', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 8,
        len: 4 + Math.random() * (s * 0.6), life: 1, decay: 1.4 + Math.random() * 0.8, color: SEC.enemy });
    }
    particles.push({ kind: 'ring', x, y, r: 4, vr: s * 9, life: 1, decay: 3.2, color: SHIP.main });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
      particles.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 1 + Math.random() * 2, life: 1, decay: 2 + Math.random(),
        color: Math.random() < 0.5 ? SHIP.main : SHIP.soft });
    }
  }

  function meteorDebris(x, y, r) {
    for (let i = 0; i < Math.max(4, Math.floor(r / 2)); i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
      particles.push({ kind: 'seg', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 8,
        len: 3 + Math.random() * (r * 0.4), life: 1, decay: 1.6 + Math.random(), color: SEC.meteor });
    }
  }

  function splitMeteor(m) {
    score += m.tier === 0 ? 30 : 15;
    meteorDebris(m.x, m.y, m.r);
    sfx.rock();
    const i = meteors.indexOf(m);
    if (i >= 0) meteors.splice(i, 1);
    if (m.tier > 0) {
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 70;
        meteors.push(makeMeteor(m.x, m.y, m.tier - 1, m.vx * 0.5 + Math.cos(a) * sp, m.vy * 0.5 + Math.sin(a) * sp));
      }
    }
  }

  function loseHeart() {
    player.hearts--;
    player.invuln = 1.6;
    shake = 0.4;
    renderHearts();
    if (player.hearts <= 0) {
      spawnExplosion(player.x, player.y, 24);
      sfx.down();
      gameOver();
    } else {
      score = Math.max(0, score - 50);
      spawnExplosion(player.x, player.y, 10);
      sfx.hit();
    }
    renderScore();
  }

  // ------------------------------------------------------------ update
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function update(dt) {
    stateT += dt;

    // stars drift faster once we're flying
    const warp = state === 'idle' ? 0.6 : state === 'closing' ? 1 : 2.2;
    if (!reduceMotion || state !== 'idle') {
      for (const st of stars) {
        st.x -= st.v * warp * dt;
        if (st.x < -4) { st.x = W + 4; st.y = Math.random() * H; }
      }
    }

    if (state === 'idle') {
      player.scale = IDLE_SCALE;
      player.x = homeX();
      player.y = homeY() + (reduceMotion ? 0 : Math.sin(stateT * 1.6) * 5);
      player.vy = reduceMotion ? 0 : Math.cos(stateT * 1.6) * 8;
    } else if (state === 'launching') {
      // ship banks and glides to the left of the arena, then the fight starts
      const t = Math.min(1, stateT / 1.1);
      const k = easeInOut(t);
      const tx = battleX(), ty = H / 2;
      const px = player.x, py = player.y;
      player.x = player.fromX + (tx - player.fromX) * k;
      player.y = player.fromY + (ty - player.fromY) * k;
      player.scale = player.fromS + (1 - player.fromS) * k;
      player.vy = (player.y - py) / Math.max(dt, 0.001);
      if (t >= 1) { setState('playing'); player.vx = player.vy = 0; }
      void px;
    } else if (state === 'closing') {
      const t = Math.min(1, stateT / 0.9);
      const k = easeInOut(t);
      const py = player.y;
      player.x = player.fromX + (homeX() - player.fromX) * k;
      player.y = player.fromY + (homeY() - player.fromY) * k;
      player.scale = player.fromS + (IDLE_SCALE - player.fromS) * k;
      player.vy = (player.y - py) / Math.max(dt, 0.001);
      if (t >= 1) setState('idle');
    } else if (state === 'playing') {
      updatePlaying(dt);
    }

    // trail
    if (state !== 'over') {
      player.trail.unshift({ x: player.x - 22 * player.scale, y: player.y, life: 1 });
      if (player.trail.length > 14) player.trail.pop();
    }
    for (const t of player.trail) t.life -= dt * 3.4;

    // entities keep moving in every state so explosions and leftovers settle
    for (const e of enemies) {
      e.x -= e.speed * dt;
      e.driftPhase += dt * 1.4;
      e.y += Math.sin(e.driftPhase) * e.driftAmp * dt;
      if (e.flash > 0) e.flash -= dt;
    }
    enemies = enemies.filter(e => e.x > -80);
    for (const m of meteors) { m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.rot += m.vrot * dt; }
    meteors = meteors.filter(m => !(m.age > 3 && (m.x < -80 || m.x > W + 80 || m.y < -120 || m.y > H + 120)));
    bullets = bullets.filter(b => { b.x += b.vx * dt; return b.x < W + 40; });
    enemyBullets = enemyBullets.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt;
      return b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20;
    });
    for (const p of particles) {
      p.life -= p.decay * dt;
      if (p.kind === 'ring') { p.r += p.vr * dt; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.2, dt); p.vy *= Math.pow(0.2, dt);
      if (p.kind === 'seg') p.rot += p.vrot * dt;
    }
    particles = particles.filter(p => p.life > 0);
    if (shake > 0) shake -= dt;
  }

  function updatePlaying(dt) {
    elapsed += dt * 1000;

    // --- movement (Frontline handling from the original)
    const MAXV = 460, ACC = 2600;
    let ax = 0, ay = 0;
    if (keys.ArrowLeft || keys.a) ax -= 1;
    if (keys.ArrowRight || keys.d) ax += 1;
    if (keys.ArrowUp || keys.w) ay -= 1;
    if (keys.ArrowDown || keys.s) ay += 1;
    if (ax && ay) { ax *= 0.7071; ay *= 0.7071; }
    if (stick.active) {
      const mag = Math.min(1, Math.hypot(stick.dx, stick.dy) / 56);
      if (mag > 0.12) {
        const d = Math.hypot(stick.dx, stick.dy) || 1;
        ax = stick.dx / d * mag; ay = stick.dy / d * mag;
      }
    }
    player.vx += ax * ACC * dt;
    player.vy += ay * ACC * dt;
    const damp = Math.pow(0.0025, dt);
    player.vx *= damp; player.vy *= damp;
    const v = Math.hypot(player.vx, player.vy);
    if (v > MAXV) { player.vx = player.vx / v * MAXV; player.vy = player.vy / v * MAXV; }
    player.x = Math.max(30, Math.min(W - 30, player.x + player.vx * dt));
    player.y = Math.max(56, Math.min(H - 64, player.y + player.vy * dt));
    if (player.invuln > 0) player.invuln -= dt;

    // --- fire
    player.cooldown -= dt;
    if ((keys[' '] || firePointer !== null) && player.cooldown <= 0) {
      player.cooldown = 0.16;
      for (const side of [-1, 1]) bullets.push({ x: player.x + 16, y: player.y + 11 * side, vx: 780 });
      sfx.laser();
    }

    // --- spawns
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(700, 1700 - elapsed / 60) * (0.7 + Math.random() * 0.6);
    }
    meteorTimer -= dt * 1000;
    if (meteorTimer <= 0) {
      spawnMeteor();
      meteorTimer = 2600 + Math.random() * 3000;
    }
    for (const e of enemies) {
      e.fireTimer -= dt * 1000;
      if (e.fireTimer <= 0 && e.x > 100 && e.x < W - 60) {
        e.fireTimer = 2600 + Math.random() * 3800;
        enemyFire(e);
      }
    }

    // --- lasers vs enemies
    for (const b of bullets) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (Math.abs(b.x - e.x) < e.s * 1.5 && Math.abs(b.y - e.y) < e.s * 1.2) {
          e.hp--; b.dead = true; e.flash = 0.1;
          if (e.hp <= 0) {
            score += e.big ? 250 : 100;
            spawnExplosion(e.x, e.y, e.s);
            sfx.explosion();
          }
          break;
        }
      }
    }
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => e.hp > 0);

    // --- lasers vs meteors
    for (const b of bullets) {
      for (const m of meteors) {
        if (Math.hypot(b.x - m.x, b.y - m.y) < m.r + 4) { b.dead = true; splitMeteor(m); break; }
      }
    }
    bullets = bullets.filter(b => !b.dead);

    // --- ship vs everything
    if (player.invuln <= 0) {
      let hurt = false;
      for (const e of enemies) {
        if (Math.hypot(e.x - player.x, e.y - player.y) < e.s + player.r) {
          hurt = true; spawnExplosion(e.x, e.y, e.s); e.hp = 0; break;
        }
      }
      if (!hurt) for (const b of enemyBullets) {
        if (Math.hypot(b.x - player.x, b.y - player.y) < player.r) { hurt = true; b.dead = true; break; }
      }
      if (!hurt) for (const m of meteors) {
        if (Math.hypot(m.x - player.x, m.y - player.y) < m.r + player.r) {
          hurt = true; meteorDebris(m.x, m.y, m.r); sfx.rock();
          meteors.splice(meteors.indexOf(m), 1); break;
        }
      }
      enemies = enemies.filter(e => e.hp > 0);
      enemyBullets = enemyBullets.filter(b => !b.dead);
      if (hurt) loseHeart();
    }
    renderScore();
  }

  // ------------------------------------------------------------ drawing (ported)
  function drawShip(x, y, bank, s) {
    const u = 15 * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bank);
    ctx.strokeStyle = SHIP.main;
    ctx.fillStyle = SHIP.main + '14';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    HULL.pts.forEach(([px, py], i) => i ? ctx.lineTo(px * u, py * u) : ctx.moveTo(px * u, py * u));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = SHIP.deep;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(HULL.canopy[0] * u, 0); ctx.lineTo(HULL.canopy[1] * u, 0); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(HULL.gunX[0] * u, side * HULL.gunY * u);
      ctx.lineTo(HULL.gunX[1] * u, side * HULL.gunY * u);
      ctx.stroke();
    }
    ctx.fillStyle = SHIP.soft;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.arc(HULL.engX * u, side * HULL.engY * u, 2.4 * Math.sqrt(s), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const { x, y, s } = e;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = e.flash > 0 ? SEC.enemyHit : SEC.enemy;
    ctx.lineWidth = e.big ? 1.6 : 1.3;
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const cx = side * s * 1.05;
      ctx.beginPath();
      ctx.moveTo(cx, -s * 1.05);
      ctx.lineTo(cx + side * s * 0.38, -s * 0.5);
      ctx.lineTo(cx + side * s * 0.38, s * 0.5);
      ctx.lineTo(cx, s * 1.05);
      ctx.lineTo(cx - side * s * 0.38, s * 0.5);
      ctx.lineTo(cx - side * s * 0.38, -s * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, -s * 1.05); ctx.lineTo(cx, s * 1.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - side * s * 0.38, 0); ctx.lineTo(side * s * 0.46, 0); ctx.stroke();
    }
    const r = s * 0.46;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
    if (e.maxHp > 1) {
      const w = e.s * 2.2, bx = e.x - w / 2, by = e.y - e.s * 1.6 - 8;
      ctx.fillStyle = SEC.hpTrack; ctx.fillRect(bx, by, w, 3);
      ctx.fillStyle = SEC.hpFill; ctx.fillRect(bx, by, w * (e.hp / e.maxHp), 3);
    }
  }

  function drawBrackets(e) {
    const pad = e.s * 1.7, arm = e.s * 0.55;
    ctx.strokeStyle = SEC.bracket;
    ctx.lineWidth = 1.2;
    for (const [sx, sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      ctx.beginPath();
      ctx.moveTo(e.x + sx * pad, e.y + sy * (pad - arm));
      ctx.lineTo(e.x + sx * pad, e.y + sy * pad);
      ctx.lineTo(e.x + sx * (pad - arm), e.y + sy * pad);
      ctx.stroke();
    }
  }

  function drawMeteor(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    ctx.beginPath();
    const n = m.shape.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = m.r * m.shape[i];
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = SEC.meteorFill; ctx.fill();
    ctx.strokeStyle = SEC.meteor; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }

  let gridAlpha = 0;
  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);

    // Night Sector grid fades in while the arena is open
    const wantGrid = state === 'idle' || state === 'closing' ? 0 : 1;
    gridAlpha += (wantGrid - gridAlpha) * Math.min(1, dt * 3);
    if (gridAlpha > 0.01) {
      ctx.globalAlpha = gridAlpha;
      ctx.strokeStyle = SEC.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = (W / 2) % 40; gx < W; gx += 40) { ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); }
      for (let gy = (H / 2) % 40; gy < H; gy += 40) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = SEC.star;
    for (const st of stars) ctx.fillRect(st.x, st.y, st.s, st.s);

    if (state === 'playing' && enemies.length) {
      let nearest = enemies[0], best = Infinity;
      for (const e of enemies) {
        const d2 = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
        if (d2 < best) { best = d2; nearest = e; }
      }
      drawBrackets(nearest);
    }

    for (const m of meteors) drawMeteor(m);
    for (const e of enemies) drawEnemy(e);

    ctx.strokeStyle = SEC.tracer;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const b of enemyBullets) {
      const d = Math.hypot(b.vx, b.vy) || 1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / d * 12, b.y - b.vy / d * 12); ctx.stroke();
    }

    for (const b of bullets) {
      ctx.strokeStyle = SHIP.fade; ctx.globalAlpha = 0.35; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(b.x - 16, b.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = SHIP.main; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(b.x - 16, b.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'seg') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.moveTo(-p.len / 2, 0); ctx.lineTo(p.len / 2, 0); ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ship + trail (hidden once it's gone down)
    if (state !== 'over') {
      for (let i = 0; i < player.trail.length; i++) {
        const t = player.trail[i];
        if (t.life <= 0) continue;
        ctx.globalAlpha = t.life * 0.35;
        ctx.fillStyle = i % 2 ? SHIP.soft : SHIP.fade;
        ctx.beginPath();
        ctx.arc(t.x - i * 2.4 * player.scale, t.y, Math.max(0.5, (4.2 - i * 0.3) * player.scale), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const blink = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
      if (!blink) drawShip(player.x, player.y, Math.max(-0.35, Math.min(0.35, player.vy * 0.00035 * (state === 'playing' ? 1 : 3))), player.scale);
    }

    ctx.restore();

    if (stick.active) {
      ctx.save();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#B9B9C2'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 42, 0, Math.PI * 2); ctx.stroke();
      const d = Math.hypot(stick.dx, stick.dy), cl = d > 42 ? 42 / d : 1;
      ctx.globalAlpha = 0.85; ctx.fillStyle = SHIP.main;
      ctx.beginPath(); ctx.arc(stick.ox + stick.dx * cl, stick.oy + stick.dy * cl, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ loop
  // Runs only while the arena is on screen (or the game is open) to keep idle cost low.
  let raf = 0, last = 0, onScreen = true;
  function frame(ts) {
    raf = 0;
    resize();
    const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
    last = ts;
    update(dt);
    draw(dt);
    if (onScreen || state !== 'idle') raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function wake() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      onScreen = entries[0].isIntersecting;
      if (onScreen) wake();
    }).observe(arena);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('resize', wake);

  // ------------------------------------------------------------ input
  const GAME_KEYS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, ' ': 1, w: 1, a: 1, s: 1, d: 1 };
  function keyName(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }

  window.addEventListener('keydown', e => {
    if (state === 'idle') return;
    const k = keyName(e);
    if (k === 'Escape') { e.preventDefault(); close(); return; }
    if (state === 'over' && (k === 'Enter' || k === ' ') && document.activeElement !== overClose) {
      e.preventDefault(); playAgain(); return;
    }
    if (GAME_KEYS[k] && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      keys[k] = true;
    }
  });
  window.addEventListener('keyup', e => { keys[keyName(e)] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  startBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overClose.addEventListener('click', close);
  againBtn.addEventListener('click', playAgain);

  // touch / pen: drag on the left half to fly, hold on the right half to fire
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'playing' || e.pointerType === 'mouse') return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    canvas.setPointerCapture(e.pointerId);
    if (x < W / 2 && !stick.active) {
      Object.assign(stick, { active: true, id: e.pointerId, ox: x, oy: y, dx: 0, dy: 0 });
    } else {
      firePointer = e.pointerId;
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!stick.active || e.pointerId !== stick.id) return;
    const r = canvas.getBoundingClientRect();
    stick.dx = e.clientX - r.left - stick.ox;
    stick.dy = e.clientY - r.top - stick.oy;
  });
  function release(e) {
    if (stick.active && e.pointerId === stick.id) stick.active = false;
    if (e.pointerId === firePointer) firePointer = null;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // mouse: click to fire while playing
  canvas.addEventListener('mousedown', e => { if (state === 'playing' && e.button === 0) firePointer = 'mouse'; });
  window.addEventListener('mouseup', () => { if (firePointer === 'mouse') firePointer = null; });

  canvas.tabIndex = -1;
  renderHearts();
  resize();
  player.x = homeX(); player.y = homeY();
  wake();

  window.SweetSpaceship = { open, close, get state() { return state; } };
})();
