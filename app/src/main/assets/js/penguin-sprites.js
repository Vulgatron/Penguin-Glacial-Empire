(function (root, factory) {
  const gameData = (typeof module === 'object' && module.exports)
    ? require('./game-data.js')
    : (root.GlacialCore && root.GlacialCore.GameData);
  const wardrobe = (typeof module === 'object' && module.exports)
    ? require('./wardrobe.js')
    : (root.GlacialCore && root.GlacialCore.Wardrobe);
  const api = factory(gameData, wardrobe);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.PenguinSprites = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GameData, Wardrobe) {
  'use strict';

  const PENGUIN_SPRITE_CACHE = {};

  function clearPenguinSpriteCache() {
    Object.keys(PENGUIN_SPRITE_CACHE).forEach(k => {
      delete PENGUIN_SPRITE_CACHE[k];
    });
  }

  const PenguinSpriteRenderer = {
    getSpeciesScale(speciesId) {
      if (speciesId === 'emperor') return 1.32;
      if (speciesId === 'cyber') return 1.18;
      if (speciesId === 'chinstrap') return 1.14;
      if (speciesId === 'gentoo') return 1.12;
      return 1.06;
    },

    drawDetailedFish(ctx, x, y, angle = 0, scale = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);

      const fishGrad = ctx.createLinearGradient(0, -4, 0, 4);
      fishGrad.addColorStop(0, '#0284c7');
      fishGrad.addColorStop(0.5, '#38bdf8');
      fishGrad.addColorStop(1, '#e0f2fe');

      // Tail fin
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-12, -4.5);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-12, 4.5);
      ctx.closePath();
      ctx.fill();

      // Dorsal fin
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.moveTo(-2, -3);
      ctx.lineTo(1, -6);
      ctx.lineTo(3, -2.5);
      ctx.closePath();
      ctx.fill();

      // Fish body
      ctx.fillStyle = fishGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6, 24, 52, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Gill & Eye
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(2.5, 0, 2.2, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4.8, -0.8, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(5.1, -0.8, 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },

    drawEye(ctx, x, y, speciesId, blink, happy) {
      if (speciesId === 'cyber') {
        ctx.save();
        const visorGrad = ctx.createLinearGradient(x - 5, y - 3, x + 6, y + 3);
        visorGrad.addColorStop(0, '#0284c7');
        visorGrad.addColorStop(0.55, '#38bdf8');
        visorGrad.addColorStop(1, '#e0f2fe');

        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.roundRect(x - 5.2, y - 3.6, 11.4, 6.8, 3);
        ctx.fill();

        ctx.fillStyle = visorGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - 4.4, y - 2.8, 10.2, 5.2, 2.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.roundRect(x - 2.6, y - 1.8, 5.4, 1.4, 0.7);
        ctx.fill();

        if (happy) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(x + 2.5, y - 0.1, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      ctx.save();
      if (speciesId === 'adelie') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (speciesId === 'emperor') {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(x, y, 3.0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (happy) {
        ctx.strokeStyle = speciesId === 'chinstrap' ? '#0f172a' : '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y + 0.8, 2.2, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else if (blink) {
        ctx.strokeStyle = speciesId === 'chinstrap' ? '#0f172a' : '#cbd5e1';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 2.2, y);
        ctx.lineTo(x + 2.2, y);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(x + 0.6, y, 1.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + 1.1, y - 0.65, 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 0.1, y + 0.7, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      if (speciesId === 'chinstrap') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.roundRect(x - 3.6, y - 3.1, 7.6, 6.0, 2.5);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#075985';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - 3.6, y - 0.2);
        ctx.lineTo(x - 10.5, y - 0.6);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x - 1.5, y - 1.9);
        ctx.lineTo(x + 1.4, y - 1.9);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawBeak(ctx, x, y, speciesId, angle = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      let topColor = '#fbbf24';
      let botColor = '#d97706';
      if (speciesId === 'gentoo') {
        topColor = '#fb923c';
        botColor = '#dc2626';
      } else if (speciesId === 'emperor') {
        topColor = '#1e293b';
        botColor = '#f43f5e';
      } else if (speciesId === 'cyber') {
        topColor = '#94a3b8';
        botColor = '#475569';
      } else if (speciesId === 'chinstrap') {
        topColor = '#334155';
        botColor = '#0f172a';
      }

      ctx.fillStyle = topColor;
      ctx.beginPath();
      ctx.moveTo(-1, -2.5);
      ctx.quadraticCurveTo(5, -2.2, 8.2, -0.2);
      ctx.lineTo(-1, 0.3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = botColor;
      ctx.beginPath();
      ctx.moveTo(-1, 0.2);
      ctx.lineTo(7.4, 0.1);
      ctx.quadraticCurveTo(4.2, 2.3, -1, 2.1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(6, 17, 33, 0.6)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(-1, -2.5);
      ctx.quadraticCurveTo(5, -2.2, 8.2, -0.2);
      ctx.quadraticCurveTo(4.5, 2.3, -1, 2.1);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.ellipse(2.2, -1.2, 2.2, 0.55, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },

    drawFootGear(ctx, x, y, speciesId, tilt = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);

      if (speciesId === 'cyber') {
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(-4.5, -2.2, 9.5, 4.4, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(1.8, -1, 2.5, 1.8);
        ctx.restore();
        return;
      }

      if (speciesId === 'chinstrap') {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.ellipse(-1.5, 0, 3.6, 2.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(-1, -1.8);
        ctx.lineTo(7.5, -3.0);
        ctx.quadraticCurveTo(8.5, 0, 7.5, 3.0);
        ctx.lineTo(-1, 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        return;
      }

      const footGrad = ctx.createLinearGradient(0, -3, 0, 3);
      footGrad.addColorStop(0, '#fb923c');
      footGrad.addColorStop(1, '#c2410c');
      ctx.fillStyle = footGrad;
      ctx.strokeStyle = 'rgba(124, 45, 18, 0.7)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.ellipse(1, 0, 5.2, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (speciesId === 'gentoo') {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-2, 2.2);
        ctx.lineTo(-2, 4.3);
        ctx.moveTo(3, 2.2);
        ctx.lineTo(3, 4.3);
        ctx.stroke();

        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4.8, 4.5);
        ctx.lineTo(6.2, 4.5);
        ctx.quadraticCurveTo(8.2, 4.3, 8.6, 2.7);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawBodyAndGearStanding(ctx, opts) {
      const {
        speciesId = 'adelie',
        stepPhase = 0,
        blink = false,
        happy = false,
        carryingFish = false,
        time = 0,
        isPortrait = false,
        hatId = 'none'
      } = opts;

      const waddleAmp = isPortrait ? 0 : Math.sin(stepPhase) * 0.11;
      const footSwing = isPortrait ? 0 : Math.sin(stepPhase) * 3.8;
      const breathe = Math.sin(time * 3.2 + stepPhase * 0.3) * 0.45;
      const flutter = Math.sin(time * 6.5 + stepPhase) * 2.2;

      if (speciesId === 'emperor' && !isPortrait) {
        ctx.save();
        const auraPulse = 0.85 + Math.sin(time * 3.5) * 0.15;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.42 * auraPulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 14.5, 29 * auraPulse, 11 * auraPulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(253, 230, 138, ${0.28 * auraPulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 14.5, 22 * auraPulse, 8 * auraPulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (speciesId === 'cyber' && !isPortrait) {
        ctx.save();
        const pulse = 0.85 + Math.sin(time * 5) * 0.15;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 14.5, 19 * pulse, 6.5 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.rotate(waddleAmp);

      if (!isPortrait) {
        ctx.fillStyle = 'rgba(6, 20, 44, 0.34)';
        ctx.beginPath();
        ctx.ellipse(0, 14.5, 13.5, 4.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (speciesId === 'emperor') {
        ctx.save();
        const capeGrad = ctx.createLinearGradient(-15, -4, -18, 15);
        capeGrad.addColorStop(0, '#9333ea');
        capeGrad.addColorStop(1, '#581c87');
        ctx.fillStyle = capeGrad;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.quadraticCurveTo(-18 - flutter * 0.4, 3, -17 - flutter * 0.6, 14);
        ctx.quadraticCurveTo(-8, 15, -3, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (speciesId === 'chinstrap') {
        ctx.save();
        const tankGrad = ctx.createLinearGradient(-14, -7, -6, 9);
        tankGrad.addColorStop(0, '#e2e8f0');
        tankGrad.addColorStop(0.55, '#94a3b8');
        tankGrad.addColorStop(1, '#475569');
        ctx.fillStyle = tankGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-14.5, -5.5, 6.8, 13.5, 3.2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-14.2, -1.5, 6.2, 2.8);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-12.2, -7.8, 2.4, 2.4);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-11, -7.5);
        ctx.quadraticCurveTo(-7, -11, -2, -7.5);
        ctx.stroke();
        ctx.restore();
      } else if (speciesId === 'cyber') {
        ctx.save();
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-14.5, -5, 6.5, 11.5, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-13.2, -2, 3.8, 3);
        const flameLen = isPortrait ? 5.5 : (6 + Math.sin(time * 28) * 2.5);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.beginPath();
        ctx.moveTo(-14, 6.5);
        ctx.lineTo(-11.2, 6.5 + flameLen + 2);
        ctx.lineTo(-8.5, 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(-13, 6.5);
        ctx.lineTo(-11.2, 6.5 + flameLen * 0.65);
        ctx.lineTo(-9.5, 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (speciesId === 'adelie') {
        ctx.save();
        ctx.fillStyle = '#0f766e';
        ctx.beginPath();
        ctx.moveTo(-5, -5.5);
        ctx.quadraticCurveTo(-15, -4 - flutter * 0.45, -16.5, -0.5 - flutter * 0.6);
        ctx.lineTo(-11, 2.5 - flutter * 0.3);
        ctx.quadraticCurveTo(-7, -1, -4, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(-13.2, -2, 5.2, 9.5, 2.2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (speciesId === 'gentoo') {
        ctx.save();
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-5, -5.5);
        ctx.quadraticCurveTo(-16, -5 + flutter * 0.5, -18, -1.5 + flutter * 0.7);
        ctx.lineTo(-12, 1.5 + flutter * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-15, -3 + flutter * 0.4, 3.2, 2.2);
        ctx.restore();
      }

      this.drawFootGear(ctx, -4.5, 11.8 + footSwing * 0.45, speciesId, -0.06);
      this.drawFootGear(ctx, 5.0, 12.2 - footSwing * 0.45, speciesId, 0.04);

      ctx.fillStyle = speciesId === 'cyber' ? '#475569' : '#0b1528';
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.lineTo(-14.5, 10.5);
      ctx.lineTo(-9, 12);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.translate(6.5, -2.5);
      ctx.rotate(isPortrait ? -0.15 : Math.sin(stepPhase) * 0.35);
      ctx.fillStyle = speciesId === 'cyber' ? '#1e293b' : '#091120';
      ctx.beginPath();
      ctx.ellipse(2.5, 4.5, 2.6, 6.8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const bodyGrad = ctx.createLinearGradient(-11, -16, 11, 13);
      if (speciesId === 'cyber') {
        bodyGrad.addColorStop(0, '#64748b');
        bodyGrad.addColorStop(0.55, '#334155');
        bodyGrad.addColorStop(1, '#0f172a');
      } else if (speciesId === 'emperor') {
        bodyGrad.addColorStop(0, '#1e293b');
        bodyGrad.addColorStop(0.55, '#0f172a');
        bodyGrad.addColorStop(1, '#060c1a');
      } else {
        bodyGrad.addColorStop(0, '#1e293b');
        bodyGrad.addColorStop(0.6, '#0f172a');
        bodyGrad.addColorStop(1, '#050a14');
      }

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = 'rgba(2, 10, 24, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -17.5 - breathe * 0.4);
      ctx.bezierCurveTo(9.5, -17.5, 11.8, -8, 12.2, 1.5);
      ctx.bezierCurveTo(12.6, 10.5, 6.8, 13.5, 0, 13.5);
      ctx.bezierCurveTo(-8.2, 13.5, -12.6, 9.8, -12.2, 1.2);
      ctx.bezierCurveTo(-11.8, -8, -9.2, -17.5, 0, -17.5 - breathe * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = speciesId === 'cyber' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(125, 211, 252, 0.25)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-6.5, -13);
      ctx.quadraticCurveTo(-11.2, -4, -10.5, 7);
      ctx.stroke();

      if (speciesId === 'cyber') {
        const armorGrad = ctx.createLinearGradient(-3, -6, 10, 11);
        armorGrad.addColorStop(0, '#cbd5e1');
        armorGrad.addColorStop(0.6, '#94a3b8');
        armorGrad.addColorStop(1, '#475569');
        ctx.fillStyle = armorGrad;
        ctx.beginPath();
        ctx.ellipse(2.4, 3.2, 7.6, 9.4, 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.85;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.beginPath();
        ctx.moveTo(-3.5, 4);
        ctx.lineTo(8.5, 4);
        ctx.stroke();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.beginPath();
        ctx.arc(3.5, 0.2, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(3.5, 0.2, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(3.5, 0.2, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const bellyGrad = ctx.createRadialGradient(2.5, 0, 1, 2.2, 3, 12);
        if (speciesId === 'emperor') {
          bellyGrad.addColorStop(0, '#fffbeb');
          bellyGrad.addColorStop(0.65, '#fef3c7');
          bellyGrad.addColorStop(1, '#dbeafe');
        } else {
          bellyGrad.addColorStop(0, '#ffffff');
          bellyGrad.addColorStop(0.7, '#f1f5f9');
          bellyGrad.addColorStop(1, '#cbd5e1');
        }
        ctx.fillStyle = bellyGrad;
        ctx.beginPath();
        ctx.ellipse(2.3, 3.0, 7.6, 9.6, 0.05, 0, Math.PI * 2);
        ctx.fill();
      }

      if (speciesId === 'emperor') {
        const auricGrad = ctx.createLinearGradient(0, -12, 6, -2);
        auricGrad.addColorStop(0, '#f59e0b');
        auricGrad.addColorStop(0.55, '#fbbf24');
        auricGrad.addColorStop(1, '#fef08a');
        ctx.fillStyle = auricGrad;
        ctx.beginPath();
        ctx.moveTo(0.5, -11.5);
        ctx.bezierCurveTo(6.8, -11.5, 8.8, -7, 8.2, -3);
        ctx.bezierCurveTo(5.8, -1.5, 1.2, -3.5, 0.5, -7.5);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        const crownGrad = ctx.createLinearGradient(-6, -24, 6, -15);
        crownGrad.addColorStop(0, '#fde047');
        crownGrad.addColorStop(0.55, '#f59e0b');
        crownGrad.addColorStop(1, '#b45309');
        ctx.fillStyle = crownGrad;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(-5.8, -15.5);
        ctx.lineTo(-6.8, -22.2);
        ctx.lineTo(-2.6, -18.8);
        ctx.lineTo(0.2, -23.8);
        ctx.lineTo(3.2, -18.8);
        ctx.lineTo(7.0, -22.0);
        ctx.lineTo(6.0, -15.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0.2, -18.2, 1.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(-4.2, -17.5, 0.95, 0, Math.PI * 2);
        ctx.arc(4.5, -17.5, 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (speciesId === 'chinstrap') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(3.6, -9.2, 6.2, 4.8, 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.65;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1.2, -11.4);
        ctx.quadraticCurveTo(2.4, -4.6, 8.2, -6.2);
        ctx.stroke();
      } else if (speciesId === 'gentoo') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(1.2, -13.2, 5.6, 2.3, -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.roundRect(-7.5, -6.6, 15.8, 3.2, 1.6);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(1.5, -6.4, 3.5, 2.8);
      } else if (speciesId === 'adelie') {
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-6, -4.5);
        ctx.lineTo(7, 6.5);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(0.2, 0.5, 2.2, 2.2);

        ctx.fillStyle = '#0d9488';
        ctx.beginPath();
        ctx.roundRect(-7.2, -6.6, 15.2, 3.0, 1.5);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = '#0f766e';
        ctx.strokeStyle = '#042f2e';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, -14.8, 7.2, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(3.5, -14.8, 8.5, 2.0, -0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(2.4, -17.5, 1.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (speciesId === 'cyber') {
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-1, -17.2);
        ctx.lineTo(-2.5, -23.5);
        ctx.stroke();
        const beaconAlpha = 0.65 + Math.sin(time * 7) * 0.35;
        ctx.fillStyle = `rgba(56, 189, 248, ${0.35 * beaconAlpha})`;
        ctx.beginPath();
        ctx.arc(-2.5, -24, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-2.5, -24, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (speciesId !== 'cyber') {
        ctx.fillStyle = happy ? 'rgba(244, 63, 94, 0.42)' : 'rgba(251, 113, 133, 0.24)';
        ctx.beginPath();
        ctx.ellipse(2.0, -7.8, 2.1, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawBeak(ctx, 8.8, -9.2, speciesId, 0.04);
      this.drawEye(ctx, 4.6, -10.8, speciesId, blink, happy);

      if (carryingFish) {
        this.drawDetailedFish(ctx, 18.5, -7.5, 0.18, 0.95);
      }

      // Render equipped Colony Wardrobe accessory over head/neck
      if (hatId && hatId !== 'none' && Wardrobe && typeof Wardrobe.drawPenguinAccessory === 'function') {
        Wardrobe.drawPenguinAccessory(ctx, hatId, speciesId, 'standing', time);
      }

      const flipperSwing = isPortrait ? 0.12 : Math.sin(stepPhase) * 0.42;
      ctx.save();
      ctx.translate(-3.6, -2.5);
      ctx.rotate(-flipperSwing);
      if (speciesId === 'cyber') {
        const wingGrad = ctx.createLinearGradient(-4, 0, 2, 12);
        wingGrad.addColorStop(0, '#64748b');
        wingGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = wingGrad;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(-1.2, 5.2, 3.1, 7.8, -0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const flipGrad = ctx.createLinearGradient(-3, 0, 2, 12);
        flipGrad.addColorStop(0, '#1e293b');
        flipGrad.addColorStop(1, '#050a14');
        ctx.fillStyle = flipGrad;
        ctx.strokeStyle = 'rgba(2, 10, 24, 0.65)';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.ellipse(-1.2, 5.2, 3.2, 8.0, -0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(-1.2, 5.2, 7.2, Math.PI * 0.7, Math.PI * 1.15);
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();
    },

    drawBodyAndGearSliding(ctx, opts) {
      const {
        speciesId = 'adelie',
        stepPhase = 0,
        blink = false,
        happy = false,
        carryingFish = false,
        time = 0,
        hatId = 'none'
      } = opts;

      const flutter = Math.sin(time * 9 + stepPhase) * 2.5;
      const kick = Math.sin(stepPhase * 2) * 1.8;

      if (speciesId === 'emperor') {
        ctx.save();
        const auraPulse = 0.85 + Math.sin(time * 3.5) * 0.15;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.38 * auraPulse})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, 6, 32 * auraPulse, 11 * auraPulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(6, 20, 44, 0.32)';
      ctx.beginPath();
      ctx.ellipse(0, 7.5, 20, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (speciesId === 'gentoo') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-26, 7);
        ctx.lineTo(-10, 7);
        ctx.stroke();
      }

      this.drawFootGear(ctx, -16, 2.2 + kick * 0.6, speciesId, 0.35);

      if (speciesId === 'cyber') {
        const flameLen = 11 + Math.sin(time * 30) * 4;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.beginPath();
        ctx.moveTo(-16, -2);
        ctx.lineTo(-18 - flameLen - 4, 1);
        ctx.lineTo(-16, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(-16, -0.5);
        ctx.lineTo(-17 - flameLen * 0.65, 1.2);
        ctx.lineTo(-16, 3);
        ctx.closePath();
        ctx.fill();
      } else if (speciesId === 'emperor') {
        ctx.fillStyle = '#7e22ce';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, -5);
        ctx.quadraticCurveTo(-10, -8 - flutter * 0.5, -22, -2 - flutter * 0.7);
        ctx.lineTo(-15, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (speciesId === 'adelie') {
        ctx.fillStyle = '#0f766e';
        ctx.beginPath();
        ctx.moveTo(8, -5);
        ctx.quadraticCurveTo(-2, -9 + flutter * 0.4, -12, -5 + flutter * 0.6);
        ctx.lineTo(-6, -1.5);
        ctx.closePath();
        ctx.fill();
      } else if (speciesId === 'gentoo') {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(8, -5);
        ctx.quadraticCurveTo(-3, -8 + flutter * 0.5, -13, -4 + flutter * 0.7);
        ctx.lineTo(-7, -1);
        ctx.closePath();
        ctx.fill();
      }

      const torsoGrad = ctx.createLinearGradient(0, -6, 0, 8);
      if (speciesId === 'cyber') {
        torsoGrad.addColorStop(0, '#64748b');
        torsoGrad.addColorStop(1, '#1e293b');
      } else {
        torsoGrad.addColorStop(0, '#1e293b');
        torsoGrad.addColorStop(1, '#091120');
      }
      ctx.fillStyle = torsoGrad;
      ctx.strokeStyle = 'rgba(2, 10, 24, 0.7)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.ellipse(-1, 1.5, 16.5, 6.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = speciesId === 'cyber' ? '#94a3b8' : (speciesId === 'emperor' ? '#fef3c7' : '#ffffff');
      ctx.beginPath();
      ctx.ellipse(1, 5.2, 13, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (speciesId === 'chinstrap') {
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(-8, -8.5, 12.5, 5.2, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-3, -8.3, 3, 4.8);
      }

      ctx.save();
      ctx.translate(13.5, -3.5);

      ctx.fillStyle = speciesId === 'cyber' ? '#475569' : '#0f172a';
      ctx.strokeStyle = 'rgba(2, 10, 24, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (speciesId === 'emperor') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(2.2, 1.5, 3.2, 2.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-4, -5.8);
        ctx.lineTo(-4.5, -11);
        ctx.lineTo(-1.5, -8);
        ctx.lineTo(0.2, -12);
        ctx.lineTo(2, -8);
        ctx.lineTo(4.6, -10.8);
        ctx.lineTo(4, -5.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (speciesId === 'chinstrap') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(2.2, 1.5, 4.2, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-1.5, -0.5);
        ctx.quadraticCurveTo(1.2, 4.2, 5.2, 3.0);
        ctx.stroke();
      } else if (speciesId === 'gentoo') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0.5, -3.8, 4.0, 1.6, -0.15, 0, Math.PI * 2);
        ctx.fill();
      } else if (speciesId === 'adelie') {
        ctx.fillStyle = '#0f766e';
        ctx.beginPath();
        ctx.arc(0, -4.2, 5.4, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(2.5, -4.2, 6.2, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (speciesId === 'cyber') {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-1, -6.5);
        ctx.lineTo(-2.5, -11.5);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-2.5, -12, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawBeak(ctx, 5.8, 0.2, speciesId, 0.06);
      this.drawEye(ctx, 2.2, -1.6, speciesId, blink, happy);

      if (carryingFish) {
        this.drawDetailedFish(ctx, 13.5, 1.2, 0.1, 0.88);
      }

      if (hatId && hatId !== 'none' && Wardrobe && typeof Wardrobe.drawPenguinAccessory === 'function') {
        Wardrobe.drawPenguinAccessory(ctx, hatId, speciesId, 'sliding', time);
      }

      ctx.restore();

      ctx.save();
      ctx.translate(1.5, 1.8);
      ctx.rotate(0.28 + Math.sin(stepPhase) * 0.12);
      ctx.fillStyle = speciesId === 'cyber' ? '#38bdf8' : '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-4.5, 0, 6.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    drawBodyAndGearSleeping(ctx, opts) {
      const {
        speciesId = 'adelie',
        stepPhase = 0,
        time = 0,
        hatId = 'none'
      } = opts;

      const breathe = Math.sin(time * 2.1 + stepPhase * 0.25) * 0.85;
      const headBob = Math.sin(time * 2.1 + stepPhase * 0.25 - 0.5) * 0.55;

      ctx.fillStyle = 'rgba(6, 20, 44, 0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 14.5, 16.5, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (speciesId === 'emperor') {
        ctx.save();
        const auraPulse = 0.75 + Math.sin(time * 2.0) * 0.12;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.26 * auraPulse})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 14.5, 24 * auraPulse, 8.5 * auraPulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (speciesId === 'cyber') {
        ctx.save();
        const pulse = 0.75 + Math.sin(time * 2.2) * 0.15;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.28 * pulse})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 14.5, 16 * pulse, 5.5 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (speciesId === 'emperor') {
        ctx.save();
        ctx.fillStyle = '#7e22ce';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-4, -3.5);
        ctx.quadraticCurveTo(-15, 2, -16, 11);
        ctx.quadraticCurveTo(-9, 13.5, -2, 10.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (speciesId === 'chinstrap') {
        ctx.save();
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(-14.2, -3.5, 6.4, 12.2, 3.0);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-13.9, 0.2, 5.8, 2.5);
        ctx.restore();
      } else if (speciesId === 'cyber') {
        ctx.save();
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(-14.0, -3.0, 6.0, 10.8, 2.4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fillRect(-12.8, -0.5, 3.6, 2.6);
        ctx.restore();
      }

      this.drawFootGear(ctx, -4.0, 12.8, speciesId, -0.04);
      this.drawFootGear(ctx, 4.6, 13.0, speciesId, 0.04);

      ctx.fillStyle = speciesId === 'cyber' ? '#475569' : '#0b1528';
      ctx.beginPath();
      ctx.moveTo(-7, 8);
      ctx.lineTo(-14.2, 11.2);
      ctx.lineTo(-9, 12.6);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.translate(0, 1.8);
      const bodyGrad = ctx.createLinearGradient(-12, -12, 12, 13);
      if (speciesId === 'cyber') {
        bodyGrad.addColorStop(0, '#64748b');
        bodyGrad.addColorStop(0.55, '#334155');
        bodyGrad.addColorStop(1, '#0f172a');
      } else {
        bodyGrad.addColorStop(0, '#1e293b');
        bodyGrad.addColorStop(0.6, '#0f172a');
        bodyGrad.addColorStop(1, '#050a14');
      }
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = 'rgba(2, 10, 24, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 1.5 - breathe * 0.25, 13.0 + breathe * 0.35, 11.8 + breathe * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (speciesId === 'cyber') {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(2.2, 3.2, 7.6, 8.2, 0.05, 0, Math.PI * 2);
        ctx.fill();
        const coreAlpha = 0.35 + (Math.sin(time * 2.1) + 1) * 0.22;
        ctx.fillStyle = `rgba(56, 189, 248, ${coreAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(3.2, 1.5, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = speciesId === 'emperor' ? '#fef3c7' : '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(2.2, 3.0, 7.8, 8.4, 0.06, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(1.8, -7.8 + headBob);
      ctx.rotate(0.42);

      ctx.fillStyle = speciesId === 'cyber' ? '#475569' : '#0f172a';
      ctx.strokeStyle = 'rgba(2, 10, 24, 0.72)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.4, 7.5, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (speciesId === 'emperor') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(2.2, 2.2, 3.5, 2.2, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-4.8, -5.6);
        ctx.lineTo(-5.5, -11.2);
        ctx.lineTo(-1.8, -8.5);
        ctx.lineTo(0.4, -12.4);
        ctx.lineTo(2.8, -8.5);
        ctx.lineTo(5.8, -11.0);
        ctx.lineTo(5.0, -5.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (speciesId === 'chinstrap') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(3.0, 1.0, 5.2, 3.8, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(-1.0, -0.8);
        ctx.quadraticCurveTo(2.2, 4.2, 7.0, 2.6);
        ctx.stroke();
      } else if (speciesId === 'gentoo') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0.8, -3.5, 4.8, 2.0, -0.15, 0, Math.PI * 2);
        ctx.fill();
      } else if (speciesId === 'adelie') {
        ctx.fillStyle = '#0f766e';
        ctx.strokeStyle = '#042f2e';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.arc(0, -4.6, 6.6, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(3.2, -4.6, 7.6, 1.8, -0.05, 0, Math.PI * 2);
        ctx.fill();
      } else if (speciesId === 'cyber') {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-1, -7.2);
        ctx.lineTo(-2.2, -12.5);
        ctx.stroke();
        const sleepLed = 0.25 + (Math.sin(time * 2.2) + 1) * 0.35;
        ctx.fillStyle = `rgba(56, 189, 248, ${sleepLed.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(-2.2, -13.0, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (speciesId !== 'cyber') {
        ctx.fillStyle = 'rgba(251, 113, 133, 0.30)';
        ctx.beginPath();
        ctx.ellipse(1.8, 1.8, 2.0, 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawBeak(ctx, 6.8, 1.4, speciesId, 0.34);

      if (speciesId === 'cyber') {
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(1.6, -0.6);
        ctx.lineTo(5.8, -0.2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.45;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(3.8, -1.0, 2.1, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }

      if (hatId && hatId !== 'none' && Wardrobe && typeof Wardrobe.drawPenguinAccessory === 'function') {
        Wardrobe.drawPenguinAccessory(ctx, hatId, speciesId, 'sleeping', time);
      }

      ctx.restore(); // end tucked head

      if (speciesId === 'gentoo' || speciesId === 'adelie') {
        ctx.fillStyle = speciesId === 'gentoo' ? '#ea580c' : '#0d9488';
        ctx.beginPath();
        ctx.roundRect(-7.2, -4.8, 15.0, 3.0, 1.5);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(-2.2, -1.2);
      ctx.rotate(-0.62 + breathe * 0.04);
      ctx.fillStyle = speciesId === 'cyber' ? '#334155' : '#0f172a';
      ctx.strokeStyle = speciesId === 'cyber' ? '#38bdf8' : 'rgba(2, 10, 24, 0.65)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.ellipse(1.5, 4.2, 3.2, 7.6, -0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // end torso translate
    },

    draw(ctx, opts = {}) {
      const speciesId = opts.speciesId || 'adelie';
      const pose = opts.pose || 'waddle';
      const scale = (opts.scale || 1) * this.getSpeciesScale(speciesId);

      ctx.save();
      ctx.scale(scale, scale);

      if (pose === 'slide') {
        this.drawBodyAndGearSliding(ctx, opts);
      } else if (pose === 'sleep') {
        this.drawBodyAndGearSleeping(ctx, opts);
      } else {
        this.drawBodyAndGearStanding(ctx, { ...opts, isPortrait: pose === 'portrait' });
      }

      ctx.restore();
    }
  };

  function getPenguinPortraitDataUrl(speciesId, hatId = 'none') {
    const safeHat = hatId || 'none';
    const cacheKey = `${speciesId}_${safeHat}`;
    if (PENGUIN_SPRITE_CACHE[cacheKey]) {
      return PENGUIN_SPRITE_CACHE[cacheKey];
    }
    try {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return '';
      }
      const off = document.createElement('canvas');
      off.width = 112;
      off.height = 112;
      const octx = off.getContext('2d');
      if (!octx || typeof octx.createLinearGradient !== 'function') {
        return '';
      }
      const speciesList = (GameData && Array.isArray(GameData.PENGUIN_SPECIES)) ? GameData.PENGUIN_SPECIES : [];
      const sp = speciesList.find(s => s.id === speciesId);
      const accent = sp ? sp.accentColor : '#38bdf8';

      if (typeof octx.createRadialGradient === 'function') {
        const halo = octx.createRadialGradient(56, 62, 6, 56, 62, 48);
        halo.addColorStop(0, accent + '55');
        halo.addColorStop(1, 'rgba(6, 17, 33, 0)');
        octx.fillStyle = halo;
        octx.fillRect(0, 0, 112, 112);
      }

      octx.save();
      octx.translate(54, 68);
      const portraitScale = speciesId === 'emperor' ? 1.78 : 1.98;
      PenguinSpriteRenderer.draw(octx, {
        speciesId,
        hatId: safeHat,
        pose: 'portrait',
        stepPhase: 0.4,
        blink: false,
        happy: false,
        carryingFish: false,
        time: 0.6,
        scale: portraitScale
      });
      octx.restore();

      const url = typeof off.toDataURL === 'function' ? off.toDataURL('image/png') : '';
      PENGUIN_SPRITE_CACHE[cacheKey] = url;
      return url;
    } catch (_) {
      return '';
    }
  }

  return {
    PENGUIN_SPRITE_CACHE,
    PenguinSpriteRenderer,
    getPenguinPortraitDataUrl,
    clearPenguinSpriteCache
  };
});
