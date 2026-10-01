const windows = document.querySelectorAll('[data-window]');
const railApps = document.querySelectorAll('.app');
const jobList = document.querySelector('.jobs');

// Embeds load only while their window is open, so audio never keeps playing in the background.
function setVisible(win, visible) {
  win.hidden = !visible;
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
