(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.SkyEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SKY_COMBO_DECAY_SEC = 20;
  const SKY_COMBO_MAX = 5;
  const STARLIGHT_FRENZY_THRESHOLD = 3;
  const STARLIGHT_FRENZY_DURATION_SEC = 15;
  const STARLIGHT_FRENZY_MULTIPLIER = 2;

  const SHOOTING_STAR_MIN_CD = 30;
  const SHOOTING_STAR_MAX_CD = 45;
  const KRILL_SWARM_MIN_CD = 45;
  const KRILL_SWARM_MAX_CD = 65;

  const SHOOTING_STAR_TOUCH_RADIUS = 52;
  const KRILL_SWARM_TOUCH_RADIUS = 50;

  function calculateSkyEventReward(dps, combo, kind) {
    const safeDps = Number.isFinite(Number(dps)) && Number(dps) > 0 ? Number(dps) : 0;
    const safeCombo = Math.max(1, Math.min(SKY_COMBO_MAX, Math.floor(Number(combo) || 1)));
    const secondsFactor = kind === 'krill_swarm' ? 9 : 8;
    const raw = Math.round(safeDps * secondsFactor * safeCombo);
    return Math.max(40, Number.isFinite(raw) ? raw : 40);
  }

  function randomRange(min, max, rng) {
    const r = typeof rng === 'function' ? rng() : Math.random();
    return min + Math.max(0, Math.min(1, r)) * (max - min);
  }

  class SkyMiniEventController {
    constructor(options = {}) {
      this.rng = typeof options.rng === 'function' ? options.rng : Math.random;
      this.starCooldownSec = Number.isFinite(options.initialStarCooldownSec)
        ? Math.max(0.1, options.initialStarCooldownSec)
        : randomRange(18, 30, this.rng);
      this.krillCooldownSec = Number.isFinite(options.initialKrillCooldownSec)
        ? Math.max(0.1, options.initialKrillCooldownSec)
        : randomRange(28, 44, this.rng);

      this.activeStar = null;
      this.activeKrill = null;
      this.comboCount = 0;
      this.comboTimer = 0;
      this._phase = 0;
    }

    resetTransient() {
      this.activeStar = null;
      this.activeKrill = null;
      this.comboCount = 0;
      this.comboTimer = 0;
      this.starCooldownSec = randomRange(SHOOTING_STAR_MIN_CD, SHOOTING_STAR_MAX_CD, this.rng);
      this.krillCooldownSec = randomRange(KRILL_SWARM_MIN_CD, KRILL_SWARM_MAX_CD, this.rng);
    }

    spawnShootingStar(width, height) {
      const w = Math.max(240, Number(width) || 390);
      const h = Math.max(400, Number(height) || 800);
      const dir = this.rng() < 0.5 ? 1 : -1;
      // Keep strictly inside top 8%-18% band so always visible & tappable even above 80% expanded sheet
      const startY = h * randomRange(0.085, 0.145, this.rng);
      const endY = h * randomRange(0.115, 0.175, this.rng);
      const startX = dir === 1 ? -24 : w + 24;
      const endX = dir === 1 ? w + 28 : -28;
      const duration = randomRange(6.2, 7.8, this.rng);

      this.activeStar = {
        kind: 'shooting_star',
        dir,
        startX,
        startY,
        endX,
        endY,
        x: startX,
        y: startY,
        prevX: startX,
        prevY: startY,
        elapsed: 0,
        duration,
        caught: false
      };
      return this.activeStar;
    }

    spawnKrillSwarm(width, height, visibleBottomY) {
      const w = Math.max(240, Number(width) || 390);
      const h = Math.max(400, Number(height) || 800);
      const safeBottom = Number.isFinite(visibleBottomY) ? visibleBottomY : h * 0.48;
      const minY = Math.max(h * 0.36, 125);
      const maxY = Math.min(h * 0.72, safeBottom - 36);
      if (maxY <= minY + 12) return null;

      const cx = w * randomRange(0.16, 0.84, this.rng);
      const cy = randomRange(minY, maxY, this.rng);
      const duration = randomRange(7.5, 9.5, this.rng);

      this.activeKrill = {
        kind: 'krill_swarm',
        baseX: cx,
        baseY: cy,
        x: cx,
        y: cy,
        elapsed: 0,
        duration,
        seed: this.rng() * Math.PI * 2,
        caught: false
      };
      return this.activeKrill;
    }

    update(dt, ctx = {}) {
      const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.25, dt) : 0;
      if (safeDt <= 0) return;

      this._phase += safeDt;

      // Combo decay pauses cleanly while blocked by modals/cutscenes
      if (!ctx.isBlocked && this.comboCount > 0) {
        this.comboTimer = Math.max(0, this.comboTimer - safeDt);
        if (this.comboTimer <= 0) {
          this.comboCount = 0;
        }
      }

      if (ctx.isBlocked) return;

      const width = Number(ctx.width) || 390;
      const height = Number(ctx.height) || 800;
      const sheetExpanded = Boolean(ctx.sheetExpanded);
      const visibleBottomY = Number.isFinite(ctx.visibleBottomY) ? ctx.visibleBottomY : height * 0.48;

      // 1. Shooting Star lifecycle (always active in top 20% sky, even when menu is expanded)
      if (this.activeStar) {
        const s = this.activeStar;
        s.prevX = s.x;
        s.prevY = s.y;
        s.elapsed += safeDt;
        const p = Math.min(1, s.elapsed / s.duration);
        s.x = s.startX + (s.endX - s.startX) * p;
        const arcLift = Math.sin(p * Math.PI) * (-Math.min(26, height * 0.032));
        s.y = s.startY + (s.endY - s.startY) * p + arcLift;
        if (s.elapsed >= s.duration) {
          this.activeStar = null;
          this.starCooldownSec = randomRange(SHOOTING_STAR_MIN_CD, SHOOTING_STAR_MAX_CD, this.rng);
        }
      } else {
        this.starCooldownSec -= safeDt;
        if (this.starCooldownSec <= 0) {
          this.spawnShootingStar(width, height);
        }
      }

      // 2. Krill Swarm lifecycle (only visible on the ice shelf when sheet is NOT expanded to 80%)
      if (this.activeKrill) {
        const k = this.activeKrill;
        k.elapsed += safeDt;
        k.x = k.baseX + Math.sin(k.elapsed * 2.1 + k.seed) * 18;
        k.y = k.baseY + Math.cos(k.elapsed * 2.8 + k.seed) * 6;
        if (k.elapsed >= k.duration || sheetExpanded) {
          this.activeKrill = null;
          this.krillCooldownSec = randomRange(KRILL_SWARM_MIN_CD, KRILL_SWARM_MAX_CD, this.rng);
        }
      } else if (!sheetExpanded) {
        this.krillCooldownSec -= safeDt;
        if (this.krillCooldownSec <= 0) {
          const spawned = this.spawnKrillSwarm(width, height, visibleBottomY);
          if (!spawned) {
            this.krillCooldownSec = 10;
          }
        }
      }
    }

    tryCatch(x, y, opts = {}) {
      const dps = Number(opts.dps) || 0;
      const sheetExpanded = Boolean(opts.sheetExpanded);

      if (this.activeStar && !this.activeStar.caught) {
        const dist = Math.hypot(this.activeStar.x - x, this.activeStar.y - y);
        if (dist <= SHOOTING_STAR_TOUCH_RADIUS) {
          const target = this.activeStar;
          target.caught = true;
          this.activeStar = null;
          this.starCooldownSec = randomRange(SHOOTING_STAR_MIN_CD, SHOOTING_STAR_MAX_CD, this.rng);
          return this._finalizeCatch('shooting_star', target.x, target.y, dps);
        }
      }

      if (!sheetExpanded && this.activeKrill && !this.activeKrill.caught) {
        const dist = Math.hypot(this.activeKrill.x - x, this.activeKrill.y - y);
        if (dist <= KRILL_SWARM_TOUCH_RADIUS) {
          const target = this.activeKrill;
          target.caught = true;
          this.activeKrill = null;
          this.krillCooldownSec = randomRange(KRILL_SWARM_MIN_CD, KRILL_SWARM_MAX_CD, this.rng);
          return this._finalizeCatch('krill_swarm', target.x, target.y, dps);
        }
      }

      return { caught: false };
    }

    _finalizeCatch(kind, x, y, dps) {
      this.comboCount = Math.min(SKY_COMBO_MAX, (this.comboCount || 0) + 1);
      this.comboTimer = SKY_COMBO_DECAY_SEC;
      const rewardFish = calculateSkyEventReward(dps, this.comboCount, kind);
      const frenzyTriggered = this.comboCount >= STARLIGHT_FRENZY_THRESHOLD;
      return {
        caught: true,
        kind,
        x,
        y,
        comboCount: this.comboCount,
        comboTimer: this.comboTimer,
        rewardFish,
        frenzyTriggered,
        frenzyDurationSec: frenzyTriggered ? STARLIGHT_FRENZY_DURATION_SEC : 0
      };
    }

    getHudSnapshot(starlightFrenzyTimer = 0) {
      const frenzySec = Math.max(0, Number(starlightFrenzyTimer) || 0);
      const frenzyActive = frenzySec > 0;
      const visible = this.comboCount > 0 || frenzyActive;
      return {
        visible,
        comboCount: this.comboCount,
        comboTimer: this.comboTimer,
        frenzyActive,
        frenzyRemainingSec: frenzySec
      };
    }

    draw(ctx, opts = {}) {
      if (!ctx) return;
      const sheetExpanded = Boolean(opts.sheetExpanded);

      // Draw Shooting Star in upper polar sky
      if (this.activeStar && !this.activeStar.caught) {
        const s = this.activeStar;
        const p = Math.min(1, s.elapsed / s.duration);
        const edgeFade = p < 0.08 ? p / 0.08 : (p > 0.90 ? (1 - p) / 0.10 : 1);
        const alpha = Math.max(0, Math.min(1, edgeFade));

        ctx.save();
        ctx.globalAlpha = alpha;

        // Luminous trailing comet tail
        const tailLen = 58;
        const tailX = s.x - s.dir * tailLen;
        const tailY = s.y - (s.endY - s.startY) * 0.08;
        const tailGrad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        tailGrad.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
        tailGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.55)');
        tailGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Pulsing tap beacon ring
        const pulse = 0.8 + Math.sin(this._phase * 8) * 0.2;
        const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 22 * pulse);
        glow.addColorStop(0, 'rgba(254, 249, 195, 0.85)');
        glow.addColorStop(0.5, 'rgba(251, 191, 36, 0.35)');
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 22 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Crisp 4-point starlight diamond head
        ctx.translate(s.x, s.y);
        ctx.rotate(this._phase * 2.2);
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? 10.5 : 3.6;
          const ang = (i * Math.PI) / 4;
          if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Draw Krill Swarm on visible ice shelf
      if (!sheetExpanded && this.activeKrill && !this.activeKrill.caught) {
        const k = this.activeKrill;
        const p = Math.min(1, k.elapsed / k.duration);
        const edgeFade = p < 0.1 ? p / 0.1 : (p > 0.88 ? (1 - p) / 0.12 : 1);
        const alpha = Math.max(0, Math.min(1, edgeFade));

        ctx.save();
        ctx.globalAlpha = alpha;

        const pulse = 0.85 + Math.sin(this._phase * 6.5) * 0.15;
        const aura = ctx.createRadialGradient(k.x, k.y, 3, k.x, k.y, 28 * pulse);
        aura.addColorStop(0, 'rgba(251, 113, 133, 0.52)');
        aura.addColorStop(0.55, 'rgba(56, 189, 248, 0.28)');
        aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(k.x, k.y, 28 * pulse, 18 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing shimmer ring
        ctx.strokeStyle = 'rgba(253, 164, 175, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(k.x, k.y, 22 * pulse, 13 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 5 darting bioluminescent krill silhouettes
        for (let i = 0; i < 5; i++) {
          const ang = this._phase * 2.6 + i * 1.25;
          const kx = k.x + Math.cos(ang) * (7 + (i % 2) * 5);
          const ky = k.y + Math.sin(ang * 1.3) * (4 + (i % 3) * 2.2);
          ctx.fillStyle = i % 2 === 0 ? '#fb7185' : '#fdba74';
          ctx.beginPath();
          ctx.ellipse(kx, ky, 4.2, 2.0, Math.cos(ang) * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff1f2';
          ctx.beginPath();
          ctx.arc(kx + 1.8, ky - 0.3, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  return {
    SKY_COMBO_DECAY_SEC,
    SKY_COMBO_MAX,
    STARLIGHT_FRENZY_THRESHOLD,
    STARLIGHT_FRENZY_DURATION_SEC,
    STARLIGHT_FRENZY_MULTIPLIER,
    SHOOTING_STAR_MIN_CD,
    SHOOTING_STAR_MAX_CD,
    KRILL_SWARM_MIN_CD,
    KRILL_SWARM_MAX_CD,
    SHOOTING_STAR_TOUCH_RADIUS,
    KRILL_SWARM_TOUCH_RADIUS,
    calculateSkyEventReward,
    SkyMiniEventController
  };
});
