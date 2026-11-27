(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.Economy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_SAFE_RESOURCE = 1e300;
  const MAX_COUNT = 1e7;
  const MAX_GLACIER_LEVEL = 10000;
  const PRESTIGE_BONUS_PER_SHARD = 0.0125;          // +1.25% per Frost Essence (75% reduction from +5%)
  const MIN_FISHING_HOLES = 3;
  const MAX_FISHING_HOLES = 6;
  const FISHING_HOLES_MIN_REBIRTHS = 5;             // Additional fishing holes (4-6) require 5 Glacial Rebirths
  const WARDROBE_MIN_REBIRTHS = 6;                  // Colony Wardrobe unlocks after 6 Glacial Rebirths
  const MAX_IGLOO_TIER = 5;

  // Global penguin collection slowdown (~40% slower overall collection cycle)
  const COLLECTION_SPEED_SCALE = 0.65;              // -35% waddle & slide velocity across all species
  const DIVE_TIME_SCALE = 1.33;                     // +33% longer dive cycle across all species

  // Scaling Colony Cap: 15 base + 5 per Glacier Level above 1 + 10 per Glacial Rebirth
  const COLONY_CAP_BASE = 15;
  const COLONY_CAP_PER_GLACIER_LEVEL = 5;
  const COLONY_CAP_PER_REBIRTH = 10;

  // Aurora Blessing cadence & nerfed Resonance Coils
  const AURORA_BASE_INTERVAL_SEC = 540;             // 9 minutes base
  const AURORA_COILS_REDUCTION_PER_LEVEL = 1;       // -1s per Resonance Coils level
  const AURORA_MIN_INTERVAL_SEC = 420;              // 7 minutes hard floor

  // Duplicate owned Legendary/Mythic perk instant fish conversion
  const DUPLICATE_LEGENDARY_FISH_SECONDS = 120;
  const DUPLICATE_MYTHIC_FISH_SECONDS = 240;

  const OFFLINE_BASE_RATE = 0.35;                   // 35% offline idle rate
  const OFFLINE_FULL_CAP_SECONDS = 24 * 3600;       // 24 hours at full offline rate (35% DPS)
  const OFFLINE_MAX_SECONDS = 7 * 24 * 3600;        // 7-day absolute ceiling
  const OFFLINE_DIMINISHING_FACTOR = 0.25;          // 25% of offline rate between 24h and 7d
  const OFFLINE_MIN_ELAPSED_SECONDS = 10;
  const OFFLINE_MIN_FISH_THRESHOLD = 5;

  const GOLDEN_FISH_BASE_COOLDOWN_MIN = 360;        // 6-9 min rare Golden Fish cadence
  const GOLDEN_FISH_BASE_COOLDOWN_SPAN = 180;
  const GOLDEN_FISH_BOOST_MULTIPLIER = 2.0;
  const GOLDEN_FISH_DURATION_SEC = 7.2;
  const GOLDEN_FISH_MIN_REWARD = 50;
  const GOLDEN_FISH_DPS_SECONDS = 30;

  const NUMBER_UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  const IGLOO_TIERS = [
    {
      tier: 0,
      id: 'starter_igloo',
      name: 'Classic Snow Igloo',
      cost: 0,
      icon: '🛖',
      desc: 'Cozy hand-packed snow-brick depot on the ice shelf.'
    },
    {
      tier: 1,
      id: 'lantern_igloo',
      name: 'Lantern-Lit Igloo',
      cost: 65000,
      icon: '🏮',
      desc: 'Adds glowing frost-lantern posts, carved ice steps, and a chimney snow-wisp.'
    },
    {
      tier: 2,
      id: 'twin_spire_keep',
      name: 'Twin-Spire Ice Keep',
      cost: 35000000,
      icon: '🗼',
      desc: 'Flanks the depot with sculpted crystal spires and an ornate frosted gatehouse.'
    },
    {
      tier: 3,
      id: 'frosted_citadel',
      name: 'Frosted Citadel',
      cost: 3000000000,
      icon: '🏰',
      desc: 'Builds crenellated battlements, twin watch turrets, and fluttering colony banners.'
    },
    {
      tier: 4,
      id: 'aurora_bastion',
      name: 'Aurora Bastion',
      cost: 75000000000,
      icon: '🏛️',
      desc: 'Raises a towering crystalline central keep with a stained-ice rose window and frost motes.'
    },
    {
      tier: 5,
      id: 'grand_glacial_palace',
      name: 'Grand Glacial Palace',
      cost: 1500000000000,
      icon: '👑',
      desc: 'Completes the full multi-spired Ice Castle with polar star finial, four crystal turrets, and royal aurora halo.'
    }
  ];

  const IGLOO_THEMES = [
    {
      id: 'glacier',
      name: 'Glacier Classic',
      cost: 0,
      swatchGrad: 'linear-gradient(135deg, #ffffff 0%, #7dd3fc 52%, #0284c7 100%)',
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
    },
    {
      id: 'aurora_emerald',
      name: 'Aurora Emerald',
      cost: 500000,
      swatchGrad: 'linear-gradient(135deg, #ecfdf5 0%, #34d399 52%, #047857 100%)',
      domeTop: '#ecfdf5',
      domeMid: '#a7f3d0',
      domeBot: '#10b981',
      mortar: 'rgba(6, 95, 70, 0.36)',
      rim: 'rgba(167, 243, 208, 0.9)',
      spireTop: '#d1fae5',
      spireMid: '#34d399',
      spireBot: '#065f46',
      doorArch: '#6ee7b7',
      doorCore: '#022c22',
      lanternGlow: '#6ee7b7',
      lanternHalo: 'rgba(52, 211, 153, 0.5)',
      bannerPrimary: '#059669',
      bannerTrim: '#a7f3d0',
      haloInner: 'rgba(52, 211, 153, 0.38)',
      haloOuter: 'rgba(56, 189, 248, 0.22)'
    },
    {
      id: 'royal_amethyst',
      name: 'Royal Amethyst',
      cost: 5000000,
      swatchGrad: 'linear-gradient(135deg, #faf5ff 0%, #c084fc 52%, #6d28d9 100%)',
      domeTop: '#faf5ff',
      domeMid: '#e9d5ff',
      domeBot: '#a855f7',
      mortar: 'rgba(107, 33, 168, 0.35)',
      rim: 'rgba(233, 213, 255, 0.92)',
      spireTop: '#f3e8ff',
      spireMid: '#c084fc',
      spireBot: '#581c87',
      doorArch: '#d8b4fe',
      doorCore: '#1e1038',
      lanternGlow: '#f5d0fe',
      lanternHalo: 'rgba(192, 132, 252, 0.52)',
      bannerPrimary: '#7e22ce',
      bannerTrim: '#fde047',
      haloInner: 'rgba(192, 132, 252, 0.42)',
      haloOuter: 'rgba(244, 114, 182, 0.24)'
    },
    {
      id: 'solar_solstice',
      name: 'Solar Solstice',
      cost: 50000000,
      swatchGrad: 'linear-gradient(135deg, #fffbeb 0%, #fbbf24 52%, #b45309 100%)',
      domeTop: '#fffbeb',
      domeMid: '#fde68a',
      domeBot: '#f59e0b',
      mortar: 'rgba(146, 64, 14, 0.34)',
      rim: 'rgba(254, 243, 199, 0.94)',
      spireTop: '#fef9c3',
      spireMid: '#fbbf24',
      spireBot: '#92400e',
      doorArch: '#fcd34d',
      doorCore: '#291504',
      lanternGlow: '#fef08a',
      lanternHalo: 'rgba(251, 191, 36, 0.6)',
      bannerPrimary: '#d97706',
      bannerTrim: '#fef08a',
      haloInner: 'rgba(251, 191, 36, 0.42)',
      haloOuter: 'rgba(251, 146, 60, 0.24)'
    },
    {
      id: 'rose_quartz',
      name: 'Polar Rose',
      cost: 400000000,
      swatchGrad: 'linear-gradient(135deg, #fff1f2 0%, #fb7185 52%, #be123c 100%)',
      domeTop: '#fff1f2',
      domeMid: '#fecdd3',
      domeBot: '#fb7185',
      mortar: 'rgba(159, 18, 57, 0.34)',
      rim: 'rgba(255, 228, 230, 0.92)',
      spireTop: '#ffe4e6',
      spireMid: '#f472b6',
      spireBot: '#9d174d',
      doorArch: '#fda4af',
      doorCore: '#2b0816',
      lanternGlow: '#fbcfe8',
      lanternHalo: 'rgba(244, 114, 182, 0.54)',
      bannerPrimary: '#be185d',
      bannerTrim: '#fce7f3',
      haloInner: 'rgba(244, 114, 182, 0.4)',
      haloOuter: 'rgba(192, 132, 252, 0.24)'
    },
    {
      id: 'midnight_obsidian',
      name: 'Obsidian Frost',
      cost: 3000000000,
      swatchGrad: 'linear-gradient(135deg, #94a3b8 0%, #1e293b 52%, #020617 100%)',
      domeTop: '#cbd5e1',
      domeMid: '#475569',
      domeBot: '#0f172a',
      mortar: 'rgba(56, 189, 248, 0.36)',
      rim: 'rgba(56, 189, 248, 0.95)',
      spireTop: '#7dd3fc',
      spireMid: '#1e293b',
      spireBot: '#020617',
      doorArch: '#334155',
      doorCore: '#020617',
      lanternGlow: '#38bdf8',
      lanternHalo: 'rgba(56, 189, 248, 0.65)',
      bannerPrimary: '#0f172a',
      bannerTrim: '#38bdf8',
      haloInner: 'rgba(56, 189, 248, 0.48)',
      haloOuter: 'rgba(14, 165, 233, 0.26)'
    }
  ];

  const FISHING_HOLE_DEFS = [
    { id: 1, name: 'West Starter Hole', desc: 'Shallow glacier cove near the western ridge', slots: 10, xRatio: 0.22, yRatio: 0.73, radiusX: 44, radiusY: 20, rippleOffset: 0.0, cost: 0, starter: true },
    { id: 2, name: 'Center Starter Hole', desc: 'Main colony plunge basin right below the igloo', slots: 10, xRatio: 0.50, yRatio: 0.81, radiusX: 50, radiusY: 22, rippleOffset: 1.2, cost: 0, starter: true },
    { id: 3, name: 'East Starter Hole', desc: 'Sheltered drift channel along the eastern shelf', slots: 10, xRatio: 0.78, yRatio: 0.74, radiusX: 44, radiusY: 20, rippleOffset: 2.4, cost: 0, starter: true },
    { id: 4, name: 'Western Shelf Basin', desc: 'Carved outer ice basin expanding west-flank diving (Unlocks at 5 Rebirths)', slots: 10, xRatio: 0.16, yRatio: 0.59, radiusX: 40, radiusY: 18, rippleOffset: 0.6, cost: 150000, starter: false },
    { id: 5, name: 'Eastern Shelf Basin', desc: 'Deep twilight fishing pool on the eastern shelf (Unlocks at 5 Rebirths)', slots: 10, xRatio: 0.84, yRatio: 0.59, radiusX: 40, radiusY: 18, rippleOffset: 1.8, cost: 2500000, starter: false },
    { id: 6, name: 'Deep Abyssal Rift', desc: 'Central thermal fissure teeming with midnight schools (Unlocks at 5 Rebirths)', slots: 10, xRatio: 0.50, yRatio: 0.67, radiusX: 44, radiusY: 19, rippleOffset: 3.0, cost: 50000000, starter: false }
  ];

  function sanitizeFiniteNumber(value, fallback = 0, min = 0, max = MAX_SAFE_RESOURCE) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function sanitizeInteger(value, fallback = 0, min = 0, max = MAX_COUNT) {
    const n = sanitizeFiniteNumber(value, fallback, min, max);
    return Math.floor(n);
  }

  function safeAddResource(current, delta, max = MAX_SAFE_RESOURCE) {
    const base = sanitizeFiniteNumber(current, 0, 0, max);
    const inc = sanitizeFiniteNumber(delta, 0, 0, max);
    const sum = base + inc;
    if (!Number.isFinite(sum) || sum > max) return max;
    return sum;
  }

  function formatNumber(num) {
    const n = typeof num === 'number' ? num : Number(num);
    if (!Number.isFinite(n)) return '0';
    if (n < 0) return '-' + formatNumber(-n);
    if (n < 1000) return Math.floor(n).toLocaleString('en-US');
    let uIdx = Math.floor(Math.log10(n) / 3) - 1;
    if (uIdx < 0) return Math.floor(n).toLocaleString('en-US');
    if (uIdx >= NUMBER_UNITS.length) {
      return n.toExponential(2);
    }
    let scaled = n / Math.pow(10, (uIdx + 1) * 3);
    if (Number(scaled.toFixed(1)) >= 1000) {
      uIdx += 1;
      if (uIdx >= NUMBER_UNITS.length) {
        return n.toExponential(2);
      }
      scaled = n / Math.pow(10, (uIdx + 1) * 3);
    }
    return scaled.toFixed(1) + NUMBER_UNITS[uIdx];
  }

  function formatHudFish(num) {
    const n = typeof num === 'number' ? num : Number(num);
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n < 10000) return Math.floor(n).toLocaleString('en-US');
    let uIdx = Math.floor(Math.log10(n) / 3) - 1;
    if (uIdx < 0) return Math.floor(n).toLocaleString('en-US');
    if (uIdx >= NUMBER_UNITS.length) {
      return n.toExponential(2);
    }
    let scaled = n / Math.pow(10, (uIdx + 1) * 3);
    if (Number(scaled.toFixed(2)) >= 1000) {
      uIdx += 1;
      if (uIdx >= NUMBER_UNITS.length) {
        return n.toExponential(2);
      }
      scaled = n / Math.pow(10, (uIdx + 1) * 3);
    }
    return scaled.toFixed(2) + NUMBER_UNITS[uIdx];
  }

  function calculateLevelRequirement(glacierLevel) {
    const lvl = sanitizeInteger(glacierLevel, 1, 1, 10000);
    const raw = 150 * Math.pow(1.32, lvl);
    if (!Number.isFinite(raw) || raw > MAX_SAFE_RESOURCE) return MAX_SAFE_RESOURCE;
    return Math.max(1, Math.floor(raw));
  }

  function calculatePendingPrestigeShards(runFish) {
    const fish = sanitizeFiniteNumber(runFish, 0, 0, MAX_SAFE_RESOURCE);
    if (fish < 150000) return 0;
    const shards = Math.floor(Math.cbrt(fish / 150000));
    return sanitizeInteger(shards, 0, 0, 1e12);
  }

  function calculatePrestigeMultiplier(prestigeShards) {
    const shards = sanitizeFiniteNumber(prestigeShards, 0, 0, 1e12);
    return 1 + shards * PRESTIGE_BONUS_PER_SHARD;
  }

  function calculatePrestigeBonusPct(prestigeShards) {
    const shards = sanitizeFiniteNumber(prestigeShards, 0, 0, 1e12);
    return Math.round(shards * PRESTIGE_BONUS_PER_SHARD * 10000) / 100;
  }

  function formatPrestigeBonusPct(prestigeShards) {
    const pct = calculatePrestigeBonusPct(prestigeShards);
    if (pct === 0) return '0';
    return Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(2)));
  }

  function getIglooTierDef(tier) {
    const idx = sanitizeInteger(tier, 0, 0, MAX_IGLOO_TIER);
    return IGLOO_TIERS[idx] || IGLOO_TIERS[0];
  }

  function getNextIglooTierDef(tier) {
    const idx = sanitizeInteger(tier, 0, 0, MAX_IGLOO_TIER);
    return idx < MAX_IGLOO_TIER ? IGLOO_TIERS[idx + 1] : null;
  }

  function getIglooThemeDef(themeId) {
    if (typeof themeId === 'string') {
      const found = IGLOO_THEMES.find((t) => t.id === themeId);
      if (found) return found;
    }
    return IGLOO_THEMES[0];
  }

  function getActiveFishingHoleDefs(unlockedCount) {
    const count = sanitizeInteger(unlockedCount, MIN_FISHING_HOLES, MIN_FISHING_HOLES, MAX_FISHING_HOLES);
    return FISHING_HOLE_DEFS.slice(0, count);
  }

  function getNextFishingHoleDef(unlockedCount) {
    const count = sanitizeInteger(unlockedCount, MIN_FISHING_HOLES, MIN_FISHING_HOLES, MAX_FISHING_HOLES);
    return count < MAX_FISHING_HOLES ? FISHING_HOLE_DEFS[count] : null;
  }

  function calculateColonyCap(glacierLevel, totalRebirths = 0) {
    const lvl = sanitizeInteger(glacierLevel, 1, 1, MAX_GLACIER_LEVEL);
    const reb = sanitizeInteger(totalRebirths, 0, 0, 1e6);
    return COLONY_CAP_BASE + Math.max(0, lvl - 1) * COLONY_CAP_PER_GLACIER_LEVEL + reb * COLONY_CAP_PER_REBIRTH;
  }

  function canUnlockAdditionalFishingHoles(totalRebirths = 0) {
    return sanitizeInteger(totalRebirths, 0, 0, 1e6) >= FISHING_HOLES_MIN_REBIRTHS;
  }

  function isWardrobeUnlocked(totalRebirths = 0) {
    return sanitizeInteger(totalRebirths, 0, 0, 1e6) >= WARDROBE_MIN_REBIRTHS;
  }

  function calculateAuroraIntervalSec(coilsLevel = 0) {
    const lvl = sanitizeInteger(coilsLevel, 0, 0, 1e6);
    return Math.max(AURORA_MIN_INTERVAL_SEC, AURORA_BASE_INTERVAL_SEC - lvl * AURORA_COILS_REDUCTION_PER_LEVEL);
  }

  function calculateDuplicatePerkFishBonus(rarity, persistentDps = 0) {
    const safeDps = sanitizeFiniteNumber(persistentDps, 0, 0, MAX_SAFE_RESOURCE);
    const isMythic = rarity === 'mythic';
    const seconds = isMythic ? DUPLICATE_MYTHIC_FISH_SECONDS : DUPLICATE_LEGENDARY_FISH_SECONDS;
    const minFloor = isMythic ? 500 : 250;
    const raw = Math.round(safeDps * seconds);
    const fish = (!Number.isFinite(raw) || raw > MAX_SAFE_RESOURCE)
      ? MAX_SAFE_RESOURCE
      : Math.max(minFloor, raw);
    return { fish, seconds };
  }

  function computeSafeFrameDeltaSec(nowMs, lastTimeMs, maxDt = 0.1) {
    if (!Number.isFinite(nowMs) || !Number.isFinite(lastTimeMs)) return 0;
    const raw = (nowMs - lastTimeMs) / 1000;
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const ceiling = Number.isFinite(maxDt) && maxDt > 0 ? maxDt : 0.1;
    return Math.min(ceiling, raw);
  }

  function positiveModulo(value, mod) {
    if (!Number.isFinite(value) || !Number.isFinite(mod) || mod <= 0) return 0;
    return ((value % mod) + mod) % mod;
  }

  function calculateGlacierLevelMultiplier(glacierLevel, levelBonusRate = 0.0425) {
    const lvl = sanitizeInteger(glacierLevel, 1, 1, 10000);
    const rate = sanitizeFiniteNumber(levelBonusRate, 0.0425, 0, 10);
    return 1 + (lvl - 1) * rate;
  }

  function calculatePenguinCost(speciesDef, currentCount, traitCostMult = 1.0) {
    if (!speciesDef) return 999999;
    const baseCost = sanitizeFiniteNumber(speciesDef.baseCost, 15, 1, MAX_SAFE_RESOURCE);
    const costMult = sanitizeFiniteNumber(speciesDef.costMult, 1.15, 1.001, 10);
    const count = sanitizeInteger(currentCount, 0, 0, MAX_COUNT);
    const mult = sanitizeFiniteNumber(traitCostMult, 1.0, 0.1, 10);

    const raw = baseCost * Math.pow(costMult, count);
    if (!Number.isFinite(raw) || raw > MAX_SAFE_RESOURCE) return MAX_SAFE_RESOURCE;
    const discounted = Math.floor(Math.floor(raw) * mult);
    return Math.max(1, sanitizeFiniteNumber(discounted, MAX_SAFE_RESOURCE, 1, MAX_SAFE_RESOURCE));
  }

  function calculateBulkPenguinPurchase(
    speciesDef,
    currentCount,
    availableFish,
    multiplier,
    firstTraitCostMult = 1.0,
    maxBulk = 100,
    remainingCapSlots = null
  ) {
    const fish = sanitizeFiniteNumber(availableFish, 0, 0, MAX_SAFE_RESOURCE);
    const count = sanitizeInteger(currentCount, 0, 0, MAX_COUNT);
    const baseCap = sanitizeInteger(maxBulk, 100, 1, 1000);
    const hasCapLimit = remainingCapSlots !== null && remainingCapSlots !== undefined && Number.isFinite(Number(remainingCapSlots));
    const slotsLeft = hasCapLimit ? Math.max(0, Math.floor(Number(remainingCapSlots))) : baseCap;

    if (hasCapLimit && slotsLeft <= 0) {
      const singleCost = calculatePenguinCost(speciesDef, count, firstTraitCostMult);
      return { qty: 0, cost: singleCost, canAfford: false, capReached: true };
    }

    const cap = Math.min(baseCap, slotsLeft);

    if (multiplier === 'MAX') {
      let tempFish = fish;
      let tempCount = count;
      let totalCost = 0;
      let affordableQty = 0;

      while (affordableQty < cap) {
        const nextCost = calculatePenguinCost(
          speciesDef,
          tempCount,
          affordableQty === 0 ? firstTraitCostMult : 1.0
        );
        if (!Number.isFinite(nextCost) || nextCost > tempFish) break;
        const nextTotal = totalCost + nextCost;
        if (!Number.isFinite(nextTotal) || nextTotal > MAX_SAFE_RESOURCE) break;
        tempFish -= nextCost;
        totalCost = nextTotal;
        tempCount++;
        affordableQty++;
      }

      if (affordableQty === 0) {
        const singleCost = calculatePenguinCost(speciesDef, count, firstTraitCostMult);
        return { qty: 1, cost: singleCost, canAfford: fish >= singleCost, capReached: false };
      }
      return { qty: affordableQty, cost: totalCost, canAfford: fish >= totalCost, capReached: false };
    }

    const desiredQty = sanitizeInteger(multiplier, 1, 1, baseCap);
    const qty = Math.min(desiredQty, cap);
    let totalCost = 0;
    for (let i = 0; i < qty; i++) {
      const nextCost = calculatePenguinCost(speciesDef, count + i, i === 0 ? firstTraitCostMult : 1.0);
      totalCost += nextCost;
      if (!Number.isFinite(totalCost) || totalCost > MAX_SAFE_RESOURCE) {
        totalCost = MAX_SAFE_RESOURCE;
        break;
      }
    }
    return { qty, cost: totalCost, canAfford: fish >= totalCost && totalCost < MAX_SAFE_RESOURCE, capReached: false };
  }

  function calculateTechCost(techDef, currentLevel) {
    if (!techDef) return 999999;
    const baseCost = sanitizeFiniteNumber(techDef.baseCost, 50, 1, MAX_SAFE_RESOURCE);
    const costMult = sanitizeFiniteNumber(techDef.costMult, 1.35, 1.001, 10);
    const lvl = sanitizeInteger(currentLevel, 0, 0, MAX_COUNT);
    const raw = baseCost * Math.pow(costMult, lvl);
    if (!Number.isFinite(raw) || raw > MAX_SAFE_RESOURCE) return MAX_SAFE_RESOURCE;
    return Math.max(1, Math.floor(raw));
  }

  function calculateBulkTechPurchase(techDef, currentLevel, availableFish, multiplier, maxBulk = 500) {
    const fish = sanitizeFiniteNumber(availableFish, 0, 0, MAX_SAFE_RESOURCE);
    const lvl = sanitizeInteger(currentLevel, 0, 0, MAX_COUNT);
    const cap = sanitizeInteger(maxBulk, 500, 1, 1000);

    if (multiplier === 'MAX') {
      let tempFish = fish;
      let tempLvl = lvl;
      let totalCost = 0;
      let affordableQty = 0;

      while (affordableQty < cap) {
        const nextCost = calculateTechCost(techDef, tempLvl);
        if (!Number.isFinite(nextCost) || nextCost > tempFish) break;
        const nextTotal = totalCost + nextCost;
        if (!Number.isFinite(nextTotal) || nextTotal > MAX_SAFE_RESOURCE) break;
        tempFish -= nextCost;
        totalCost = nextTotal;
        tempLvl++;
        affordableQty++;
      }

      if (affordableQty === 0) {
        const singleCost = calculateTechCost(techDef, lvl);
        return { qty: 1, cost: singleCost, canAfford: fish >= singleCost };
      }
      return { qty: affordableQty, cost: totalCost, canAfford: fish >= totalCost };
    }

    const qty = sanitizeInteger(multiplier, 1, 1, cap);
    let totalCost = 0;
    for (let i = 0; i < qty; i++) {
      totalCost += calculateTechCost(techDef, lvl + i);
      if (!Number.isFinite(totalCost) || totalCost > MAX_SAFE_RESOURCE) {
        totalCost = MAX_SAFE_RESOURCE;
        break;
      }
    }
    return { qty, cost: totalCost, canAfford: fish >= totalCost && totalCost < MAX_SAFE_RESOURCE };
  }

  /**
   * Computes offline earnings with clock rollback guard and 24h full + diminishing returns up to 7d.
   */
  function calculateOfflineEarnings(params) {
    const {
      dps = 0,
      lastSaveTimeMs = 0,
      nowMs = Date.now(),
      minElapsedSec = OFFLINE_MIN_ELAPSED_SECONDS,
      minFishThreshold = OFFLINE_MIN_FISH_THRESHOLD
    } = params || {};

    const safeDps = sanitizeFiniteNumber(dps, 0, 0, MAX_SAFE_RESOURCE);
    const safeLast = sanitizeFiniteNumber(lastSaveTimeMs, 0, 0, Number.MAX_SAFE_INTEGER);
    const safeNow = sanitizeFiniteNumber(nowMs, Date.now(), 0, Number.MAX_SAFE_INTEGER);

    if (safeLast <= 0 || safeNow <= 0) {
      return { earned: 0, rawElapsedSec: 0, effectiveSec: 0, capped: false, clockMovedBackward: false };
    }

    const rawElapsedSec = (safeNow - safeLast) / 1000;
    if (rawElapsedSec < 0) {
      return { earned: 0, rawElapsedSec, effectiveSec: 0, capped: false, clockMovedBackward: true };
    }

    if (rawElapsedSec <= minElapsedSec || safeDps <= 0) {
      return { earned: 0, rawElapsedSec, effectiveSec: 0, capped: false, clockMovedBackward: false };
    }

    const clampedSec = Math.min(rawElapsedSec, OFFLINE_MAX_SECONDS);
    const fullSec = Math.min(clampedSec, OFFLINE_FULL_CAP_SECONDS);
    const extraSec = Math.max(0, clampedSec - OFFLINE_FULL_CAP_SECONDS);
    const effectiveSec = fullSec + extraSec * OFFLINE_DIMINISHING_FACTOR;

    const rawEarned = safeDps * effectiveSec * OFFLINE_BASE_RATE;
    const earned = !Number.isFinite(rawEarned) || rawEarned > MAX_SAFE_RESOURCE
      ? MAX_SAFE_RESOURCE
      : Math.floor(rawEarned);

    if (earned <= minFishThreshold) {
      return {
        earned: 0,
        rawElapsedSec,
        effectiveSec,
        capped: rawElapsedSec > OFFLINE_FULL_CAP_SECONDS,
        clockMovedBackward: false
      };
    }

    return {
      earned,
      rawElapsedSec,
      effectiveSec,
      capped: rawElapsedSec > OFFLINE_FULL_CAP_SECONDS,
      clockMovedBackward: false
    };
  }

  /**
   * Golden Fish cooldown tick: pauses when blocked, accelerates 2x while Aurora Golden Fish perk is active.
   */
  function computeGoldenFishCooldownStep(params) {
    const {
      cooldownSec = GOLDEN_FISH_BASE_COOLDOWN_MIN,
      dtSec = 0,
      goldenFishTimerSec = 0,
      isBlocked = false
    } = params || {};

    const safeCooldown = sanitizeFiniteNumber(cooldownSec, GOLDEN_FISH_BASE_COOLDOWN_MIN, 0, 3600);
    const safeDt = sanitizeFiniteNumber(dtSec, 0, 0, 5);
    const boosted = sanitizeFiniteNumber(goldenFishTimerSec, 0, 0, 86400) > 0;

    if (isBlocked || safeDt <= 0) {
      return { nextCooldownSec: safeCooldown, shouldSpawn: false, boostActive: boosted };
    }

    const rate = boosted ? GOLDEN_FISH_BOOST_MULTIPLIER : 1.0;
    const remaining = safeCooldown - safeDt * rate;
    if (remaining <= 0) {
      return { nextCooldownSec: 0, shouldSpawn: true, boostActive: boosted };
    }
    return { nextCooldownSec: remaining, shouldSpawn: false, boostActive: boosted };
  }

  function computeGoldenFishNextCooldown(params) {
    const { goldenFishTimerSec = 0, rng = Math.random } = params || {};
    const r = sanitizeFiniteNumber(typeof rng === 'function' ? rng() : 0.5, 0.5, 0, 1);
    const base = GOLDEN_FISH_BASE_COOLDOWN_MIN + r * GOLDEN_FISH_BASE_COOLDOWN_SPAN;
    const boosted = sanitizeFiniteNumber(goldenFishTimerSec, 0, 0, 86400) > 0;
    return boosted ? base / GOLDEN_FISH_BOOST_MULTIPLIER : base;
  }

  /**
   * Computes Golden Fish canvas coordinates ensuring it always arcs cleanly within the visible
   * glacier area above the bottom sheet (and directly over fishing holes when sheet is collapsed).
   */
  function computeGoldenFishPosition(params) {
    const {
      width = 360,
      height = 640,
      hole = { xRatio: 0.5, yRatio: 0.78 },
      elapsed = 0,
      duration = GOLDEN_FISH_DURATION_SEC,
      dir = 1,
      visibleTopY = 92,
      visibleBottomY = null
    } = params || {};

    const w = Math.max(120, sanitizeFiniteNumber(width, 360, 120, 10000));
    const h = Math.max(200, sanitizeFiniteNumber(height, 640, 200, 10000));
    const dur = Math.max(0.5, sanitizeFiniteNumber(duration, GOLDEN_FISH_DURATION_SEC, 0.5, 60));
    const t = Math.max(0, Math.min(1, sanitizeFiniteNumber(elapsed, 0, 0, dur) / dur));
    const safeDir = dir < 0 ? -1 : 1;

    const hx = w * sanitizeFiniteNumber(hole && hole.xRatio, 0.5, 0.1, 0.9);
    const rawHy = h * sanitizeFiniteNumber(hole && hole.yRatio, 0.78, 0.25, 0.92);

    const topBound = Math.max(76, sanitizeFiniteNumber(visibleTopY, 92, 40, h * 0.4));
    const maxAllowedBaseY = (visibleBottomY != null && Number.isFinite(visibleBottomY))
      ? Math.max(topBound + 72, Math.min(h - 32, visibleBottomY - 26))
      : (h - 32);

    const baseHy = Math.min(rawHy, maxAllowedBaseY);
    const hopPhase = (t * 2.5) % 1;
    const maxArcHeight = Math.min(58, Math.max(28, (baseHy - topBound) * 0.6));
    const arcY = Math.sin(hopPhase * Math.PI) * maxArcHeight;
    const swayX = Math.sin(t * Math.PI * 2) * Math.min(38, w * 0.12) * safeDir;

    const x = Math.max(34, Math.min(w - 34, hx + swayX));
    const y = Math.max(topBound + 18, Math.min(maxAllowedBaseY, baseHy - 14 - arcY));

    return { x, y, t, hopPhase, baseHy, clampedAboveSheet: baseHy < rawHy - 1 };
  }

  function calculateGoldenFishReward(dps) {
    const safeDps = sanitizeFiniteNumber(dps, 0, 0, MAX_SAFE_RESOURCE);
    const burst = Math.round(safeDps * GOLDEN_FISH_DPS_SECONDS);
    if (!Number.isFinite(burst) || burst > MAX_SAFE_RESOURCE) return MAX_SAFE_RESOURCE;
    return Math.max(GOLDEN_FISH_MIN_REWARD, burst);
  }

  return {
    MAX_SAFE_RESOURCE,
    MAX_COUNT,
    MAX_GLACIER_LEVEL,
    PRESTIGE_BONUS_PER_SHARD,
    MIN_FISHING_HOLES,
    MAX_FISHING_HOLES,
    FISHING_HOLES_MIN_REBIRTHS,
    WARDROBE_MIN_REBIRTHS,
    MAX_IGLOO_TIER,
    COLLECTION_SPEED_SCALE,
    DIVE_TIME_SCALE,
    COLONY_CAP_BASE,
    COLONY_CAP_PER_GLACIER_LEVEL,
    COLONY_CAP_PER_REBIRTH,
    AURORA_BASE_INTERVAL_SEC,
    AURORA_COILS_REDUCTION_PER_LEVEL,
    AURORA_MIN_INTERVAL_SEC,
    DUPLICATE_LEGENDARY_FISH_SECONDS,
    DUPLICATE_MYTHIC_FISH_SECONDS,
    IGLOO_TIERS,
    IGLOO_THEMES,
    FISHING_HOLE_DEFS,
    OFFLINE_BASE_RATE,
    OFFLINE_FULL_CAP_SECONDS,
    OFFLINE_MAX_SECONDS,
    OFFLINE_DIMINISHING_FACTOR,
    OFFLINE_MIN_ELAPSED_SECONDS,
    OFFLINE_MIN_FISH_THRESHOLD,
    GOLDEN_FISH_BASE_COOLDOWN_MIN,
    GOLDEN_FISH_BASE_COOLDOWN_SPAN,
    GOLDEN_FISH_BOOST_MULTIPLIER,
    GOLDEN_FISH_DURATION_SEC,
    GOLDEN_FISH_MIN_REWARD,
    GOLDEN_FISH_DPS_SECONDS,
    sanitizeFiniteNumber,
    sanitizeInteger,
    safeAddResource,
    formatNumber,
    formatHudFish,
    calculateLevelRequirement,
    calculatePendingPrestigeShards,
    calculatePrestigeMultiplier,
    calculatePrestigeBonusPct,
    formatPrestigeBonusPct,
    getIglooTierDef,
    getNextIglooTierDef,
    getIglooThemeDef,
    getActiveFishingHoleDefs,
    getNextFishingHoleDef,
    calculateColonyCap,
    canUnlockAdditionalFishingHoles,
    isWardrobeUnlocked,
    calculateAuroraIntervalSec,
    calculateDuplicatePerkFishBonus,
    computeSafeFrameDeltaSec,
    positiveModulo,
    calculateGlacierLevelMultiplier,
    calculatePenguinCost,
    calculateBulkPenguinPurchase,
    calculateTechCost,
    calculateBulkTechPurchase,
    calculateOfflineEarnings,
    computeGoldenFishCooldownStep,
    computeGoldenFishNextCooldown,
    computeGoldenFishPosition,
    calculateGoldenFishReward
  };
});
