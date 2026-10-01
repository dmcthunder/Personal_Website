const windows = document.querySelectorAll('[data-window]');
const railApps = document.querySelectorAll('.app');
const jobList = document.querySelector('.jobs');

const isPhone = window.matchMedia('(max-width: 760px)');

// Embeds load only while their window is open, so audio never keeps playing in the background.
function setVisible(win, visible) {
  win.hidden = !visible;
  // A window's default size, measured the first time it opens, is its minimum size.
  if (visible && !win.dataset.minWidth && !isPhone.matches) {
    win.dataset.minWidth = win.offsetWidth;
    win.dataset.minHeight = win.offsetHeight;
  }
  const embed = win.querySelector('iframe[data-src]');
  if (!embed) return;
  if (visible && !embed.src) embed.src = embed.dataset.src;
  if (!visible) embed.removeAttribute('src');
}

// One screen at a time, like the design frames: opening one closes the others.
function openWindow(id, job) {
  windows.forEach(win => setVisible(win, win.id === id));

  railApps.forEach(app => app.classList.toggle('is-active', id === 'work' && Boolean(job) && app.dataset.job === job));

  if (id === 'work') highlightJob(job);
}

function highlightJob(job) {
  document.querySelectorAll('.job').forEach(el => el.classList.toggle('is-active', el.id === `job-${job}`));

  const entry = job && document.getElementById(`job-${job}`);
  jobList.scrollTo({ top: entry ? entry.offsetTop - jobList.offsetTop : 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-open]').forEach(button => {
  button.addEventListener('click', () => openWindow(button.dataset.open, button.dataset.job));
});

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => {
    setVisible(button.closest('[data-window]'), false);
    railApps.forEach(app => app.classList.remove('is-active'));
  });
});

// Moving and resizing, desktop only

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Tracks one pointer gesture; onMove receives the distance from where it started.
function trackPointer(event, bodyClass, onMove) {
  event.preventDefault();
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  document.body.classList.add(bodyClass);

  const move = e => onMove(e.clientX - event.clientX, e.clientY - event.clientY);
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    document.body.classList.remove(bodyClass);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

windows.forEach(win => {
  const bar = win.querySelector('.window__bar, .testimonials__head');
  bar.addEventListener('pointerdown', event => {
    if (isPhone.matches || event.button !== 0 || event.target.closest('button')) return;
    const startLeft = win.offsetLeft;
    const startTop = win.offsetTop;
    trackPointer(event, 'is-dragging', (dx, dy) => {
      // Always leave part of the title bar on screen so the window can be grabbed again.
      win.style.left = `${clamp(startLeft + dx, 80 - win.offsetWidth, window.innerWidth - 80)}px`;
      win.style.top = `${clamp(startTop + dy, 0, window.innerHeight - 48)}px`;
    });
  });

  if (!win.classList.contains('window')) return;

  ['e', 's', 'se'].forEach(edge => {
    const handle = document.createElement('div');
    handle.className = `resize resize--${edge}`;
    handle.setAttribute('aria-hidden', 'true');
    win.append(handle);

    handle.addEventListener('pointerdown', event => {
      if (isPhone.matches || event.button !== 0) return;
      const startWidth = win.offsetWidth;
      const startHeight = win.offsetHeight;
      trackPointer(event, 'is-resizing', (dx, dy) => {
        if (edge !== 's') win.style.width = `${Math.max(Number(win.dataset.minWidth), startWidth + dx)}px`;
        if (edge !== 'e') win.style.height = `${Math.max(Number(win.dataset.minHeight), startHeight + dy)}px`;
      });
    });
  });
});

// The Hello window is open on load, so record its minimum size now.
windows.forEach(win => { if (!win.hidden) setVisible(win, true); });

// Testimonials pager
const quotes = [...document.querySelectorAll('.quote')];
const indexLabel = document.querySelector('[data-index]');
let current = 0;

document.querySelectorAll('[data-step]').forEach(button => {
  button.addEventListener('click', () => {
    quotes[current].hidden = true;
    current = (current + Number(button.dataset.step) + quotes.length) % quotes.length;
    quotes[current].hidden = false;
    indexLabel.textContent = current + 1;
  });
});
