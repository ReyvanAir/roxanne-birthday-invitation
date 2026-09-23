const START_AT = 11;   // seconds into the song; used on first play and on every loop
const FADE_MS = 1200;
const VOLUME = 0.8;

const stage = document.querySelector('.stage');
const envelope = document.querySelector('.envelope');
const seal = document.querySelector('.envelope__seal');
const invite = document.querySelector('.invite');
const song = document.getElementById('song');
const soundToggle = document.querySelector('.sound-toggle');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Every visit starts at the envelope; a restored scroll position would yank the page once it unlocks.
history.scrollRestoration = 'manual';

/* Opening sequence. Timing lives in style.css; JS only moves between phases when an animation finishes. */

envelope.addEventListener('click', () => {
  stage.classList.add('is-opening');
  soundToggle.hidden = false;
  startSong();
}, { once: true });

stage.addEventListener('animationstart', (e) => {
  if (e.animationName === 'seal-fall-left') {
    const r = seal.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 18, speed: 6, size: 5, colors: WAX });
  }
  if (e.animationName === 'stage-out') celebrate();
});

stage.addEventListener('animationend', (e) => {
  if (e.animationName === 'letter-rise') {
    invite.hidden = false;
    invite.classList.add('is-in');
    stage.classList.add('is-revealing');
  } else if (e.animationName === 'stage-out') {
    stage.remove();
    document.body.classList.remove('is-sealed');
    invite.querySelector('h1').focus({ preventScroll: true });
  }
});

/* Music. iOS ignores song.volume, so there the song starts at full volume without the fade. */

let soundOn = false;

function startSong() {
  song.volume = 0;
  if (song.readyState >= 1) song.currentTime = START_AT;
  else song.addEventListener('loadedmetadata', () => { song.currentTime = START_AT; }, { once: true });
  setSound(true);
  fadeIn();
}

function fadeIn() {
  const t0 = performance.now();
  requestAnimationFrame(function step(now) {
    const k = Math.min(Math.max((now - t0) / FADE_MS, 0), 1);
    song.volume = VOLUME * k * k;
    if (k < 1) requestAnimationFrame(step);
  });
}

function setSound(on) {
  soundOn = on;
  soundToggle.setAttribute('aria-pressed', String(on));
  if (!on) return song.pause();
  song.play().catch(() => setSound(false));
}

song.addEventListener('ended', () => {
  song.currentTime = START_AT;
  song.volume = 0;
  setSound(true);
  fadeIn();
});

soundToggle.addEventListener('click', () => setSound(!soundOn));

// Guests tap the map link and leave the tab; don't keep playing at them from the background.
document.addEventListener('visibilitychange', () => {
  if (!soundOn) return;
  if (document.hidden) song.pause();
  else song.play().catch(() => setSound(false));
});

/* Portrait: stays on the monogram until assets/images/roxanne.jpg exists. */

const portrait = document.querySelector('.portrait');
const photo = portrait.querySelector('img');
const showPhoto = () => { if (photo.naturalWidth) portrait.classList.add('has-photo'); };
if (photo.complete) showPhoto();
else photo.addEventListener('load', showPhoto);

/* Countdown to 6 PM Manado time (UTC+8), so guests in any timezone count to the same moment. */

const PARTY_AT = new Date('2026-11-18T18:00:00+08:00').getTime();
const countdown = document.querySelector('.countdown');
const countdownUnits = [...countdown.querySelectorAll('.countdown__unit')];

function renderCountdown(msLeft) {
  if (msLeft <= 0) {
    countdown.textContent = "It's party time!";
    countdown.classList.add('is-done');
    return false;
  }
  const s = Math.ceil(msLeft / 1000);
  const values = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
  countdownUnits.forEach((unit, i) => {
    const n = values[i];
    unit.querySelector('.countdown__num').textContent = i ? String(n).padStart(2, '0') : n;
    unit.querySelector('.countdown__label').textContent = unit.dataset.unit + (n === 1 ? '' : 's');
  });
  return true;
}

(function tick() {
  // Wake on the next whole second so the seconds never skip or stall.
  if (renderCountdown(PARTY_AT - Date.now())) setTimeout(tick, 1000 - (Date.now() % 1000));
})();
countdown.hidden = false;

/* Details card slides in like a letter set down on the table. */

const card = document.querySelector('.card');
new IntersectionObserver((entries, observer) => {
  if (!entries[0].isIntersecting) return;
  card.classList.add('is-visible');
  observer.disconnect();
}, { threshold: 0.15 }).observe(card);

/* Confetti */

const canvas = document.querySelector('.confetti');
const ctx = canvas.getContext('2d');
const PARTY = ['#cf2433', '#b01825', '#8c1120', '#fbf4ea', '#d9b56f', '#e8828a'];
const WAX = ['#b01825', '#8c1120', '#6a0c19', '#d9b56f'];
const GRAVITY = 0.15;
const DRAG = 0.955;
let pieces = [];
let frame = 0;
let last = 0;

function celebrate() {
  const w = innerWidth;
  const h = innerHeight;
  const speed = h * 0.045;
  burst(0, h, { count: 90, speed, angle: -Math.PI / 3, spread: 0.8 });
  burst(w, h, { count: 90, speed, angle: (-2 * Math.PI) / 3, spread: 0.8 });
}

function burst(x, y, { count, speed, angle = -Math.PI / 2, spread = Math.PI * 2, size = 9, colors = PARTY }) {
  if (reduceMotion) return;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.45 + Math.random() * 0.55);
    pieces.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: size * (0.6 + Math.random() * 0.8),
      h: size * (0.35 + Math.random() * 0.35),
      spin: Math.random() * Math.PI * 2,
      vspin: (Math.random() - 0.5) * 0.3,
      flip: Math.random() * Math.PI * 2,
      vflip: 0.08 + Math.random() * 0.12,
      color: colors[i % colors.length],
    });
  }
  if (!frame) {
    fitCanvas();
    last = performance.now();
    frame = requestAnimationFrame(draw);
  }
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(now) {
  const dt = Math.min(Math.max(now - last, 0) / 16.67, 3); // 1 = one frame at 60fps
  last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  pieces = pieces.filter((p) => p.y < innerHeight + 40);

  for (const p of pieces) {
    const drag = DRAG ** dt;
    p.vx *= drag;
    p.vy = p.vy * drag + GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.spin += p.vspin * dt;
    p.flip += p.vflip * dt;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.scale(1, Math.cos(p.flip));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }

  frame = pieces.length ? requestAnimationFrame(draw) : 0;
}
