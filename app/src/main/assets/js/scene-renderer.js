(function (root, factory) {
  const economy = (typeof module === 'object' && module.exports)
    ? require('./economy.js')
    : (root.GlacialCore && root.GlacialCore.Economy);
  const castleRenderer = (typeof module === 'object' && module.exports)
    ? require('./castle-renderer.js')
    : (root.GlacialCore && root.GlacialCore.CastleRenderer);
  const api = factory(economy, castleRenderer);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.SceneRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CoreEconomy, CoreCastleRenderer) {
  'use strict';

  const SKY_STARS = Array.from({ length: 58 }, (_, idx) => ({
    xFrac: ((idx * 173 + 37) % 997) / 997,
    yFrac: 0.02 + (((idx * 311 + 19) % 340) / 1000),
    size: (idx % 4 === 0) ? 1.8 : (idx % 2 === 0 ? 1.25 : 0.9),
    phase: idx * 0.9,
    speed: 1.4 + (idx % 5) * 0.45
  }));

  const SKY_PALETTE_KEYFRAMES = [
    // 0: Deep Polar Twilight
    { top: [2, 8, 20], mid: [7, 25, 54], bot: [18, 56, 102], starAlpha: 0.92, auroraAlpha: 0.85 },
    // 1: Starry Arctic Midnight
    { top: [1, 5, 16], mid: [5, 16, 42], bot: [12, 34, 72], starAlpha: 1.0, auroraAlpha: 0.72 },
    // 2: Vibrant Aurora Borealis Peak
    { top: [4, 14, 30], mid: [10, 38, 66], bot: [20, 74, 104], starAlpha: 0.88, auroraAlpha: 1.25 },
    // 3: Crisp Polar Dawn
    { top: [14, 24, 52], mid: [34, 52, 92], bot: [72, 102, 146], starAlpha: 0.45, auroraAlpha: 0.52 }
  ];

  function lerpRgbStr(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  function getCurrentSkyAtmosphere(skyCycleElapsed) {
    const len = SKY_PALETTE_KEYFRAMES.length;
    const safeElapsed = CoreEconomy && typeof CoreEconomy.positiveModulo === 'function'
      ? CoreEconomy.positiveModulo(skyCycleElapsed, 360)
      : (((Number.isFinite(skyCycleElapsed) ? skyCycleElapsed : 0) % 360) + 360) % 360;
    const cyclePos = (safeElapsed / 360) * len;
    const idx = CoreEconomy && typeof CoreEconomy.positiveModulo === 'function'
      ? CoreEconomy.positiveModulo(Math.floor(cyclePos), len)
      : ((Math.floor(cyclePos) % len) + len) % len;
    const nextIdx = (idx + 1) % len;
    const frac = Math.max(0, Math.min(1, cyclePos - Math.floor(cyclePos)));
    const smooth = frac * frac * (3 - 2 * frac);
    const a = SKY_PALETTE_KEYFRAMES[idx] || SKY_PALETTE_KEYFRAMES[0];
    const b = SKY_PALETTE_KEYFRAMES[nextIdx] || SKY_PALETTE_KEYFRAMES[0];
    return {
      top: lerpRgbStr(a.top, b.top, smooth),
      mid: lerpRgbStr(a.mid, b.mid, smooth),
      bot: lerpRgbStr(a.bot, b.bot, smooth),
      starAlpha: a.starAlpha + (b.starAlpha - a.starAlpha) * smooth,
      auroraAlpha: a.auroraAlpha + (b.auroraAlpha - a.auroraAlpha) * smooth
    };
  }

  function drawPolarStarsAndMoon(ctx, width, height, phase, starOpacityScale = 1.0) {
    ctx.save();
    SKY_STARS.forEach(star => {
      const twinkle = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(phase * star.speed + star.phase))) * starOpacityScale;
      ctx.fillStyle = `rgba(224, 242, 254, ${Math.min(1, twinkle).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.xFrac * width, star.yFrac * height, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    const mx = width * 0.16;
    const my = height * 0.13;
    const moonHalo = ctx.createRadialGradient(mx, my, 8, mx, my, 46);
    moonHalo.addColorStop(0, 'rgba(224, 242, 254, 0.35)');
    moonHalo.addColorStop(0.45, 'rgba(125, 211, 252, 0.14)');
    moonHalo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath();
    ctx.arc(mx, my, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f0f9ff';
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.beginPath();
    ctx.arc(mx - 3, my - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(mx + 4, my + 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAuroraWaves(ctx, width, height, phase, auroraOpacityScale = 1.0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.max(0.35, Math.min(1.0, auroraOpacityScale));

    const ribbons = [
      { cTop: 'rgba(56, 189, 248, 0.04)', cBot: 'rgba(56, 189, 248, 0.30)', baseY: 0.14, offset: 0 },
      { cTop: 'rgba(52, 211, 153, 0.05)', cBot: 'rgba(52, 211, 153, 0.34)', baseY: 0.18, offset: 1.7 },
      { cTop: 'rgba(168, 85, 247, 0.04)', cBot: 'rgba(192, 132, 252, 0.25)', baseY: 0.11, offset: 3.1 }
    ];

    ribbons.forEach((rb, i) => {
      const grad = ctx.createLinearGradient(0, 0, 0, height * (rb.baseY + 0.1));
      grad.addColorStop(0, rb.cTop);
      grad.addColorStop(1, rb.cBot);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, height * rb.baseY);

      for (let x = 0; x <= width; x += 24) {
        const y = height * rb.baseY +
          Math.sin(x * 0.005 + phase + rb.offset) * 32 +
          Math.cos(x * 0.013 - phase * 0.65 + i) * 18;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    });

    for (let r = 0; r < 10; r++) {
      const rx = width * (0.08 + r * 0.095) + Math.sin(phase * 0.7 + r) * 18;
      const rayHeight = height * (0.16 + 0.05 * Math.sin(phase + r * 1.3));
      const rayGrad = ctx.createLinearGradient(rx, height * 0.03, rx, rayHeight);
      rayGrad.addColorStop(0, 'rgba(52, 211, 153, 0)');
      rayGrad.addColorStop(0.6, 'rgba(52, 211, 153, 0.14)');
      rayGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = rayGrad;
      ctx.fillRect(rx - 8, height * 0.02, 16, rayHeight);
    }

    ctx.restore();
  }

  function drawDistantMountains(ctx, width, height) {
    ctx.save();
    const baseY = height * 0.415;

    ctx.fillStyle = '#0c2040';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const farPeaks = [
      { x: 0.08, h: 0.31 },
      { x: 0.25, h: 0.26 },
      { x: 0.45, h: 0.30 },
      { x: 0.68, h: 0.27 },
      { x: 0.90, h: 0.31 }
    ];
    farPeaks.forEach(p => {
      ctx.lineTo(width * (p.x - 0.12), baseY);
      ctx.lineTo(width * p.x, height * p.h);
      ctx.lineTo(width * (p.x + 0.12), baseY);
    });
    ctx.closePath();
    ctx.fill();

    const peaks = [
      { x: 0.14, w: 0.13, h: 0.30 },
      { x: 0.36, w: 0.14, h: 0.255 },
      { x: 0.60, w: 0.13, h: 0.315 },
      { x: 0.84, w: 0.15, h: 0.27 }
    ];

    peaks.forEach(p => {
      const px = width * p.x;
      const py = height * p.h;
      const leftX = width * (p.x - p.w);
      const rightX = width * (p.x + p.w);

      const litGrad = ctx.createLinearGradient(leftX, py, px, baseY);
      litGrad.addColorStop(0, '#3b6ca1');
      litGrad.addColorStop(1, '#183b66');
      ctx.fillStyle = litGrad;
      ctx.beginPath();
      ctx.moveTo(leftX, baseY);
      ctx.lineTo(px, py);
      ctx.lineTo(px + width * 0.012, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0e284b';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(rightX, baseY);
      ctx.lineTo(px - width * 0.005, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - width * p.w * 0.28, py + (baseY - py) * 0.28);
      ctx.lineTo(px - width * p.w * 0.06, py + (baseY - py) * 0.22);
      ctx.lineTo(px + width * p.w * 0.16, py + (baseY - py) * 0.26);
      ctx.closePath();
      ctx.fill();
    });

    const ridgeGrad = ctx.createLinearGradient(0, baseY - 10, 0, baseY + 14);
    ridgeGrad.addColorStop(0, 'rgba(186, 230, 253, 0)');
    ridgeGrad.addColorStop(0.55, 'rgba(186, 230, 253, 0.28)');
    ridgeGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = ridgeGrad;
    ctx.fillRect(0, baseY - 10, width, 24);
    ctx.restore();
  }

  function drawIceDetails(ctx, width, height) {
    ctx.save();

    ctx.fillStyle = 'rgba(240, 249, 255, 0.22)';
    [
      { x: 0.18, y: 0.49, rx: 64, ry: 12 },
      { x: 0.80, y: 0.53, rx: 72, ry: 14 },
      { x: 0.34, y: 0.88, rx: 90, ry: 15 },
      { x: 0.72, y: 0.89, rx: 78, ry: 13 }
    ].forEach(d => {
      ctx.beginPath();
      ctx.ellipse(width * d.x, height * d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const cracks = [
      [{ x: 0.09, y: 0.56 }, { x: 0.25, y: 0.59 }, { x: 0.33, y: 0.55 }],
      [{ x: 0.66, y: 0.61 }, { x: 0.79, y: 0.65 }, { x: 0.90, y: 0.60 }],
      [{ x: 0.35, y: 0.77 }, { x: 0.42, y: 0.80 }, { x: 0.39, y: 0.84 }]
    ];
    cracks.forEach(pts => {
      ctx.strokeStyle = 'rgba(14, 116, 144, 0.22)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pts.forEach((p, idx) => idx === 0 ? ctx.moveTo(width * p.x, height * p.y + 1) : ctx.lineTo(width * p.x, height * p.y + 1));
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach((p, idx) => idx === 0 ? ctx.moveTo(width * p.x, height * p.y) : ctx.lineTo(width * p.x, height * p.y));
      ctx.stroke();
    });

    [
      { x: 0.08, y: 0.47, s: 1.0 },
      { x: 0.91, y: 0.49, s: 1.15 },
      { x: 0.11, y: 0.84, s: 0.85 },
      { x: 0.90, y: 0.83, s: 0.9 }
    ].forEach(c => {
      const cx = width * c.x;
      const cy = height * c.y;
      const s = c.s;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16 * s);
      ctx.lineTo(cx + 8 * s, cy + 2 * s);
      ctx.lineTo(cx, cy + 6 * s);
      ctx.lineTo(cx - 8 * s, cy + 2 * s);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16 * s);
      ctx.lineTo(cx, cy + 6 * s);
      ctx.lineTo(cx - 8 * s, cy + 2 * s);
      ctx.closePath();
      ctx.fill();
    });

    ctx.restore();
  }

  function drawIceHole(ctx, width, height, hole, auroraWavePhase, hotspotOpts = null) {
    const cx = width * hole.xRatio;
    const cy = height * hole.yRatio;
    const isHotspot = Boolean(hotspotOpts && hotspotOpts.isHotspot);
    const surgeActive = Boolean(hotspotOpts && hotspotOpts.surgeActive);
    const hotspotColor = (hotspotOpts && hotspotOpts.color) || '#fbbf24';
    const hotspotSecondary = (hotspotOpts && hotspotOpts.secondary) || '#38bdf8';

    ctx.save();
    if (isHotspot) {
      const pulse = 0.88 + Math.sin(auroraWavePhase * (surgeActive ? 6.2 : 3.4)) * 0.12;
      const auraRx = (hole.radiusX + (surgeActive ? 19 : 13)) * pulse;
      const auraRy = (hole.radiusY + (surgeActive ? 11 : 8)) * pulse;
      const glow = ctx.createRadialGradient(cx, cy, hole.radiusX * 0.25, cx, cy, auraRx);
      glow.addColorStop(0, surgeActive ? 'rgba(254, 240, 138, 0.44)' : 'rgba(56, 189, 248, 0.30)');
      glow.addColorStop(0.55, surgeActive ? 'rgba(251, 191, 36, 0.28)' : 'rgba(125, 211, 252, 0.16)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, auraRx, auraRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isHotspot ? 'rgba(254, 249, 195, 0.92)' : 'rgba(240, 250, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, hole.radiusX + 5.5, hole.radiusY + 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isHotspot ? hotspotColor : '#7dd3fc';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.5, hole.radiusX + 2.4, hole.radiusY + 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    const waterGrad = ctx.createRadialGradient(cx, cy + 2, 3, cx, cy, hole.radiusX);
    waterGrad.addColorStop(0, isHotspot ? '#04223a' : '#021526');
    waterGrad.addColorStop(0.65, isHotspot ? '#0b4a78' : '#073153');
    waterGrad.addColorStop(1, isHotspot ? hotspotSecondary : '#0e5288');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1.5, hole.radiusX, hole.radiusY - 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1.5, hole.radiusX - 3, hole.radiusY - 2, 0, 0, Math.PI * 2);
    ctx.clip();
    const swimOffset = Math.sin(auroraWavePhase * 1.8 + hole.id * 2.1) * (hole.radiusX * 0.48);
    ctx.fillStyle = isHotspot ? 'rgba(254, 240, 138, 0.55)' : 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + swimOffset, cy + 2, 6.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isHotspot) {
      const swimOffset2 = Math.cos(auroraWavePhase * 2.4 + hole.id) * (hole.radiusX * 0.42);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx + swimOffset2, cy - 2.5, 5.2, 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const ripple = (hole.rippleTimer % 2.0) / 2.0;
    ctx.strokeStyle = isHotspot
      ? (surgeActive
          ? `rgba(254, 240, 138, ${(0.90 * (1 - ripple)).toFixed(3)})`
          : `rgba(251, 191, 36, ${(0.78 * (1 - ripple)).toFixed(3)})`)
      : `rgba(186, 230, 253, ${(0.72 * (1 - ripple)).toFixed(3)})`;
    ctx.lineWidth = isHotspot ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, hole.radiusX * ripple, hole.radiusY * ripple, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (isHotspot) {
      // Rising shimmer motes & compact glowing star crest above rim
      const moteCount = surgeActive ? 5 : 3;
      for (let i = 0; i < moteCount; i++) {
        const mPhase = (auroraWavePhase * (surgeActive ? 1.4 : 0.9) + i * 0.72) % 1;
        const mx = cx + Math.sin(auroraWavePhase * 2 + i * 2.1) * (hole.radiusX * 0.62);
        const my = cy - 4 - mPhase * 18;
        ctx.fillStyle = i % 2 === 0 ? hotspotColor : '#e0f2fe';
        ctx.globalAlpha = Math.sin(mPhase * Math.PI) * 0.85;
        ctx.beginPath();
        ctx.arc(mx, my, surgeActive ? 2.2 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.92;
      ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#061121';
      const badgeLabel = surgeActive ? '⚡ SURGE' : '★ HOTSPOT';
      const tw = badgeLabel.length * 5.2 + 10;
      const by = cy - hole.radiusY - 11;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(cx - tw / 2, by - 7, tw, 13, 6);
      } else {
        ctx.rect(cx - tw / 2, by - 7, tw, 13);
      }
      ctx.fill();
      ctx.strokeStyle = hotspotColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = surgeActive ? '#fef08a' : '#f8fafc';
      ctx.fillText(badgeLabel, cx, by + 2.5);
    }

    ctx.restore();
  }

  /**
   * Draws 4 milestone-unlocked scenic landmarks cleanly along the snow ridge & shelf flanks
   * (behind penguins and clear of fishing holes):
   * 1. Frost Lantern Path (glacierLevel >= 3 || iglooTier >= 1)
   * 2. Wind-Reactive Colony Pennants (fishingHolesUnlocked >= 4 || totalPenguins >= 25)
   * 3. Aurora Crystal Monoliths (iglooTier >= 3 || glacierLevel >= 10)
   * 4. Permanent Rebirth Star Monument (totalRebirths >= 1)
   */
  function drawGlacierLandmarks(ctx, width, height, phase, landmarks = {}, windFactor = 0.5) {
    if (!ctx || !landmarks) return;
    ctx.save();

    // Landmark 1: Frost Lantern Path along upper ridge flanking the Igloo/Castle
    if (landmarks.lanternPath) {
      const posts = [
        { x: 0.27, y: 0.455 },
        { x: 0.37, y: 0.445 },
        { x: 0.63, y: 0.445 },
        { x: 0.73, y: 0.455 }
      ];
      posts.forEach((p, idx) => {
        const px = width * p.x;
        const py = height * p.y;
        const flicker = 0.85 + Math.sin(phase * 3.8 + idx * 1.4) * 0.15;

        // Warm glow pool
        const halo = ctx.createRadialGradient(px, py - 12, 1, px, py - 12, 16 * flicker);
        halo.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
        halo.addColorStop(0.55, 'rgba(251, 191, 36, 0.18)');
        halo.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py - 12, 16 * flicker, 0, Math.PI * 2);
        ctx.fill();

        // Carved frost post
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 13);
        ctx.stroke();

        // Glowing lantern housing
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(px, py - 13, 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Landmark 2: Wind-Reactive Colony Pennants along outer flanks
    if (landmarks.colonyPennants) {
      const flags = [
        { x: 0.09, y: 0.54, color: '#38bdf8' },
        { x: 0.91, y: 0.54, color: '#fbbf24' }
      ];
      const windAmp = Math.min(2.6, 0.8 + Math.max(0, Number(windFactor) || 0.4) * 0.65);
      flags.forEach((f, idx) => {
        const fx = width * f.x;
        const fy = height * f.y;
        const wave = Math.sin(phase * (3.6 + windAmp * 1.4) + idx * 1.9) * (3.2 * windAmp);
        const dir = f.x < 0.5 ? 1 : -1;

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - 24);
        ctx.stroke();

        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(fx, fy - 23);
        ctx.quadraticCurveTo(fx + dir * 10, fy - 22 + wave * 0.5, fx + dir * 18, fy - 18 + wave);
        ctx.lineTo(fx, fy - 14);
        ctx.closePath();
        ctx.fill();
      });
    }

    // Landmark 3: Twin Aurora Crystal Monoliths at mountain foothills
    if (landmarks.auroraMonoliths) {
      const glowBoost = landmarks.monolithBoost ? 1.35 : 1.0;
      const monoliths = [
        { x: 0.16, y: 0.435, s: 1.0 },
        { x: 0.84, y: 0.435, s: 1.0 }
      ];
      monoliths.forEach((m, idx) => {
        const mx = width * m.x;
        const my = height * m.y;
        const pulse = (0.78 + Math.sin(phase * 2.6 + idx * Math.PI) * 0.22) * glowBoost;

        const aura = ctx.createRadialGradient(mx, my - 16, 2, mx, my - 16, 24 * pulse);
        aura.addColorStop(0, 'rgba(52, 211, 153, 0.36)');
        aura.addColorStop(0.55, 'rgba(56, 189, 248, 0.16)');
        aura.addColorStop(1, 'rgba(192, 132, 252, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(mx, my - 16, 24 * pulse, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createLinearGradient(mx, my - 30, mx, my);
        grad.addColorStop(0, '#a7f3d0');
        grad.addColorStop(0.5, '#38bdf8');
        grad.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(mx, my - 30);
        ctx.lineTo(mx + 7, my - 16);
        ctx.lineTo(mx + 5, my);
        ctx.lineTo(mx - 5, my);
        ctx.lineTo(mx - 7, my - 16);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(240, 253, 250, 0.55)';
        ctx.beginPath();
        ctx.moveTo(mx, my - 30);
        ctx.lineTo(mx, my);
        ctx.lineTo(mx - 5, my);
        ctx.lineTo(mx - 7, my - 16);
        ctx.closePath();
        ctx.fill();
      });
    }

    // Landmark 4: Permanent Glacial Rebirth Star Monument (persists across Rebirths!)
    if (landmarks.rebirthMonument) {
      const rx = width * 0.78;
      const ry = height * 0.452;
      const tierRings = Math.min(3, Math.max(1, Number(landmarks.rebirthCount) || 1));
      const hover = Math.sin(phase * 2.4) * 2.5;

      // Pedestal
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(rx - 10, ry);
      ctx.lineTo(rx - 7, ry - 8);
      ctx.lineTo(rx + 7, ry - 8);
      ctx.lineTo(rx + 10, ry);
      ctx.closePath();
      ctx.fill();

      // Orbiting prestige rings
      for (let r = 0; r < tierRings; r++) {
        ctx.strokeStyle = r === 0 ? 'rgba(192, 132, 252, 0.72)' : (r === 1 ? 'rgba(56, 189, 248, 0.62)' : 'rgba(251, 191, 36, 0.65)');
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(rx, ry - 20 + hover, 9 + r * 3.8, 3.2 + r * 1.1, (phase * 0.5 + r * 0.8) % Math.PI, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Levitating star prism
      const starGrad = ctx.createRadialGradient(rx, ry - 20 + hover, 1, rx, ry - 20 + hover, 14);
      starGrad.addColorStop(0, '#fef08a');
      starGrad.addColorStop(0.5, 'rgba(192, 132, 252, 0.55)');
      starGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = starGrad;
      ctx.beginPath();
      ctx.arc(rx, ry - 20 + hover, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.moveTo(rx, ry - 28 + hover);
      ctx.lineTo(rx + 5.5, ry - 20 + hover);
      ctx.lineTo(rx, ry - 12 + hover);
      ctx.lineTo(rx - 5.5, ry - 20 + hover);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawIglooDepot(ctx, width, height, depot, iglooTier, iglooTheme, auroraWavePhase) {
    const cx = width * depot.x;
    const cy = height * depot.y;
    const r = depot.radius;
    if (CoreCastleRenderer && typeof CoreCastleRenderer.drawIglooCastle === 'function') {
      CoreCastleRenderer.drawIglooCastle(ctx, {
        cx,
        cy,
        r,
        iglooTier: iglooTier || 0,
        iglooTheme: iglooTheme || 'glacier',
        phase: auroraWavePhase
      });
      return;
    }
    ctx.save();
    ctx.fillStyle = '#d4ecfc';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSlideTrailsAndRipples(ctx, dt, width, height, slideTrails, holeRipples) {
    ctx.save();
    for (let i = slideTrails.length - 1; i >= 0; i--) {
      const seg = slideTrails[i];
      seg.life -= dt;
      if (seg.life <= 0) {
        slideTrails.splice(i, 1);
        continue;
      }
      const alpha = (seg.life / seg.maxLife) * 0.42;
      ctx.fillStyle = seg.cyber
        ? `rgba(125, 211, 252, ${alpha.toFixed(3)})`
        : `rgba(240, 249, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(seg.x, seg.y, seg.r * 1.45, seg.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = holeRipples.length - 1; i >= 0; i--) {
      const rip = holeRipples[i];
      rip.progress += dt * 1.35;
      if (rip.progress >= 1) {
        holeRipples.splice(i, 1);
        continue;
      }
      const rx = rip.maxRx * rip.progress;
      const ry = rip.maxRy * rip.progress;
      ctx.globalAlpha = Math.max(0, 1 - rip.progress);
      ctx.strokeStyle = rip.color;
      ctx.lineWidth = 2.0 * (1 - rip.progress * 0.5);
      ctx.beginPath();
      ctx.ellipse(width * rip.xRatio, height * rip.yRatio + 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnow(ctx, dt, params) {
    const {
      width,
      height,
      targetWeather,
      snowParticles,
      maxSnow,
      weatherMix
    } = params;

    const lerpRate = Math.min(1, dt * 1.4);
    weatherMix.snow += (targetWeather.snowFactor - weatherMix.snow) * lerpRate;
    weatherMix.wind += (targetWeather.windFactor - weatherMix.wind) * lerpRate;
    weatherMix.fog += (targetWeather.fogFactor - weatherMix.fog) * lerpRate;

    const activeCount = Math.max(8, Math.round(maxSnow * weatherMix.snow));
    const frameScale = dt * 60;

    ctx.save();
    for (let i = 0; i < activeCount; i++) {
      const p = snowParticles[i];
      if (!p) continue;
      const vy = p.speedY * (0.85 + weatherMix.snow * 1.4) * frameScale;
      const vx = (p.speedX + weatherMix.wind * 1.35) * frameScale;
      p.y += vy;
      p.x += vx;
      if (p.y > height) {
        p.y = -6;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 5;
      if (p.x > width + 10) p.x = -5;

      ctx.fillStyle = `rgba(240, 250, 255, ${Math.min(0.95, p.opacity * (0.7 + weatherMix.snow * 0.45))})`;
      ctx.beginPath();
      if (weatherMix.fog > 0.35) {
        ctx.ellipse(p.x, p.y, p.radius * (1 + weatherMix.fog * 2.2), p.radius * 0.85, 0.22, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBlizzardVisibilityOverlay(ctx, width, height, weatherFogMix, auroraWavePhase) {
    if (weatherFogMix <= 0.02) return;

    ctx.save();
    const baseHazeAlpha = Math.min(0.46, weatherFogMix * 0.42);
    ctx.fillStyle = `rgba(205, 228, 248, ${baseHazeAlpha})`;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.52;
    const outerR = Math.max(width, height) * 0.72;
    const fogGrad = ctx.createRadialGradient(cx, cy, outerR * 0.18, cx, cy, outerR);
    fogGrad.addColorStop(0, `rgba(215, 236, 252, ${(0.08 * weatherFogMix).toFixed(3)})`);
    fogGrad.addColorStop(0.6, `rgba(190, 222, 248, ${(0.28 * weatherFogMix).toFixed(3)})`);
    fogGrad.addColorStop(1, `rgba(175, 212, 244, ${(0.52 * weatherFogMix).toFixed(3)})`);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, width, height);

    if (weatherFogMix > 0.25) {
      const gustAlpha = Math.min(0.22, (weatherFogMix - 0.2) * 0.22);
      ctx.fillStyle = `rgba(240, 248, 255, ${gustAlpha})`;
      for (let i = 0; i < 4; i++) {
        const bandY = ((height * (0.2 + i * 0.22)) + Math.sin(auroraWavePhase * 1.4 + i) * 28);
        const driftX = ((auroraWavePhase * (90 + i * 25)) % (width + 240)) - 120;
        ctx.beginPath();
        ctx.ellipse(driftX, bandY, 150 + i * 20, 26 + i * 6, -0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawScene(ctx, dt, sceneCtx) {
    const {
      width,
      height,
      skyCycleElapsed,
      auroraWavePhase,
      fishingHoles,
      slideTrails,
      holeRipples,
      depot,
      iglooTier,
      iglooTheme,
      targetWeather,
      snowParticles,
      maxSnow,
      weatherMix
    } = sceneCtx;

    ctx.clearRect(0, 0, width, height);

    const skyAtm = getCurrentSkyAtmosphere(skyCycleElapsed);
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.56);
    skyGradient.addColorStop(0, skyAtm.top);
    skyGradient.addColorStop(0.5, skyAtm.mid);
    skyGradient.addColorStop(1, skyAtm.bot);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.6);

    drawPolarStarsAndMoon(ctx, width, height, auroraWavePhase, skyAtm.starAlpha);
    drawAuroraWaves(ctx, width, height, auroraWavePhase, skyAtm.auroraAlpha);
    drawDistantMountains(ctx, width, height);

    const iceGradient = ctx.createLinearGradient(0, height * 0.38, 0, height);
    iceGradient.addColorStop(0, '#1e4878');
    iceGradient.addColorStop(0.14, '#3671ab');
    iceGradient.addColorStop(0.45, '#72addc');
    iceGradient.addColorStop(0.8, '#9fd7f4');
    iceGradient.addColorStop(1, '#c4ebfc');
    ctx.fillStyle = iceGradient;
    ctx.fillRect(0, height * 0.38, width, height * 0.62);

    const sheenGrad = ctx.createRadialGradient(width * 0.5, height * 0.56, 15, width * 0.5, height * 0.58, width * 0.55);
    sheenGrad.addColorStop(0, 'rgba(186, 230, 253, 0.24)');
    sheenGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.08)');
    sheenGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, height * 0.38, width, height * 0.62);

    drawIceDetails(ctx, width, height);

    const hotspotHoleId = sceneCtx.hotspotHoleId || null;
    const hotspotSurgeActive = Boolean(sceneCtx.hotspotSurgeActive);
    const hotspotColor = sceneCtx.hotspotColor || '#fbbf24';
    const hotspotSecondary = sceneCtx.hotspotSecondary || '#38bdf8';

    drawGlacierLandmarks(ctx, width, height, auroraWavePhase, sceneCtx.landmarks, targetWeather ? targetWeather.windFactor : 0.4);

    fishingHoles.forEach(hole => {
      hole.rippleTimer += dt * 1.5;
      drawIceHole(ctx, width, height, hole, auroraWavePhase, {
        isHotspot: hotspotHoleId !== null && hole.id === hotspotHoleId,
        surgeActive: hotspotSurgeActive,
        color: hotspotColor,
        secondary: hotspotSecondary
      });
    });

    drawSlideTrailsAndRipples(ctx, dt, width, height, slideTrails, holeRipples);
    drawIglooDepot(ctx, width, height, depot, iglooTier, iglooTheme, auroraWavePhase);
    drawSnow(ctx, dt, { width, height, targetWeather, snowParticles, maxSnow, weatherMix });
  }

  function updateParticles(ctx, dt, pools) {
    const { tapParticles, fireworks, sleepZzzParticles } = pools;

    for (let i = tapParticles.length - 1; i >= 0; i--) {
      const p = tapParticles[i];
      p.life -= dt * 1.4;
      p.y += p.vy;
      p.x += p.vx;

      if (p.life <= 0) {
        tapParticles.splice(i, 1);
      } else {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px var(--font-family)`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }

    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];
      fw.life -= dt * 1.2;
      fw.x += fw.vx;
      fw.y += fw.vy;
      fw.vy += dt * 3.5;

      if (fw.life <= 0) {
        fireworks.splice(i, 1);
      } else {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fw.life);
        ctx.fillStyle = fw.color;
        ctx.beginPath();
        ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = sleepZzzParticles.length - 1; i >= 0; i--) {
      const z = sleepZzzParticles[i];
      z.age += dt;
      if (z.age >= z.maxLife) {
        sleepZzzParticles.splice(i, 1);
        continue;
      }
      const progress = z.age / z.maxLife;
      const alpha = progress < 0.2
        ? (progress / 0.2) * 0.92
        : (1 - ((progress - 0.2) / 0.8)) * 0.92;
      const driftX = Math.sin(z.age * 3.1 + z.phase) * 5.5 + progress * 4.5;
      const drawX = z.x + driftX;
      const drawY = z.y + z.vy * z.age;
      const fontSize = Math.round(z.baseSize + progress * 3.5);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = `italic 800 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.lineWidth = 2.4;
      ctx.strokeText(z.text, drawX, drawY);
      ctx.fillStyle = z.color;
      ctx.fillText(z.text, drawX, drawY);
      ctx.restore();
    }
  }

  return {
    SKY_STARS,
    SKY_PALETTE_KEYFRAMES,
    lerpRgbStr,
    getCurrentSkyAtmosphere,
    drawPolarStarsAndMoon,
    drawAuroraWaves,
    drawDistantMountains,
    drawIceDetails,
    drawGlacierLandmarks,
    drawIceHole,
    drawIglooDepot,
    drawSlideTrailsAndRipples,
    drawSnow,
    drawBlizzardVisibilityOverlay,
    drawScene,
    updateParticles
  };
});
