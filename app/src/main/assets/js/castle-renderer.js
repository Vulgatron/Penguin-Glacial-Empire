(function (root, factory) {
  const economy = (typeof module === 'object' && module.exports)
    ? require('./economy.js')
    : (root.GlacialCore && root.GlacialCore.Economy);
  const api = factory(economy);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.CastleRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Economy) {
  'use strict';

  function resolveTheme(themeId) {
    if (Economy && typeof Economy.getIglooThemeDef === 'function') {
      return Economy.getIglooThemeDef(themeId);
    }
    return {
      id: 'glacier',
      name: 'Glacier Classic',
      domeTop: '#ffffff',
      domeMid: '#d4ecfc',
      domeBot: '#60a5fa',
      mortar: 'rgba(100, 165, 215, 0.45)',
      rim: 'rgba(224, 242, 254, 0.88)',
      spireTop: '#e0f2fe',
      spireMid: '#38bdf8',
      spireBot: '#0369a1',
      doorArch: '#b4dcf5',
      doorCore: '#061a33',
      lanternGlow: '#fde68a',
      lanternHalo: 'rgba(251, 191, 36, 0.45)',
      bannerPrimary: '#0284c7',
      bannerTrim: '#e0f2fe',
      haloInner: 'rgba(56, 189, 248, 0.34)',
      haloOuter: 'rgba(192, 132, 252, 0.22)'
    };
  }

  function drawBanner(ctx, x, y, phase, theme, scale = 1) {
    const wave = Math.sin(phase * 3.1 + x * 0.05) * 3.5 * scale;
    ctx.save();
    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 16 * scale);
    ctx.stroke();

    ctx.fillStyle = theme.bannerPrimary;
    ctx.beginPath();
    ctx.moveTo(x, y - 16 * scale);
    ctx.quadraticCurveTo(x + 8 * scale, y - 15 * scale + wave, x + 15 * scale, y - 12 * scale + wave * 0.8);
    ctx.lineTo(x + 11 * scale, y - 9.5 * scale + wave * 0.5);
    ctx.lineTo(x + 15 * scale, y - 7 * scale + wave * 0.8);
    ctx.quadraticCurveTo(x + 7 * scale, y - 8.5 * scale + wave * 0.3, x, y - 8 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = theme.bannerTrim;
    ctx.lineWidth = 0.9 * scale;
    ctx.stroke();
    ctx.restore();
  }

  function drawCrystalSpire(ctx, sx, sy, spireH, halfW, theme) {
    const grad = ctx.createLinearGradient(sx, sy - spireH, sx, sy);
    grad.addColorStop(0, theme.spireTop);
    grad.addColorStop(0.55, theme.spireMid);
    grad.addColorStop(1, theme.spireBot);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy - spireH);
    ctx.lineTo(sx + halfW, sy);
    ctx.lineTo(sx - halfW, sy);
    ctx.closePath();
    ctx.fill();

    // Specular ice facet ridge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.moveTo(sx, sy - spireH);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx - halfW * 0.85, sy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawWatchTurret(ctx, tx, ty, w, h, theme, phase, withBanner) {
    const bodyGrad = ctx.createLinearGradient(tx - w * 0.5, ty - h, tx + w * 0.5, ty);
    bodyGrad.addColorStop(0, theme.domeTop);
    bodyGrad.addColorStop(0.55, theme.domeMid);
    bodyGrad.addColorStop(1, theme.domeBot);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(tx - w * 0.5, ty - h, w, h);

    ctx.strokeStyle = theme.mortar;
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - w * 0.5, ty - h, w, h);

    // Tall pointed ice roof
    drawCrystalSpire(ctx, tx, ty - h, h * 0.72, w * 0.68, theme);

    // Glowing arched slit window
    ctx.fillStyle = theme.lanternGlow;
    ctx.beginPath();
    ctx.arc(tx, ty - h * 0.55, w * 0.18, Math.PI, 0, false);
    ctx.lineTo(tx + w * 0.18, ty - h * 0.34);
    ctx.lineTo(tx - w * 0.18, ty - h * 0.34);
    ctx.closePath();
    ctx.fill();

    if (withBanner) {
      drawBanner(ctx, tx, ty - h - h * 0.72, phase, theme, 0.78);
    }
  }

  /**
   * Renders the colony Igloo Depot evolving across 6 cosmetic tiers (0 -> 5) into
   * a Grand Glacial Ice Castle using the player's selected color palette.
   */
  function drawIglooCastle(ctx, params) {
    const cx = params.cx;
    const cy = params.cy;
    const r = params.r || 46;
    const tier = Math.max(0, Math.min(5, Math.floor(Number(params.iglooTier) || 0)));
    const phase = Number(params.phase) || 0;
    const theme = resolveTheme(params.iglooTheme);

    ctx.save();

    // 1. Ground shadow scales gracefully from cozy Igloo to Grand Palace
    const shadowScaleX = 1.35 + tier * 0.15;
    ctx.fillStyle = 'rgba(10, 30, 60, 0.36)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.42, r * shadowScaleX, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Tier 5: Grand Royal Aurora Halo behind the Palace
    if (tier >= 5) {
      const pulse = 0.74 + 0.26 * Math.sin(phase * 2.3);
      const halo = ctx.createRadialGradient(cx, cy - r * 0.65, r * 0.35, cx, cy - r * 0.65, r * 2.35);
      halo.addColorStop(0, theme.haloInner);
      halo.addColorStop(0.55, theme.haloOuter);
      halo.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.62, r * 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Tier 4+: Towering Central Crystalline Keep behind the main structure
    if (tier >= 4) {
      const keepW = r * (tier >= 5 ? 1.12 : 0.96);
      const keepH = r * (tier >= 5 ? 1.38 : 1.15);
      const keepGrad = ctx.createLinearGradient(cx - keepW * 0.5, cy - keepH, cx + keepW * 0.5, cy);
      keepGrad.addColorStop(0, theme.domeTop);
      keepGrad.addColorStop(0.45, theme.domeMid);
      keepGrad.addColorStop(1, theme.spireBot);
      ctx.fillStyle = keepGrad;
      ctx.fillRect(cx - keepW * 0.5, cy - keepH, keepW, keepH);

      ctx.strokeStyle = theme.rim;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(cx - keepW * 0.5, cy - keepH, keepW, keepH);

      // Central crowned spire on top of keep
      const crownH = tier >= 5 ? r * 0.98 : r * 0.72;
      drawCrystalSpire(ctx, cx, cy - keepH, crownH, keepW * 0.46, theme);

      // Glowing stained-ice rose window in upper keep
      const roseY = cy - keepH * 0.74;
      const roseR = r * 0.2;
      const roseHalo = ctx.createRadialGradient(cx, roseY, 1, cx, roseY, roseR * 2.1);
      roseHalo.addColorStop(0, theme.lanternGlow);
      roseHalo.addColorStop(0.55, theme.lanternHalo);
      roseHalo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = roseHalo;
      ctx.beginPath();
      ctx.arc(cx, roseY, roseR * 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.lanternGlow;
      ctx.beginPath();
      ctx.arc(cx, roseY, roseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.rim;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Tier 5: Radiant Polar Star Finial atop the highest spire
      if (tier >= 5) {
        const starY = cy - keepH - crownH - 4;
        const starPulse = 0.8 + 0.25 * Math.sin(phase * 4.2);
        ctx.save();
        ctx.translate(cx, starY);
        ctx.fillStyle = theme.lanternGlow;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4;
          const rad = (i % 2 === 0 ? 7.5 : 2.8) * starPulse;
          if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 4. Tier 3+: Crenellated Castle Battlement Curtain Wall + Twin Watch Turrets
    if (tier >= 3) {
      const wallW = r * (tier >= 5 ? 2.68 : 2.38);
      const wallH = r * 0.62;
      const wallGrad = ctx.createLinearGradient(cx, cy - wallH, cx, cy + 2);
      wallGrad.addColorStop(0, theme.domeTop);
      wallGrad.addColorStop(0.6, theme.domeMid);
      wallGrad.addColorStop(1, theme.domeBot);
      ctx.fillStyle = wallGrad;
      ctx.fillRect(cx - wallW * 0.5, cy - wallH, wallW, wallH + 2);

      // Crenellations along parapet top
      const merlonCount = tier >= 5 ? 9 : 7;
      const step = wallW / merlonCount;
      for (let i = 0; i < merlonCount; i++) {
        const mx = cx - wallW * 0.5 + i * step + step * 0.16;
        ctx.fillStyle = theme.domeTop;
        ctx.fillRect(mx, cy - wallH - 6, step * 0.68, 7);
        ctx.strokeStyle = theme.mortar;
        ctx.lineWidth = 0.9;
        ctx.strokeRect(mx, cy - wallH - 6, step * 0.68, 7);
      }

      // Flanking watch turrets
      [-1, 1].forEach((side) => {
        const tx = cx + side * (wallW * 0.48);
        drawWatchTurret(ctx, tx, cy + 2, r * 0.34, r * (tier >= 5 ? 0.98 : 0.84), theme, phase, true);
      });

      // Tier 5: Outer pair of royal diamond crystal turrets
      if (tier >= 5) {
        [-1, 1].forEach((side) => {
          drawCrystalSpire(ctx, cx + side * (wallW * 0.63), cy + 3, r * 0.86, 11, theme);
        });
      }
    }

    // 5. Tier 2+: Flanking Sculpted Crystal Ice Spires
    if (tier >= 2) {
      [-1, 1].forEach((side) => {
        const sx = cx + side * (r * (tier >= 3 ? 0.86 : 1.06));
        const sy = cy + 2;
        const spireH = tier >= 4 ? 48 : 36;
        drawCrystalSpire(ctx, sx, sy, spireH, 10, theme);
      });
    }

    // 6. Core Igloo Dome / Castle Front Rotunda
    const domeGrad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.42, 4, cx, cy, r * 1.08);
    domeGrad.addColorStop(0, theme.domeTop);
    domeGrad.addColorStop(0.52, theme.domeMid);
    domeGrad.addColorStop(1, theme.domeBot);
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // Ice-block curved courses & staggered mortar seams
    ctx.strokeStyle = theme.mortar;
    ctx.lineWidth = 1.3;
    [0.36, 0.64, 0.86].forEach((frac) => {
      const yOff = cy - r * (1 - frac);
      const halfW = Math.sqrt(Math.max(0, r * r - (cy - yOff) * (cy - yOff)));
      ctx.beginPath();
      ctx.moveTo(cx - halfW, yOff);
      ctx.quadraticCurveTo(cx, yOff + 5, cx + halfW, yOff);
      ctx.stroke();
    });
    [
      { x: -0.52, y0: 0.0, y1: 0.36 },
      { x: 0.45, y0: 0.0, y1: 0.36 },
      { x: -0.22, y0: 0.36, y1: 0.64 },
      { x: 0.25, y0: 0.36, y1: 0.64 },
      { x: 0.0, y0: 0.64, y1: 0.86 }
    ].forEach((b) => {
      ctx.beginPath();
      ctx.moveTo(cx + r * b.x, cy - r * b.y0);
      ctx.lineTo(cx + r * b.x * 0.88, cy - r * b.y1);
      ctx.stroke();
    });

    // Outer dome rim
    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = tier >= 3 ? 2.0 : 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.stroke();

    // 7. Sculpted Arched Entrance Tunnel / Grand Castle Gatehouse
    const archScale = tier >= 3 ? 0.46 : 0.42;
    ctx.fillStyle = theme.doorArch;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r * archScale, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    if (tier >= 2) {
      ctx.strokeStyle = theme.rim;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.fillStyle = theme.doorCore;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r * 0.33, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // Tier 1+: Carved snow threshold steps & chimney frost wisp
    if (tier >= 1) {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 5, r * 0.44, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gentle frost chimney wisp rising from dome (for Tiers 1-3 before central keep replaces chimney)
      if (tier < 4) {
        for (let w = 0; w < 3; w++) {
          const lift = ((phase * 0.65 + w * 0.33) % 1);
          const wx = cx + r * 0.28 + Math.sin(phase * 2 + w * 1.7) * 5;
          const wy = cy - r * 0.92 - lift * 20;
          ctx.fillStyle = `rgba(224, 242, 254, ${(0.38 * (1 - lift)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(wx, wy, 3 + lift * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Glowing Frost-Lantern Posts flanking doorway
      [-1, 1].forEach((side) => {
        const lx = cx + side * (r * 0.5);
        const ly = cy - 6;
        ctx.strokeStyle = theme.rim;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, cy + 4);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 13);
        glow.addColorStop(0, theme.lanternGlow);
        glow.addColorStop(0.5, theme.lanternHalo);
        glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lx, ly, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = theme.lanternGlow;
        ctx.beginPath();
        ctx.arc(lx, ly, 3.3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 8. Tier 4+: Upward-drifting crystal frost motes around the Castle
    if (tier >= 4) {
      const moteCount = tier >= 5 ? 8 : 5;
      for (let i = 0; i < moteCount; i++) {
        const prog = ((phase * 0.36 + i / moteCount) % 1);
        const mx = cx + Math.sin(i * 2.1 + phase * 1.2) * (r * 1.35);
        const my = cy + 6 - prog * (r * 2.1);
        ctx.fillStyle = theme.lanternGlow;
        ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.72;
        ctx.beginPath();
        ctx.arc(mx, my, 1.8 + (i % 2) * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Compact inline SVG illustration for the Glacier Tab Igloo-to-Ice-Castle Architect preview card.
   */
  function getSvgCastlePreviewMarkup(iglooTier, iglooTheme) {
    const tier = Math.max(0, Math.min(5, Math.floor(Number(iglooTier) || 0)));
    const theme = resolveTheme(iglooTheme);
    const uid = `cst${tier}_${theme.id}`;
    return `
      <svg viewBox="0 0 180 112" width="144" height="90" aria-hidden="true">
        <defs>
          <radialGradient id="${uid}Dome" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stop-color="${theme.domeTop}" />
            <stop offset="55%" stop-color="${theme.domeMid}" />
            <stop offset="100%" stop-color="${theme.domeBot}" />
          </radialGradient>
          <linearGradient id="${uid}Spire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${theme.spireTop}" />
            <stop offset="55%" stop-color="${theme.spireMid}" />
            <stop offset="100%" stop-color="${theme.spireBot}" />
          </linearGradient>
        </defs>
        ${tier >= 5 ? `<circle cx="90" cy="52" r="50" fill="${theme.haloInner}" opacity="0.65" />` : ''}
        <ellipse cx="90" cy="96" rx="${46 + tier * 6}" ry="11" fill="rgba(6, 17, 33, 0.45)" />
        ${tier >= 4 ? `
          <rect x="68" y="34" width="44" height="58" fill="url(#${uid}Dome)" stroke="${theme.rim}" stroke-width="1.2" />
          <polygon points="90,${tier >= 5 ? 6 : 14} 108,34 72,34" fill="url(#${uid}Spire)" stroke="${theme.rim}" stroke-width="1" />
          <circle cx="90" cy="48" r="7" fill="${theme.lanternGlow}" stroke="${theme.rim}" stroke-width="1" />
        ` : ''}
        ${tier >= 3 ? `
          <rect x="38" y="64" width="104" height="28" fill="url(#${uid}Dome)" stroke="${theme.mortar}" stroke-width="1" />
          <rect x="34" y="54" width="14" height="38" fill="url(#${uid}Dome)" stroke="${theme.rim}" stroke-width="1" />
          <polygon points="41,34 50,54 32,54" fill="url(#${uid}Spire)" />
          <rect x="132" y="54" width="14" height="38" fill="url(#${uid}Dome)" stroke="${theme.rim}" stroke-width="1" />
          <polygon points="139,34 148,54 130,54" fill="url(#${uid}Spire)" />
          <polygon points="41,34 51,37 41,40" fill="${theme.bannerPrimary}" />
          <polygon points="139,34 149,37 139,40" fill="${theme.bannerPrimary}" />
        ` : ''}
        ${tier >= 2 ? `
          <polygon points="56,48 64,92 48,92" fill="url(#${uid}Spire)" stroke="${theme.rim}" stroke-width="0.9" />
          <polygon points="124,48 132,92 116,92" fill="url(#${uid}Spire)" stroke="${theme.rim}" stroke-width="0.9" />
        ` : ''}
        <path d="M56,92 A34,34 0 0,1 124,92 Z" fill="url(#${uid}Dome)" stroke="${theme.rim}" stroke-width="1.4" />
        <path d="M76,92 A14,14 0 0,1 104,92 Z" fill="${theme.doorArch}" />
        <path d="M80,92 A10,10 0 0,1 100,92 Z" fill="${theme.doorCore}" />
        ${tier >= 1 ? `
          <circle cx="71" cy="84" r="3.4" fill="${theme.lanternGlow}" />
          <circle cx="109" cy="84" r="3.4" fill="${theme.lanternGlow}" />
        ` : ''}
        ${tier >= 5 ? `<circle cx="90" cy="7" r="4" fill="${theme.lanternGlow}" />` : ''}
      </svg>
    `;
  }

  return {
    drawIglooCastle,
    getSvgCastlePreviewMarkup
  };
});
