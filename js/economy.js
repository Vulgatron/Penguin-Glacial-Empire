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
  const OFFLINE_BASE_RATE = 2 / 3;
  const OFFLINE_FULL_CAP_SECONDS = 24 * 3600;       // 24 hours at full offline rate (2/3 DPS)
  const OFFLINE_MAX_SECONDS = 7 * 24 * 3600;        // 7-day absolute ceiling
  const OFFLINE_DIMINISHING_FACTOR = 0.25;          // 25% of offline rate between 24h and 7d
  const OFFLINE_MIN_ELAPSED_SECONDS = 10;
  const OFFLINE_MIN_FISH_THRESHOLD = 5;

  const GOLDEN_FISH_BASE_COOLDOWN_MIN = 78;
  const GOLDEN_FISH_BASE_COOLDOWN_SPAN = 36;
  const GOLDEN_FISH_BOOST_MULTIPLIER = 2.0;
  const GOLDEN_FISH_DURATION_SEC = 7.2;
  const GOLDEN_FISH_MIN_REWARD = 50;
  const GOLDEN_FISH_DPS_SECONDS = 30;

  const NUMBER_UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

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
    return 1 + shards * 0.05;
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
    maxBulk = 100
  ) {
    const fish = sanitizeFiniteNumber(availableFish, 0, 0, MAX_SAFE_RESOURCE);
    const count = sanitizeInteger(currentCount, 0, 0, MAX_COUNT);
    const cap = sanitizeInteger(maxBulk, 100, 1, 1000);

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
        return { qty: 1, cost: singleCost, canAfford: fish >= singleCost };
      }
      return { qty: affordableQty, cost: totalCost, canAfford: fish >= totalCost };
    }

    const qty = sanitizeInteger(multiplier, 1, 1, cap);
    let totalCost = 0;
    for (let i = 0; i < qty; i++) {
      const nextCost = calculatePenguinCost(speciesDef, count + i, i === 0 ? firstTraitCostMult : 1.0);
      totalCost += nextCost;
      if (!Number.isFinite(totalCost) || totalCost > MAX_SAFE_RESOURCE) {
        totalCost = MAX_SAFE_RESOURCE;
        break;
      }
    }
    return { qty, cost: totalCost, canAfford: fish >= totalCost && totalCost < MAX_SAFE_RESOURCE };
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
