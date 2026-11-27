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
    fishingHolesUnlocked: Economy.MIN_FISHING_HOLES,
    prestigeShards: 0,
    totalRebirths: 0,
    skyEventsCaught: 0,
    paradesWitnessed: 0,
    unlockedHats: ['none'],
    penguins,
    tech,
    weatherIndex: 0,
    weatherTimer: 300,
    hotspotHoleId: null,
    hotspotActiveTimer: 0,
    hotspotCooldownTimer: PolarSynergy.HOTSPOT_COOLDOWN_MIN_SEC,
    hotspotSurgeTimer: 0,
    paradeBoostTimer: 0,
    auroraTimer: Economy.AURORA_BASE_INTERVAL_SEC,
    perkYieldMult: 1,
    perkSpeedMult: 1,
    perkDiveMult: 1,
    completedPermanentMilestones: [],
    completedRunMilestones: [],
    skippedMilestones: [],
    unlockedTabs: ['penguins', 'stats', 'settings']
  };
}

function getTotalPenguins(s) {
  return SPECIES.reduce((acc, sp) => acc + (s.penguins[sp.id]?.count || 0), 0);
}

function getColonyCap(s) {
  return Economy.calculateColonyCap(s.glacierLevel, s.totalRebirths);
}

function getRemainingCapSlots(s) {
  return Math.max(0, getColonyCap(s) - getTotalPenguins(s));
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
    const baseCatch = sp.baseYield * (1 + (lvl - 1) * GameData.COLONY_SIZE_BONUS_RATE) * lineBonus * s.perkYieldMult;
    const perTrip = baseCatch * prestige * levelMult * cryoBonus;
    const walkSpeed = Math.max(10, sp.baseSpeed * 40 * Economy.COLLECTION_SPEED_SCALE * walkBonus * s.perkSpeedMult);
    const slideChance = sp.id === 'gentoo' ? 1.0 : 0.35;
    const slideFactor = 1.8 * slideBonus;
    const legDist = 175;
    const expectedLeg = (1 - slideChance) * (legDist / walkSpeed) + slideChance * (legDist / (walkSpeed * slideFactor));
    const diveRate = (sp.diveTime > 1 ? 1.2 : 1.0) * s.perkDiveMult;
    const diveSec = Math.max(0.8, (sp.diveTime * Economy.DIVE_TIME_SCALE) / Math.max(0.1, diveRate));
    const tripSec = Math.max(2.2, expectedLeg * 2 + 0.5 + diveSec + 0.6);
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
  const transientMult = paradeActive ? 2 : 1;

  const hotspotActive = s.hotspotHoleId != null && s.hotspotActiveTimer > 0;
  const totalPenguins = getTotalPenguins(s);
  const hotspotShare = (hotspotActive && totalPenguins > 0) ? Math.min(1, 10 / Math.max(10, totalPenguins)) : 0;

  let totalDps = 0;
  for (const sp of SPECIES) {
    const pData = s.penguins[sp.id];
    if (!pData || pData.count <= 0) continue;
    const lvl = Math.max(1, Math.floor(1 + pData.count / 10));
    const baseCatch = sp.baseYield * (1 + (lvl - 1) * GameData.COLONY_SIZE_BONUS_RATE) * lineBonus * s.perkYieldMult;

    const nonHotspotYield = PolarSynergy.calculateEffectiveYield({
      baseCatch,
      weatherId,
      speciesId: sp.id,
      paradeActive,
      isAtHotspot: false,
      hotspotSurgeTimer: 0
    }).effectiveCatch;

    const hotspotYield = hotspotActive
      ? PolarSynergy.calculateEffectiveYield({
          baseCatch,
          weatherId,
          speciesId: sp.id,
          paradeActive,
          isAtHotspot: true,
          hotspotSurgeTimer: s.hotspotSurgeTimer
        }).effectiveCatch
      : nonHotspotYield;

    const blendedCatch = nonHotspotYield * (1 - hotspotShare) + hotspotYield * hotspotShare;
    const syn = PolarSynergy.getSpeciesSynergy(sp.id, weatherId, paradeActive);

    const perTrip = blendedCatch * prestige * levelMult * cryoBonus * transientMult;
    const walkSpeed = Math.max(10, sp.baseSpeed * 40 * Economy.COLLECTION_SPEED_SCALE * walkBonus * s.perkSpeedMult * syn.speedMult);
    const slideChance = sp.id === 'gentoo' ? 1.0 : 0.35;
    const slideFactor = 1.8 * slideBonus;
    const legDist = 175;
    const expectedLeg = (1 - slideChance) * (legDist / walkSpeed) + slideChance * (legDist / (walkSpeed * slideFactor));
    const diveRate = (sp.diveTime > 1 ? 1.2 : 1.0) * s.perkDiveMult * syn.diveSpeedMult;
    const diveSec = Math.max(0.8, (sp.diveTime * Economy.DIVE_TIME_SCALE) / Math.max(0.1, diveRate));
    const tripSec = Math.max(2.2, expectedLeg * 2 + 0.5 + diveSec + 0.6);
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
    if (s.levelFish >= req && s.glacierLevel < Economy.MAX_GLACIER_LEVEL) {
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
  } else {
    s.weatherTimer = rem;
  }
}

function stepHotspot(s, dt) {
  const holeIds = Array.from({ length: s.fishingHolesUnlocked }, (_, i) => i + 1);
  const res = PolarSynergy.stepHotspotLifecycle(
    {
      holeId: s.hotspotHoleId,
      activeTimer: s.hotspotActiveTimer,
      cooldownTimer: s.hotspotCooldownTimer,
      surgeTimer: s.hotspotSurgeTimer,
      rotationEpoch: s.weatherIndex
    },
    dt,
    {
      weatherId: WEATHER_IDS[s.weatherIndex] || 'clear',
      unlockedHoleIds: holeIds,
      rng: () => 0.5
    }
  );
  s.hotspotHoleId = res.holeId;
  s.hotspotActiveTimer = res.activeTimer;
  s.hotspotCooldownTimer = res.cooldownTimer;
  s.hotspotSurgeTimer = res.surgeTimer;
}

function clearTransientForOffline(s, offlineGapSec) {
  s.hotspotHoleId = null;
  s.hotspotActiveTimer = 0;
  s.hotspotCooldownTimer = PolarSynergy.rollHotspotCooldownSec(() => 0.5);
  s.hotspotSurgeTimer = Math.max(0, s.hotspotSurgeTimer - offlineGapSec);
  s.paradeBoostTimer = Math.max(0, s.paradeBoostTimer - offlineGapSec);
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
  s.fishingHolesUnlocked = Economy.MIN_FISHING_HOLES;
  s.hotspotHoleId = null;
  s.hotspotActiveTimer = 0;
  s.hotspotCooldownTimer = PolarSynergy.rollHotspotCooldownSec(() => 0.5);
  s.hotspotSurgeTimer = 0;
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

function spendOptimally(s, opts = {}) {
  const {
    profileName = 'efficient',
    decisionStep = 0,
    saveForTargetCost = null,
    allowClickTech = false
  } = opts;

  let purchased = true;
  let guard = 0;
  while (purchased && guard < 12) {
    purchased = false;
    guard++;

    const remainingSlots = getRemainingCapSlots(s);

    // Casual profile occasionally buys extra Adélie when cap allows
    if (profileName === 'casual' && decisionStep % 3 === 0 && remainingSlots > 0) {
      const adelieCost = Economy.calculatePenguinCost(SPECIES[0], s.penguins.adelie.count, 1.0);
      if (s.fish >= adelieCost && s.penguins.adelie.count < 16) {
        s.fish -= adelieCost;
        s.penguins.adelie.count += 1;
        purchased = true;
        continue;
      }
    }

    let bestChoice = null;
    const baseDps = Math.max(0.1, calcPersistentBaselineDps(s));

    if (remainingSlots > 0) {
      for (const sp of SPECIES) {
        const cost = Economy.calculatePenguinCost(sp, s.penguins[sp.id].count, 1.0);
        if (s.fish >= cost) {
          const gainScore = (sp.baseYield / Math.max(1, sp.diveTime * Economy.DIVE_TIME_SCALE + 2)) / cost;
          if (!bestChoice || gainScore > bestChoice.score) {
            bestChoice = { kind: 'penguin', id: sp.id, cost, score: gainScore };
          }
        }
      }
    }

    for (const t of TECH) {
      if (t.id === 'bioluminescent_krill' && !allowClickTech) continue;
      if (t.id === 'aurora_coils') continue; // Minimal ROI after 2.7.2 nerf
      const cost = Economy.calculateTechCost(t, s.tech[t.id]);
      if (s.fish >= cost) {
        const estGain = (baseDps * 0.16) / cost;
        if (!bestChoice || estGain > bestChoice.score) {
          bestChoice = { kind: 'tech', id: t.id, cost, score: estGain };
        }
      }
    }

    if (bestChoice) {
      const savingForGoal = saveForTargetCost != null && s.fish >= saveForTargetCost * 0.65 && bestChoice.cost > s.fish * 0.35;
      if (!savingForGoal) {
        s.fish -= bestChoice.cost;
        if (bestChoice.kind === 'penguin') s.penguins[bestChoice.id].count += 1;
        else s.tech[bestChoice.id] += 1;
        purchased = true;
      }
    }
  }
}

/**
 * Runs a deterministic early-to-First-Rebirth player profile simulation.
 * Profiles: 'efficient' | 'casual' | 'active' | 'idle'
 */
export function runProfileSimulation(profileName, options = {}) {
  const igloo1Cost = options.igloo1Cost ?? Economy.IGLOO_TIERS[1].cost;
  const maxSimSeconds = options.maxSimSeconds ?? 12 * 3600; // 12 simulated hours max
  const s = createSimState();

  const timeline = {
    profile: profileName,
    techTabMin: null,
    gentooMin: null,
    chinstrapMin: null,
    emperorMin: null,
    castle1Min: null,
    rebirthReadyMin: null,
    rebirth1Min: null,
    castleBeforeRebirthRecommendationObserved: false,
    colonyCapViolated: false,
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
    // Idle profile simulates 10m active check-ins separated by 45m offline intervals (35% rate)
    if (profileName === 'idle' && idleCycleTimer >= 600 && s.lifetimeFish >= 50) {
      const offlineGapSec = 2700;
      const persistentBefore = calcPersistentBaselineDps(s);
      // Inject transient timers right before going offline to verify zero leakage
      s.hotspotHoleId = 1;
      s.hotspotActiveTimer = 25;
      s.hotspotSurgeTimer = 20;
      s.paradeBoostTimer = 15;

      const offlineRes = Economy.calculateOfflineEarnings({
        dps: persistentBefore,
        lastSaveTimeMs: 0,
        nowMs: offlineGapSec * 1000
      });
      clearTransientForOffline(s, offlineGapSec);
      if (s.hotspotHoleId !== null || s.hotspotActiveTimer !== 0 || s.hotspotSurgeTimer !== 0 || s.paradeBoostTimer !== 0) {
        timeline.transientLeakDetected = true;
      }
      const expectedMaxOffline = Math.floor(persistentBefore * offlineGapSec * Economy.OFFLINE_BASE_RATE);
      if (offlineRes.earned > expectedMaxOffline) {
        timeline.transientLeakDetected = true;
      }

      advanceWeather(s, offlineGapSec);
      addFish(s, offlineRes.earned);
      elapsedSec += offlineGapSec;
      idleCycleTimer = 0;
    }

    const dt = 5;
    elapsedSec += dt;
    idleCycleTimer += dt;
    activeEventTimer += dt;

    s.hotspotSurgeTimer = Math.max(0, s.hotspotSurgeTimer - dt);
    s.paradeBoostTimer = Math.max(0, s.paradeBoostTimer - dt);
    advanceWeather(s, dt);
    stepHotspot(s, dt);

    const liveDps = calcLiveDps(s);
    addFish(s, liveDps * dt);

    // Active profile taps occasionally & catches rare standalone Sky/Krill events (~210s cadence, no Sky Combo)
    if (profileName === 'active') {
      const clickVal = Math.max(1, Math.floor((1 + s.tech.bioluminescent_krill * 0.5) * Economy.calculatePrestigeMultiplier(s.prestigeShards) * Economy.calculateGlacierLevelMultiplier(s.glacierLevel)));
      addFish(s, clickVal * 6);
      if (activeEventTimer >= 210) {
        activeEventTimer = 0;
        s.skyEventsCaught += 1;
        if (s.hotspotHoleId != null && s.hotspotActiveTimer > 0) {
          s.hotspotSurgeTimer = PolarSynergy.HOTSPOT_SURGE_DURATION_SEC;
        }
        addFish(s, Math.max(40, Math.round(liveDps * 8)));
      }
    } else if (profileName === 'efficient' && elapsedSec <= 60) {
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

    decisionStep++;

    // Castle Tier 1 (65K) before Rebirth 1
    if (s.iglooTier < 1 && s.fish >= igloo1Cost) {
      s.fish -= igloo1Cost;
      s.iglooTier = 1;
      if (timeline.castle1Min === null) timeline.castle1Min = +(elapsedSec / 60).toFixed(2);
    }

    spendOptimally(s, {
      profileName,
      decisionStep,
      saveForTargetCost: s.iglooTier < 1 ? igloo1Cost : null,
      allowClickTech: profileName === 'active'
    });

    if (getTotalPenguins(s) > getColonyCap(s)) {
      timeline.colonyCapViolated = true;
    }

    if (timeline.techTabMin === null && s.unlockedTabs.includes('tech')) timeline.techTabMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.gentooMin === null && s.penguins.gentoo.count >= 1) timeline.gentooMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.chinstrapMin === null && s.penguins.chinstrap.count >= 1) timeline.chinstrapMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.emperorMin === null && s.penguins.emperor.count >= 1) timeline.emperorMin = +(elapsedSec / 60).toFixed(2);
    if (timeline.rebirthReadyMin === null && s.runFish >= 150000) timeline.rebirthReadyMin = +(elapsedSec / 60).toFixed(2);

    if (s.totalRebirths === 0 && s.iglooTier >= 1 && Economy.calculatePendingPrestigeShards(s.runFish) >= 1) {
      doRebirth(s);
      timeline.rebirth1Min = +(elapsedSec / 60).toFixed(2);
      break;
    }
  }

  const requiredFields = ['techTabMin', 'gentooMin', 'chinstrapMin', 'emperorMin', 'castle1Min', 'rebirth1Min'];
  for (const f of requiredFields) {
    if (timeline[f] === null) {
      timeline.unreachableCount += 1;
      timeline.deadEndDetected = true;
    }
  }

  return { timeline, finalState: s };
}

/**
 * Multi-day mostly-idle simulation measuring realistic wall-clock hours to reach Tier 3 Frosted Citadel.
 * Models a player checking in 3 times per day (~10 minutes active per check-in, ~7h50m offline between check-ins
 * at the 35% offline rate) with modest Aurora perks, Colony Cap limits, and Prestige Rebirths.
 */
export function runMultiDayFrostedCitadelSimulation(options = {}) {
  const maxDays = options.maxDays ?? 10;
  const maxSec = maxDays * 24 * 3600;
  const activeSessionSec = options.activeSessionSec ?? 600;     // 10 min active check-in
  const offlineGapSec = options.offlineGapSec ?? (7 * 3600 + 50 * 60); // 7h 50m offline (3 check-ins/day)
  const targetRebirthsBeforePush = options.targetRebirthsBeforePush ?? 3;
  const citadelCost = options.citadelCost ?? Economy.IGLOO_TIERS[3].cost;
  const keepCost = options.keepCost ?? Economy.IGLOO_TIERS[2].cost;
  const igloo1Cost = options.igloo1Cost ?? Economy.IGLOO_TIERS[1].cost;

  const s = createSimState();
  let elapsedSec = 0;
  let castle1Hours = null;
  let castle2Hours = null;
  let frostedCitadelHours = null;
  let transientLeakDetected = false;
  let auroraClaims = 0;

  while (elapsedSec < maxSec && frostedCitadelHours === null) {
    // 1) Active check-in session (10 minutes)
    const sessionEnd = Math.min(maxSec, elapsedSec + activeSessionSec);
    let sessionStep = 0;
    while (elapsedSec < sessionEnd && frostedCitadelHours === null) {
      const dt = 10;
      elapsedSec += dt;
      sessionStep++;

      advanceWeather(s, dt);
      stepHotspot(s, dt);
      s.hotspotSurgeTimer = Math.max(0, s.hotspotSurgeTimer - dt);
      s.paradeBoostTimer = Math.max(0, s.paradeBoostTimer - dt);

      const liveDps = calcLiveDps(s);
      addFish(s, liveDps * dt);

      // Opening taps on very first session so the starter penguin gets moving
      if (elapsedSec <= 120) {
        addFish(s, 6);
      }

      // 9-minute Aurora Blessing cadence (modest average permanent buff after 2.7.2 nerf & 1/1 Legendary/Mythic cap)
      s.auroraTimer -= dt;
      if (s.auroraTimer <= 0) {
        s.auroraTimer = Economy.calculateAuroraIntervalSec(s.tech.aurora_coils || 0);
        auroraClaims++;
        // Average permanent blessing pick (+4% yield or +3% speed, diminishing once top perks hit 1/1 cap)
        if (auroraClaims <= 14) {
          if (auroraClaims % 2 === 1) s.perkYieldMult *= 1.045;
          else s.perkSpeedMult *= 1.03;
        } else {
          s.perkYieldMult *= 1.015;
        }
      }

      // Castle upgrades
      if (s.iglooTier < 1 && s.fish >= igloo1Cost) {
        s.fish -= igloo1Cost;
        s.iglooTier = 1;
        if (castle1Hours === null) castle1Hours = +(elapsedSec / 3600).toFixed(2);
      }
      if (s.iglooTier === 1 && s.fish >= keepCost) {
        s.fish -= keepCost;
        s.iglooTier = 2;
        if (castle2Hours === null) castle2Hours = +(elapsedSec / 3600).toFixed(2);
      }
      if (s.iglooTier === 2 && s.fish >= citadelCost) {
        s.fish -= citadelCost;
        s.iglooTier = 3;
        frostedCitadelHours = +(elapsedSec / 3600).toFixed(2);
        break;
      }

      // Unlock additional fishing holes once 5 Rebirths are reached
      if (Economy.canUnlockAdditionalFishingHoles(s.totalRebirths) && s.fishingHolesUnlocked < Economy.MAX_FISHING_HOLES) {
        const nextHole = Economy.getNextFishingHoleDef(s.fishingHolesUnlocked);
        if (nextHole && s.fish >= nextHole.cost && s.fish < citadelCost * 0.5) {
          s.fish -= nextHole.cost;
          s.fishingHolesUnlocked += 1;
        }
      }

      const nextCastleCost = s.iglooTier === 0 ? igloo1Cost : (s.iglooTier === 1 ? keepCost : citadelCost);
      spendOptimally(s, {
        profileName: 'efficient',
        decisionStep: sessionStep,
        saveForTargetCost: nextCastleCost,
        allowClickTech: false
      });

      // Perform Rebirth strategically before pushing for Frosted Citadel
      const pending = Economy.calculatePendingPrestigeShards(s.runFish);
      const rebirthThreshold = s.totalRebirths === 0 ? 1 : (s.totalRebirths < 3 ? 2 : (s.totalRebirths < 5 ? 4 : 6));
      if (s.totalRebirths < targetRebirthsBeforePush && s.iglooTier >= 1 && pending >= rebirthThreshold && s.fish < citadelCost * 0.35) {
        doRebirth(s);
      }
    }

    if (frostedCitadelHours !== null || elapsedSec >= maxSec) break;

    // 2) Offline stretch (~7h50m at 35% offline rate)
    const gap = Math.min(offlineGapSec, maxSec - elapsedSec);
    const persistentDps = calcPersistentBaselineDps(s);
    const offlineRes = Economy.calculateOfflineEarnings({
      dps: persistentDps,
      lastSaveTimeMs: 0,
      nowMs: gap * 1000
    });
    clearTransientForOffline(s, gap);
    const maxExpected = Math.floor(persistentDps * gap * Economy.OFFLINE_BASE_RATE);
    if (offlineRes.earned > maxExpected) {
      transientLeakDetected = true;
    }
    advanceWeather(s, gap);
    addFish(s, offlineRes.earned);
    elapsedSec += gap;
  }

  return {
    castle1Hours,
    castle2Hours,
    frostedCitadelHours,
    frostedCitadelDays: frostedCitadelHours != null ? +(frostedCitadelHours / 24).toFixed(2) : null,
    totalRebirths: s.totalRebirths,
    prestigeShards: s.prestigeShards,
    finalGlacierLevel: s.glacierLevel,
    finalColonyCount: getTotalPenguins(s),
    finalColonyCap: getColonyCap(s),
    finalDps: +calcPersistentBaselineDps(s).toFixed(1),
    auroraClaims,
    transientLeakDetected
  };
}
