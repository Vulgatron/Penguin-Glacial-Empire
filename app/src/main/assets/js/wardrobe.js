(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.Wardrobe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SPECIES_IDS = ['adelie', 'gentoo', 'chinstrap', 'emperor', 'cyber'];
  const DEFAULT_CONFIRM_WINDOW_MS = 4000;
  const WARDROBE_MIN_REBIRTHS = 6;
  const EMPEROR_BLOCKED_HATS = new Set(['star_crown']);

  // Ultra-Prestige Frost Essence Cosmetic Wardrobe (Purely Visual • Resets on Rebirth • Never Achievement-Locked)
  const WARDROBE_ITEMS = [
    {
      id: 'none',
      name: 'Natural Plumage',
      icon: '🐧',
      costEssence: 0,
      accent: '#94a3b8',
      desc: 'Classic arctic tuxedo with no extra hat or accessory.'
    },
    {
      id: 'scarf',
      name: 'Knitted Polar Scarf',
      icon: '🧣',
      costEssence: 100,
      accent: '#f43f5e',
      desc: 'Hand-knit crimson & frost winter scarf fluttering in polar winds.'
    },
    {
      id: 'goggles',
      name: 'Abyssal Diver Goggles',
      icon: '🥽',
      costEssence: 350,
      accent: '#38bdf8',
      desc: 'Brass-rimmed deep-sea goggles with glowing aqua lenses.'
    },
    {
      id: 'parade_cap',
      name: 'Parade Conductor Cap',
      icon: '🎩',
      costEssence: 1000,
      accent: '#818cf8',
      desc: 'Royal navy bandleader cap trimmed in gold braid with a plume.'
    },
    {
      id: 'star_crown',
      name: 'Starlight Crown',
      icon: '👑',
      costEssence: 3000,
      accent: '#fbbf24',
      desc: 'Radiant celestial tiara forged from shimmering starlight spires.'
    },
    {
      id: 'aurora_halo',
      name: 'Aurora Halo',
      icon: '🌌',
      costEssence: 10000,
      accent: '#34d399',
      desc: 'Floating iridescent emerald-violet aurora ring orbiting overhead.'
    }
  ];

  const VALID_HAT_IDS = WARDROBE_ITEMS.map(item => item.id);
  const VALID_HAT_SET = new Set(VALID_HAT_IDS);

  function getWardrobeItem(hatId) {
    return WARDROBE_ITEMS.find(item => item.id === hatId) || WARDROBE_ITEMS[0];
  }

  function isValidHatId(hatId) {
    return typeof hatId === 'string' && VALID_HAT_SET.has(hatId);
  }

  function isWardrobeUnlocked(totalRebirths = 0) {
    const n = Number(totalRebirths);
    return Number.isFinite(n) && Math.floor(n) >= WARDROBE_MIN_REBIRTHS;
  }

  function canSpeciesWearHat(speciesId, hatId) {
    if (!isValidHatId(hatId)) return false;
    if (speciesId === 'emperor' && EMPEROR_BLOCKED_HATS.has(hatId)) return false;
    return true;
  }

  function resolveHatForSpecies(speciesId, equippedHat = 'none', speciesHats = null) {
    const candidate = (speciesHats && typeof speciesHats === 'object' && typeof speciesHats[speciesId] === 'string')
      ? speciesHats[speciesId]
      : equippedHat;
    if (!canSpeciesWearHat(speciesId, candidate)) return 'none';
    return candidate;
  }

  function createDefaultSpeciesHats() {
    const map = {};
    SPECIES_IDS.forEach(spId => {
      map[spId] = 'none';
    });
    return map;
  }

  function sanitizeWardrobeState(rawUnlockedHats, rawEquippedHat, rawSpeciesHats) {
    const unlockedSet = new Set(['none']);
    if (Array.isArray(rawUnlockedHats)) {
      rawUnlockedHats.forEach(id => {
        if (isValidHatId(id)) {
          unlockedSet.add(id);
        }
      });
    }

    const equippedHat = (isValidHatId(rawEquippedHat) && unlockedSet.has(rawEquippedHat))
      ? rawEquippedHat
      : 'none';

    const speciesHats = createDefaultSpeciesHats();
    const hasSpeciesMap = Boolean(rawSpeciesHats && typeof rawSpeciesHats === 'object' && !Array.isArray(rawSpeciesHats));
    SPECIES_IDS.forEach(spId => {
      const candidate = hasSpeciesMap ? rawSpeciesHats[spId] : equippedHat;
      if (isValidHatId(candidate) && unlockedSet.has(candidate) && canSpeciesWearHat(spId, candidate)) {
        speciesHats[spId] = candidate;
      } else {
        speciesHats[spId] = 'none';
      }
    });

    return {
      unlockedHats: Array.from(unlockedSet),
      equippedHat,
      speciesHats
    };
  }

  /**
   * Inline tap-again safety guard for high-value Frost Essence purchases.
   * First tap arms confirmation for 4 seconds; second tap on the same item confirms spend.
   */
  function createPurchaseGuard(confirmWindowMs = DEFAULT_CONFIRM_WINDOW_MS) {
    const windowMs = Math.max(500, Number(confirmWindowMs) || DEFAULT_CONFIRM_WINDOW_MS);
    let armedHatId = null;
    let armedScope = null;
    let armedExpiresAt = 0;

    function disarm() {
      armedHatId = null;
      armedScope = null;
      armedExpiresAt = 0;
    }

    function getArmed(nowMs = Date.now()) {
      if (!armedHatId) return null;
      const remainingMs = armedExpiresAt - nowMs;
      if (remainingMs <= 0) {
        disarm();
        return null;
      }
      return {
        hatId: armedHatId,
        scope: armedScope,
        remainingMs,
        expiresAt: armedExpiresAt
      };
    }

    function armOrConfirm(hatId, scope = 'all', nowMs = Date.now()) {
      const current = getArmed(nowMs);
      if (current && current.hatId === hatId && current.scope === scope) {
        disarm();
        return { confirmed: true, armed: false };
      }
      armedHatId = hatId;
      armedScope = scope;
      armedExpiresAt = nowMs + windowMs;
      return {
        confirmed: false,
        armed: true,
        hatId: armedHatId,
        scope: armedScope,
        expiresAt: armedExpiresAt
      };
    }

    return {
      armOrConfirm,
      getArmed,
      disarm,
      windowMs
    };
  }

  /**
   * Vector Canvas renderer for wearable penguin hats & accessories across all 3 poses:
   * - 'standing' (waddle / portrait): body origin (0, 0), head crown ~ (0, -17), eye ~ (4.6, -10.8), neck ~ (0, -6.4)
   * - 'sliding': already inside lifted head local frame (center 0,0; radius ~6.8; eye ~ 2.2,-1.6)
   * - 'sleeping': already inside tucked tilted head local frame (center 0,0; rx 8.4, ry 7.5; eye ~ 3.8,-1.0)
   */
  function drawPenguinAccessory(ctx, hatId, speciesId, pose, time) {
    if (!ctx || !hatId || hatId === 'none') return;
    if (!canSpeciesWearHat(speciesId, hatId)) return;
    const t = Number.isFinite(time) ? time : 0;
    const flutter = Math.sin(t * 7.2) * 1.8;

    ctx.save();

    if (pose === 'sliding') {
      // Head radius ~6.8 centered at (0,0)
      drawAccessoryAtFrame(ctx, hatId, {
        headTopY: -6.2,
        headScale: 0.78,
        eyeX: 2.2,
        eyeY: -1.6,
        neckX: -2.2,
        neckY: 4.8,
        speciesId,
        time: t,
        flutter,
        isSliding: true
      });
    } else if (pose === 'sleeping') {
      // Tucked head ellipse rx=8.4, ry=7.5 centered at (0,0)
      drawAccessoryAtFrame(ctx, hatId, {
        headTopY: -6.8,
        headScale: 0.90,
        eyeX: 3.4,
        eyeY: -1.0,
        neckX: -0.5,
        neckY: 6.2,
        speciesId,
        time: t,
        flutter: flutter * 0.25,
        isSleeping: true
      });
    } else {
      // Standing / portrait: head top around y=-17.2, eye at (4.6, -10.8), neck at (0, -6.2)
      const emperorLift = speciesId === 'emperor' ? -1.4 : 0;
      drawAccessoryAtFrame(ctx, hatId, {
        headTopY: -16.8 + emperorLift,
        headScale: 1.0,
        eyeX: 4.6,
        eyeY: -10.8,
        neckX: 0,
        neckY: -6.2,
        speciesId,
        time: t,
        flutter
      });
    }

    ctx.restore();
  }

  function drawAccessoryAtFrame(ctx, hatId, f) {
    const s = f.headScale || 1;

    if (hatId === 'scarf') {
      // Cozy crimson & frost-white knitted polar scarf around neck with fluttering tails
      ctx.save();
      ctx.translate(f.neckX, f.neckY);
      ctx.scale(s, s);

      // Trailing knit tail
      ctx.fillStyle = '#e11d48';
      ctx.strokeStyle = '#881337';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(-4.5, 0.5);
      ctx.quadraticCurveTo(-13.5, 2.2 + f.flutter * 0.6, -15.5, 7.2 + f.flutter);
      ctx.lineTo(-11.2, 8.8 + f.flutter * 0.85);
      ctx.quadraticCurveTo(-8.2, 4.2 + f.flutter * 0.4, -2.5, 2.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Frost stripes on tail
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-13.2, 4.4 + f.flutter * 0.72, 3.2, 1.5);

      // Cozy wrap collar
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#881337';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-8.4, -1.8, 17.2, 4.0, 2.0);
      } else {
        ctx.rect(-8.4, -1.8, 17.2, 4.0);
      }
      ctx.fill();
      ctx.stroke();

      // Nordic knit stripe & knot
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(-3.6, -1.4, 2.4, 3.2);
      ctx.fillRect(2.2, -1.4, 2.4, 3.2);
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.arc(-4.2, 0.8, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (hatId === 'goggles') {
      // Brass-rimmed Abyssal Diver Goggles perched on forehead/brow
      ctx.save();
      ctx.translate(f.eyeX * 0.55, f.headTopY + 4.4 * s);
      ctx.scale(s, s);

      // Leather goggle strap around crown
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-9.2, 0.4);
      ctx.quadraticCurveTo(-2, -0.8, 6.2, 0);
      ctx.stroke();

      // Brass dual-lens frames
      const drawLens = (lx, ly, r) => {
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.arc(lx, ly, r + 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const lensGrad = ctx.createRadialGradient(lx - 0.6, ly - 0.6, 0.3, lx, ly, r);
        lensGrad.addColorStop(0, '#e0f2fe');
        lensGrad.addColorStop(0.55, '#38bdf8');
        lensGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fill();

        // Crisp glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(lx - 0.7, ly - 0.8, 0.75, 0, Math.PI * 2);
        ctx.fill();
      };

      drawLens(-1.6, 0.2, 2.6);
      drawLens(4.0, 0.1, 2.75);
      ctx.restore();
      return;
    }

    if (hatId === 'parade_cap') {
      // Royal Navy & Gold Parade Conductor Cap with jaunty feather plume
      ctx.save();
      ctx.translate(0.4, f.headTopY + 1.2 * s);
      ctx.scale(s, s);

      // Crowned conductor shako/peaked cap body
      const capGrad = ctx.createLinearGradient(0, -10, 0, 1);
      capGrad.addColorStop(0, '#312e81');
      capGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = capGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(-7.2, 0.4);
      ctx.lineTo(-8.8, -6.2);
      ctx.quadraticCurveTo(0, -9.2, 8.8, -6.2);
      ctx.lineTo(7.2, 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold braid band
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-7.3, -1.8, 14.6, 2.1);

      // Glossy visor brim
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(4.4, 0.6, 7.2, 1.8, 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Gold crest star + cyan-white plume
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(2.4, -4.4, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(2.4, -7.8);
      ctx.quadraticCurveTo(4.2, -12.6, 0.4 + f.flutter * 0.35, -13.6);
      ctx.stroke();

      ctx.restore();
      return;
    }

    if (hatId === 'star_crown') {
      // Radiant Starlight Tiara Crown with glowing star spires
      const liftY = f.speciesId === 'emperor' ? -4.5 * s : 0;
      ctx.save();
      ctx.translate(0, f.headTopY + 1.0 * s + liftY);
      ctx.scale(s, s);

      const pulse = 0.72 + Math.sin(f.time * 4.5) * 0.28;
      // Soft starlight aura behind crown
      const glow = ctx.createRadialGradient(0, -6.5, 1, 0, -6.5, 11);
      glow.addColorStop(0, `rgba(254, 240, 138, ${(0.52 * pulse).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -6.5, 11, 0, Math.PI * 2);
      ctx.fill();

      const crownGrad = ctx.createLinearGradient(-7, -11, 7, 1);
      crownGrad.addColorStop(0, '#fef08a');
      crownGrad.addColorStop(0.5, '#fbbf24');
      crownGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = crownGrad;
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-6.8, 0.5);
      ctx.lineTo(-7.8, -6.8);
      ctx.lineTo(-3.4, -3.5);
      ctx.lineTo(0, -10.5);
      ctx.lineTo(3.4, -3.5);
      ctx.lineTo(7.8, -6.8);
      ctx.lineTo(6.8, 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sparkling star jewel at central spire
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(0, -10.6, 1.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-4.2, -2.4, 1.05, 0, Math.PI * 2);
      ctx.arc(4.2, -2.4, 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    if (hatId === 'aurora_halo') {
      // Floating iridescent emerald-cyan-violet Aurora Halo orbiting overhead
      const bob = Math.sin(f.time * 3.8) * 1.4;
      const liftY = f.speciesId === 'emperor' ? -5.0 * s : 0;
      ctx.save();
      ctx.translate(0, f.headTopY - 6.8 * s + bob + liftY);
      ctx.scale(s, s);

      // Soft iridescent glow
      const haloGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 14);
      haloGlow.addColorStop(0, 'rgba(52, 211, 153, 0.34)');
      haloGlow.addColorStop(0.55, 'rgba(56, 189, 248, 0.22)');
      haloGlow.addColorStop(1, 'rgba(192, 132, 252, 0)');
      ctx.fillStyle = haloGlow;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Primary glowing aurora ring
      const ringGrad = ctx.createLinearGradient(-10, 0, 10, 0);
      ringGrad.addColorStop(0, '#34d399');
      ringGrad.addColorStop(0.5, '#38bdf8');
      ringGrad.addColorStop(1, '#c084fc');
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9.6, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner white specular highlight
      ctx.strokeStyle = 'rgba(240, 253, 250, 0.82)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, -0.3, 8.4, 2.3, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting aurora mote
      const orbAng = f.time * 2.8;
      const ox = Math.cos(orbAng) * 9.8;
      const oy = Math.sin(orbAng) * 3.3;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(ox, oy, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  return {
    SPECIES_IDS,
    DEFAULT_CONFIRM_WINDOW_MS,
    WARDROBE_MIN_REBIRTHS,
    WARDROBE_ITEMS,
    VALID_HAT_IDS,
    getWardrobeItem,
    isValidHatId,
    isWardrobeUnlocked,
    canSpeciesWearHat,
    resolveHatForSpecies,
    createDefaultSpeciesHats,
    sanitizeWardrobeState,
    createPurchaseGuard,
    drawPenguinAccessory
  };
});
