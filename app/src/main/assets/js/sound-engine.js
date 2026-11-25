(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.SoundEngine = api.SoundEngine;
  root.SoundEngine = api.SoundEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Procedural Web Audio API Synthesizer + Haptics Coordinator (Zero External Assets).
   * Supports cutscene silence gating (stops background penguin audio & haptics immediately
   * upon Rebirth confirmation) and a festive 10-second winter soundtrack for the Rebirth cutscene.
   */
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.masterVolume = 1.0;
      this.sfxVolume = 1.0;
      this.ambientVolume = 1.0;
      this.hapticsEnabled = true;
      this.lastHapticAt = 0;
      this._inCanvasPointerDown = false;
      this._nativeLabelTapActive = false;
      this._nativeLabelTapResetTimer = null;
      this._pendingIosHaptic = null;
      this._lastUserGestureAt = 0;
      this.ambientReady = false;
      this.ambientWeatherId = 'clear';
      this.isBackgrounded = false;
      this.cutsceneMode = false;
      this._lastAmbienceKey = '';
      this.masterGain = null;
      this.sfxGain = null;
      this.ambientGain = null;
      this.windGain = null;
      this.snowGain = null;
      this.windFilter = null;
      this.snowFilter = null;
      this.windLfoGain = null;
      this._activeWinterScore = null;
    }

    init() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        try { this.ctx.resume(); } catch (_) {}
      }
      this.initAudioRouting();
      this.setupAmbientWeatherNodes();
      this.applyVolumes(true);
      this.syncWeatherAmbience(true);
    }

    initAudioRouting() {
      if (!this.ctx || this.ctx.state === 'closed' || this.masterGain) return;
      if (typeof this.ctx.createGain !== 'function') return;
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    getSfxOutput() {
      return this.sfxGain || (this.ctx ? this.ctx.destination : null);
    }

    canPlayGameplaySfx() {
      return !this.cutsceneMode && !this.muted && !this.isBackgrounded &&
        Boolean(this.ctx) && this.ctx.state !== 'closed' &&
        this.masterVolume > 0 && this.sfxVolume > 0;
    }

    canPlayCutsceneAudio() {
      return !this.muted && !this.isBackgrounded &&
        Boolean(this.ctx) && this.ctx.state !== 'closed' &&
        this.masterVolume > 0 && this.sfxVolume > 0;
    }

    /**
     * Immediately silences all background penguin/colony SFX, ambient weather wind,
     * and non-cutscene haptics while the Rebirth cutscene is active.
     */
    setCutsceneMode(active) {
      this.cutsceneMode = Boolean(active);
      if (this.cutsceneMode) {
        this._pendingIosHaptic = null;
      } else if (this._activeWinterScore) {
        try { this._activeWinterScore.stop(); } catch (_) {}
        this._activeWinterScore = null;
      }
      this.syncWeatherAmbience(true);
    }

    applyVolumes(immediate = false) {
      if (!this.ctx || this.ctx.state === 'closed' || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const active = !this.muted && !this.isBackgrounded;
      const mVal = active ? Math.max(0, Math.min(1, this.masterVolume)) : 0;
      const sVal = Math.max(0, Math.min(1, this.sfxVolume));
      const aVal = this.cutsceneMode ? 0 : Math.max(0, Math.min(1, this.ambientVolume));

      if (immediate) {
        this.masterGain.gain.setValueAtTime(mVal, now);
        if (this.sfxGain) this.sfxGain.gain.setValueAtTime(sVal, now);
        if (this.ambientGain) this.ambientGain.gain.setValueAtTime(aVal, now);
      } else {
        this.masterGain.gain.setTargetAtTime(mVal, now, 0.04);
        if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(sVal, now, 0.04);
        if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(aVal, now, 0.06);
      }
    }

    setupAmbientWeatherNodes() {
      if (this.ambientReady || !this.ctx || this.ctx.state === 'closed') return;
      if (
        typeof this.ctx.createBuffer !== 'function' ||
        typeof this.ctx.createBufferSource !== 'function' ||
        typeof this.ctx.createBiquadFilter !== 'function'
      ) {
        return;
      }
      try {
        this.initAudioRouting();
        const ambDest = this.ambientGain || this.ctx.destination;
        const sampleRate = this.ctx.sampleRate || 44100;
        const length = sampleRate * 3;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.950 * b2 + white * 0.048;
          b3 = 0.850 * b3 + white * 0.080;
          data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3) * 0.65));
        }
        const fadeSamples = Math.min(2048, Math.floor(length * 0.05));
        for (let i = 0; i < fadeSamples; i++) {
          const k = i / fadeSamples;
          const tailIdx = length - fadeSamples + i;
          data[i] = data[i] * k + data[tailIdx] * (1 - k);
        }

        const windSource = this.ctx.createBufferSource();
        windSource.buffer = buffer;
        windSource.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
        this.windFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

        const windLfo = this.ctx.createOscillator();
        windLfo.type = 'sine';
        windLfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
        this.windLfoGain = this.ctx.createGain();
        this.windLfoGain.gain.setValueAtTime(70, this.ctx.currentTime);
        windLfo.connect(this.windLfoGain);
        this.windLfoGain.connect(this.windFilter.frequency);

        windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(ambDest);

        const snowSource = this.ctx.createBufferSource();
        snowSource.buffer = buffer;
        snowSource.loop = true;
        snowSource.loopStart = 0.7;

        this.snowFilter = this.ctx.createBiquadFilter();
        this.snowFilter.type = 'bandpass';
        this.snowFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
        this.snowFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

        this.snowGain = this.ctx.createGain();
        this.snowGain.gain.setValueAtTime(0, this.ctx.currentTime);

        snowSource.connect(this.snowFilter);
        this.snowFilter.connect(this.snowGain);
        this.snowGain.connect(ambDest);

        const startTime = this.ctx.currentTime;
        windLfo.start(startTime);
        windSource.start(startTime);
        snowSource.start(startTime);

        this.ambientReady = true;
      } catch (_) {
        this.ambientReady = false;
      }
    }

    getWeatherAudioProfile(weatherId) {
      if (weatherId === 'blizzard') {
        return { windVol: 0.115, snowVol: 0.055, windFreq: 520, windQ: 2.5, lfoDepth: 250, snowFreq: 2600 };
      }
      if (weatherId === 'light_snow') {
        return { windVol: 0.032, snowVol: 0.018, windFreq: 350, windQ: 1.9, lfoDepth: 110, snowFreq: 2100 };
      }
      return { windVol: 0.012, snowVol: 0.0, windFreq: 250, windQ: 1.6, lfoDepth: 55, snowFreq: 1800 };
    }

    setWeather(weatherId) {
      if (weatherId && weatherId !== this.ambientWeatherId) {
        this.ambientWeatherId = weatherId;
      }
      this.syncWeatherAmbience();
    }

    setBackgrounded(hidden) {
      this.isBackgrounded = Boolean(hidden);
      this.applyVolumes(true);
      this.syncWeatherAmbience(true);
    }

    syncWeatherAmbience(fast = false) {
      this.applyVolumes(fast);
      if (!this.ambientReady || !this.ctx || !this.windGain || !this.snowGain) return;
      const active = !this.cutsceneMode && !this.muted && !this.isBackgrounded &&
        this.masterVolume > 0 && this.ambientVolume > 0 && this.ctx.state !== 'closed';
      const key = `${this.ambientWeatherId}|${active}|${this.cutsceneMode}|${this.ambientVolume.toFixed(2)}|${this.masterVolume.toFixed(2)}`;
      if (!fast && this._lastAmbienceKey === key) return;
      this._lastAmbienceKey = key;

      const now = this.ctx.currentTime;
      const tau = fast ? 0.06 : 0.45;
      const profile = this.getWeatherAudioProfile(this.ambientWeatherId);

      this.windGain.gain.setTargetAtTime(active ? profile.windVol : 0, now, tau);
      this.snowGain.gain.setTargetAtTime(active ? profile.snowVol : 0, now, tau);

      if (this.windFilter && this.snowFilter && this.windLfoGain) {
        this.windFilter.frequency.setTargetAtTime(profile.windFreq, now, tau);
        this.windFilter.Q.setTargetAtTime(profile.windQ, now, tau);
        this.windLfoGain.gain.setTargetAtTime(profile.lfoDepth, now, tau);
        this.snowFilter.frequency.setTargetAtTime(profile.snowFreq, now, tau);
      }
    }

    isActive() {
      return !this.muted && !this.isBackgrounded && this.masterVolume > 0 && Boolean(this.ctx) && this.ctx.state !== 'closed';
    }

    isEnabledForGesture() {
      return !this.muted && !this.isBackgrounded && this.masterVolume > 0 && (!this.ctx || this.ctx.state !== 'closed');
    }

    isIOSDevice() {
      if (typeof navigator === 'undefined') return false;
      const ua = navigator.userAgent || '';
      const platform = navigator.platform || '';
      const maxTouch = navigator.maxTouchPoints || 0;
      return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouch > 1);
    }

    syncIosHapticDomState() {
      if (typeof document === 'undefined') return;
      const shouldWire = this.isIOSDevice() && this.hapticsEnabled && this.isEnabledForGesture() && !this.cutsceneMode;
      const switchEl = document.getElementById('ios-haptic-switch');
      if (switchEl) {
        switchEl.disabled = !shouldWire;
      }
      const labels = document.querySelectorAll('[data-ios-haptic-label]');
      labels.forEach((el) => {
        const wantsHaptic = shouldWire && el.getAttribute('data-ios-haptic-label') !== '0';
        if (wantsHaptic) {
          if (el.getAttribute('for') !== 'ios-haptic-switch') {
            el.setAttribute('for', 'ios-haptic-switch');
          }
        } else if (el.hasAttribute('for')) {
          el.removeAttribute('for');
        }
      });
    }

    markUserGesture() {
      this._lastUserGestureAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    hasRecentUserGesture() {
      if (typeof navigator !== 'undefined' && navigator.userActivation && navigator.userActivation.isActive) {
        return true;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return (now - this._lastUserGestureAt) < 350;
    }

    postWKWebViewHaptic(kind = 'tap') {
      try {
        const handlers = typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers;
        if (handlers) {
          if (handlers.triggerHaptic && typeof handlers.triggerHaptic.postMessage === 'function') {
            handlers.triggerHaptic.postMessage(kind);
            return true;
          }
          if (handlers.hapticFeedback && typeof handlers.hapticFeedback.postMessage === 'function') {
            handlers.hapticFeedback.postMessage({ type: kind });
            return true;
          }
          if (handlers.haptic && typeof handlers.haptic.postMessage === 'function') {
            handlers.haptic.postMessage(kind);
            return true;
          }
        }
      } catch (_) {}
      return false;
    }

    fireIOSHaptic(kind = 'tap', allowNonGesture = false) {
      try {
        if (this.postWKWebViewHaptic(kind)) return true;
        if (this._nativeLabelTapActive) return true;
        if (!allowNonGesture && !this.hasRecentUserGesture()) return false;
        const labelEl = document.getElementById('ios-haptic-label');
        if (labelEl && typeof labelEl.click === 'function') {
          labelEl.click();
          return true;
        }
        const switchEl = document.getElementById('ios-haptic-switch');
        if (switchEl && typeof switchEl.click === 'function') {
          switchEl.click();
          return true;
        }
      } catch (_) {}
      return false;
    }

    flushPendingIosHaptic() {
      const kind = this._pendingIosHaptic;
      if (!kind) return false;
      this._pendingIosHaptic = null;
      if (this.cutsceneMode || !this.hapticsEnabled || !this.isActive()) return false;
      this.markUserGesture();
      return this.fireIOSHaptic(kind, true);
    }

    triggerHaptic(kind = 'tap', minGapMs = 0, options = {}) {
      if (!this.hapticsEnabled || this.isBackgrounded) return false;
      if (this.cutsceneMode && !(options && options.allowInCutscene)) return false;
      if (!(options && options.allowInCutscene) && !this.isActive()) return false;
      if ((options && options.allowInCutscene) && this.muted) return false;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (minGapMs > 0 && (now - this.lastHapticAt) < minGapMs) return false;
      this.lastHapticAt = now;

      try {
        if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.triggerHaptic === 'function') {
          return Boolean(window.AndroidBridge.triggerHaptic(kind));
        }
        if (this.isIOSDevice()) {
          if (this.postWKWebViewHaptic(kind)) return true;
          if (this._nativeLabelTapActive) return true;
          if (this._inCanvasPointerDown) {
            this._pendingIosHaptic = kind;
            return true;
          }
          return this.fireIOSHaptic(kind, false);
        }
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          const ms = kind === 'celebrate' ? 34 : kind === 'collect' ? 26 : kind === 'penguin_tap' ? 20 : 14;
          return Boolean(navigator.vibrate(ms));
        }
      } catch (_) {}
      return false;
    }

    playPlink() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const freq = 1200 + Math.random() * 400;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playChirp() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.linearRampToValueAtTime(2200, now + 0.06);
      osc.frequency.linearRampToValueAtTime(1600, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    playSlide() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    playSplash() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.16);
    }

    playLevelUp(options = {}) {
      const allowed = (options && options.allowInCutscene) ? this.canPlayCutsceneAudio() : this.canPlayGameplaySfx();
      if (!allowed) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
        osc.connect(gain);
        gain.connect(out);
        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
      });
    }

    playBuzzer() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(110, now);
      osc2.frequency.setValueAtTime(116, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(out);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    }

    playAuroraAlert() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const chimeNotes = [587.33, 739.99, 880.00, 1174.66, 1479.98];
      chimeNotes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t0 = now + idx * 0.16;
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.03, t0 + 0.25);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.16, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, Math.min(now + 0.98, t0 + 0.34));
        osc.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(Math.min(now + 1.0, t0 + 0.36));
      });
    }

    playAuroraChord() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      const now = this.ctx.currentTime;
      const chord = [392.00, 493.88, 587.33, 783.99];
      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.08, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now + i * 0.04);
        osc.stop(now + 1.2);
      });
    }

    /**
     * Celebratory opening chime fanfare when the 15-minute Penguin Parade begins.
     * Uses sparkling celesta/glockenspiel bell tones gated by gameplay SFX & cutscene silence.
     */
    playParadeFanfare() {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      try {
        const now = this.ctx.currentTime;
        // Bright joyful C-major winter bell fanfare: C5 -> E5 -> G5 -> C6 -> D6 -> E6 -> G6
        const fanfare = [
          { at: 0.00, freq: 523.25, dur: 0.36, vol: 0.14 },
          { at: 0.10, freq: 659.25, dur: 0.36, vol: 0.14 },
          { at: 0.20, freq: 783.99, dur: 0.40, vol: 0.15 },
          { at: 0.31, freq: 1046.50, dur: 0.52, vol: 0.16 },
          { at: 0.44, freq: 1174.66, dur: 0.38, vol: 0.14 },
          { at: 0.55, freq: 1318.51, dur: 0.62, vol: 0.16 },
          { at: 0.69, freq: 1567.98, dur: 0.78, vol: 0.15 }
        ];
        fanfare.forEach((n) => {
          const t0 = now + n.at;
          const mainOsc = this.ctx.createOscillator();
          const overOsc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          const og = this.ctx.createGain();

          mainOsc.type = 'sine';
          mainOsc.frequency.setValueAtTime(n.freq, t0);
          overOsc.type = 'triangle';
          overOsc.frequency.setValueAtTime(n.freq * 2.0, t0);

          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(n.vol, t0 + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);

          og.gain.setValueAtTime(0.0001, t0);
          og.gain.linearRampToValueAtTime(n.vol * 0.26, t0 + 0.008);
          og.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur * 0.55);

          mainOsc.connect(g);
          overOsc.connect(og);
          og.connect(g);
          g.connect(out);

          mainOsc.start(t0);
          overOsc.start(t0);
          mainOsc.stop(t0 + n.dur + 0.03);
          overOsc.stop(t0 + n.dur + 0.03);
        });
      } catch (_) {}
    }

    /**
     * Light periodic celebratory chime motif played while penguins march across the glacier.
     */
    playParadeChimeStep(stepIndex = 0) {
      if (!this.canPlayGameplaySfx()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      try {
        const now = this.ctx.currentTime;
        const motifs = [
          [1046.50, 1318.51, 1567.98], // C6 - E6 - G6
          [1174.66, 1567.98, 1760.00], // D6 - G6 - A6
          [1318.51, 1567.98, 2093.00], // E6 - G6 - C7
          [1174.66, 1318.51, 1567.98]  // D6 - E6 - G6
        ];
        const safeIdx = Math.abs(Math.floor(Number(stepIndex) || 0)) % motifs.length;
        const notes = motifs[safeIdx];
        notes.forEach((freq, i) => {
          const t0 = now + i * 0.11;
          const dur = i === notes.length - 1 ? 0.52 : 0.30;
          const osc = this.ctx.createOscillator();
          const shimmer = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          const sg = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          shimmer.type = 'triangle';
          shimmer.frequency.setValueAtTime(freq * 2.0, t0);

          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.095, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

          sg.gain.setValueAtTime(0.0001, t0);
          sg.gain.linearRampToValueAtTime(0.024, t0 + 0.008);
          sg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.5);

          osc.connect(g);
          shimmer.connect(sg);
          sg.connect(g);
          g.connect(out);

          osc.start(t0);
          shimmer.start(t0);
          osc.stop(t0 + dur + 0.03);
          shimmer.stop(t0 + dur + 0.03);
        });
      } catch (_) {}
    }

    // --- FUN WINTER-THEMED PROCEDURAL REBIRTH CUTSCENE SOUNDTRACK (10-SECOND ARC) ---

    _createNoiseBuffer(durationSec = 0.25) {
      if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;
      const sr = this.ctx.sampleRate || 44100;
      const len = Math.max(256, Math.floor(sr * durationSec));
      const buf = this.ctx.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    playWinterBellNote(dest, freq, startOffsetSec = 0, durationSec = 0.42, volume = 0.14, activeNodes = null) {
      if (!this.canPlayCutsceneAudio() || !dest) return;
      const now = this.ctx.currentTime + Math.max(0, startOffsetSec);
      const mainOsc = this.ctx.createOscillator();
      const sparkleOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const sparkleGain = this.ctx.createGain();

      // Celesta / glockenspiel bell voice (pure fundamental + soft 2nd/3rd crystalline shimmer)
      mainOsc.type = 'sine';
      mainOsc.frequency.setValueAtTime(freq, now);
      sparkleOsc.type = 'triangle';
      sparkleOsc.frequency.setValueAtTime(freq * 2.0, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      sparkleGain.gain.setValueAtTime(0.0001, now);
      sparkleGain.gain.linearRampToValueAtTime(volume * 0.28, now + 0.008);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 0.55);

      mainOsc.connect(gain);
      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(gain);
      gain.connect(dest);

      mainOsc.start(now);
      sparkleOsc.start(now);
      mainOsc.stop(now + durationSec + 0.03);
      sparkleOsc.stop(now + durationSec + 0.03);

      if (activeNodes) {
        activeNodes.push(mainOsc, sparkleOsc);
      }
    }

    playSleighBellShake(dest, startOffsetSec = 0, intensity = 0.7, activeNodes = null) {
      if (!this.canPlayCutsceneAudio() || !dest) return;
      const noiseBuf = this._createNoiseBuffer(0.16);
      if (!noiseBuf || typeof this.ctx.createBufferSource !== 'function') return;

      const now = this.ctx.currentTime + Math.max(0, startOffsetSec);
      const lvl = Math.max(0.2, Math.min(1.2, intensity));

      // Crisp metallic jingle noise burst (bandpass around 6.8 kHz)
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(6400 + Math.random() * 1400, now);
      bp.Q.setValueAtTime(4.5, now);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.095 * lvl, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(now);
      src.stop(now + 0.15);
      if (activeNodes) activeNodes.push(src);

      // Pair of bright tiny brass jingle partials
      [3520, 4698.6].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const og = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * (1 + (Math.random() - 0.5) * 0.015), now + idx * 0.014);
        og.gain.setValueAtTime(0.0001, now + idx * 0.014);
        og.gain.linearRampToValueAtTime(0.026 * lvl, now + idx * 0.014 + 0.008);
        og.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.014 + 0.11);
        osc.connect(og);
        og.connect(dest);
        osc.start(now + idx * 0.014);
        osc.stop(now + idx * 0.014 + 0.13);
        if (activeNodes) activeNodes.push(osc);
      });
    }

    playIceCrackle(intensity = 0.65) {
      if (!this.canPlayCutsceneAudio()) return;
      const out = this.getSfxOutput();
      if (!out) return;
      try {
        const now = this.ctx.currentTime;
        const level = Math.max(0.2, Math.min(1.2, intensity));
        const ping = this.ctx.createOscillator();
        const pingGain = this.ctx.createGain();
        const baseFreq = 1800 + Math.random() * 1700;
        ping.type = 'triangle';
        ping.frequency.setValueAtTime(baseFreq, now);
        ping.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + 0.13);
        pingGain.gain.setValueAtTime(0.08 * level, now);
        pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        ping.connect(pingGain);
        pingGain.connect(out);
        ping.start(now);
        ping.stop(now + 0.16);
      } catch (_) {}
    }

    /**
     * Starts a joyful, magical winter-themed procedural Web Audio soundtrack
     * synchronized to the 10-second Glacial Rebirth animation.
     */
    startPrestigeWinterScore() {
      const noopCtrl = { update: () => {}, triggerClimax: () => {}, stop: () => {}, isPlaying: false };
      if (!this.canPlayCutsceneAudio()) return noopCtrl;
      const out = this.getSfxOutput();
      if (!out) return noopCtrl;

      if (this._activeWinterScore) {
        try { this._activeWinterScore.stop(); } catch (_) {}
      }

      try {
        const now = this.ctx.currentTime;
        const scoreBus = this.ctx.createGain();
        scoreBus.gain.setValueAtTime(0.001, now);
        scoreBus.gain.linearRampToValueAtTime(1.0, now + 0.2);
        scoreBus.connect(out);

        const activeNodes = [];
        let stopped = false;
        let climaxTriggered = false;

        // Soft magical polar breeze bed (gentle bandpass shimmer, not harsh rumble)
        let breezeGain = null;
        let breezeFilter = null;
        const windBuf = this._createNoiseBuffer(2.0);
        if (windBuf && typeof this.ctx.createBufferSource === 'function') {
          const breezeSrc = this.ctx.createBufferSource();
          breezeSrc.buffer = windBuf;
          breezeSrc.loop = true;
          breezeFilter = this.ctx.createBiquadFilter();
          breezeFilter.type = 'bandpass';
          breezeFilter.frequency.setValueAtTime(520, now);
          breezeFilter.Q.setValueAtTime(2.2, now);
          breezeGain = this.ctx.createGain();
          breezeGain.gain.setValueAtTime(0.0001, now);
          breezeGain.gain.linearRampToValueAtTime(0.028, now + 0.5);
          breezeSrc.connect(breezeFilter);
          breezeFilter.connect(breezeGain);
          breezeGain.connect(scoreBus);
          breezeSrc.start(now);
          activeNodes.push(breezeSrc);
        }

        // Warm twinkling winter pad chord (C4 + G4 soft sine)
        const padGain = this.ctx.createGain();
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.linearRampToValueAtTime(0.035, now + 0.7);
        padGain.connect(scoreBus);
        [261.63, 392.00].forEach((freq) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(padGain);
          osc.start(now);
          activeNodes.push(osc);
        });

        // Cheerful winter celesta/glockenspiel cues across 0.0s -> 9.4s
        // Playful C-major winter wonderland motif -> rising frost arpeggio -> snowfall finale
        const melodyCues = [
          // Act 1 (0.0 - 5.35s): Sparkling winter enchantment buildup
          { at: 0.15, freq: 523.25, dur: 0.42, vol: 0.12, sleigh: 0.55 }, // C5
          { at: 0.48, freq: 659.25, dur: 0.38, vol: 0.12 },               // E5
          { at: 0.80, freq: 783.99, dur: 0.44, vol: 0.13, sleigh: 0.60 }, // G5
          { at: 1.15, freq: 1046.50, dur: 0.50, vol: 0.14 },              // C6
          { at: 1.50, freq: 987.77, dur: 0.38, vol: 0.12, sleigh: 0.65 }, // B5
          { at: 1.82, freq: 783.99, dur: 0.42, vol: 0.12 },               // G5
          { at: 2.18, freq: 659.25, dur: 0.40, vol: 0.13, sleigh: 0.65 }, // E5
          { at: 2.52, freq: 880.00, dur: 0.46, vol: 0.13 },               // A5
          { at: 2.86, freq: 783.99, dur: 0.38, vol: 0.13, sleigh: 0.72 }, // G5
          { at: 3.16, freq: 698.46, dur: 0.36, vol: 0.13 },               // F5
          { at: 3.46, freq: 783.99, dur: 0.38, vol: 0.14, sleigh: 0.78 }, // G5
          { at: 3.76, freq: 880.00, dur: 0.36, vol: 0.14 },               // A5
          { at: 4.04, freq: 987.77, dur: 0.36, vol: 0.15, sleigh: 0.85 }, // B5
          { at: 4.30, freq: 1046.50, dur: 0.38, vol: 0.15 },              // C6
          { at: 4.54, freq: 1174.66, dur: 0.36, vol: 0.16, sleigh: 0.92 },// D6
          { at: 4.78, freq: 1318.51, dur: 0.38, vol: 0.16 },              // E6
          { at: 5.02, freq: 1479.98, dur: 0.40, vol: 0.17, sleigh: 1.0 }, // F#6 (aurora shimmer!)
          { at: 5.26, freq: 1567.98, dur: 0.55, vol: 0.17 },              // G6 (breath-hold peak)
          // Act 3 (6.8 - 9.2s): Joyful snowfall music-box coda after climax
          { at: 6.85, freq: 1318.51, dur: 0.46, vol: 0.12, sleigh: 0.55 },// E6
          { at: 7.20, freq: 1046.50, dur: 0.44, vol: 0.11 },              // C6
          { at: 7.55, freq: 1174.66, dur: 0.42, vol: 0.11, sleigh: 0.5 }, // D6
          { at: 7.88, freq: 987.77, dur: 0.46, vol: 0.10 },               // B5
          { at: 8.22, freq: 1046.50, dur: 0.65, vol: 0.11, sleigh: 0.45 },// C6
          { at: 8.62, freq: 783.99, dur: 0.60, vol: 0.09 },               // G5
          { at: 9.00, freq: 1046.50, dur: 0.85, vol: 0.08 }               // C6 warm resolve
        ];
        let nextCueIdx = 0;

        const ctrl = {
          isPlaying: true,
          update: (tSec) => {
            if (stopped || !this.ctx) return;
            const t = Math.max(0, Number(tSec) || 0);
            while (nextCueIdx < melodyCues.length && t >= melodyCues[nextCueIdx].at) {
              const cue = melodyCues[nextCueIdx++];
              this.playWinterBellNote(scoreBus, cue.freq, 0, cue.dur, cue.vol, activeNodes);
              if (cue.sleigh) {
                this.playSleighBellShake(scoreBus, 0.02, cue.sleigh, activeNodes);
              }
            }
            const cur = this.ctx.currentTime;
            if (breezeFilter && breezeGain) {
              if (t < 5.4) {
                const u = t / 5.4;
                breezeFilter.frequency.setTargetAtTime(520 + u * 880, cur, 0.08);
                breezeGain.gain.setTargetAtTime(this.muted ? 0.0001 : (0.024 + u * 0.036), cur, 0.08);
              } else if (t < 6.0) {
                // Brief winter hush before climax burst
                breezeGain.gain.setTargetAtTime(0.008, cur, 0.06);
              } else {
                const fadeOut = Math.max(0, 1 - (t - 6.0) / 3.6);
                breezeFilter.frequency.setTargetAtTime(900 - (1 - fadeOut) * 450, cur, 0.1);
                breezeGain.gain.setTargetAtTime(this.muted ? 0.0001 : (0.025 * fadeOut), cur, 0.1);
              }
            }
            if (t >= 8.9) {
              const tail = Math.max(0.0001, 1 - (t - 8.9) / 1.0);
              scoreBus.gain.setTargetAtTime(tail, cur, 0.08);
            }
          },
          triggerClimax: () => {
            if (stopped || climaxTriggered || !this.canPlayCutsceneAudio()) return;
            climaxTriggered = true;
            try {
              const t0 = this.ctx.currentTime;
              // 1. Warm sparkling aurora choir chord (C4, E4, G4, B4, C5)
              const chord = [261.63, 329.63, 392.00, 493.88, 523.25];
              chord.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const filt = this.ctx.createBiquadFilter();
                const g = this.ctx.createGain();
                osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
                osc.frequency.setValueAtTime(freq, t0 + idx * 0.025);
                filt.type = 'lowpass';
                filt.frequency.setValueAtTime(1800, t0);
                g.gain.setValueAtTime(0.0001, t0 + idx * 0.025);
                g.gain.linearRampToValueAtTime(0.075, t0 + idx * 0.025 + 0.08);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.85);
                osc.connect(filt);
                filt.connect(g);
                g.connect(scoreBus);
                osc.start(t0 + idx * 0.025);
                osc.stop(t0 + 1.95);
                activeNodes.push(osc);
              });

              // 2. Festive sleigh-bell celebration burst
              this.playSleighBellShake(scoreBus, 0.0, 1.15, activeNodes);
              this.playSleighBellShake(scoreBus, 0.18, 0.9, activeNodes);

              // 3. Cascading crystal icicle harp glissando
              const gliss = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
              gliss.forEach((freq, idx) => {
                this.playWinterBellNote(scoreBus, freq, 0.04 + idx * 0.055, 0.65, 0.13, activeNodes);
              });
            } catch (_) {}
          },
          stop: () => {
            if (stopped) return;
            stopped = true;
            ctrl.isPlaying = false;
            try {
              const cur = this.ctx ? this.ctx.currentTime : 0;
              scoreBus.gain.cancelScheduledValues(cur);
              scoreBus.gain.setTargetAtTime(0.0001, cur, 0.04);
              activeNodes.forEach((node) => {
                try { node.stop(cur + 0.16); } catch (_) {}
              });
            } catch (_) {}
            if (this._activeWinterScore === ctrl) {
              this._activeWinterScore = null;
            }
          }
        };

        this._activeWinterScore = ctrl;
        return ctrl;
      } catch (_) {
        return noopCtrl;
      }
    }

    // Legacy compatibility wrapper
    startPrestigeRumble() {
      const score = this.startPrestigeWinterScore();
      return {
        updateIntensity: (u) => score.update(u * 5.2),
        stop: () => score.stop()
      };
    }

    playPrestigeClimaxFanfare() {
      if (this._activeWinterScore && typeof this._activeWinterScore.triggerClimax === 'function') {
        this._activeWinterScore.triggerClimax();
        return;
      }
      this.playLevelUp({ allowInCutscene: true });
    }
  }

  return { SoundEngine };
});
