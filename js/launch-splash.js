(function (globalScope) {
  'use strict';

  function isReducedMotionPreferred() {
    return Boolean(
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  class LaunchSplashController {
    constructor() {
      this.isActive = Boolean(typeof document !== 'undefined' && document.getElementById('launch-splash-screen'));
      this.durationMs = 0;
      this.progress = 0;
      this.rafId = null;
      this.safetyTimeoutId = null;
      this.snowFlakes = [];
      this.canvas = null;
      this.ctx = null;
      this.lastFrameTime = 0;
      this.onCompleteCallback = null;
      this.onBeforeFadeOutCallback = null;
      this._boundResize = null;
      this._hasFinished = false;
      this.flavorSteps = [
        { at: 0, text: 'Polishing the ice shelf...' },
        { at: 22, text: 'Waking the Emperor penguins...' },
        { at: 46, text: 'Chiseling deep fishing holes...' },
        { at: 70, text: 'Tuning Aurora Borealis crystals...' },
        { at: 88, text: 'Stocking the Igloo Fish Depot...' },
        { at: 100, text: 'Colony ready for expedition!' }
      ];
    }

    // Randomized duration strictly between 1500ms (1.5s) and 4000ms (4.0s)
    generateRandomDurationMs() {
      return Math.round(1500 + Math.random() * 2500);
    }

    // Smooth monotonic curve (0 -> 1) with realistic staggered micro-pauses
    computeStaggeredProgress(normT) {
      const t = Math.max(0, Math.min(1, normT));
      const base = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const ripple = Math.sin(t * Math.PI * 5) * 0.018 * Math.sin(t * Math.PI);
      return Math.max(0, Math.min(1, base + ripple));
    }

    getFlavorForPercent(pct) {
      let current = this.flavorSteps[0].text;
      for (let i = 0; i < this.flavorSteps.length; i++) {
        if (pct >= this.flavorSteps[i].at) {
          current = this.flavorSteps[i].text;
        }
      }
      return current;
    }

    setupSnowCanvas() {
      const el = document.getElementById('splash-snow-canvas');
      if (!el || typeof el.getContext !== 'function') return;
      this.canvas = el;
      this.ctx = el.getContext('2d');
      const resize = () => {
        if (!this.canvas || !this.ctx) return;
        const dprVal = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 360);
        const h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 640);
        this.canvas.width = Math.floor(w * dprVal);
        this.canvas.height = Math.floor(h * dprVal);
        this.ctx.setTransform(dprVal, 0, 0, dprVal, 0, 0);
        this.viewW = w;
        this.viewH = h;
        const targetCount = Math.max(26, Math.min(68, Math.round((w * h) / 14000)));
        if (this.snowFlakes.length === 0) {
          for (let i = 0; i < targetCount; i++) {
            this.snowFlakes.push({
              x: Math.random() * w,
              y: Math.random() * h,
              r: 1.1 + Math.random() * 2.5,
              speedY: 18 + Math.random() * 38,
              driftX: (Math.random() - 0.5) * 16,
              phase: Math.random() * Math.PI * 2,
              alpha: 0.25 + Math.random() * 0.65
            });
          }
        }
      };
      resize();
      this._boundResize = resize;
      window.addEventListener('resize', resize);
    }

    renderSnow(dtSec) {
      if (!this.ctx || !this.viewW || !this.viewH) return;
      const c = this.ctx;
      c.clearRect(0, 0, this.viewW, this.viewH);
      for (let i = 0; i < this.snowFlakes.length; i++) {
        const f = this.snowFlakes[i];
        f.phase += dtSec * 1.4;
        f.y += f.speedY * dtSec;
        f.x += (f.driftX + Math.sin(f.phase) * 12) * dtSec;
        if (f.y > this.viewH + 6) {
          f.y = -6;
          f.x = Math.random() * this.viewW;
        }
        if (f.x < -8) f.x = this.viewW + 8;
        if (f.x > this.viewW + 8) f.x = -8;

        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(224, 242, 254, ${f.alpha})`;
        c.fill();
      }
    }

    start(onComplete, onBeforeFadeOut, options = {}) {
      const root = document.getElementById('launch-splash-screen');
      let skipOnce = false;
      try {
        if (sessionStorage.getItem('PGE_SKIP_SPLASH_ONCE') === '1') {
          sessionStorage.removeItem('PGE_SKIP_SPLASH_ONCE');
          skipOnce = true;
        }
      } catch (_) {}

      if (!root || skipOnce) {
        if (root) {
          root.classList.add('splash-hidden');
        }
        this.isActive = false;
        if (typeof onBeforeFadeOut === 'function') onBeforeFadeOut();
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      this._hasFinished = false;
      this.isActive = true;
      this.onCompleteCallback = typeof onComplete === 'function' ? onComplete : null;
      this.onBeforeFadeOutCallback = typeof onBeforeFadeOut === 'function' ? onBeforeFadeOut : null;
      const reduced = isReducedMotionPreferred();
      this.durationMs = reduced ? 650 : this.generateRandomDurationMs();
      this.progress = 0;

      const versionEl = document.getElementById('splash-version-label');
      const versionStr = options && options.version
        ? options.version
        : (typeof globalScope.LATEST_FEATURE_RELEASE !== 'undefined' && globalScope.LATEST_FEATURE_RELEASE
            ? globalScope.LATEST_FEATURE_RELEASE.version
            : null);
      if (versionEl && versionStr) {
        versionEl.textContent = `v${versionStr}`;
      }

      const fillEl = document.getElementById('splash-gauge-fill');
      const sliderPenguinEl = document.getElementById('splash-slider-penguin');
      const pctEl = document.getElementById('splash-percent-badge');
      const flavorEl = document.getElementById('splash-flavor-text');
      const barEl = document.getElementById('splash-progressbar');

      this.setupSnowCanvas();
      const startPerf = performance.now();
      this.lastFrameTime = startPerf;
      let lastFlavor = '';
      let maxPctShown = 0;

      const finishSplash = () => {
        if (this._hasFinished) return;
        this._hasFinished = true;
        if (this.rafId != null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.safetyTimeoutId != null) {
          clearTimeout(this.safetyTimeoutId);
          this.safetyTimeoutId = null;
        }
        if (fillEl) fillEl.style.width = '100%';
        if (sliderPenguinEl) sliderPenguinEl.style.left = '100%';
        if (pctEl) pctEl.textContent = '100%';
        if (barEl) barEl.setAttribute('aria-valuenow', '100');

        if (this.onBeforeFadeOutCallback) {
          const preCb = this.onBeforeFadeOutCallback;
          this.onBeforeFadeOutCallback = null;
          preCb();
        }
        root.classList.add('splash-fade-out');
        const fadeDelayMs = reduced ? 40 : 480;
        setTimeout(() => {
          root.classList.add('splash-hidden');
          if (this._boundResize) {
            window.removeEventListener('resize', this._boundResize);
            this._boundResize = null;
          }
          this.isActive = false;
          if (this.onCompleteCallback) {
            const cb = this.onCompleteCallback;
            this.onCompleteCallback = null;
            cb();
          }
        }, fadeDelayMs);
      };

      // Wall-clock safety fallback: prevents splash from stalling if rAF is throttled on cold WebView start
      this.safetyTimeoutId = setTimeout(finishSplash, this.durationMs + 750);

      const tick = (now) => {
        if (this._hasFinished) return;
        const rawDt = (now - this.lastFrameTime) / 1000;
        const dtSec = (Number.isFinite(rawDt) && rawDt > 0) ? Math.min(0.05, rawDt) : 0.016;
        this.lastFrameTime = now;
        if (!reduced) {
          this.renderSnow(dtSec);
        }

        const elapsed = Math.max(0, now - startPerf);
        const normT = elapsed >= this.durationMs - 1 ? 1 : Math.min(1, elapsed / this.durationMs);
        const eased = this.computeStaggeredProgress(normT);
        const pct = normT >= 1 ? 100 : Math.max(maxPctShown, Math.min(99, Math.round(eased * 100)));
        maxPctShown = pct;
        this.progress = pct;

        if (fillEl) fillEl.style.width = `${pct}%`;
        if (sliderPenguinEl) sliderPenguinEl.style.left = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (barEl) barEl.setAttribute('aria-valuenow', String(pct));

        const nextFlavor = this.getFlavorForPercent(pct);
        if (flavorEl && nextFlavor !== lastFlavor) {
          lastFlavor = nextFlavor;
          flavorEl.textContent = nextFlavor;
        }

        if (normT >= 1) {
          setTimeout(finishSplash, reduced ? 40 : 180);
          return;
        }
        this.rafId = requestAnimationFrame(tick);
      };

      this.rafId = requestAnimationFrame(tick);
    }
  }

  const api = { LaunchSplashController };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.GlacialCore = globalScope.GlacialCore || {};
    globalScope.GlacialCore.LaunchSplash = api;
    globalScope.LaunchSplashController = LaunchSplashController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
