/* Landing v2 interactions:
 *  1. dot cursor: an 8px white dot replaces the system cursor; it fades over
 *     the Testimonials / Portfolio / Resume pills and becomes the 32px glass
 *     "expand" cursor over the badges
 *  2. crown drag: drop the header crown on Diogo's photo for party poppers
 *  3. badge windows: About, the four industries, and the Jammin' DAW
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ------------------------------------------------------------ 1. dot cursor
  const cursor = document.getElementById('cursor');
  let x = -100, y = -100, cx = -100, cy = -100, raf = 0;
  let mode = '';       // '' dot | 'expand' | 'gone'
  let suppressed = false; // the crown is being dragged, so the crown is the cursor

  function loop() {
    // the dot sticks close to the pointer; the bigger expand cursor trails a touch more
    const k = mode === 'expand' ? 0.35 : 0.6;
    cx += (x - cx) * k;
    cy += (y - cy) * k;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(var(--press))`;
    if (Math.abs(x - cx) > 0.1 || Math.abs(y - cy) > 0.1) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  function modeFor(el) {
    if (!el || !el.closest) return '';
    if (el.closest('.ctas .cta:not(.cta--primary)')) return 'gone';
    if (el.closest('.badge')) return 'expand';
    return '';
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    cursor.classList.toggle('is-expand', m === 'expand');
    cursor.classList.toggle('is-gone', m === 'gone' || suppressed);
  }
  // content can change under a still pointer (a window opens or closes), so re-read what's there
  function refreshCursor() {
    if (!cursor || !document.documentElement.classList.contains('dot-cursor')) return;
    setMode(modeFor(document.elementFromPoint(x, y)));
  }
  function suppressCursor(on) {
    suppressed = on;
    cursor.classList.toggle('is-gone', on || mode === 'gone');
  }

  if (cursor) {
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !fine.matches) return;
      if (!document.documentElement.classList.contains('dot-cursor')) {
        document.documentElement.classList.add('dot-cursor');
        cx = e.clientX; cy = e.clientY;
      }
      x = e.clientX; y = e.clientY;
      cursor.classList.add('is-visible');
      setMode(modeFor(e.target));
      kick();
    }, { passive: true });

    document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') cursor.classList.add('is-down'); });
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    // leaving the window, or moving into the Jammin' iframe (which draws its own cursor)
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) cursor.classList.remove('is-visible'); });
    window.addEventListener('blur', () => cursor.classList.remove('is-visible', 'is-down'));
  }

  // ------------------------------------------------------------ 2. crown → photo = party poppers
  const logo = document.querySelector('.logo');
  const crown = logo && logo.querySelector('img');
  const nameBadge = document.querySelector('.badge--first');
  const avatar = nameBadge && nameBadge.querySelector('.badge__avatar');
  const confettiCanvas = document.getElementById('confetti');

  if (logo && crown && avatar) {
    let drag = null, swallowClick = false;

    const overAvatar = (px, py) => {
      const r = nameBadge.getBoundingClientRect();
      const pad = 14;
      return px > r.left - pad && px < r.left + r.height + 24 + pad && py > r.top - pad && py < r.bottom + pad;
    };

    function place(g, px, py, rot, s) {
      g.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${rot}deg) scale(${s})`;
    }

    logo.addEventListener('dragstart', e => e.preventDefault());

    logo.addEventListener('pointerdown', e => {
      if (e.button !== 0 || drag) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, vx: 0, ghost: null, rot: 0, raf: 0 };
      logo.setPointerCapture(e.pointerId);
    });

    logo.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
        const g = crown.cloneNode();
        g.className = 'crown-ghost';
        g.removeAttribute('width'); g.removeAttribute('height');
        document.body.appendChild(g);
        drag.ghost = g;
        logo.classList.add('is-lifted');
        suppressCursor(true);
        const tick = () => {
          // the crown swings with the pointer's speed, like it's hanging off it
          drag.rot += (Math.max(-28, Math.min(28, drag.vx * 1.4)) - drag.rot) * 0.18;
          drag.vx *= 0.82;
          place(drag.ghost, drag.x, drag.y, drag.rot, 1);
          drag.raf = requestAnimationFrame(tick);
        };
        drag.raf = requestAnimationFrame(tick);
      }
      drag.vx += (e.clientX - drag.x) * 0.5;
      drag.x = e.clientX; drag.y = e.clientY;
      nameBadge.classList.toggle('is-target', overAvatar(drag.x, drag.y));
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.ghost) return; // a plain click on the logo
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 0);
      cancelAnimationFrame(d.raf);
      suppressCursor(false);
      const hit = e.type === 'pointerup' && overAvatar(d.x, d.y);
      nameBadge.classList.remove('is-target');
      if (hit) crownLanded(d); else flyHome(d.ghost, d.x, d.y, d.rot);
    }
    logo.addEventListener('pointerup', endDrag);
    logo.addEventListener('pointercancel', endDrag);
    logo.addEventListener('click', e => { if (swallowClick) { e.preventDefault(); swallowClick = false; } }, true);

    function flyHome(g, fx, fy, rot) {
      const r = crown.getBoundingClientRect();
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const a = g.animate([
        { transform: `translate3d(${fx}px, ${fy}px, 0) rotate(${rot}deg) scale(1)` },
        { transform: `translate3d(${tx}px, ${ty}px, 0) rotate(0deg) scale(${r.width / 46})` }
      ], { duration: reduceMotion ? 1 : 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
      a.onfinish = () => { g.remove(); logo.classList.remove('is-lifted'); };
    }

    function crownLanded(d) {
      const g = d.ghost;
      const r = avatar.getBoundingClientRect();
      const ax = r.left + r.width / 2, ay = r.top + r.height / 2;
      // the crown settles on Diogo's head, a little jaunty
      const sit = `translate3d(${ax}px, ${r.top - 6}px, 0) rotate(-14deg) scale(0.52)`;
      const a = g.animate([
        { transform: `translate3d(${d.x}px, ${d.y}px, 0) rotate(${d.rot}deg) scale(1)` },
        { transform: sit }
      ], { duration: reduceMotion ? 1 : 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' });
      a.onfinish = () => {
        partyPoppers(ax, ay);
        avatar.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
          { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        setTimeout(() => {
          g.style.transform = sit;
          a.cancel();
          flyHome(g, ax, r.top - 6, -14);
        }, 1800);
      };
    }
  }

  // party poppers: two cones of confetti fired up and out from (ox, oy)
  let bits = [], confRaf = 0, confLast = 0;
  const COLORS = ['#3ED29C', '#F4F983', '#FF4546', '#007AFF', '#FF76A2', '#FFFFFF'];

  function partyPoppers(ox, oy) {
    if (!confettiCanvas) return;
    const n = reduceMotion ? 40 : 90;
    for (const dir of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const ang = (-90 + dir * (28 + Math.random() * 42)) * Math.PI / 180;
        const sp = 520 + Math.random() * 760;
        const kind = Math.random();
        bits.push({
          x: ox + dir * 8, y: oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          w: 5 + Math.random() * 6, h: kind < 0.75 ? 3 + Math.random() * 3 : 10 + Math.random() * 8,
          round: kind > 0.9, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 18,
          flip: Math.random() * Math.PI * 2, vf: 6 + Math.random() * 10,
          color: COLORS[(Math.random() * COLORS.length) | 0], life: 2.4 + Math.random() * 1.2, age: 0
        });
      }
    }
    if (!confRaf) { confLast = 0; confRaf = requestAnimationFrame(confettiFrame); }
  }

  function confettiFrame(ts) {
    const c = confettiCanvas, ctx = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const dt = confLast ? Math.min((ts - confLast) / 1000, 0.05) : 0.016;
    confLast = ts;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const drag = Math.pow(0.12, dt); // air resistance, per second
    for (const b of bits) {
      b.age += dt;
      b.vx *= drag; b.vy = b.vy * drag + 1500 * dt;
      b.vx += Math.sin(b.flip) * 30 * dt; // flutter
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += b.vr * dt; b.flip += b.vf * dt;
      const fade = Math.min(1, (b.life - b.age) / 0.6);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade;
      ctx.fillStyle = b.color;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(1, Math.cos(b.flip));
      if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    bits = bits.filter(b => b.age < b.life && b.y < h + 40);
    if (bits.length) confRaf = requestAnimationFrame(confettiFrame);
    else { confRaf = 0; ctx.clearRect(0, 0, w, h); }
  }

  // ------------------------------------------------------------ 3. badge windows
  let openModal = null, opener = null;

  function focusables(m) {
    return [...m.querySelectorAll('a[href], button, iframe, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.closest('[hidden]') && el.getClientRects().length);
  }

  function showModal(key, from) {
    const m = document.getElementById('modal-' + key);
    if (!m || openModal === m) return;
    if (openModal) hideModal(true);
    openModal = m; opener = from || null;
    m.hidden = false;
    document.documentElement.classList.add('modal-open');
    const frame = m.querySelector('iframe[data-src]');
    if (frame) {
      const fb = m.querySelector('.embed-fallback');
      if (fb) fb.hidden = !embedBlocked;
      frame.src = frame.dataset.src;
    }

    // the window grows out of the badge that opened it
    const panel = m.querySelector('.modal__panel');
    const scrim = m.querySelector('.modal__scrim');
    panel.scrollTop = 0;
    const to = panel.getBoundingClientRect();
    let fromT = 'translate(0, 16px) scale(0.96)';
    if (from) {
      const b = from.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (to.left + to.width / 2);
      const dy = b.top + b.height / 2 - (to.top + to.height / 2);
      fromT = `translate(${dx}px, ${dy}px) scale(${Math.max(0.08, b.width / to.width)}, ${Math.max(0.04, b.height / to.height)})`;
    }
    const dur = reduceMotion ? 1 : 460;
    panel.animate([{ transform: fromT, opacity: 0, borderRadius: '100px' }, { transform: 'none', opacity: 1 }],
      { duration: dur, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.7, easing: 'ease-out' });
    panel.focus({ preventScroll: true });
    refreshCursor();
    if (location.hash !== '#' + key) history.replaceState(null, '', '#' + key);
  }

  function hideModal(instant) {
    const m = openModal;
    if (!m) return;
    openModal = null;
    const panel = m.querySelector('.modal__panel');
    const scrim = m.querySelector('.modal__scrim');
    const back = opener; opener = null;
    const done = () => {
      m.hidden = true;
      const frame = m.querySelector('iframe[data-src]');
      if (frame) frame.removeAttribute('src');
      if (!openModal) document.documentElement.classList.remove('modal-open');
      refreshCursor();
    };
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (back) back.focus({ preventScroll: true });
    if (instant || reduceMotion) { done(); return; }
    let toT = 'translate(0, 12px) scale(0.97)';
    if (back) {
      const b = back.getBoundingClientRect(), to = panel.getBoundingClientRect();
      toT = `translate(${b.left + b.width / 2 - (to.left + to.width / 2)}px, ${b.top + b.height / 2 - (to.top + to.height / 2)}px) scale(${Math.max(0.08, b.width / to.width)}, ${Math.max(0.04, b.height / to.height)})`;
    }
    const a = panel.animate([{ transform: 'none', opacity: 1 }, { transform: toT, opacity: 0 }],
      { duration: 320, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' });
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
    a.onfinish = () => { a.cancel(); scrim.getAnimations().forEach(x => x.cancel()); done(); };
  }

  // Some hosts (like a sandboxed preview) aren't allowed to embed other sites.
  // The browser reports the blocked frame, so swap the empty window for a way out.
  let embedBlocked = false;
  document.addEventListener('securitypolicyviolation', e => {
    if (!/^(frame|child|default)-src/.test(e.effectiveDirective || e.violatedDirective || '')) return;
    if (!/jamminstudio/.test(e.blockedURI || '')) return;
    embedBlocked = true;
    document.querySelectorAll('.embed-fallback').forEach(el => { el.hidden = false; });
  });

  document.querySelectorAll('[data-modal]').forEach(b => {
    b.addEventListener('click', e => { e.preventDefault(); showModal(b.dataset.modal, b); });
  });

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target.closest('[data-close]')) hideModal(); });
  });

  document.addEventListener('keydown', e => {
    if (!openModal) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideModal(); return; }
    if (e.key === 'Tab') {
      const f = focusables(openModal);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !openModal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);

  window.LandingModal = { get open() { return !!openModal; } };

  // deep links: diogomaiacaetano.net/#pharma opens straight into that window
  const initial = location.hash.slice(1);
  if (initial && document.getElementById('modal-' + initial)) {
    showModal(initial, document.querySelector(`[data-modal="${initial}"]`));
  }
})();
