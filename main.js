// Modal open/close and idle-to-loop logic
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modalOverlay');
  const video = document.getElementById('modalVideo');
  const closeBtn = document.getElementById('modalClose');

  let idleTimer = null;
  let flashInterval = null;
  const static_time = 25; // seconds before launching loop
  const IDLE_MS = static_time * 1000;

  // --- refactored input handling (pointer-first, touch fallback) ---
  const supportsPointer = window.PointerEvent;
  let lastTouchTime = 0;

  function tryActivateFromElement(el, originalEvent) {
    if (!el || el.nodeType !== 1) return false;
    const a = el.closest('[data-video-src]');
    if (!a) return false;
    if (originalEvent && typeof originalEvent.preventDefault === 'function') originalEvent.preventDefault();
    clearIdleTimer();
    openModal(a.dataset.videoSrc);
    return true;
  }

  // Pointer-based devices (preferred)
  if (supportsPointer) {
    document.addEventListener('pointerup', (e) => {
      // ignore non-primary buttons
      if (e.button && e.button !== 0) return;
      tryActivateFromElement(e.target, e);
    }, { passive: false });

    overlay.addEventListener('pointerup', (e) => {
      if (e.target === overlay) {
        closeModal();
        startIdleTimer();
      }
    }, { passive: true });

    // Cancel idle on any pointer interaction
    document.addEventListener('pointerdown', clearIdleTimer, { passive: true });
  } else {
    // Touch fallback: use touchend -> elementFromPoint to find tapped element
    document.addEventListener('touchend', (e) => {
      lastTouchTime = Date.now();
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      // try activate; preventDefault only if we actually activate
      if (tryActivateFromElement(el, e)) {
        // prevent the subsequent synthetic click from triggering
        // don't mark as passive so preventDefault works if needed upstream
      }
    }, { passive: true });

    // guard clicks after touch to avoid double activation
    document.addEventListener('click', (e) => {
      // ignore click if a touch was just processed
      if (Date.now() - lastTouchTime < 700) return;
      tryActivateFromElement(e.target, e);
    }, { passive: true });

    // overlay touch handler
    overlay.addEventListener('touchend', (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el === overlay) {
        closeModal();
        startIdleTimer();
      }
    }, { passive: true });

    // cancel idle on any touchstart
    document.addEventListener('touchstart', clearIdleTimer, { passive: true });
  }

  // fallback keyboard/close handlers (unchanged)
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // when a video ends: close modal and start idle timer
  video.addEventListener('ended', () => {
    closeModal();
    startIdleTimer();
  });

  // if the user explicitly starts playback, cancel idle timer
  video.addEventListener('play', () => {
    clearIdleTimer();
  });

  function openModal(src) {
    if (!src) return;
    clearIdleTimer();
    video.src = src;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    video.currentTime = 0;
    video.play().catch(() => {});
  }

  function closeModal() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    try { video.pause(); } catch (e) {}
    video.removeAttribute('src');
    video.load();
  }

  function startFlashLoop() {
    if (flashInterval) return;
    applyFlashToRandomThumb();
    flashInterval = setInterval(applyFlashToRandomThumb, 7250 ); // every 7.seconds
  }

  function clearFlashLoop() {
    if (flashInterval) {
      clearInterval(flashInterval);
      flashInterval = null;
    }
  }

  function startIdleTimer() {
    clearIdleTimer();
    startFlashLoop();
    idleTimer = setTimeout(() => {
      openModal('assets/videos/loop.mp4');
    }, IDLE_MS);
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    clearFlashLoop();
  }

  // --- Flashiness: pick random 1-5 and animate a thumbnail ---
  function randInt1to5() {
    return Math.floor(Math.random() * 5) + 1;
  }

  function applyFlashToRandomThumb() {
    const thumbs = document.querySelectorAll('.thumb, .loop_thumb');
    if (!thumbs || thumbs.length === 0) return;
    const n = randInt1to5();
    // map number 1-5 to an index in the NodeList (wrap if fewer than 5)
    const idx = (n - 1) % thumbs.length;
    const el = thumbs[idx];
    if (!el) return;
    el.classList.add('flash', `flash-${n}`);
    // remove classes when animation completes so it can be re-triggered later
    const cleanup = () => {
      el.classList.remove('flash', `flash-${n}`);
      el.removeEventListener('animationend', cleanup);
    };
    el.addEventListener('animationend', cleanup);
    return { element: el, choice: n };
  }

  // make easily callable for debugging / manual retriggering
  window.applyFlashToRandomThumb = applyFlashToRandomThumb;

  // run once on load
  applyFlashToRandomThumb();

  // Optional: start idle timer on page load if desired
  // startIdleTimer();
});