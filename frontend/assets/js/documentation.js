(function () {
  "use strict";

  const viewport = document.getElementById("documentationViewport");
  const story = document.getElementById("documentationStory");

  if (!viewport || !story) return;

  document.querySelectorAll(".source-logo-wrap img").forEach(function (img) {
    img.addEventListener("error", function () {
      const wrap = img.closest(".source-logo-wrap");
      if (wrap) wrap.classList.add("logo-missing");
    });
  });

  let isInteracting = false;
  let restartTimer = null;
  let lastFrame = performance.now();
  let startAfter = performance.now() + 1400;
  let returningToTop = false;

  function getSpeed() {
    if (window.innerWidth <= 480) return 13;
    if (window.innerWidth <= 768) return 16;
    return 20;
  }

  function maxScroll() {
    return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  }

  function scheduleRestart(delay) {
    window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(function () {
      isInteracting = false;
      lastFrame = performance.now();
      startAfter = performance.now() + 450;
    }, delay || 1200);
  }

  function pauseForInteraction() {
    isInteracting = true;
  }

  function tick(now) {
    const delta = Math.min(48, now - lastFrame);
    lastFrame = now;

    if (!isInteracting && !returningToTop && now >= startAfter) {
      const limit = maxScroll();

      if (limit > 2) {
        viewport.scrollTop += (getSpeed() * delta) / 1000;

        if (viewport.scrollTop >= limit - 2) {
          returningToTop = true;
          window.setTimeout(function () {
            viewport.scrollTop = 0;
            returningToTop = false;
            lastFrame = performance.now();
            startAfter = performance.now() + 1200;
          }, 1500);
        }
      }
    }

    window.requestAnimationFrame(tick);
  }

  viewport.addEventListener("wheel", function () {
    pauseForInteraction();
    scheduleRestart(1500);
  }, { passive: true });

  viewport.addEventListener("touchstart", pauseForInteraction, { passive: true });
  viewport.addEventListener("touchend", function () {
    scheduleRestart(1500);
  }, { passive: true });

  viewport.addEventListener("pointerdown", pauseForInteraction, { passive: true });
  viewport.addEventListener("pointerup", function () {
    scheduleRestart(1100);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      pauseForInteraction();
    } else {
      scheduleRestart(500);
    }
  });

  window.addEventListener("resize", function () {
    if (viewport.scrollTop > maxScroll()) viewport.scrollTop = maxScroll();
  });

  window.requestAnimationFrame(function () {
    story.classList.add("is-ready");
    window.requestAnimationFrame(tick);
  });
})();
