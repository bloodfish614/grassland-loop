function createVideo(url) {
  const video = document.createElement('video');
  video.src = url;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.loop = false;
  video.crossOrigin = 'anonymous';
  return video;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(u) {
  return u * u * (3 - 2 * u);
}

export function createBgVideoLooper({ url, xfadeSeconds, primeSeconds, epsilonSec }) {
  const a = createVideo(url);
  const b = createVideo(url);

  let front = a;
  let back = b;

  let bgStatus = 'loading';
  let needUserGesture = false;
  let primed = false;
  let handoffActive = false;
  let handoffElapsedSec = 0;
  let handoffAlpha = 0;
  let pending404 = false;

  const set404 = () => {
    pending404 = true;
    if (bgStatus !== 'playing') {
      bgStatus = '404';
    }
  };

  a.addEventListener('error', set404);
  b.addEventListener('error', set404);

  function canDraw(video) {
    return video.readyState >= 2 && video.videoWidth > 0 && !video.paused;
  }

  function canPrepare(video) {
    return video.readyState >= 2 && video.videoWidth > 0;
  }

  async function safePlay(video) {
    try {
      await video.play();
      return true;
    } catch {
      return false;
    }
  }

  async function start() {
    if (pending404) {
      bgStatus = '404';
      return false;
    }

    const ok = await safePlay(front);
    if (ok) {
      bgStatus = 'playing';
      needUserGesture = false;
      return true;
    }

    needUserGesture = true;
    bgStatus = 'click';
    return false;
  }

  async function resumeByUserGesture() {
    const okFront = await safePlay(front);
    const okBack = canPrepare(back) ? await safePlay(back) : true;

    if (okFront && okBack) {
      needUserGesture = false;
      bgStatus = 'playing';
      return true;
    }

    needUserGesture = true;
    bgStatus = 'click';
    return false;
  }

  function update(dtSec) {
    if (pending404 && bgStatus !== 'playing') {
      bgStatus = '404';
    }

    if (!canDraw(front)) {
      return;
    }

    const duration = Number.isFinite(front.duration) ? front.duration : 0;
    if (duration <= 0) {
      return;
    }

    const remaining = duration - front.currentTime;

    if (!primed && remaining <= primeSeconds) {
      primed = true;
      back.pause();
      back.currentTime = 0;
      back.load();
    }

    if (!handoffActive && remaining <= xfadeSeconds) {
      handoffActive = true;
      handoffElapsedSec = 0;
      handoffAlpha = 0;
      back.currentTime = 0;
      if (!needUserGesture) {
        safePlay(back).then((ok) => {
          if (!ok) {
            needUserGesture = true;
            bgStatus = 'click';
          }
        });
      }
    }

    if (handoffActive) {
      if (canDraw(back)) {
        handoffElapsedSec += dtSec;
        const u = clamp01(handoffElapsedSec / xfadeSeconds);
        handoffAlpha = smoothstep01(u);
      }

      const shouldSwap = handoffAlpha >= 0.999 || (remaining <= epsilonSec && canDraw(back) && handoffAlpha >= 0.999);

      if (shouldSwap) {
        const oldFront = front;
        front = back;
        back = oldFront;

        primed = false;
        handoffActive = false;
        handoffElapsedSec = 0;
        handoffAlpha = 0;

        back.pause();
        back.currentTime = 0;

        if (!front.paused && bgStatus !== '404') {
          bgStatus = 'playing';
        }
      }
    }
  }

  function draw(ctx, width, height) {
    if (canDraw(front)) {
      ctx.globalAlpha = 1;
      ctx.drawImage(front, 0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    if (handoffActive && handoffAlpha > 0 && canDraw(back)) {
      ctx.globalAlpha = handoffAlpha;
      ctx.drawImage(back, 0, 0, width, height);
    }

    ctx.globalAlpha = 1;
  }

  return {
    start,
    resumeByUserGesture,
    update,
    draw,
    getStatus: () => bgStatus,
    needsUserGesture: () => needUserGesture,
  };
}
