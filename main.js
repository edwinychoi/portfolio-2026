(function () {
  const glow = document.querySelector(".ambient-glow");
  if (!glow) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let targetX = 0.5;
  let targetY = 0.35;
  let smoothX = targetX;
  let smoothY = targetY;
  const start = performance.now();

  /** Lower = slower catch-up to the cursor (not 1:1 with pointer). */
  const FOLLOW_EASE = 0.045;
  /** Max normalized offset from smoothed position — slow wandering. */
  const DRIFT = 0.055;

  function setPointerNorm(clientX, clientY) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    targetX = clientX / w;
    targetY = clientY / h;
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      setPointerNorm(e.clientX, e.clientY);
    },
    { passive: true }
  );

  function tick(now) {
    const t = (now - start) * 0.00012;
    const driftX = Math.sin(t * 0.55) * DRIFT + Math.cos(t * 0.31) * (DRIFT * 0.45);
    const driftY = Math.cos(t * 0.48) * DRIFT + Math.sin(t * 0.37) * (DRIFT * 0.4);

    smoothX += (targetX - smoothX) * FOLLOW_EASE;
    smoothY += (targetY - smoothY) * FOLLOW_EASE;

    const x = (smoothX + driftX) * 100;
    const y = (smoothY + driftY) * 100;

    glow.style.setProperty("--glow-x", `${x}%`);
    glow.style.setProperty("--glow-y", `${y}%`);

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

let heroHeadingTemplate = null;

function debounce(fn, ms) {
  let id;
  return function () {
    clearTimeout(id);
    id = setTimeout(fn, ms);
  };
}

function collectHeadingSegments(heading) {
  const segs = [];
  for (const child of Array.from(heading.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const parts = child.textContent.match(/\S+|\s+/gu);
      if (parts) parts.forEach((text) => segs.push({ kind: "text", text }));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      segs.push({ kind: "el", el: child });
    }
  }
  return segs;
}

function fragmentForMeasure(segs) {
  const f = document.createDocumentFragment();
  for (const s of segs) {
    if (s.kind === "text") f.appendChild(document.createTextNode(s.text));
    else f.appendChild(s.el.cloneNode(true));
  }
  return f;
}

function fragmentCommit(segs) {
  const f = document.createDocumentFragment();
  for (const s of segs) {
    if (s.kind === "text") f.appendChild(document.createTextNode(s.text));
    else f.appendChild(s.el);
  }
  return f;
}

function splitHeadingByVisualLines(heading, widthRetry) {
  const segs = collectHeadingSegments(heading);
  if (!segs.length) return;

  const cs = getComputedStyle(heading);
  const rawW = heading.clientWidth || heading.getBoundingClientRect().width;
  if (rawW < 1) {
    const next = typeof widthRetry === "number" ? widthRetry : 0;
    if (next < 12) {
      requestAnimationFrame(() => splitHeadingByVisualLines(heading, next + 1));
    }
    return;
  }
  const w = Math.round(rawW);

  const meas = document.createElement("div");
  meas.setAttribute("aria-hidden", "true");
  meas.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    "visibility:hidden",
    "pointer-events:none",
    "box-sizing:border-box",
    "width:" + w + "px",
    "max-width:100%",
    "min-width:0",
    "font-family:" + cs.fontFamily,
    "font-size:" + cs.fontSize,
    "font-weight:" + cs.fontWeight,
    "font-style:" + cs.fontStyle,
    "letter-spacing:" + cs.letterSpacing,
    "line-height:" + cs.lineHeight,
    "word-break:break-word",
    "overflow-wrap:break-word",
  ].join(";");
  document.body.appendChild(meas);

  function lineHeight(segsIn) {
    meas.replaceChildren(fragmentForMeasure(segsIn));
    return meas.offsetHeight;
  }

  const lines = [];
  let cur = [];

  for (const seg of segs) {
    const next = [...cur, seg];
    const hNext = lineHeight(next);
    const hCur = cur.length ? lineHeight(cur) : 0;
    if (cur.length && hNext > hCur) {
      lines.push(cur);
      cur = [seg];
    } else {
      cur = next;
    }
  }
  if (cur.length) lines.push(cur);

  meas.remove();

  heading.replaceChildren();
  lines.forEach((lineSegs, i) => {
    const wrap = document.createElement("span");
    wrap.className = "hero__line";
    const inner = document.createElement("span");
    inner.className = "hero__line-inner";
    inner.style.setProperty("--line", String(i));
    inner.appendChild(fragmentCommit(lineSegs));
    wrap.appendChild(inner);
    heading.appendChild(wrap);
  });
}

function runHeroLineSplit() {
  const heading = document.querySelector(".hero__intro");
  if (!heading) return;

  if (!heroHeadingTemplate) {
    heroHeadingTemplate = heading.cloneNode(true);
  } else {
    heading.replaceChildren(...heroHeadingTemplate.cloneNode(true).childNodes);
  }
  splitHeadingByVisualLines(heading);
}

function initHeroLineReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function layoutAndSplit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(runHeroLineSplit);
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(layoutAndSplit);
  } else {
    layoutAndSplit();
  }
}

const debouncedHeroSplit = debounce(runHeroLineSplit, 180);

/** Matches `styles.css` mobile breakpoint for layout. */
const MOBILE_INTERACTION_MQ = window.matchMedia("(max-width: 767px)");

/** When the project *copy* (title/body) nears the viewport — later than the image alone. */
const MOBILE_PROJECT_TRIGGER_IO = {
  root: null,
  rootMargin: "0px 0px -22% 0px",
  threshold: 0.18,
};

function isMobileInteractionMode() {
  return MOBILE_INTERACTION_MQ.matches;
}

function projectCopyForMedia(mediaEl) {
  return mediaEl.closest(".project__inner")?.querySelector(".project__copy") ?? null;
}

/**
 * CSS-only hover effects (canvas, COVID stack, SHR zoom, SDOH zoom): on narrow viewports,
 * add a class when the project *text* block nears the viewport — once — mirroring :hover in CSS.
 */
function initCssHoverFallbackOnScroll() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const selectors = [
    ".project__media--canvas-hover",
    ".project__media--c19-stack",
    ".project__media--shr-hover",
    ".project__media--sdoh-zoom",
  ];

  const mediasToArm = () =>
    Array.from(document.querySelectorAll(selectors.join(","))).filter(
      (el) => !el.classList.contains("project__media--interaction-done")
    );

  const io = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const target = entry.target;
      const media =
        target.classList.contains("project__copy") && target.previousElementSibling?.classList.contains("project__media")
          ? target.previousElementSibling
          : target.classList.contains("project__media")
            ? target
            : null;
      if (media) {
        media.classList.add("project__media--interaction-done");
      }
      obs.unobserve(target);
    }
  }, MOBILE_PROJECT_TRIGGER_IO);

  function observeEligible() {
    if (!isMobileInteractionMode()) return;
    mediasToArm().forEach((media) => {
      const copy = projectCopyForMedia(media);
      io.observe(copy ?? media);
    });
  }

  observeEligible();
  MOBILE_INTERACTION_MQ.addEventListener("change", observeEligible);
}

function initWorkbenchHoverSequence() {
  const root = document.querySelector(".project__media--workbench-hover");
  if (!root) return;

  const frames = [...root.querySelectorAll("[data-workbench-frame]")].sort(
    (a, b) => Number(a.dataset.workbenchFrame) - Number(b.dataset.workbenchFrame)
  );
  let timers = [];

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  };

  function setFrame(index) {
    frames.forEach((el) => {
      el.classList.toggle("is-workbench-visible", Number(el.dataset.workbenchFrame) === index);
    });
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setFrame(0);
    return;
  }

  const STEP_MS = 192;

  function runSequence() {
    clearTimers();
    if (frames.length <= 1) {
      setFrame(0);
      return;
    }

    // Desktop hover: jump immediately to the next frame; mobile scroll: same, once.
    setFrame(1);
    for (let i = 2; i < frames.length; i++) {
      timers.push(
        window.setTimeout(() => {
          setFrame(i);
        }, STEP_MS * (i - 1))
      );
    }
  }

  function resetToFirstFrame() {
    clearTimers();
    setFrame(0);
  }

  function onEnter() {
    runSequence();
  }

  function onLeave() {
    resetToFirstFrame();
  }

  let workbenchIo = null;
  let scrollPlayed = false;

  function disconnectIo() {
    if (!workbenchIo) return;
    workbenchIo.disconnect();
    workbenchIo = null;
  }

  function bindWorkbenchInteraction() {
    root.removeEventListener("pointerenter", onEnter);
    root.removeEventListener("pointerleave", onLeave);
    disconnectIo();

    if (isMobileInteractionMode()) {
      if (scrollPlayed) {
        return;
      }
      const copyEl = projectCopyForMedia(root);
      workbenchIo = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || scrollPlayed) continue;
            scrollPlayed = true;
            runSequence();
            obs.unobserve(entry.target);
          }
        },
        MOBILE_PROJECT_TRIGGER_IO
      );
      workbenchIo.observe(copyEl ?? root);
      setFrame(0);
    } else {
      root.addEventListener("pointerenter", onEnter);
      root.addEventListener("pointerleave", onLeave);
      setFrame(0);
    }
  }

  bindWorkbenchInteraction();
  MOBILE_INTERACTION_MQ.addEventListener("change", bindWorkbenchInteraction);
}

document.addEventListener("DOMContentLoaded", () => {
  initHeroLineReveal();
  initWorkbenchHoverSequence();
  initCssHoverFallbackOnScroll();
  window.addEventListener("resize", debouncedHeroSplit, { passive: true });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const projectPieces = document.querySelectorAll(".project__media, .project__copy");
  const simpleBlocks = document.querySelectorAll(".logos, .footer");

  projectPieces.forEach((el) => {
    el.classList.add("reveal-on-scroll", "reveal-on-scroll--hero");
  });
  simpleBlocks.forEach((el) => el.classList.add("reveal-on-scroll"));

  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        obs.unobserve(entry.target);
      }
    },
    { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
  );

  projectPieces.forEach((el) => io.observe(el));
  simpleBlocks.forEach((el) => io.observe(el));
});
