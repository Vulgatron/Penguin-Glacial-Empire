import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Economy = require('../js/economy.js');
const GameData = require('../js/game-data.js');
const MilestoneEngine = require('../js/milestone-engine.js');
const PolarSynergy = require('../js/polar-synergy.js');

const SPECIES = GameData.PENGUIN_SPECIES;
const TECH = GameData.GLACIER_TECH;
const WEATHER_IDS = ['clear', 'light_snow', 'blizzard'];

function createSimState() {
  const penguins = {};
  for (const sp of SPECIES) {
    penguins[sp.id] = { count: sp.id === 'adelie' ? 1 : 0, level: 1 };
  }
  const tech = {};
  for (const t of TECH) {
    tech[t.id] = 0;
  }
  return {
    fish: 0,
    runFish: 0,
    lifetimeFish: 0,
    levelFish: 0,
    glacierLevel: 1,
    iglooTier: 0,
    fishingHolesUnlocked: 3,
    prestigeShards: 0,
    totalRebirths: 0,
    skyEventsCaught: 0,
    paradesWitnessed: 0,
    unlockedHats: ['none'],
    penguins,
    tech,
    weatherIndex: 0,
    weatherTimer: 300,
    hotspotHoleId: 1,
    hotspotSurgeTimer: 0,
    starlightFrenzyTimer: 0,
    paradeBoostTimer: 0,
    completedPermanentMilestones: [],
    completedRunMilestones: [],
    skippedMilestones: [],
    unlockedTabs: ['penguins', 'stats', 'settings']
  };
}

function calcPersistentBaselineDps(s) {
  const prestige = Economy.calculatePrestigeMultiplier(s.prestigeShards);
  const levelMult = Economy.calculateGlacierLevelMultiplier(s.glacierLevel, GameData.GLACIER_LEVEL_BONUS_RATE);
  const cryoBonus = 1 + (s.tech.cryo_storage || 0) * 0.2;
  const lineBonus = 1 + (s.tech.reinforced_line || 0) * 0.25;
  const walkBonus = 1 + (s.tech.thermal_parkas || 0) * 0.15;
  const slideBonus = 1 + (s.tech.smooth_ice || 0) * 0.3;

  let totalDps = 0;
  for (const sp of SPECIES) {
    const pData = s.penguins[sp.id];
    if (!pData || pData.count <= 0) continue;
    const lvl = Math.max(1, Math.floor(1 + pData.count / 10));
    const baseCatch = sp.baseYield * (1 + (lvl - 1) * GameData.COLONY_SIZE_BONUS_RATE) * lineBonus;
    const perTrip = baseCatch * prestige * levelMult * cryoBonus;
    const walkSpeed = Math.max(12, sp.baseSpeed * 40 * walkBonus);
    const slideChance = sp.id === 'gentoo' ? 1.0 : 0.35;
    const slideFactor = 1.8 * slideBonus;
    const legDist = 175;
    const expectedLeg = (1 - slideChance) * (legDist / walkSpeed) + slideChance * (legDist / (walkSpeed * slideFactor));
    const diveSec = Math.max(0.6, sp.diveTime / (sp.diveTime > 1 ? 1.2 : 1.0));
    const tripSec = Math.max(1.8, expectedLeg * 2 + 0.5 + diveSec + 0.6);
    totalDps += (perTrip / tripSec) * pData.count;
  }
  return totalDps;
}

function calcLiveDps(s) {
  const weatherId = WEATHER_IDS[s.weatherIndex] || 'clear';
  const prestige = Economy.calculatePrestigeMultiplier(s.prestigeShards);
  const levelMult = Economy.calculateGlacierLevelMultiplier(s.glacierLevel, GameData.GLACIER_LEVEL_BONUS_RATE);
  const cryoBonus = 1 + (s.tech.cryo_storage || 0) * 0.2;
  const lineBonus = 1 + (s.tech.reinforced_line || 0) * 0.25;
  const walkBonus = 1 + (s.tech.thermal_parkas || 0) * 0.15;
  const slideBonus = 1 + (s.tech.smooth_ice || 0) * 0.3;
  const paradeActive = s.paradeBoostTimer > 0;
  const transientMult = (paradeActive ? 2 : 1) * (s.starlightFrenzyTimer > 0 ? 2 : 1);

  let totalDps = 0;
  // Approximate fraction of colony diving at the glowing Hotspot hole (capped by 10 slots)
  const totalPenguins = SPECIES.reduce((acc, sp) => acc + (s.penguins[sp.id]?.count || 0), 0);
  const hotspotShare = totalPenguins > 0 ? Math.min(1, 10 / Math.max(10, totalPenguins)) : 0;

  for (const sp of SPECIES) {
    const pData = s.penguins[sp.id];
    if (!pData || pData.count <= 0) continue;
    const lvl = Math.max(1, Math.floor(1 + pData.count / 10));
    const baseCatch = sp.baseYield * (1 + (lvl - 1) * GameData.COLONY_SIZE_BONUS_RATE) * lineBonus;

    const nonHotspotYield = PolarSynergy.calculateEffectiveYield({
      baseCatch,
      weatherId,
      speciesId: sp.id,
      paradeActive,
      isAtHotspot: false,
      hotspotSurgeTimer: s.hotspotSurgeTimer
    }).effectiveCatch;

    const hotspotYield = PolarSynergy.calculateEffectiveYield({
      baseCatch,
      weatherId,
      speciesId: sp.id,
      paradeActive,
      isAtHotspot: true,
      hotspotSurgeTimer: s.hotspotSurgeTimer
    }).effectiveCatch;

    const blendedCatch = nonHotspotYield * (1 - hotspotShare) + hotspotYield * hotspotShare;
    const syn = PolarSynergy.getSpeciesSynergy(sp.id, weatherId, paradeActive);

    const perTrip = blendedCatch * prestige * levelMult * cryoBonus * transientMult;
    const walkSpeed = Math.max(12, sp.baseSpeed * 40 * walkBonus * syn.speedMult);
    const slideChance = sp.id === 'gentoo' ? 1.0 : 0.35;
    const slideFactor = 1.8 * slideBonus;
    const legDist = 175;
    const expectedLeg = (1 - slideChance) * (legDist / walkSpeed) + slideChance * (legDist / (walkSpeed * slideFactor));
    const diveRate = (sp.diveTime > 1 ? 1.2 : 1.0) * syn.diveSpeedMult;
    const diveSec = Math.max(0.6, sp.diveTime / Math.max(0.1, diveRate));
    const tripSec = Math.max(1.8, expectedLeg * 2 + 0.5 + diveSec + 0.6);
    totalDps += (perTrip / tripSec) * pData.count;
  }
  return totalDps;
}

function addFish(s, amount) {
  if (!(amount > 0)) return;
  s.fish += amount;
  s.runFish += amount;
  s.lifetimeFish += amount;
  s.levelFish += amount;
  while (true) {
    const req = Economy.calculateLevelRequirement(s.glacierLevel);
    if (s.levelFish >= req && s.glacierLevel < 10000) {
      s.levelFish -= req;
      s.glacierLevel += 1;
    } else {
      break;
    }
  }
}

function advanceWeather(s, sec) {
  let rem = s.weatherTimer - sec;
  if (rem <= 0) {
    const steps = Math.floor((-rem) / 300) + 1;
    s.weatherIndex = (s.weatherIndex + steps) % WEATHER_IDS.length;
    s.weatherTimer = 300 - ((-rem) % 300);
    const holeIds = Array.from({ length: s.fishingHolesUnlocked }, (_, i) => i + 1);
    s.hotspotHoleId = PolarSynergy.selectHotspotHoleId(WEATHER_IDS[s.weatherIndex], holeIds, s.weatherIndex);
  } else {
    s.weatherTimer = rem;
  }
}

function doRebirth(s) {
  const gained = Economy.calculatePendingPrestigeShards(s.runFish);
  if (gained <= 0) return false;
  s.prestigeShards += gained;
  s.totalRebirths += 1;
  s.fish = 0;
  s.runFish = 0;
  s.levelFish = 0;
  s.glacierLevel = 1;
  s.iglooTier = 0;
  s.fishingHolesUnlocked = 3;
  s.hotspotSurgeTimer = 0;
  s.starlightFrenzyTimer = 0;
  s.paradeBoostTimer = 0;
  s.completedRunMilestones = [];
  for (const sp of SPECIES) {
    s.penguins[sp.id] = { count: sp.id === 'adelie' ? 1 : 0, level: 1 };
  }
  for (const t of TECH) {
    s.tech[t.id] = 0;
  }
  return true;
}

/**
 * Runs a deterministic multi-hour player profile simulation.
 * Profiles: 'efficient' | 'casual' | 'active' | 'idle'
 */
export function runProfileSimulation(profileName, options = {}) {
  const hole4Cost = options.hole4Cost ?? Economy.FISHING_HOLE_DEFS[3].cost;
  const igloo1Cost = options.igloo1Cost ?? Economy.IGLOO_TIERS[1].cost;
  const maxSimSeconds = options.maxSimSeconds ?? 6 * 3600; // 6 simulated hours max
  const s = createSimState();

  const timeline = {
    profile: profileName,
    techTabMin: null,
    gentooMin: null,
    chinstrapMin: null,
    emperorMin: null,
    hole4Min: null,
    castle1Min: null,
    rebirthReadyMin: null,
    rebirth1Min: null,
    castleBeforeRebirthRecommendationObserved: false,
    deadEndDetected: false,
    unreachableCount: 0,
    transientLeakDetected: false
  };

  let elapsedSec = 0;
  let idleCycleTimer = 0;
  let activeEventTimer = 0;
  let lastShownMilestoneId = null;
  let decisionStep = 0;

  while (elapsedSec < maxSimSeconds) {
    // Idle profile simulates 20m active check-ins separated by 45m offline intervals
    if (profileName === 'idle' && idleCycleTimer >= 600 && s.lifetimeFish >= 50) {
      const offlineGapSec = 2700; // 45 min offline
      const persistentBefore = calcPersistentBaselineDps(s);
      // Inject transient timers right before going offline to verify zero leakage
      s.hotspotSurgeTimer = 20;
      s.starlightFrenzyTimer = 15;
      s.paradeBoostTimer = 15;

      const offlineRes = Economy.calculateOfflineEarnings({
        dps: persistentBefore,
        lastSaveTimeMs: 0,
        nowMs: offlineGapSec * 1000
      });
      // Transient timers MUST expire during offline gap and never leak into offlineRes
      s.hotspotSurgeTimer = Math.max(0, s.hotspotSurgeTimer - offlineGapSec);
      s.starlightFrenzyTimer = Math.max(0, s.starlightFrenzyTimer - offlineGapSec);
      s.paradeBoostTimer = Math.max(0, s.paradeBoostTimer - offlineGapSec);
      if (s.hotspotSurgeTimer !== 0 || s.starlightFrenzyTimer !== 0 || s.paradeBoostTimer !== 0) {
        timeline.transientLeakDetected = true;
      }
      const expectedMaxOffline = Math.floor(persistentBefore * offlineGapSec * (2 / 3));
      if (offlineRes.earned > expectedMaxOffline) {
        timeline.transientLeakDetected = true;
      }

      advanceWeather(s, offlineGapSec);
      addFish(s, offlineRes.earned);
      elapsedSec += offlineGapSec;
      idleCycleTimer = 0;
    }

    const dt = 5; // 5-second step for deterministic speed
    elapsedSec += dt;
    idleCycleTimer += dt;
    activeEventTimer += dt;

    // Tick transient timers down cleanly
    s.hotspotSurgeTimer = Math.max(0, s.hotspotSurgeTimer - dt);
    s.starlightFrenzyTimer = Math.max(0, s.starlightFrenzyTimer - dt);
    s.paradeBoostTimer = Math.max(0, s.paradeBoostTimer - dt);
    advanceWeather(s, dt);

    const liveDps = calcLiveDps(s);
    addFish(s, liveDps * dt);

    // Active profile taps occasionally & catches Shooting Stars / Krill Swarms / Golden Fish
    if (profileName === 'active') {
      const clickVal = Math.max(1, Math.floor((1 + s.tech.bioluminescent_krill * 0.5) * Economy.calculatePrestigeMultiplier(s.prestigeShards) * Economy.calculateGlacierLevelMultiplier(s.glacierLevel)));
      addFish(s, clickVal * 8); // ~1.6 taps/sec casual clicking
      if (activeEventTimer >= 45) {
        activeEventTimer = 0;
        s.skyEventsCaught += 1;
        s.hotspotSurgeTimer = PolarSynergy.HOTSPOT_SURGE_DURATION_SEC;
        if (s.skyEventsCaught % 3 === 0) {
          s.starlightFrenzyTimer = 15;
        }
        addFish(s, Math.max(40, Math.round(liveDps * 8)));
      }
    } else if (profileName === 'efficient' && elapsedSec <= 60) {
      // Brief opening taps during first minute
      addFish(s, 5);
    }

    // Update milestone compass & tab unlock tracking
    s.unlockedTabs = MilestoneEngine.evaluateUnlockedTabs(s, s.unlockedTabs);
    const msRes = MilestoneEngine.selectActiveMilestone(s, { currentShownId: lastShownMilestoneId });
    s.completedPermanentMilestones = msRes.completedPermanentMilestones;
    s.completedRunMilestones = msRes.completedRunMilestones;
    lastShownMilestoneId = msRes.milestone ? msRes.milestone.id : null;

    if (s.totalRebirths === 0 && s.iglooTier === 0 && s.runFish >= 150000) {
      if (msRes.milestone && msRes.milestone.id === 'castle_tier_1') {
        timeline.castleBeforeRebirthRecommendationObserved = true;
      }
    }

    // Spend according to profile strategy
    decisionStep++;
    const canBuyHole4 = s.fishingHolesUnlocked < 4 && s.fish >= hole4Cost;
    const canBuyCastle1 = s.iglooTier < 1 && s.fish >= igloo1Cost;

    if (canBuyHole4) {
      s.fish -= hole4Cost;
      s.fishingHolesUnlocked = 4;
      if (timeline.hole4Min === null) timeline.hole4Min = +(elapsedSec / 60).toFixed(2);
    }

    // Both efficient and casual players buy Castle Tier 1 once affordable (especially guided by compass)
    if (canBuyCastle1 && (profileName === 'casual' || s.runFish >= igloo1Cost * 1.15 || s.emperor >= 1)) {
      s.fish -= igloo1Cost;
      s.iglooTier = 1;
      if (timeline.castle1Min === null) timeline.castle1Min = +(elapsedSec / 60).toFixed(2);
    }

    // Buy species / tech
    let purchased = true;
    let guard = 0;
    while (purchased && guard < 10) {
      purchased = false;
      guard++;

      // Casual profile buys extra Adélie/Gentoo or tech slightly suboptimally
      if (profileName === 'casual' && decisionStep % 3 === 0) {
        const adelieCost = Economy.calculatePenguinCost(SPECIES[0], s.penguins.adelie.count, 1.0);
        if (s.fish >= adelieCost && s.penguins.adelie.count < 25) {
          s.fish -= adelieCost;
          s.penguins.adelie.count += 1;
          purchased = true;
          continue;
        }
      }

      // Pick best ROI among unlocked/next species and core tech
      let bestChoice = null;
      const baseDps = Math.max(0.1, calcPersistentBaselineDps(s));

      for (const sp of SPECIES) {
        const cost = Economy.calculatePenguinCost(sp, s.penguins[sp.id].count, 1.0);
        if (s.fish >= cost) {
          // Approximate marginal DPS gain per fish spent
          const gainScore = (sp.baseYield / Math.max(1, sp.diveTime + 2)) / cost;
          if (!bestChoice || gainScore > bestChoice.score) {
            bestChoice = { kind: 'penguin', id: sp.id, cost, score: gainScore };
          }
        }
      }

      for (const t of TECH) {
        if (t.id === 'bioluminescent_krill' && profileName !== 'active') continue;
        const cost = Economy.calculateTechCost(t, s.tech[t.id]);
        if (s.fish >= cost) {
          const estGain = (baseDps * 0.16) / cost;
          if (!bestChoice || estGain > bestChoice.score) {
            bestChoice = { kind: 'tech', id: t.id, cost, score: estGain };
          }
        }
      }

      // Don't blow savings right before Hole 4 or Castle Tier 1 when saving up
      if (bestChoice) {
        const savingForHole4 = s.fishingHolesUnlocked < 4 && s.fish >= hole4Cost * 0.72 && bestChoice.cost > s.fish * 0.4;
        const savingForCastle1 = s.iglooTier < 1 && s.fishingHolesUnlocked >= 4 && s.fish >= igloo1Cost * 0.72 && bestChoice.cost > s.fish * 0.4;
        if (!savingForHole4 && !savingForCastle1) {
          s.fish -= bestChoice.cost;
          if (bestChoice.kind === 'penguin') s.penguins[bestChoice.id].count += 1;
          else s.tech[bestChoice.id] += 1;
          purchased = true;
        }
      }
    }

    // Record key milestones
    if (timeline.techTabMin === null && s.unlockedTabs.includes('tech')) timeline.techTabMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.gentooMin === null && s.penguins.gentoo.count >= 1) timeline.gentooMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.chinstrapMin === null && s.penguins.chinstrap.count >= 1) timeline.chinstrapMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.emperorMin === null && s.penguins.emperor.count >= 1) timeline.emperorMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.rebirthReadyMin === null && s.runFish >= 150000) timeline.rebirthReadyMin = +(elapsedSec / 60).toFixed(2);

    // Perform First Rebirth once Castle Tier 1 has been built and >= 1 Frost Essence is pending
    if (s.totalRebirths === 0 && s.iglooTier >= 1 && Economy.calculatePendingPrestigeShards(s.runFish) >= 1) {
      doRebirth(s);
      timeline.rebirth1Min = +(elapsedSec / 60).toFixed(2);
      break;
    }
  }

  // Verify no unreachable early-to-rebirth milestones
  const requiredFields = ['techTabMin', 'gentooMin', 'chinstrapMin', 'emperorMin', 'hole4Min', 'castle1Min', 'rebirth1Min'];
  for (const f of requiredFields) {
    if (timeline[f] === null) {
      timeline.unreachableCount += 1;
      timeline.deadEndDetected = true;
    }
  }

  return { timeline, finalState: s };
}
