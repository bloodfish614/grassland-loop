import { BG_VIDEO_URL, BUILD, EPSILON_SEC, PRIME_SECONDS, XFADE_SECONDS } from './config.js';
import { createBgVideoLooper } from './bgVideoLoop.js';

const canvas = document.getElementById('stage');
const overlay = document.getElementById('tapOverlay');
const ctx = canvas.getContext('2d');

const looper = createBgVideoLooper({
  url: BG_VIDEO_URL,
  xfadeSeconds: XFADE_SECONDS,
  primeSeconds: PRIME_SECONDS,
  epsilonSec: EPSILON_SEC,
});

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawHud(status) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(12, 12, 220, 58);
  ctx.fillStyle = '#fff';
  ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`BUILD=${BUILD}`, 22, 34);
  ctx.fillText(`BG: ${status}`, 22, 56);
  ctx.restore();
}

async function tryStart() {
  const ok = await looper.start();
  overlay.hidden = ok;
}

async function activateByClick() {
  const ok = await looper.resumeByUserGesture();
  overlay.hidden = ok;
}

overlay.addEventListener('click', activateByClick);
overlay.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activateByClick();
  }
});

window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dtSec = Math.min(0.1, (now - last) / 1000);
  last = now;

  looper.update(dtSec);

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  looper.draw(ctx, window.innerWidth, window.innerHeight);
  drawHud(looper.getStatus());

  if (looper.needsUserGesture()) {
    overlay.hidden = false;
  }

  requestAnimationFrame(frame);
}

tryStart();
requestAnimationFrame(frame);
