/* Landing v2: custom cursor over the bio badges.
 * Badges swap the system cursor for the 32px glass "expand" cursor from Figma. */
(function () {
  'use strict';

  const cursor = document.getElementById('cursor');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!cursor) return;

  let x = -100, y = -100, cx = -100, cy = -100, raf = 0, over = false;

  function loop() {
    // a touch of easing so the cursor feels attached but soft
    cx += (x - cx) * 0.35;
    cy += (y - cy) * 0.35;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${over ? 1 : 0.6})`;
    if (Math.abs(x - cx) > 0.1 || Math.abs(y - cy) > 0.1 || over) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  document.querySelectorAll('.badge').forEach(badge => {
    badge.addEventListener('pointerenter', e => {
      if (!fine.matches || e.pointerType !== 'mouse') return;
      if (!over) { cx = x = e.clientX; cy = y = e.clientY; }
      over = true;
      cursor.classList.add('is-visible');
      kick();
    });
    badge.addEventListener('pointerleave', () => {
      over = false;
      cursor.classList.remove('is-visible');
      kick();
    });
  });

  window.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (over) kick();
  }, { passive: true });
})();
