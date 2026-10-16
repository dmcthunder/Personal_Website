/* Testimonials deck: the cards fall into a pile in the middle of the screen.
 * Click (or →) sends the top card to the back, ← brings the last one forward,
 * and any card can be dragged out of the pile and dropped anywhere.
 * Cards move on small springs so drops, throws and shuffles settle naturally.
 */
(function () {
  'use strict';

  const deck = document.getElementById('testimonials');
  const trigger = document.querySelector('[data-testimonials]');
  if (!deck || !trigger) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = [...deck.querySelectorAll('.tcard')];
  const pagerEl = deck.querySelector('.tdeck__pager');
  const indexEl = deck.querySelector('[data-index]');
  const totalEl = deck.querySelector('[data-total]');
  totalEl.textContent = els.length;

  const K = 210, C = 17; // spring stiffness / damping: a little bounce, no wobble

  const cards = els.map((el, i) => ({
    el, i, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, tx: 0, ty: 0, tr: 0,
    jx: 0, jy: 0, jr: 0, free: false, held: false, delay: 0, z: i
  }));
  let pile = [];      // indexes into cards, last = top of the pile
  let isOpen = false, closing = false, raf = 0, last = 0, zTop = 10, opener = null;

  function size() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  // where a card rests in the pile: centred above the control bar, a little askew
  function restFor(c, depth) {
    const { w, h } = size();
    const cw = c.el.offsetWidth, ch = c.el.offsetHeight;
    return {
      x: (w - cw) / 2 + c.jx + depth * 2,
      y: Math.max(16, (h - 72) / 2 - ch / 2) + c.jy + depth * 5,
      r: c.jr + (depth ? (depth % 2 ? 1.6 : -1.4) * depth : 0)
    };
  }

  function layoutPile() {
    pile.forEach((ci, k) => {
      const c = cards[ci];
      if (c.held) return;
      const rest = restFor(c, pile.length - 1 - k);
      c.tx = rest.x; c.ty = rest.y; c.tr = rest.r;
    });
    pile.forEach((ci, k) => { cards[ci].z = k + 1; });
    for (const c of cards) c.el.style.zIndex = c.free ? c.z : c.z;
    updatePager();
    kick();
  }

  function updatePager() {
    pagerEl.hidden = pile.length < 2;
    if (pile.length) indexEl.textContent = cards[pile[pile.length - 1]].i + 1;
  }

  function render(c) {
    c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.r}deg)`;
  }

  function frame(ts) {
    raf = 0;
    const dt = last ? Math.min((ts - last) / 1000, 0.033) : 0.016;
    last = ts;
    let moving = false;
    for (const c of cards) {
      if (c.held) { render(c); moving = true; continue; }
      if (c.delay > 0) { c.delay -= dt; moving = true; continue; }
      if (reduceMotion) {
        c.x = c.tx; c.y = c.ty; c.r = c.tr; c.vx = c.vy = c.vr = 0;
      } else {
        c.vx += (K * (c.tx - c.x) - C * c.vx) * dt;
        c.vy += (K * (c.ty - c.y) - C * c.vy) * dt;
        c.vr += (K * (c.tr - c.r) - C * c.vr) * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt;
      }
      render(c);
      if (Math.abs(c.tx - c.x) + Math.abs(c.ty - c.y) + Math.abs(c.tr - c.r) > 0.3 ||
          Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.vr) > 0.5) moving = true;
    }
    if (moving) raf = requestAnimationFrame(frame);
    else { last = 0; if (closing) finishClose(); }
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  // ------------------------------------------------------------ open / close
  function open(e) {
    if (e) e.preventDefault();
    if (isOpen) return;
    isOpen = true; closing = false;
    opener = document.activeElement;
    deck.hidden = false;
    document.documentElement.classList.add('modal-open');
    deck.querySelector('.tdeck__scrim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    const { w } = size();
    // first testimonial ends up on top, so it drops last
    pile = cards.map(c => c.i).reverse();
    cards.forEach((c, k) => {
      c.free = false; c.held = false;
      c.jx = (Math.random() - 0.5) * 18;
      c.jy = (Math.random() - 0.5) * 10;
      c.jr = (Math.random() - 0.5) * 7;
      const order = pile.indexOf(c.i);
      c.x = (w - c.el.offsetWidth) / 2 + (Math.random() - 0.5) * 160;
      c.y = -c.el.offsetHeight - 80 - Math.random() * 120;
      c.r = (Math.random() - 0.5) * 40;
      c.vx = 0; c.vy = 600; c.vr = 0;
      c.delay = reduceMotion ? 0 : order * 0.14;
      render(c);
    });
    layoutPile();
    deck.querySelector('[data-step="1"]').focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen || closing) return;
    closing = true;
    const { h } = size();
    // everything drops out of the bottom of the screen
    cards.forEach((c, k) => {
      c.held = false;
      c.tx = c.x + (Math.random() - 0.5) * 120;
      c.ty = h + 120;
      c.tr = c.r + (Math.random() - 0.5) * 50;
      c.vy -= 250;
      c.delay = reduceMotion ? 0 : k * 0.04;
    });
    deck.querySelector('.tdeck__scrim').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    if (reduceMotion) { finishClose(); return; }
    kick();
    // a safety net in case the springs never report rest
    setTimeout(() => { if (closing) finishClose(); }, 1200);
  }

  function finishClose() {
    if (!closing) return;
    closing = false; isOpen = false;
    deck.hidden = true;
    deck.querySelector('.tdeck__scrim').getAnimations().forEach(a => a.cancel());
    if (!(window.LandingModal && window.LandingModal.open)) document.documentElement.classList.remove('modal-open');
    (opener && opener.focus ? opener : trigger).focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ shuffle
  function step(dir) {
    if (pile.length < 2) return;
    const { w } = size();
    if (dir > 0) {
      // top card slides out to the right, then tucks in at the back
      const ci = pile.pop();
      const c = cards[ci];
      c.tx = c.x + Math.min(320, w * 0.32); c.ty = c.y - 30; c.tr = c.r + 10;
      kick();
      setTimeout(() => { if (!c.free && pile.indexOf(ci) === -1) { pile.unshift(ci); layoutPile(); } }, reduceMotion ? 0 : 170);
    } else {
      // the card at the back comes out on the left and lands on top
      const ci = pile.shift();
      const c = cards[ci];
      c.x -= Math.min(320, w * 0.32); c.r -= 10; c.vx = 0;
      pile.push(ci);
      layoutPile();
    }
    updatePager();
  }

  // ------------------------------------------------------------ drag
  let drag = null;
  cards.forEach(c => {
    c.el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || closing) return;
      drag = { c, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - c.x, oy: e.clientY - c.y, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 };
      c.el.setPointerCapture(e.pointerId);
      // bring it above everything while it's in hand
      c.el.style.zIndex = ++zTop + 100;
    });
    c.el.addEventListener('pointermove', e => {
      if (!drag || drag.c !== c || e.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        c.held = true;
        c.el.classList.add('is-held');
        const k = pile.indexOf(c.i);
        if (k !== -1) { pile.splice(k, 1); layoutPile(); }
        c.free = true;
      }
      const now = performance.now(), dt = Math.max(1, now - drag.lt);
      drag.vx = drag.vx * 0.6 + ((e.clientX - drag.lx) / dt) * 1000 * 0.4;
      drag.vy = drag.vy * 0.6 + ((e.clientY - drag.ly) / dt) * 1000 * 0.4;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
      c.x = e.clientX - drag.ox;
      c.y = e.clientY - drag.oy;
      c.r += (Math.max(-14, Math.min(14, drag.vx * 0.012)) - c.r) * 0.25; // swings with the throw
      kick();
    });
    const end = e => {
      if (!drag || drag.c !== c || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.moved) {
        // a click: top of the pile → next card; anything else → bring it forward
        const k = pile.indexOf(c.i);
        if (k === pile.length - 1) step(1);
        else if (k !== -1) { pile.splice(k, 1); pile.push(c.i); layoutPile(); }
        else { c.z = ++zTop; c.el.style.zIndex = c.z; }
        return;
      }
      c.held = false;
      c.el.classList.remove('is-held');
      c.z = ++zTop; c.el.style.zIndex = c.z;
      // let it glide a little after the drop, then settle flat-ish where it landed
      const { w, h } = size();
      const glide = reduceMotion ? 0 : 0.12;
      c.tx = Math.max(-c.el.offsetWidth * 0.5, Math.min(w - c.el.offsetWidth * 0.5, c.x + d.vx * glide));
      c.ty = Math.max(-c.el.offsetHeight * 0.3, Math.min(h - 80, c.y + d.vy * glide));
      c.tr = Math.max(-12, Math.min(12, c.r * 0.6));
      c.vx = d.vx * 0.3; c.vy = d.vy * 0.3;
      kick();
    };
    c.el.addEventListener('pointerup', end);
    c.el.addEventListener('pointercancel', end);
    c.el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(1); }
    });
  });

  // ------------------------------------------------------------ wiring
  trigger.addEventListener('click', open);
  deck.addEventListener('click', e => {
    const s = e.target.closest('[data-step]');
    if (s) { step(+s.dataset.step); return; }
    if (e.target.closest('[data-close]')) close();
  });

  document.addEventListener('keydown', e => {
    if (!isOpen || closing) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); step(-1); }
    else if (e.key === 'Tab') {
      const f = [...deck.querySelectorAll('button:not([hidden]), .tcard')].filter(el => el.getClientRects().length);
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    } else if (e.key === ' ' && !e.target.closest('button, .tcard')) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);

  window.addEventListener('resize', () => { if (isOpen && !closing) layoutPile(); });

  if (location.hash === '#testimonials') open();
})();
