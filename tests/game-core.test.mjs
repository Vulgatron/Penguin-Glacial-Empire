import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { runProfileSimulation, runMultiDayFrostedCitadelSimulation } from './pacing-simulator.mjs';

const require = createRequire(import.meta.url);
const Economy = require('../js/economy.js');
const DailySystem = require('../js/daily-system.js');
const Wardrobe = require('../js/wardrobe.js');
const GameData = require('../js/game-data.js');
const MilestoneEngine = require('../js/milestone-engine.js');
const PolarSynergy = require('../js/polar-synergy.js');
const SaveSystem = require('../js/save-system.js');
const SkyEvents = require('../js/sky-events.js');
const DailyManager = require('../js/daily-manager.js');
const { SoundEngine } = require('../js/sound-engine.js');
const CastleRenderer = require('../js/castle-renderer.js');
const PenguinSprites = require('../js/penguin-sprites.js');
const SceneRenderer = require('../js/scene-renderer.js');
const ParadeEvent = require('../js/parade-event.js');

const ROOT = path.resolve(import.meta.dirname, '..');

test('Economy: number formatting handles normal, rollover boundaries, large HUD units, negative, and non-finite values', () => {
  assert.equal(Economy.formatNumber(0), '0');
  assert.equal(Economy.formatNumber(999), '999');
  assert.equal(Economy.formatNumber(1500), '1.5K');
  assert.equal(Economy.formatNumber(999_949), '999.9K');
  assert.equal(Economy.formatNumber(999_950), '1.0M');
  assert.equal(Economy.formatNumber(999_999), '1.0M');
  assert.equal(Economy.formatNumber(2_500_000), '2.5M');
  assert.equal(Economy.formatNumber(-1200), '-1.2K');
  assert.equal(Economy.formatNumber(NaN), '0');
  assert.equal(Economy.formatNumber(Infinity), '0');
  assert.match(Economy.formatNumber(1e45), /e\+45$/i);

  // Overflow-safe HUD formatter covers full unit table, rollovers, scientific fallback, and non-finite inputs
  assert.equal(Economy.formatHudFish(0), '0');
  assert.equal(Economy.formatHudFish(999), '999');
  assert.equal(Economy.formatHudFish(1_500), '1,500');
  assert.equal(Economy.formatHudFish(12_500), '12.50K');
  assert.equal(Economy.formatHudFish(999_999), '1.00M');
  assert.equal(Economy.formatHudFish(1e27), '1.00Oc');
  assert.equal(Economy.formatHudFish(1e33), '1.00Dc');
  assert.match(Economy.formatHudFish(1e45), /e\+45$/i);
  assert.equal(Economy.formatHudFish(NaN), '0');
  assert.equal(Economy.formatHudFish(Infinity), '0');
  assert.equal(Economy.formatHudFish(-Infinity), '0');
  assert.equal(Economy.MAX_GLACIER_LEVEL, 10000);
});

test('Economy: penguin & tech cost calculations preserve formulas and clamp overflow safely', () => {
  const adelie = { id: 'adelie', baseCost: 15, costMult: 1.15 };
  assert.equal(Economy.calculatePenguinCost(adelie, 0, 1.0), 15);
  assert.equal(Economy.calculatePenguinCost(adelie, 0, 0.85), 12); // Thrifty trait discount
  assert.equal(Economy.calculatePenguinCost(adelie, 1, 1.0), 17);

  // Extreme count clamps to MAX_SAFE_RESOURCE instead of Infinity/NaN
  const extreme = Economy.calculatePenguinCost(adelie, 50000, 1.0);
  assert.equal(Number.isFinite(extreme), true);
  assert.equal(extreme, Economy.MAX_SAFE_RESOURCE);

  const tech = { id: 'thermal_parkas', baseCost: 50, costMult: 1.35 };
  assert.equal(Economy.calculateTechCost(tech, 0), 50);
  assert.equal(Economy.calculateTechCost(tech, 1), 67);
  assert.equal(Number.isFinite(Economy.calculateTechCost(tech, 50000)), true);
});

test('Economy: bulk penguin and tech purchases handle fixed qty, MAX, and insufficient funds', () => {
  const adelie = { id: 'adelie', baseCost: 15, costMult: 1.15 };
  const exact10 = Economy.calculateBulkPenguinPurchase(adelie, 1, 10000, 10, 1.0);
  assert.equal(exact10.qty, 10);
  assert.equal(exact10.canAfford, true);
  assert.ok(exact10.cost > 150 && exact10.cost < 500);

  const maxAffordable = Economy.calculateBulkPenguinPurchase(adelie, 0, 50, 'MAX', 1.0);
  // 15 + 17 = 32 <= 50; 3rd costs 19 -> 51 > 50, so MAX buys 2
  assert.equal(maxAffordable.qty, 2);
  assert.equal(maxAffordable.cost, 32);
  assert.equal(maxAffordable.canAfford, true);

  const cannotAffordMax = Economy.calculateBulkPenguinPurchase(adelie, 0, 10, 'MAX', 1.0);
  assert.equal(cannotAffordMax.qty, 1);
  assert.equal(cannotAffordMax.cost, 15);
  assert.equal(cannotAffordMax.canAfford, false);

  const tech = { id: 'smooth_ice', baseCost: 50, costMult: 1.35 };
  const maxTech = Economy.calculateBulkTechPurchase(tech, 0, 130, 'MAX');
  // 50 + 67 = 117 <= 130; 3rd costs 91 -> 208 > 130
  assert.equal(maxTech.qty, 2);
  assert.equal(maxTech.cost, 117);
  assert.equal(maxTech.canAfford, true);

  // Update 2.7.2: Colony Cap scaling (15 + 5*(Lv-1) + 10*Rebirths) & bulk cap clamping
  assert.equal(Economy.calculateColonyCap(1, 0), 15);
  assert.equal(Economy.calculateColonyCap(2, 0), 20);
  assert.equal(Economy.calculateColonyCap(1, 1), 25);
  assert.equal(Economy.calculateColonyCap(10, 6), 15 + 45 + 60);

  const clampedBuy = Economy.calculateBulkPenguinPurchase(adelie, 1, 100000, 10, 1.0, 100, 3);
  assert.equal(clampedBuy.qty, 3);
  assert.equal(clampedBuy.capReached, false);
  const fullCapBuy = Economy.calculateBulkPenguinPurchase(adelie, 1, 100000, 1, 1.0, 100, 0);
  assert.equal(fullCapBuy.qty, 0);
  assert.equal(fullCapBuy.canAfford, false);
  assert.equal(fullCapBuy.capReached, true);

  // Update 2.7.2: Prestige gates, 9m Aurora cadence with -1s/lv Coils & 7m floor, duplicate Legendary/Mythic fish bonus
  assert.equal(Economy.canUnlockAdditionalFishingHoles(4), false);
  assert.equal(Economy.canUnlockAdditionalFishingHoles(5), true);
  assert.equal(Economy.isWardrobeUnlocked(5), false);
  assert.equal(Economy.isWardrobeUnlocked(6), true);
  assert.equal(Economy.calculateAuroraIntervalSec(0), 540);
  assert.equal(Economy.calculateAuroraIntervalSec(10), 530);
  assert.equal(Economy.calculateAuroraIntervalSec(500), 420);
  assert.deepEqual(Economy.calculateDuplicatePerkFishBonus('legendary', 100), { fish: 12000, seconds: 120 });
  assert.deepEqual(Economy.calculateDuplicatePerkFishBonus('mythic', 100), { fish: 24000, seconds: 240 });
  assert.deepEqual(Economy.calculateDuplicatePerkFishBonus('legendary', 0), { fish: 250, seconds: 120 });
  assert.deepEqual(Economy.calculateDuplicatePerkFishBonus('mythic', 0), { fish: 500, seconds: 240 });
});

test('Economy: prestige shards (+1.25% each, 75% reduced) and glacier level scaling preserve progression rules', () => {
  assert.equal(Economy.PRESTIGE_BONUS_PER_SHARD, 0.0125);
  assert.equal(Economy.calculatePendingPrestigeShards(149_999), 0);
  assert.equal(Economy.calculatePendingPrestigeShards(150_000), 1);
  assert.equal(Economy.calculatePendingPrestigeShards(150_000 * 8), 2);
  assert.equal(Economy.calculatePrestigeMultiplier(20), 1.25);
  assert.equal(Economy.calculatePrestigeMultiplier(80), 2.0);
  assert.equal(Economy.calculatePrestigeBonusPct(1), 1.25);
  assert.equal(Economy.formatPrestigeBonusPct(1), '1.25');
  assert.equal(Economy.formatPrestigeBonusPct(4), '5');
  assert.equal(Economy.formatPrestigeBonusPct(20), '25');
  assert.equal(Economy.calculateLevelRequirement(1), Math.floor(150 * 1.32));
  assert.equal(Number.isFinite(Economy.calculateLevelRequirement(9999)), true);
});

test('Economy: Igloo-to-Ice-Castle tiers, color palettes, purchasable fishing holes, and safe frame timing', () => {
  assert.equal(Economy.MAX_IGLOO_TIER, 5);
  assert.equal(Economy.IGLOO_TIERS.length, 6);
  assert.equal(Economy.IGLOO_TIERS[0].cost, 0);
  for (let i = 1; i < Economy.IGLOO_TIERS.length; i++) {
    assert.ok(Economy.IGLOO_TIERS[i].cost > Economy.IGLOO_TIERS[i - 1].cost, 'Castle tiers must escalate substantially');
  }
  assert.equal(Economy.getNextIglooTierDef(0).tier, 1);
  assert.equal(Economy.IGLOO_TIERS[1].cost, 65000);
  assert.equal(Economy.IGLOO_TIERS[3].cost, 3000000000); // Calibrated 3-5 day Frosted Citadel (v2.7.2)
  assert.equal(Economy.getNextIglooTierDef(5), null);

  assert.equal(Economy.IGLOO_THEMES.length, 6);
  assert.equal(Economy.getIglooThemeDef('glacier').cost, 0);
  assert.equal(Economy.getIglooThemeDef('unknown_theme').id, 'glacier');

  // Fishing holes: 3 starter + 3 purchasable = 6 max (4-6 gated behind 5 Rebirths)
  assert.equal(Economy.MIN_FISHING_HOLES, 3);
  assert.equal(Economy.MAX_FISHING_HOLES, 6);
  assert.equal(Economy.FISHING_HOLES_MIN_REBIRTHS, 5);
  assert.equal(Economy.FISHING_HOLE_DEFS.length, 6);
  assert.equal(Economy.FISHING_HOLE_DEFS[3].cost, 150000);
  assert.equal(Economy.getActiveFishingHoleDefs(3).length, 3);
  assert.equal(Economy.getActiveFishingHoleDefs(1).length, 3);
  assert.equal(Economy.getActiveFishingHoleDefs(6).length, 6);
  assert.equal(Economy.getActiveFishingHoleDefs(99).length, 6);
  assert.equal(Economy.getNextFishingHoleDef(3).id, 4);
  assert.equal(Economy.getNextFishingHoleDef(5).id, 6);
  assert.equal(Economy.getNextFishingHoleDef(6), null);

  // Blank-canvas root-cause guards: never negative dt, never negative modulo index
  assert.equal(Economy.computeSafeFrameDeltaSec(95, 100, 0.1), 0);
  assert.equal(Economy.computeSafeFrameDeltaSec(NaN, 100, 0.1), 0);
  assert.equal(Economy.computeSafeFrameDeltaSec(1000, 100, 0.1), 0.1);
  assert.ok(Math.abs(Economy.computeSafeFrameDeltaSec(116, 100, 0.1) - 0.016) < 1e-6);

  assert.equal(Economy.positiveModulo(-1, 4), 3);
  assert.equal(Economy.positiveModulo(-0.5, 360), 359.5);
  assert.equal(Economy.positiveModulo(NaN, 4), 0);

  // Castle SVG preview renders safely across all tiers and palettes
  const svgPreview = CastleRenderer.getSvgCastlePreviewMarkup(5, 'aurora');
  assert.match(svgPreview, /<svg/);
  assert.match(svgPreview, /<\/svg>/);
});

test('Economy: offline earnings enforce 24h full + diminishing up to 7d and block clock rollback', () => {
  const now = 1_750_000_000_000;

  // Under 10 seconds -> 0
  const tooShort = Economy.calculateOfflineEarnings({
    dps: 100,
    lastSaveTimeMs: now - 5_000,
    nowMs: now
  });
  assert.equal(tooShort.earned, 0);
  assert.equal(tooShort.clockMovedBackward, false);

  // Backward clock jump -> 0 and flagged
  const backward = Economy.calculateOfflineEarnings({
    dps: 100,
    lastSaveTimeMs: now + 3_600_000,
    nowMs: now
  });
  assert.equal(backward.earned, 0);
  assert.equal(backward.clockMovedBackward, true);

  // 12 hours -> full offline rate (35% DPS in v2.7.2)
  assert.equal(Economy.OFFLINE_BASE_RATE, 0.35);
  const twelveHours = Economy.calculateOfflineEarnings({
    dps: 30,
    lastSaveTimeMs: now - 12 * 3600 * 1000,
    nowMs: now
  });
  assert.equal(twelveHours.capped, false);
  assert.equal(twelveHours.earned, Math.floor(30 * (12 * 3600) * 0.35));

  // 48 hours -> 24h full + 24h * 0.25 = 30 effective hours
  const fortyEightHours = Economy.calculateOfflineEarnings({
    dps: 30,
    lastSaveTimeMs: now - 48 * 3600 * 1000,
    nowMs: now
  });
  assert.equal(fortyEightHours.capped, true);
  assert.equal(fortyEightHours.effectiveSec, 30 * 3600);
  assert.equal(fortyEightHours.earned, Math.floor(30 * (30 * 3600) * 0.35));

  // 30 days -> capped at 7d ceiling (24h + 6d * 0.25 = 60 effective hours)
  const thirtyDays = Economy.calculateOfflineEarnings({
    dps: 30,
    lastSaveTimeMs: now - 30 * 24 * 3600 * 1000,
    nowMs: now
  });
  assert.equal(thirtyDays.capped, true);
  assert.equal(thirtyDays.effectiveSec, 60 * 3600);
});

test('Golden Fish: cooldown ticks at 2x when perk timer active, pauses when blocked, stays above bottom sheet', () => {
  // Normal 1x countdown
  const normal = Economy.computeGoldenFishCooldownStep({
    cooldownSec: 10,
    dtSec: 2,
    goldenFishTimerSec: 0,
    isBlocked: false
  });
  assert.equal(normal.nextCooldownSec, 8);
  assert.equal(normal.shouldSpawn, false);
  assert.equal(normal.boostActive, false);

  // 2x frequency boost from r_magnetic / l_golden_aurora
  const boosted = Economy.computeGoldenFishCooldownStep({
    cooldownSec: 10,
    dtSec: 2,
    goldenFishTimerSec: 60,
    isBlocked: false
  });
  assert.equal(boosted.nextCooldownSec, 6);
  assert.equal(boosted.boostActive, true);

  // Trigger spawn when reaching 0
  const triggers = Economy.computeGoldenFishCooldownStep({
    cooldownSec: 1.5,
    dtSec: 1.0,
    goldenFishTimerSec: 45,
    isBlocked: false
  });
  assert.equal(triggers.shouldSpawn, true);
  assert.equal(triggers.nextCooldownSec, 0);

  // Paused when blocked (expanded bottom sheet or modal)
  const blocked = Economy.computeGoldenFishCooldownStep({
    cooldownSec: 5,
    dtSec: 4,
    goldenFishTimerSec: 60,
    isBlocked: true
  });
  assert.equal(blocked.nextCooldownSec, 5);
  assert.equal(blocked.shouldSpawn, false);

  // Rare Golden Fish base cooldown is 6–9 minutes (360–540s) and halved when boost active
  assert.equal(Economy.GOLDEN_FISH_BASE_COOLDOWN_MIN, 360);
  const baseCd = Economy.computeGoldenFishNextCooldown({ goldenFishTimerSec: 0, rng: () => 0.5 });
  assert.equal(baseCd, 450);
  const boostedCd = Economy.computeGoldenFishNextCooldown({ goldenFishTimerSec: 30, rng: () => 0.5 });
  assert.equal(boostedCd, baseCd / 2);

  // Position stays visible above default 52vh bottom sheet on an 800px tall phone
  const sheetTopY = 800 * 0.48; // 384px
  const posOpenSheet = Economy.computeGoldenFishPosition({
    width: 390,
    height: 800,
    hole: { xRatio: 0.50, yRatio: 0.78 }, // rawHy = 624 (behind sheet!)
    elapsed: 1.5,
    duration: 7.2,
    dir: 1,
    visibleTopY: 92,
    visibleBottomY: sheetTopY
  });
  assert.equal(posOpenSheet.clampedAboveSheet, true);
  assert.ok(posOpenSheet.y <= sheetTopY - 26, `Expected y (${posOpenSheet.y}) above sheet top (${sheetTopY})`);
  assert.ok(posOpenSheet.y >= 110, `Expected y (${posOpenSheet.y}) below top HUD`);

  // When sheet is collapsed, Golden Fish leaps naturally over the fishing hole
  const posCollapsed = Economy.computeGoldenFishPosition({
    width: 390,
    height: 800,
    hole: { xRatio: 0.50, yRatio: 0.78 },
    elapsed: 1.5,
    duration: 7.2,
    dir: 1,
    visibleTopY: 92,
    visibleBottomY: 790
  });
  assert.equal(posCollapsed.clampedAboveSheet, false);
  assert.ok(posCollapsed.y > 500);

  // Reward math
  assert.equal(Economy.calculateGoldenFishReward(0), 50);
  assert.equal(Economy.calculateGoldenFishReward(10), 300);
  assert.equal(Economy.calculateGoldenFishReward(NaN), 50);
});

test('DailySystem: 3 AM cycle rollover, streak increments, idempotence, and missed day reset', () => {
  const before3am = new Date(2026, 4, 15, 2, 59, 0).getTime();
  const at3am = new Date(2026, 4, 15, 3, 0, 0).getTime();
  assert.equal(DailySystem.getCycleDateKey(before3am), '2026-05-14');
  assert.equal(DailySystem.getCycleDateKey(at3am), '2026-05-15');
  assert.equal(DailySystem.isConsecutiveCycleDay('2026-05-14', '2026-05-15'), true);
  assert.equal(DailySystem.isConsecutiveCycleDay('2026-05-13', '2026-05-15'), false);

  // Day 1 claim starts streak at 1
  const day1 = DailySystem.applyStreakForGoalClaim(
    { streakCount: 0, bestStreak: 0, lastStreakDateKey: '', permanentFishBonusPct: 0 },
    '2026-05-14'
  );
  assert.equal(day1.streakCount, 1);
  assert.equal(day1.incremented, true);
  assert.equal(day1.bonusGainPct, 0);

  // Duplicate claim on same day is idempotent (no duplicate reward)
  const day1Dup = DailySystem.applyStreakForGoalClaim(day1, '2026-05-14');
  assert.equal(day1Dup.streakCount, 1);
  assert.equal(day1Dup.incremented, false);
  assert.equal(day1Dup.bonusGainPct, 0);

  // Day 2 consecutive claim grants +2% permanent fish bonus
  const day2 = DailySystem.applyStreakForGoalClaim(day1, '2026-05-15');
  assert.equal(day2.streakCount, 2);
  assert.equal(day2.bestStreak, 2);
  assert.equal(day2.bonusGainPct, 2);
  assert.equal(day2.permanentFishBonusPct, 2);

  // Skipped day resets active streak to 0 while preserving bestStreak
  const afterGap = DailySystem.syncStreakForCycle(day2, '2026-05-18');
  assert.equal(afterGap.streakCount, 0);
  assert.equal(afterGap.bestStreak, 2);
});

test('SaveSystem: migrates legacy v0 saves, sanitizes corrupt values/NaN/prototype keys/future clocks', () => {
  const now = 1_760_000_000_000;
  const legacyV0 = {
    fish: 12345,
    lifetimeFish: 50000,
    glacierLevel: 4,
    prestigeShards: 3,
    penguins: {
      adelie: { count: 12, level: 2, nextTrait: 'optimistic', traitCounts: { optimistic: 10, bogusTrait: 5 } },
      gentoo: { count: -4, level: NaN }
    },
    tech: { thermal_parkas: 5, smooth_ice: 'NaN' },
    unlockedAchievements: JSON.parse('{"first_recruit": true, "__proto__": {"polluted": true}}'),
    lastSaveTime: now + 86_400_000 * 365 // 1 year in the future
  };

  const sanitized = SaveSystem.sanitizeSaveData(legacyV0, {}, now);
  assert.equal(sanitized.migrated, true);
  assert.equal(sanitized.migratedFrom, 0);
  assert.equal(sanitized.data.saveVersion, SaveSystem.CURRENT_SAVE_VERSION);
  assert.equal(sanitized.data.fish, 12345);
  assert.equal(sanitized.data.runFish, 50000);
  assert.equal(sanitized.data.penguins.adelie.count, 12);
  assert.equal(sanitized.data.penguins.adelie.traitCounts.bogusTrait, undefined);
  assert.equal(sanitized.data.penguins.gentoo.count, 0);
  assert.equal(sanitized.data.tech.thermal_parkas, 5);
  assert.equal(sanitized.data.tech.smooth_ice, 0);
  assert.equal(sanitized.data.unlockedAchievements.first_recruit, true);
  assert.equal(({}).polluted, undefined);
  assert.equal(sanitized.futureClockDetected, true);
  assert.equal(sanitized.data.lastSaveTime, now);

  // Zero-penguin corrupted save repairs to 1 starter adelie so colony cannot brick
  const zeroPenguins = SaveSystem.sanitizeSaveData({ fish: NaN, penguins: { adelie: { count: 0 } } }, {}, now);
  assert.equal(zeroPenguins.data.fish, 0);
  assert.equal(zeroPenguins.data.penguins.adelie.count, 1);
  assert.ok(zeroPenguins.repairs.includes('starter_penguin'));

  // Legacy saves containing removed push-notification fields migrate cleanly without re-emitting them
  const legacyWithPushFields = SaveSystem.sanitizeSaveData({
    saveVersion: 2,
    fish: 750,
    lifetimeFish: 1000,
    runFish: 1000,
    glacierLevel: 2,
    dailyReminderEnabled: true,
    lastDailyReminderDateKey: '2026-05-14',
    penguins: { adelie: { count: 3, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 3 } } }
  }, {}, now);
  assert.equal(legacyWithPushFields.data.fish, 750);
  assert.equal('dailyReminderEnabled' in legacyWithPushFields.data, false);
  assert.equal('lastDailyReminderDateKey' in legacyWithPushFields.data, false);

  // Forward-version save preserves known fields safely and flags futureVersionDetected
  const futureSave = SaveSystem.sanitizeSaveData({
    saveVersion: 99,
    fish: 4200,
    lifetimeFish: 5000,
    runFish: 5000,
    glacierLevel: 3,
    iglooTier: 4,
    iglooTheme: 'royal_amethyst',
    unlockedIglooThemes: ['glacier', 'royal_amethyst'],
    fishingHolesUnlocked: 5,
    penguins: { adelie: { count: 4, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 4 } } }
  }, {}, now);
  assert.equal(futureSave.futureVersionDetected, true);
  assert.equal(futureSave.data.fish, 4200);
  assert.equal(futureSave.data.iglooTier, 4);
  assert.equal(futureSave.data.iglooTheme, 'royal_amethyst');
  assert.equal(futureSave.data.fishingHolesUnlocked, 5);

  // v2 -> v5 migration defaults & sanitization of invalid castle/fishing-hole/wardrobe/milestone values
  const migratedV2 = SaveSystem.sanitizeSaveData({
    saveVersion: 2,
    fish: 900,
    lifetimeFish: 1200,
    runFish: 1200,
    glacierLevel: 2,
    penguins: { adelie: { count: 2, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 2 } } }
  }, {}, now);
  assert.equal(migratedV2.migrated, true);
  assert.equal(migratedV2.migratedFrom, 2);
  assert.equal(migratedV2.data.saveVersion, 5);
  assert.equal(migratedV2.data.iglooTier, 0);
  assert.equal(migratedV2.data.iglooTheme, 'glacier');
  assert.deepEqual(migratedV2.data.unlockedIglooThemes, ['glacier']);
  assert.equal(migratedV2.data.fishingHolesUnlocked, 3);
  assert.deepEqual(migratedV2.data.unlockedHats, ['none']);
  assert.equal(migratedV2.data.equippedHat, 'none');
  assert.equal(migratedV2.data.speciesHats.adelie, 'none');
  assert.equal(migratedV2.data.skyEventsCaught, 0);
  assert.equal(migratedV2.data.bestSkyCombo, 0);
  assert.equal(migratedV2.data.paradesWitnessed, 0);
  assert.ok(migratedV2.data.unlockedTabs.includes('tech'));
  assert.ok(migratedV2.data.unlockedTabs.includes('daily'));
  assert.ok(migratedV2.data.unlockedTabs.includes('log'));
  assert.equal(migratedV2.data.showAllTabs, false);

  // v3 -> v5 migration preserves v3 castle/holes and initializes wardrobe + milestones cleanly
  const clampedV3 = SaveSystem.sanitizeSaveData({
    saveVersion: 3,
    fish: 900,
    iglooTier: 99,
    iglooTheme: 'midnight_obsidian',
    unlockedIglooThemes: ['bogus'],
    fishingHolesUnlocked: 12,
    penguins: { adelie: { count: 2, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 2 } } }
  }, {}, now);
  assert.equal(clampedV3.migrated, true);
  assert.equal(clampedV3.migratedFrom, 3);
  assert.equal(clampedV3.data.saveVersion, 5);
  assert.equal(clampedV3.data.iglooTier, 5);
  assert.equal(clampedV3.data.iglooTheme, 'glacier'); // midnight_obsidian not unlocked
  assert.deepEqual(clampedV3.data.unlockedIglooThemes, ['glacier']);
  assert.equal(clampedV3.data.fishingHolesUnlocked, 6);
  assert.ok(clampedV3.data.unlockedTabs.includes('glacier'));

  // v4 -> v5 migration strips locked/invalid hats, preserves per-species mix, and derives v5 milestone/tab fields
  const sanitizedV4 = SaveSystem.sanitizeSaveData({
    saveVersion: 4,
    fish: 1500,
    unlockedHats: ['none', 'scarf', 'star_crown', 'bogus_hat'],
    equippedHat: 'aurora_halo', // locked -> falls back to 'none'
    speciesHats: { adelie: 'scarf', emperor: 'star_crown', cyber: 'aurora_halo' },
    skyEventsCaught: 19,
    bestSkyCombo: 99, // clamped to 5
    paradesWitnessed: 4,
    penguins: { adelie: { count: 3, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 3 } } }
  }, {}, now);
  assert.equal(sanitizedV4.migrated, true);
  assert.equal(sanitizedV4.migratedFrom, 4);
  assert.equal(sanitizedV4.data.saveVersion, 5);
  assert.deepEqual(sanitizedV4.data.unlockedHats, ['none', 'scarf', 'star_crown']);
  assert.equal(sanitizedV4.data.equippedHat, 'none');
  assert.equal(sanitizedV4.data.speciesHats.adelie, 'scarf');
  assert.equal(sanitizedV4.data.speciesHats.emperor, 'none'); // Emperor cannot wear star_crown (v2.7.2)
  assert.equal(sanitizedV4.data.speciesHats.cyber, 'none');
  assert.equal(sanitizedV4.data.skyEventsCaught, 19);
  assert.equal(sanitizedV4.data.bestSkyCombo, 5);
  assert.equal(sanitizedV4.data.paradesWitnessed, 4);

  // Native v5 save preserves valid permanent/run milestones, clamps legacy Legendary/Mythic perk stacks to 1
  const nativeV5 = SaveSystem.sanitizeSaveData({
    saveVersion: 5,
    fish: 250,
    lifetimeFish: 500,
    runFish: 500,
    collectedPerks: [
      { id: 'c_sharp', name: 'Sharp Beak', icon: '🗡️', rarity: 'common', desc: '+4% Yield', count: 5 },
      { id: 'l_midas', name: 'Midas Touch', icon: '👑', rarity: 'legendary', desc: '+14% Yield', count: 4 },
      { id: 'm_eternal', name: 'Eternal Frost', icon: '🌌', rarity: 'mythic', desc: '+20% Yield', count: 3 }
    ],
    completedPermanentMilestones: ['recruit_5_adelie', 'castle_tier_1', 'bogus_id'], // castle_tier_1 is run-scoped -> stripped from permanent
    completedRunMilestones: ['carve_fourth_hole', 'recruit_5_adelie'],
    skippedMilestones: ['catch_sky_or_parade'],
    unlockedTabs: ['penguins', 'tech', 'stats', 'settings'],
    showAllTabs: true,
    milestoneBarExpanded: true,
    penguins: { adelie: { count: 5, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 5 } } }
  }, {}, now);
  assert.equal(nativeV5.migrated, false);
  assert.equal(nativeV5.data.saveVersion, 5);
  assert.equal(nativeV5.data.collectedPerks.find(p => p.id === 'c_sharp').count, 5);
  assert.equal(nativeV5.data.collectedPerks.find(p => p.id === 'l_midas').count, 1);
  assert.equal(nativeV5.data.collectedPerks.find(p => p.id === 'm_eternal').count, 1);
  assert.ok(nativeV5.repairs.includes('clamped_perk_l_midas'));
  assert.ok(nativeV5.repairs.includes('clamped_perk_m_eternal'));
  assert.ok(nativeV5.data.completedPermanentMilestones.includes('recruit_5_adelie'));
  assert.equal(nativeV5.data.completedPermanentMilestones.includes('castle_tier_1'), false);
  assert.deepEqual(nativeV5.data.skippedMilestones, ['catch_sky_or_parade']);
  assert.equal(nativeV5.data.showAllTabs, true);
  assert.equal(nativeV5.data.milestoneBarExpanded, true);
});

test('Wardrobe: Ultra-Prestige Frost Essence catalog, 4s tap-again safety guard, per-species sanitization, and vector drawing', () => {
  assert.equal(Wardrobe.WARDROBE_ITEMS.length, 6);
  assert.deepEqual(
    Wardrobe.WARDROBE_ITEMS.map(item => item.costEssence),
    [0, 100, 350, 1000, 3000, 10000]
  );
  // Purely Frost Essence shop — never tied to achievement unlocks
  assert.equal(Wardrobe.WARDROBE_ITEMS.every(item => !('achievementId' in item)), true);

  // 4-second tap-again confirmation guard
  const guard = Wardrobe.createPurchaseGuard(4000);
  const firstTap = guard.armOrConfirm('scarf', 'all', 1000);
  assert.equal(firstTap.armed, true);
  assert.equal(firstTap.confirmed, false);
  assert.equal(guard.getArmed(2000).hatId, 'scarf');

  // Tapping same hat + same scope within 4s confirms purchase
  const secondTap = guard.armOrConfirm('scarf', 'all', 3500);
  assert.equal(secondTap.confirmed, true);
  assert.equal(secondTap.armed, false);
  assert.equal(guard.getArmed(3600), null);

  // Changing scope or waiting past 4s re-arms instead of confirming
  guard.armOrConfirm('goggles', 'adelie', 5000);
  const scopeChanged = guard.armOrConfirm('goggles', 'gentoo', 5500);
  assert.equal(scopeChanged.armed, true);
  assert.equal(scopeChanged.confirmed, false);
  const expired = guard.armOrConfirm('goggles', 'gentoo', 10000);
  assert.equal(expired.armed, true);
  assert.equal(expired.confirmed, false);

  // Vector rendering across standing, sliding, sleeping poses executes cleanly on a mock canvas context
  const noop = () => {};
  const mockCtx = {
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop,
    rect: noop, fillRect: noop, strokeRect: noop, roundRect: noop,
    fill: noop, stroke: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop })
  };
  for (const item of Wardrobe.WARDROBE_ITEMS) {
    for (const pose of ['standing', 'sliding', 'sleeping']) {
      Wardrobe.drawPenguinAccessory(mockCtx, item.id, 'adelie', pose, 1.2);
    }
  }
  for (const pose of ['waddle', 'slide', 'sleep', 'portrait']) {
    PenguinSprites.PenguinSpriteRenderer.draw(mockCtx, {
      speciesId: 'emperor',
      pose,
      hatId: 'aurora_halo',
      stepPhase: 0.5,
      time: 1.0
    });
  }
  // Update 2.7.2: 6-Rebirth Wardrobe gate & Emperor Penguin Starlight Crown exclusion
  assert.equal(Wardrobe.WARDROBE_MIN_REBIRTHS, 6);
  assert.equal(Wardrobe.isWardrobeUnlocked(5), false);
  assert.equal(Wardrobe.isWardrobeUnlocked(6), true);
  assert.equal(Wardrobe.canSpeciesWearHat('emperor', 'star_crown'), false);
  assert.equal(Wardrobe.canSpeciesWearHat('adelie', 'star_crown'), true);
  assert.equal(Wardrobe.canSpeciesWearHat('emperor', 'goggles'), true);
  assert.equal(Wardrobe.resolveHatForSpecies('emperor', 'star_crown'), 'none');
  assert.equal(Wardrobe.resolveHatForSpecies('adelie', 'star_crown'), 'star_crown');

  const sanitizedW = Wardrobe.sanitizeWardrobeState(
    ['none', 'star_crown', 'scarf'],
    'star_crown',
    { adelie: 'star_crown', emperor: 'star_crown', gentoo: 'scarf' }
  );
  assert.equal(sanitizedW.speciesHats.adelie, 'star_crown');
  assert.equal(sanitizedW.speciesHats.emperor, 'none');
  assert.equal(sanitizedW.speciesHats.gentoo, 'scarf');
});

test('SkyEvents: rare standalone Shooting Stars (3–4.5m) in top 20% sky & Krill Swarms (4–6m), with Sky Combo completely removed', () => {
  assert.equal(SkyEvents.SHOOTING_STAR_MIN_CD, 180);
  assert.equal(SkyEvents.SHOOTING_STAR_MAX_CD, 270);
  assert.equal(SkyEvents.KRILL_SWARM_MIN_CD, 240);
  assert.equal(SkyEvents.KRILL_SWARM_MAX_CD, 360);
  assert.equal('SKY_COMBO_MAX' in SkyEvents, false);
  assert.equal('STARLIGHT_FRENZY_MULTIPLIER' in SkyEvents, false);

  const ctrl = new SkyEvents.SkyMiniEventController({
    initialStarCooldownSec: 0.2,
    initialKrillCooldownSec: 0.2,
    rng: () => 0.5
  });

  // With expanded sheet, Shooting Star spawns in top 8.5%-17.5% sky while Krill Swarm stays paused
  ctrl.update(0.25, { width: 390, height: 800, sheetExpanded: true, isBlocked: false });
  assert.ok(ctrl.activeStar, 'Expected Shooting Star to spawn even when menu is expanded to 80%');
  assert.equal(ctrl.activeKrill, null, 'Expected Krill Swarm to pause when menu is expanded');
  assert.ok(ctrl.activeStar.y >= 800 * 0.08 && ctrl.activeStar.y <= 800 * 0.18, 'Shooting Star must stay within top 20% sky band');

  // Standalone Shooting Star catch awards flat bonus with no Sky Combo / Starlight Frenzy
  const catch1 = ctrl.tryCatch(ctrl.activeStar.x, ctrl.activeStar.y, { dps: 100, sheetExpanded: true });
  assert.equal(catch1.caught, true);
  assert.equal(catch1.kind, 'shooting_star');
  assert.ok(catch1.rewardFish > 0);
  assert.equal(ctrl.starCooldownSec, 225); // 180 + 0.5 * 90

  // Un-expand sheet -> Krill Swarm can spawn on visible ice shelf
  ctrl.update(0.25, { width: 390, height: 800, sheetExpanded: false, visibleBottomY: 620, isBlocked: false });
  assert.ok(ctrl.activeKrill, 'Expected Krill Swarm to spawn when shelf is visible');
  const catch2 = ctrl.tryCatch(ctrl.activeKrill.x, ctrl.activeKrill.y, { dps: 100, sheetExpanded: false });
  assert.equal(catch2.caught, true);
  assert.equal(catch2.kind, 'krill_swarm');
  assert.ok(catch2.rewardFish > 0);
  assert.equal(ctrl.krillCooldownSec, 300); // 240 + 0.5 * 120

  ctrl.resetTransient();
  assert.equal(ctrl.activeStar, null);
  assert.equal(ctrl.activeKrill, null);
});

test('GameData & SceneRenderer & DailyManager: 40-perk pool, nerfed Coils, v2.7.2 release metadata, and Hotspot/Landmark rendering', () => {
  assert.equal(GameData.PENGUIN_SPECIES.length, 5);
  assert.equal(GameData.GLACIER_TECH.length, 6);
  const coils = GameData.GLACIER_TECH.find(t => t.id === 'aurora_coils');
  assert.equal(coils.effect, 1);

  assert.equal(GameData.AURORA_PERKS_POOL.length, 40);
  const perkIds = new Set(GameData.AURORA_PERKS_POOL.map(p => p.id));
  assert.equal(perkIds.size, 40, 'All 40 Aurora perks must have unique IDs');
  assert.equal(GameData.AURORA_PERKS_POOL.filter(p => p.rarity === 'legendary').length, 8);
  assert.equal(GameData.AURORA_PERKS_POOL.filter(p => p.rarity === 'mythic').length, 6);
  assert.equal(GameData.isCappedPerkRarity('legendary'), true);
  assert.equal(GameData.isCappedPerkRarity('mythic'), true);
  assert.equal(GameData.isCappedPerkRarity('rare'), false);

  assert.equal(GameData.ACHIEVEMENTS_LIST.length, 22);
  assert.equal(GameData.LATEST_FEATURE_RELEASE.version, '2.7.2');
  assert.equal(typeof DailyManager.DailyObjectivesManager, 'function');
  const sky = SceneRenderer.getCurrentSkyAtmosphere(-15);
  assert.match(sky.top, /^rgb\(/);

  // Mock 2D context validates drawGlacierLandmarks & Hotspot drawIceHole render cleanly
  const noop = () => {};
  const mockCtx = {
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop,
    rect: noop, fillRect: noop, strokeRect: noop, roundRect: noop,
    fill: noop, stroke: noop, fillText: noop, clip: noop, clearRect: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop })
  };
  SceneRenderer.drawGlacierLandmarks(mockCtx, 390, 800, 1.2, {
    lanternPath: true,
    colonyPennants: true,
    auroraMonoliths: true,
    monolithBoost: true,
    rebirthMonument: true,
    rebirthCount: 3
  }, 1.8);
  SceneRenderer.drawIceHole(mockCtx, 390, 800, {
    id: 2, xRatio: 0.5, yRatio: 0.81, radiusX: 50, radiusY: 22, rippleTimer: 0.6
  }, 1.2, { isHotspot: true, surgeActive: true, color: '#fbbf24', secondary: '#38bdf8' });
});

test('SoundEngine: cutscene mode, species calls with rate limiting, castle upgrade & milestone chimes', () => {
  const se = new SoundEngine();
  let hapticCalls = [];
  let oscCreated = 0;
  se.ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }),
    createOscillator: () => {
      oscCreated += 1;
      return { type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    },
    createBiquadFilter: () => ({ type: 'bandpass', frequency: { setValueAtTime() {}, setTargetAtTime() {} }, Q: { setValueAtTime() {}, setTargetAtTime() {} }, connect() {} })
  };

  // Mock AndroidBridge haptic receiver temporarily
  const prevWin = globalThis.window;
  globalThis.window = {
    AndroidBridge: {
      triggerHaptic(kind) {
        hapticCalls.push(kind);
        return true;
      }
    }
  };
  try {
    assert.equal(se.triggerHaptic('penguin_tap'), true);
    assert.deepEqual(hapticCalls, ['penguin_tap']);

    // All 5 species calls synthesize cleanly and respect per-species rate limit (150ms)
    const beforeCalls = oscCreated;
    assert.equal(se.playSpeciesCall('adelie'), true);
    assert.equal(se.playSpeciesCall('adelie'), false, 'Rapid duplicate call on same species must be rate-limited');
    assert.equal(se.playSpeciesCall('gentoo'), true);
    assert.equal(se.playSpeciesCall('chinstrap'), true);
    assert.equal(se.playSpeciesCall('emperor'), true);
    assert.equal(se.playSpeciesCall('cyber'), true);
    assert.ok(oscCreated > beforeCalls + 4);

    // Castle upgrade & Milestone chime synthesize cleanly
    assert.equal(se.playCastleUpgrade(3), true);
    assert.equal(se.playMilestoneChime(), true);

    // Cutscene mode blocks all background penguin/gameplay haptics & procedural SFX
    se.setCutsceneMode(true);
    assert.equal(se.triggerHaptic('penguin_tap'), false);
    assert.equal(se.triggerHaptic('collect'), false);
    assert.equal(se.playSpeciesCall('emperor'), false);
    assert.equal(se.playCastleUpgrade(1), false);
    assert.equal(se.playMilestoneChime(), false);
    assert.equal(hapticCalls.length, 1);

    // Explicit allowInCutscene celebration haptic is permitted
    assert.equal(se.triggerHaptic('celebrate', 0, { allowInCutscene: true }), true);
    assert.deepEqual(hapticCalls, ['penguin_tap', 'celebrate']);

    // Winter soundtrack starts and stops cleanly without throwing
    const score = se.startPrestigeWinterScore();
    assert.equal(typeof score.update, 'function');
    assert.equal(typeof score.triggerClimax, 'function');
    assert.equal(typeof score.stop, 'function');
    score.update(2.5);
    score.triggerClimax();
    score.stop();

    se.setCutsceneMode(false);
    assert.equal(se.triggerHaptic('tap'), true);

    // Celebratory Parade chimes run cleanly during gameplay and stay silent during cutsceneMode
    se.playParadeFanfare();
    se.playParadeChimeStep(0);
    se.playParadeChimeStep(3);
    se.setCutsceneMode(true);
    se.playParadeFanfare();
    se.playParadeChimeStep(1);
    se.setCutsceneMode(false);
  } finally {
    globalThis.window = prevWin;
  }
});

test('MilestoneEngine: deterministic priority scoring, stickiness, Castle-before-Rebirth, permanent vs run scope, skip, and visibility-only showAllTabs', () => {
  // Fresh colony starts with only 3 starter tabs; showAllTabs reveals all 8 (visibility only)
  const fresh = {
    fish: 0, runFish: 0, lifetimeFish: 0, glacierLevel: 1, iglooTier: 0, fishingHolesUnlocked: 3,
    totalRebirths: 0, prestigeShards: 0, penguins: { adelie: { count: 1 } }, tech: {}, showAllTabs: false
  };
  assert.deepEqual(MilestoneEngine.evaluateUnlockedTabs(fresh), ['penguins', 'stats', 'settings']);
  assert.equal(MilestoneEngine.getVisibleTabs({ ...fresh, showAllTabs: true }).length, 8);
  assert.equal(MilestoneEngine.evaluateUnlockedTabs({ ...fresh, showAllTabs: true }).length, 3);

  // Deterministic scoring: Castle Tier 1 (65K) outranks First Rebirth (150K) on Run 1 BEFORE Tier 1 is built
  const beforeCastle = {
    fish: 80000,
    runFish: 160000,
    lifetimeFish: 160000,
    glacierLevel: 5,
    iglooTier: 0,
    fishingHolesUnlocked: 4,
    totalRebirths: 0,
    prestigeShards: 0,
    penguins: { adelie: { count: 10 }, gentoo: { count: 5 }, chinstrap: { count: 3 }, emperor: { count: 1 } },
    tech: { thermal_parkas: 2 }
  };
  const pickBefore = MilestoneEngine.selectActiveMilestone(beforeCastle);
  assert.equal(pickBefore.milestone.id, 'castle_tier_1');
  assert.equal(pickBefore.milestone.reason, 'castle_before_rebirth');

  // Stickiness: passing currentShownId holds the same goal across ticks unless strictly outranked
  const pickSticky = MilestoneEngine.selectActiveMilestone(beforeCastle, { currentShownId: 'castle_tier_1' });
  assert.equal(pickSticky.milestone.id, 'castle_tier_1');

  // Once Castle Tier 1 is experienced, First Rebirth immediately becomes top priority
  const afterCastle = { ...beforeCastle, iglooTier: 1, fish: 15000 };
  const pickAfter = MilestoneEngine.selectActiveMilestone(afterCastle, { currentShownId: 'castle_tier_1' });
  assert.equal(pickAfter.milestone.id, 'first_rebirth');
  assert.equal(pickAfter.milestone.readyNow, true);

  // Non-destructive Skip advances to next goal while keeping underlying Rebirth unlockable
  const skippedState = { ...afterCastle, skippedMilestones: ['first_rebirth'] };
  const pickSkipped = MilestoneEngine.selectActiveMilestone(skippedState);
  assert.notEqual(pickSkipped.milestone.id, 'first_rebirth');
  assert.equal(Economy.calculatePendingPrestigeShards(skippedState.runFish), 1);

  // Dynamic endgame fallback -> "All Current Milestones Complete" when everything is maxed/owned
  const maxed = {
    fish: 1e12, runFish: 1e12, lifetimeFish: 1e12, glacierLevel: 50,
    iglooTier: 5, fishingHolesUnlocked: 6, totalRebirths: 10, prestigeShards: 50000,
    skyEventsCaught: 20, paradesWitnessed: 5,
    unlockedHats: Wardrobe.WARDROBE_ITEMS.map(i => i.id),
    penguins: { adelie: { count: 20 }, gentoo: { count: 20 }, chinstrap: { count: 20 }, emperor: { count: 20 }, cyber: { count: 20 } },
    tech: { thermal_parkas: 10 },
    skippedMilestones: ['dynamic_rebirth_surge']
  };
  const completeRes = MilestoneEngine.selectActiveMilestone(maxed);
  assert.equal(completeRes.milestone.id, 'all_milestones_complete');
  assert.equal(completeRes.milestone.canSkip, false);

  // Update 2.7.2: Fishing Hole 4 milestone respects 5-Rebirth gate & Wardrobe milestone respects 6-Rebirth gate
  const preGate = {
    fish: 500000, runFish: 500000, lifetimeFish: 500000, glacierLevel: 10,
    iglooTier: 1, fishingHolesUnlocked: 3, totalRebirths: 4, prestigeShards: 150,
    skyEventsCaught: 3, paradesWitnessed: 1, unlockedHats: ['none'],
    penguins: { adelie: { count: 10 }, gentoo: { count: 5 }, chinstrap: { count: 5 }, emperor: { count: 2 }, cyber: { count: 1 } },
    tech: { thermal_parkas: 3 },
    completedPermanentMilestones: ['recruit_5_adelie', 'unlock_gentoo', 'unlock_chinstrap', 'unlock_emperor', 'first_rebirth', 'catch_sky_or_parade', 'unlock_cyber_penguin'],
    completedRunMilestones: ['first_tech_upgrade', 'castle_tier_1']
  };
  const preGatePick = MilestoneEngine.selectActiveMilestone(preGate);
  assert.notEqual(preGatePick.milestone.id, 'carve_fourth_hole');
  assert.notEqual(preGatePick.milestone.id, 'first_wardrobe_accessory');

  const atFiveReb = { ...preGate, totalRebirths: 5 };
  assert.equal(MilestoneEngine.selectActiveMilestone(atFiveReb).milestone.id, 'carve_fourth_hole');

  const atSixReb = { ...preGate, totalRebirths: 6, fishingHolesUnlocked: 4 };
  assert.equal(MilestoneEngine.selectActiveMilestone(atSixReb).milestone.id, 'first_wardrobe_accessory');
});

test('PolarSynergy: single-source yield math, additive capped Event Surge (1.85x), Parade no-double-count, and mid-walk Hotspot shift stability', () => {
  // Clear + Adélie at Hotspot without Surge -> 1.0 * 1.35 * 1.50 = 2.025
  const clearAdelie = PolarSynergy.calculateEffectiveYield({
    baseCatch: 100, weatherId: 'clear', speciesId: 'adelie', paradeActive: false, isAtHotspot: true, hotspotSurgeTimer: 0
  });
  assert.ok(Math.abs(clearAdelie.totalMult - 2.025) < 1e-6);

  // Blizzard + Emperor at Hotspot WITH Event Surge -> Hotspot bonus = min(0.85, 0.60 + 0.25) = 0.85 (1.85x)
  // Global Weather applied ONCE (1.20) * Species (1.35) * Hotspot (1.85) = 2.997
  const blizzEmperorSurge = PolarSynergy.calculateEffectiveYield({
    baseCatch: 100, weatherId: 'blizzard', speciesId: 'emperor', paradeActive: false, isAtHotspot: true, hotspotSurgeTimer: 15
  });
  assert.equal(blizzEmperorSurge.globalWeatherMult, 1.20);
  assert.equal(blizzEmperorSurge.speciesSynergyMult, 1.35);
  assert.equal(blizzEmperorSurge.hotspotMult, 1.85);
  assert.ok(Math.abs(blizzEmperorSurge.totalMult - (1.20 * 1.35 * 1.85)) < 1e-6);

  // Parade Anti-Double-Counting: Emperor in Blizzard + Parade MUST NOT stack a second species bonus!
  const blizzEmperorParade = PolarSynergy.calculateEffectiveYield({
    baseCatch: 100, weatherId: 'blizzard', speciesId: 'emperor', paradeActive: true, isAtHotspot: false, hotspotSurgeTimer: 0
  });
  assert.equal(blizzEmperorParade.speciesSynergyMult, 1.35);
  assert.equal(blizzEmperorParade.synergySource, 'weather_and_parade_capped');

  // While non-matched species (Adélie in Blizzard) DOES gain 1.35x once during Parade
  const blizzAdelieParade = PolarSynergy.calculateEffectiveYield({
    baseCatch: 100, weatherId: 'blizzard', speciesId: 'adelie', paradeActive: true, isAtHotspot: false, hotspotSurgeTimer: 0
  });
  assert.equal(blizzAdelieParade.speciesSynergyMult, 1.35);
  assert.equal(blizzAdelieParade.synergySource, 'parade');

  // Explicit Edge Case: Hotspot shifts while penguin is already walking toward Hole 1
  const holes = [
    { id: 1, occupants: 2, maxCapacity: 10 },
    { id: 2, occupants: 0, maxCapacity: 10 },
    { id: 3, occupants: 0, maxCapacity: 10 }
  ];
  // Rule 1: New trip picks active Hotspot (Hole 1)
  const trip1Pick = PolarSynergy.chooseFishingHoleForPenguin({ currentTargetHoleId: null, holes, hotspotHoleId: 1 });
  assert.equal(trip1Pick.id, 1);
  // Rule 2: Weather rotates Hotspot to Hole 2 while penguin is walking -> penguin KEEPS Hole 1 (no indecisive switching!)
  const midWalkPick = PolarSynergy.chooseFishingHoleForPenguin({ currentTargetHoleId: 1, holes, hotspotHoleId: 2 });
  assert.equal(midWalkPick.id, 1);
  // Rule 3: Dive finishes against LIVE hotspot (Hole 2 != Hole 1) -> does NOT pay expired Hole 1 hotspot bonus
  const liveDiveCatch = PolarSynergy.calculateEffectiveYield({
    baseCatch: 100, weatherId: 'light_snow', speciesId: 'adelie', paradeActive: false, isAtHotspot: (1 === 2), hotspotSurgeTimer: 10
  });
  assert.equal(liveDiveCatch.hotspotMult, 1.0);
  // Rule 3b: Next trip after delivering fish re-evaluates and routes to new Hotspot (Hole 2)
  const trip2Pick = PolarSynergy.chooseFishingHoleForPenguin({ currentTargetHoleId: null, holes, hotspotHoleId: 2 });
  assert.equal(trip2Pick.id, 2);
  // Rule 4: Full Hotspot falls back cleanly to least-crowded available hole
  const fullHotspotHoles = [
    { id: 1, occupants: 1, maxCapacity: 10 },
    { id: 2, occupants: 10, maxCapacity: 10 },
    { id: 3, occupants: 0, maxCapacity: 10 }
  ];
  const fallbackPick = PolarSynergy.chooseFishingHoleForPenguin({ currentTargetHoleId: null, holes: fullHotspotHoles, hotspotHoleId: 2, rng: () => 0 });
  assert.equal(fallbackPick.id, 3);

  // Update 2.7.2: Timed 30-second single-active Hotspot lifecycle (5–7 min cooldown)
  assert.equal(PolarSynergy.HOTSPOT_ACTIVE_DURATION_SEC, 30);
  assert.equal(PolarSynergy.HOTSPOT_COOLDOWN_MIN_SEC, 300);
  assert.equal(PolarSynergy.HOTSPOT_COOLDOWN_MAX_SEC, 420);
  assert.equal(PolarSynergy.rollHotspotCooldownSec(() => 0), 300);
  assert.equal(PolarSynergy.rollHotspotCooldownSec(() => 1), 420);

  // Cooldown reaches 0 -> activates exactly 1 Hotspot hole for 30s
  const activated = PolarSynergy.stepHotspotLifecycle(
    { holeId: null, activeTimer: 0, cooldownTimer: 3, surgeTimer: 0, rotationEpoch: 0 },
    5,
    { weatherId: 'clear', unlockedHoleIds: [1, 2, 3], rng: () => 0.5 }
  );
  assert.equal(activated.spawned, true);
  assert.ok([1, 2, 3].includes(activated.holeId));
  assert.equal(activated.activeTimer, 30);

  // Active 30s window ticks down and expires back to null + fresh 5–7 min cooldown
  const midActive = PolarSynergy.stepHotspotLifecycle(
    activated,
    10,
    { weatherId: 'clear', unlockedHoleIds: [1, 2, 3], rng: () => 0.5 }
  );
  assert.equal(midActive.holeId, activated.holeId);
  assert.equal(midActive.activeTimer, 20);

  const expired = PolarSynergy.stepHotspotLifecycle(
    midActive,
    21,
    { weatherId: 'clear', unlockedHoleIds: [1, 2, 3], rng: () => 0.5 }
  );
  assert.equal(expired.expired, true);
  assert.equal(expired.holeId, null);
  assert.equal(expired.activeTimer, 0);
  assert.equal(expired.cooldownTimer, 360);
});

test('Pacing & Time-State Simulator: early-to-Rebirth profiles, Colony Cap integrity, and 3–5 day mostly-idle Frosted Citadel pacing', () => {
  for (const profile of ['efficient', 'casual', 'active', 'idle']) {
    const { timeline } = runProfileSimulation(profile);
    assert.equal(timeline.deadEndDetected, false, `${profile} profile hit a dead end`);
    assert.equal(timeline.unreachableCount, 0, `${profile} profile had unreachable milestones`);
    assert.equal(timeline.colonyCapViolated, false, `${profile} profile violated Colony Cap`);
    assert.equal(timeline.transientLeakDetected, false, `${profile} profile leaked transient bonuses across offline gap`);
    assert.ok(timeline.castle1Min !== null, `${profile} must build Lantern-Lit Igloo Tier 1`);
    assert.ok(timeline.rebirth1Min !== null, `${profile} must complete First Rebirth`);
    assert.ok(timeline.castle1Min <= timeline.rebirth1Min, `${profile}: Castle Tier 1 should precede Rebirth`);
  }

  // Multi-day mostly-idle simulation validates Frosted Citadel lands inside 3–5 days (72–125h)
  const idleZeroReb = runMultiDayFrostedCitadelSimulation({ targetRebirthsBeforePush: 0 });
  const idleTwoReb = runMultiDayFrostedCitadelSimulation({ targetRebirthsBeforePush: 2 });
  const idleThreeReb = runMultiDayFrostedCitadelSimulation({ targetRebirthsBeforePush: 3 });
  assert.equal(idleZeroReb.transientLeakDetected, false);
  assert.equal(idleTwoReb.transientLeakDetected, false);
  assert.ok(
    idleZeroReb.frostedCitadelHours >= 72 && idleZeroReb.frostedCitadelHours <= 125,
    `Expected 0-rebirth mostly-idle Frosted Citadel in 72–125h, got ${idleZeroReb.frostedCitadelHours}h`
  );
  assert.ok(
    idleTwoReb.frostedCitadelHours >= 72 && idleTwoReb.frostedCitadelHours <= 125,
    `Expected 2-rebirth mostly-idle Frosted Citadel in 72–125h, got ${idleTwoReb.frostedCitadelHours}h`
  );
  assert.ok(
    idleThreeReb.frostedCitadelHours >= 72 && idleThreeReb.frostedCitadelHours <= 125,
    `Expected 3-rebirth mostly-idle Frosted Citadel in 72–125h, got ${idleThreeReb.frostedCitadelHours}h`
  );
});

test('ParadeEvent: 15-minute cadence, full-colony single-file march, chimes, 2x boost, enrollment, and Rebirth cancellation', () => {
  assert.equal(ParadeEvent.PARADE_INTERVAL_SEC, 900);
  assert.equal(ParadeEvent.PARADE_BOOST_DURATION_SEC, 60);
  assert.equal(ParadeEvent.PARADE_BOOST_MULTIPLIER, 2);

  const makePenguin = (uid, speciesId, x, y, carriedFish = 0) => ({
    uid,
    speciesId,
    x,
    y,
    facing: 1,
    stepPhase: 0,
    state: 'FISHING',
    claimedTarget: { hole: 1 },
    carriedFish,
    happyTimer: 0,
    departureDelay: 0,
    resumedTo: null,
    initiatePathToHoleCount: 0,
    initiatePathToFishingHole() {
      this.state = 'NAVIGATE_TO_HOLE';
      this.resumedTo = 'hole';
      this.initiatePathToHoleCount += 1;
    },
    initiatePathToDepot() {
      this.state = 'NAVIGATE_TO_DEPOT';
      this.resumedTo = 'depot';
    }
  });

  const penguins = [
    makePenguin(1, 'adelie', 120, 420, 0),
    makePenguin(2, 'emperor', 240, 440, 50),
    makePenguin(3, 'gentoo', 310, 410, 0)
  ];

  const ctrl = new ParadeEvent.ParadeController({ intervalSec: 10 });
  const releasedSlots = [];
  const startEvents = [];
  let chimeCalls = 0;
  let endCalls = 0;

  const ctx = {
    penguins,
    width: 380,
    height: 760,
    visibleBottomY: 500,
    isPaused: false,
    isBlocked: true,
    releaseSlot: (uid) => releasedSlots.push(uid),
    onParadeStart: (info) => startEvents.push(info),
    onParadeChime: () => { chimeCalls += 1; },
    onParadeEnd: () => { endCalls += 1; }
  };

  // Blocked modal/full-screen sheet pauses countdown
  ctrl.update(0.25, ctx);
  assert.equal(ctrl.countdownSec, 10);
  assert.equal(ctrl.isActive(), false);

  // Unblocked countdown triggers Parade at 0
  ctx.isBlocked = false;
  for (let i = 0; i < 40; i++) {
    ctrl.update(0.25, ctx);
  }
  assert.equal(ctrl.isActive(), true);
  assert.equal(startEvents.length, 1);
  assert.equal(startEvents[0].participantCount, 3);
  assert.equal(startEvents[0].boostMultiplier, 2);
  assert.equal(startEvents[0].boostDurationSec, 60);
  assert.equal(startEvents[0].direction, 1);
  assert.deepEqual(releasedSlots.sort((a, b) => a - b), [1, 2, 3]);

  // Emperor leads the line with the leader flag
  assert.equal(penguins[1].isParadeLeader, true);
  assert.equal(penguins[0].isParadeLeader, false);
  assert.equal(penguins.every((p) => p.state === 'PARADE'), true);

  // Newly recruited penguin mid-parade joins at the tail
  const newbie = makePenguin(4, 'cyber', 180, 340, 0);
  penguins.push(newbie);
  assert.equal(ctrl.enrollPenguin(newbie, { width: 380, releaseSlot: (uid) => releasedSlots.push(uid) }), true);
  assert.equal(newbie.state, 'PARADE');

  // Step through GATHER -> MARCH -> completion
  let completed = false;
  for (let step = 0; step < 300 && !completed; step++) {
    const res = ctrl.update(0.1, ctx);
    if (res.completed) completed = true;
  }
  assert.equal(completed, true);
  assert.equal(ctrl.isActive(), false);
  assert.equal(endCalls, 1);
  assert.ok(chimeCalls >= 1, 'Expected celebratory chimes while marching across screen');

  // Penguins return cleanly to depot (if carrying fish) or fishing holes
  assert.equal(penguins[1].resumedTo, 'depot');
  assert.equal(penguins[0].resumedTo, 'hole');
  assert.equal(penguins.every((p) => !p.isParadeLeader && p.state !== 'PARADE'), true);

  // Second parade alternates direction (right -> left) and cancelAndReset aborts cleanly for Rebirth
  assert.equal(ctrl.startParade(ctx), true);
  assert.equal(ctrl.direction, -1);
  ctrl.cancelAndReset(penguins);
  assert.equal(ctrl.isActive(), false);
  assert.equal(ctrl.countdownSec, 10);
  assert.equal(penguins.every((p) => !p.isParadeLeader && p.state !== 'PARADE'), true);
});

test('SaveSystem: multi-slot backup recovery on corrupted primary/backup and non-destructive unrecoverable detection', () => {
  const validBackup = JSON.stringify({
    saveVersion: 2,
    fish: 9999,
    lifetimeFish: 12000,
    runFish: 12000,
    glacierLevel: 3,
    penguins: { adelie: { count: 5, level: 1, nextTrait: 'optimistic', traitCounts: { optimistic: 5 } } }
  });

  const recovered = SaveSystem.parseAndRecoverSave({
    primaryRaw: '{truncated-corrupt-json',
    backupRaw: validBackup,
    nowMs: 1_760_000_000_000
  });
  assert.equal(recovered.status, 'recovered');
  assert.equal(recovered.recoveredFromBackup, true);
  assert.equal(recovered.data.fish, 9999);
  assert.equal(recovered.corruptedPayload, '{truncated-corrupt-json');

  // If both native primary and web primary are corrupt, extraBackups (web backup slot) still recovers cleanly
  const recoveredThirdSlot = SaveSystem.parseAndRecoverSave({
    primaryRaw: '{corrupt-native',
    backupRaw: '{corrupt-web-primary',
    extraBackups: [validBackup],
    nowMs: 1_760_000_000_000
  });
  assert.equal(recoveredThirdSlot.status, 'recovered');
  assert.equal(recoveredThirdSlot.source, 'fallback_1');
  assert.equal(recoveredThirdSlot.recoveredFromBackup, true);
  assert.equal(recoveredThirdSlot.data.fish, 9999);
  assert.equal(recoveredThirdSlot.corruptedPayload, '{corrupt-native');

  // Unrecoverable corruption without backup MUST NOT silently return empty fresh state
  const unrecoverable = SaveSystem.parseAndRecoverSave({
    primaryRaw: '<<<NOT JSON>>>',
    backupRaw: null,
    nowMs: 1_760_000_000_000
  });
  assert.equal(unrecoverable.status, 'corrupted_unrecoverable');
  assert.equal(unrecoverable.data, null);
});

test('SaveSystem: persistence controller skips unchanged state, throttles routine writes, respects corruption guard', () => {
  let fakeNow = 1_000_000;
  const writes = [];
  const ctrl = SaveSystem.createPersistenceController({
    autosaveIntervalMs: 15_000,
    nowFn: () => fakeNow,
    writeFn: (jsonStr, opts) => {
      writes.push({ jsonStr, opts });
      return true;
    }
  });

  const snap1 = { saveVersion: 2, fish: 100, lastSaveTime: fakeNow };
  assert.equal(ctrl.save(snap1, { immediate: true }).written, true);
  assert.equal(writes.length, 1);

  // Unchanged content (even with newer lastSaveTime) skips I/O
  fakeNow += 20_000;
  const snap1Same = { saveVersion: 2, fish: 100, lastSaveTime: fakeNow };
  assert.equal(ctrl.save(snap1Same).reason, 'unchanged');
  assert.equal(writes.length, 1);

  // Changed content within 15s routine throttle skips non-immediate write
  fakeNow = 1_005_000;
  const snap2 = { saveVersion: 2, fish: 250, lastSaveTime: fakeNow };
  assert.equal(ctrl.save(snap2).reason, 'throttled');
  assert.equal(writes.length, 1);

  // Immediate flush bypasses throttle
  assert.equal(ctrl.save(snap2, { immediate: true }).written, true);
  assert.equal(writes.length, 2);

  // Corruption guard prevents overwriting quarantined corrupt data
  ctrl.setCorruptionGuard(true);
  const snap3 = { saveVersion: 2, fish: 500, lastSaveTime: fakeNow + 30_000 };
  assert.equal(ctrl.save(snap3, { immediate: true }).reason, 'corruption_guard');
  assert.equal(writes.length, 2);
});

test('Push notification removal invariants: zero push files, handlers, UI, config, or permissions remain', () => {
  const removedPaths = [
    'push-relay',
    'push-config.json',
    'js/push-client.js',
    'tests/push-relay.test.mjs',
    'app/src/main/assets/push-config.json',
    'app/src/main/assets/js/push-client.js'
  ];
  for (const rel of removedPaths) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), false, `Expected removed push artifact to be absent: ${rel}`);
  }

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8');
  const androidManifest = fs.readFileSync(path.join(ROOT, 'app/src/main/AndroidManifest.xml'), 'utf8');

  const forbiddenPatterns = [
    /push-client\.js/i,
    /push-config\.json/i,
    /DailyPushReminderManager/,
    /Notification\.requestPermission/,
    /PushManager/,
    /pushsubscriptionchange/,
    /notificationclick/,
    /SHOW_LOCAL_NOTIFICATION/,
    /OPEN_DAILY_TAB/,
    /dailyReminderEnabled/,
    /POST_NOTIFICATIONS/
  ];

  for (const [label, content] of [
    ['index.html', html],
    ['sw.js', sw],
    ['manifest.webmanifest', manifest],
    ['AndroidManifest.xml', androidManifest]
  ]) {
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `Unexpected push reference ${pattern} in ${label}`);
    }
  }
});

test('Integration invariants: viewport zoom policy, modular CSS, offline PWA caching, splash-to-offline sequencing, and asset sync parity', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  // Explicit exclusion: keep user-scalable=no intact
  assert.match(html, /<meta\s+name="viewport"[^>]*user-scalable=no/i);

  // Modular stylesheets & 14 scripts linked and precached by offline service worker
  assert.match(html, /<link\s+rel="stylesheet"\s+href="\.\/styles\/core\.css"/);
  assert.match(html, /<link\s+rel="stylesheet"\s+href="\.\/styles\/splash-cutscene\.css"/);
  assert.match(html, /<link\s+rel="stylesheet"\s+href="\.\/styles\/game\.css"/);
  const requiredScripts = [
    'economy.js',
    'daily-system.js',
    'wardrobe.js',
    'game-data.js',
    'milestone-engine.js',
    'polar-synergy.js',
    'save-system.js',
    'sky-events.js',
    'daily-manager.js',
    'sound-engine.js',
    'castle-renderer.js',
    'penguin-sprites.js',
    'scene-renderer.js',
    'parade-event.js',
    'prestige-cutscene.js',
    'launch-splash.js'
  ];
  for (const scriptName of requiredScripts) {
    assert.match(html, new RegExp(`<script\\s+src="\\.\\/js\\/${scriptName.replace('.', '\\.')}"`), `Missing script tag: ${scriptName}`);
    assert.match(sw, new RegExp(`'\\.\\/js\\/${scriptName.replace('.', '\\.')}'`), `Missing SW precache entry: ${scriptName}`);
  }
  assert.doesNotMatch(html, /<style>/i, 'Inline <style> block should be fully extracted into styles/*.css');
  assert.ok(html.split('\n').length < 8000, 'index.html should remain compact after modular JS extraction');

  // 80% vertical menu cap, top-HUD interactivity, and Next Milestone mobile layout protection CSS invariants
  const coreCss = fs.readFileSync(path.join(ROOT, 'styles/core.css'), 'utf8');
  assert.match(coreCss, /#top-bar\s*\{[\s\S]*?z-index:\s*48;/);
  assert.match(coreCss, /#bottom-sheet\.expanded\s*\{[\s\S]*?height:\s*80dvh;[\s\S]*?max-height:\s*80dvh;[\s\S]*?z-index:\s*35;/);
  assert.match(coreCss, /@media\s*\(max-height:\s*540px\)/);
  assert.doesNotMatch(html, /id="sky-combo-pill"/);
  assert.match(html, /function openDailyTabFromNotification/);
  assert.match(html, /id="milestone-bar"/);
  assert.match(html, /id="milestone-go-btn"/);
  assert.match(html, /id="milestone-skip-btn"/);
  assert.match(html, /calculatePersistentOfflineDPS/);
  assert.match(html, /decayTransientTimers/);

  // Version 2.7.2 consistency across HTML, GameData, Service Worker, Android Gradle, and README
  const gradleKts = fs.readFileSync(path.join(ROOT, 'app/build.gradle.kts'), 'utf8');
  const readmeMd = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(html, /id="splash-version-label"[^>]*>v2\.7\.2</);
  assert.equal(GameData.LATEST_FEATURE_RELEASE.version, '2.7.2');
  assert.match(sw, /penguin-glacial-empire-v272/);
  assert.match(gradleKts, /versionName\s*=\s*"2\.7\.2"/);
  assert.match(gradleKts, /versionCode\s*=\s*18/);
  assert.match(readmeMd, /Penguin Glacial Empire \(v2\.7\.2\)/);

  // Themed Glacial Rebirth modal replaces native browser confirm()
  assert.match(html, /id="rebirth-confirm-modal"/);
  assert.match(html, /function openRebirthConfirmModal\(\)/);
  assert.doesNotMatch(html, /if\s*\(\s*confirm\s*\(\s*promptMsg\s*\)\s*\)/);

  // Android WebView Prestige cutscene artifact-free invariants
  const cutsceneJs = fs.readFileSync(path.join(ROOT, 'js/prestige-cutscene.js'), 'utf8');
  const splashCutsceneCss = fs.readFileSync(path.join(ROOT, 'styles/splash-cutscene.css'), 'utf8');
  const prestigeCssStart = splashCutsceneCss.indexOf('#prestige-cutscene-overlay');
  const prestigeCssBlock = splashCutsceneCss.slice(prestigeCssStart);
  assert.doesNotMatch(cutsceneJs, /feGaussianBlur/, 'SVG feGaussianBlur causes Android WebView box-clipping artifacts');
  assert.doesNotMatch(cutsceneJs, /heroEmperor\.style\.filter/, 'CSS drop-shadow on animated SVG <g> causes Android ghosting artifacts');
  assert.doesNotMatch(cutsceneJs, /camEl\.style\.filter/, 'Per-frame CSS filter on transformed camera causes Android tile tearing');
  assert.doesNotMatch(cutsceneJs, /overlay\.style\.clipPath/, 'Animated clip-path exit wipe causes Android stencil artifacts');
  assert.doesNotMatch(prestigeCssBlock, /backdrop-filter/, 'backdrop-filter inside 60fps cutscene causes Android compositing artifacts');
  assert.doesNotMatch(prestigeCssBlock, /overflow:\s*visible/, 'overflow: visible on cutscene SVGs causes edge smear on Android');
  assert.doesNotMatch(prestigeCssBlock, /background-clip:\s*text/, 'transparent background-clip text + drop-shadow glitches on Android WebView');

  // Non-blocking Google Fonts to prevent launch blank screen on slow/offline networks
  assert.match(html, /fonts\.googleapis\.com[^>]*media="print"/);

  // Rebirth pause gate & castle/hole/wardrobe/parade reset invariants
  assert.match(html, /prestigeCutscene\.isActive/);
  assert.match(html, /state\.iglooTier\s*=\s*0/);
  assert.match(html, /state\.iglooTheme\s*=\s*'glacier'/);
  assert.match(html, /state\.fishingHolesUnlocked\s*=\s*CoreEconomy/);
  assert.match(html, /state\.unlockedHats\s*=\s*\['none'\]/);
  assert.match(html, /paradeController\.cancelAndReset/);
  assert.match(html, /computeSafeFrameDeltaSec/);
  assert.match(html, /finally\s*\{\s*requestAnimationFrame\(gameLoop\)/);
  assert.match(html, /window\.notifyAndroidSurfaceReady/);

  // Service worker precaches all modular CSS & manifest
  assert.match(sw, /'\.\/styles\/core\.css'/);
  assert.match(sw, /'\.\/styles\/splash-cutscene\.css'/);
  assert.match(sw, /'\.\/styles\/game\.css'/);
  assert.match(sw, /'\.\/manifest\.webmanifest'/);

  // Splash-to-idle-fish flash fix: pre-mounts modal before splash fade-out
  assert.match(html, /onBeforeFadeOut/);
  assert.match(html, /allowUnderSplash:\s*true/);

  // No surprise mid-session splash replay after claiming idle fish
  const installBlock = sw.slice(
    sw.indexOf("addEventListener('install'"),
    sw.indexOf("addEventListener('activate'")
  );
  assert.ok(installBlock.length > 0);
  assert.doesNotMatch(installBlock, /self\.skipWaiting\(\)/);
  const splashJs = fs.readFileSync(path.join(ROOT, 'js/launch-splash.js'), 'utf8');
  assert.match(splashJs, /PGE_SKIP_SPLASH_ONCE/);
  const claimIdx = html.indexOf('function claimOfflineCatch()');
  const claimBlock = html.slice(claimIdx, claimIdx + 1200);
  assert.ok(claimIdx > 0);
  assert.doesNotMatch(claimBlock, /flushPendingSwReload|location\.reload/);
  assert.match(html, /window\.flushPendingSwReload\s*=\s*function\(\)\s*\{\s*return false;\s*\}/);

  // Golden Fish fixes present in index.html
  assert.match(html, /getVisibleGlacierBottomY/);
  assert.match(html, /computeGoldenFishCooldownStep/);
  assert.match(html, /goldenFishTimerSec:\s*state\.goldenFishTimer/);

  // Canonical web assets match synced Android assets byte-for-byte
  const syncedFiles = [
    'index.html',
    'styles/core.css',
    'styles/splash-cutscene.css',
    'styles/game.css',
    'js/economy.js',
    'js/daily-system.js',
    'js/wardrobe.js',
    'js/game-data.js',
    'js/milestone-engine.js',
    'js/polar-synergy.js',
    'js/save-system.js',
    'js/sky-events.js',
    'js/daily-manager.js',
    'js/sound-engine.js',
    'js/castle-renderer.js',
    'js/penguin-sprites.js',
    'js/scene-renderer.js',
    'js/parade-event.js',
    'js/prestige-cutscene.js',
    'js/launch-splash.js',
    'manifest.webmanifest'
  ];
  for (const rel of syncedFiles) {
    const rootContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const assetPath = path.join(ROOT, 'app/src/main/assets', rel);
    assert.equal(fs.existsSync(assetPath), true, `Expected synced Android asset: ${rel}`);
    assert.equal(
      fs.readFileSync(assetPath, 'utf8'),
      rootContent,
      `Synced Android asset diverged from canonical root file: ${rel}`
    );
  }
});

test('Cold-boot smoke test: index.html initializes with zero TDZ/runtime errors, finishes splash, and runs Parade', async () => {
  const vm = await import('node:vm');
  const noop = () => {};
  const makeEl = (id = '') => ({
    id,
    style: {},
    children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, v) {
        if (v === undefined) {
          if (this._s.has(c)) this._s.delete(c);
          else this._s.add(c);
        } else if (v) {
          this._s.add(c);
        } else {
          this._s.delete(c);
        }
      }
    },
    setAttribute: noop,
    getAttribute: () => null,
    removeAttribute: noop,
    hasAttribute: () => false,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    appendChild(child) { this.children.push(child); return child; },
    removeChild: noop,
    focus: noop,
    click: noop,
    getBoundingClientRect: () => ({ top: 420, bottom: 800, left: 0, right: 390, width: 390, height: 380 }),
    getContext: () => ({
      setTransform: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
      quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop,
      fill: noop, stroke: noop, save: noop, restore: noop, translate: noop,
      scale: noop, rotate: noop, clip: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: (t) => ({ width: String(t).length * 6 }),
      fillText: noop, strokeText: noop, roundRect: noop
    }),
    width: 390,
    height: 800,
    clientWidth: 390,
    clientHeight: 800,
    textContent: '',
    innerHTML: '',
    value: ''
  });

  const els = new Map();
  const getEl = (id) => {
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  };
  const timers = [];
  const rafs = [];
  const sandbox = {
    console, Math, Date, JSON, Number, String, Boolean, Array, Object, Set, Map, RegExp, Error,
    parseInt, parseFloat, isFinite, isNaN,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: noop,
    setInterval: () => 1,
    clearInterval: noop,
    requestAnimationFrame: (fn) => { rafs.push(fn); return rafs.length; },
    cancelAnimationFrame: noop,
    performance: { now: () => 1000 },
    localStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); }
    },
    sessionStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); }
    },
    navigator: { userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5 },
    matchMedia: () => ({ matches: false }),
    document: {
      readyState: 'complete',
      hidden: false,
      documentElement: { clientWidth: 390, clientHeight: 800 },
      body: makeEl('body'),
      getElementById: getEl,
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      createElement: (tag) => makeEl(tag),
      addEventListener: noop
    },
    innerWidth: 390,
    innerHeight: 800,
    devicePixelRatio: 2,
    addEventListener: noop,
    removeEventListener: noop,
    location: { protocol: 'https:', hostname: 'appassets.androidplatform.net', reload: noop }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  const scripts = [
    'js/economy.js',
    'js/daily-system.js',
    'js/wardrobe.js',
    'js/game-data.js',
    'js/milestone-engine.js',
    'js/polar-synergy.js',
    'js/save-system.js',
    'js/sky-events.js',
    'js/daily-manager.js',
    'js/sound-engine.js',
    'js/castle-renderer.js',
    'js/penguin-sprites.js',
    'js/scene-renderer.js',
    'js/parade-event.js',
    'js/prestige-cutscene.js',
    'js/launch-splash.js'
  ];
  for (const rel of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(inlineScript, ctx, { filename: 'index.html' });

  // Splash started and updates version to v2.7.2
  assert.equal(rafs.length >= 2, true, 'Expected splash and gameLoop rAF callbacks');
  assert.equal(getEl('splash-version-label').textContent, 'v2.7.2');

  // Complete splash screen
  const splashRaf = rafs[0];
  const gameRaf = rafs[1];
  splashRaf(6500);
  while (timers.length > 0) {
    const t = timers.shift();
    t.fn();
  }
  assert.equal(getEl('launch-splash-screen').classList.contains('splash-hidden'), true);

  // Close What's New modal so glacier is unblocked, then verify Parade triggers smoothly & increments paradesWitnessed
  getEl('whats-new-modal').style.display = 'none';
  sandbox.paradeController.countdownSec = 0.01;
  gameRaf(1040);
  assert.equal(sandbox.paradeController.isActive(), true);
  assert.equal(vm.runInContext('state.paradesWitnessed', ctx), 1);

  // Verify Daily Goals tap banner opens bottom sheet & switches to Daily tab even if tab was hidden/collapsed
  const dailyBannerNav = vm.runInContext(`
    setBottomSheetState('collapsed');
    state.currentTab = 'penguins';
    window.openDailyTabFromNotification();
    ({
      tab: state.currentTab,
      snap: sheetSnapState,
      dailyUnlocked: state.unlockedTabs.includes('daily')
    });
  `, ctx);
  assert.equal(dailyBannerNav.tab, 'daily');
  assert.equal(dailyBannerNav.snap, 'default');
  assert.equal(dailyBannerNav.dailyUnlocked, true);

  // Verify Colony Cap reaches 0 remaining slots & renders CAP REACHED on Penguins tab at 15/15
  const sheetContent = getEl('sheet-content-container');
  sheetContent.children = [];
  const capCheck = vm.runInContext(`
    state.fish = 1_000_000;
    state.penguins.adelie.count = 15;
    state.currentTab = 'penguins';
    updateSheetContent();
    ({
      cap: state.getColonyCap(),
      remaining: state.getRemainingColonySlots(),
      count: state.getTotalPenguinCount()
    });
  `, ctx);
  assert.equal(capCheck.cap, 15);
  assert.equal(capCheck.count, 15);
  assert.equal(capCheck.remaining, 0);
  const penguinsHtmlAtCap = sheetContent.children.filter(Boolean).map(c => c.innerHTML).join('\n');
  assert.match(penguinsHtmlAtCap, /Colony Cap:/);
  assert.match(penguinsHtmlAtCap, /15 \/ 15/);
  assert.match(penguinsHtmlAtCap, /CAP REACHED/);
  vm.runInContext(`state.penguins.adelie.count = 1; state.fish = 0;`, ctx);

  // Verify Glacier tab renders cleanly with locked 5-Rebirth Fishing Holes gate & 6-Rebirth Wardrobe gate at 0 Rebirths
  sheetContent.children = [];
  vm.runInContext(`
    state.currentTab = 'glacier';
    updateSheetContent();
  `, ctx);
  assert.equal(sheetContent.children.length, 1, 'Expected glacier-tab-container appended to sheet-content-container');
  const lockedGlacierWrap = sheetContent.children[0];
  assert.equal(lockedGlacierWrap.children.length, 3, 'Expected Ice Castle, Fishing Holes, and Colony Wardrobe cards');
  assert.match(lockedGlacierWrap.children[1].innerHTML, /5 Glacial Rebirths/);
  assert.match(lockedGlacierWrap.children[2].innerHTML, /6 Glacial Rebirths/);

  const preGateActions = vm.runInContext(`
    state.fish = 1_000_000;
    state.prestigeShards = 500;
    ({
      holeLocked: state.purchaseFishingHole(),
      wardrobeLocked: state.purchaseOrEquipHat('scarf', 'adelie')
    });
  `, ctx);
  assert.equal(preGateActions.holeLocked.ok, false);
  assert.equal(preGateActions.holeLocked.reason, 'rebirth_locked');
  assert.equal(preGateActions.wardrobeLocked.ok, false);
  assert.equal(preGateActions.wardrobeLocked.reason, 'rebirth_locked');

  // After 6 Rebirths, both Fishing Holes and Colony Wardrobe unlock; verify rendering & Emperor star_crown exclusion
  sheetContent.children = [];
  vm.runInContext(`
    state.totalRebirths = 6;
    state.currentTab = 'glacier';
    updateSheetContent();
  `, ctx);
  const glacierWrap = sheetContent.children[0];
  const castleHtml = glacierWrap.children[0].innerHTML;
  const holesHtml = glacierWrap.children[1].innerHTML;
  const wardrobeHtml = glacierWrap.children[2].innerHTML;
  assert.match(castleHtml, /Igloo to Ice Castle/);
  assert.match(castleHtml, /Obsidian Frost/);
  assert.doesNotMatch(castleHtml, /undefined/);
  assert.match(holesHtml, /Ice Fishing Holes/);
  assert.match(holesHtml, /Deep Abyssal Rift/);
  assert.match(holesHtml, /\+10 diving slots/);
  assert.doesNotMatch(holesHtml, /undefined/);
  assert.match(wardrobeHtml, /Colony Wardrobe/);
  assert.match(wardrobeHtml, /Purely Visual/);
  assert.match(wardrobeHtml, /Resets on Rebirth/);
  assert.match(wardrobeHtml, /100/);
  assert.match(wardrobeHtml, /10,000/);
  assert.match(wardrobeHtml, /All Colony/);
  assert.doesNotMatch(wardrobeHtml, /undefined/);

  // Verify Wardrobe Frost Essence purchase, per-species hat mixing, and Emperor Starlight Crown exclusion
  const wardrobeRes = vm.runInContext(`
    state.prestigeShards = 5000;
    const buyScarf = state.purchaseOrEquipHat('scarf', 'adelie');
    const buyGoggles = state.purchaseOrEquipHat('goggles', 'emperor');
    const emperorCrownBlocked = state.purchaseOrEquipHat('star_crown', 'emperor');
    const wholeColonyCrown = state.purchaseOrEquipHat('star_crown', 'all');
    ({
      buyScarf,
      buyGoggles,
      emperorCrownBlocked,
      wholeColonyCrown,
      shardsLeft: state.prestigeShards,
      adelieHat: state.getSpeciesHat('adelie'),
      emperorHat: state.getSpeciesHat('emperor'),
      gentooHat: state.getSpeciesHat('gentoo')
    });
  `, ctx);
  assert.equal(wardrobeRes.buyScarf.ok, true);
  assert.equal(wardrobeRes.buyScarf.purchased, true);
  assert.equal(wardrobeRes.buyGoggles.ok, true);
  assert.equal(wardrobeRes.buyGoggles.purchased, true);
  assert.equal(wardrobeRes.emperorCrownBlocked.ok, false);
  assert.equal(wardrobeRes.emperorCrownBlocked.reason, 'species_incompatible');
  assert.equal(wardrobeRes.wholeColonyCrown.ok, true);
  assert.equal(wardrobeRes.shardsLeft, 1550); // 5000 - 100 - 350 - 3000
  assert.equal(wardrobeRes.adelieHat, 'star_crown');
  assert.equal(wardrobeRes.emperorHat, 'goggles'); // Emperor skips star_crown even in Whole Colony mode, keeping prior hat
  assert.notEqual(wardrobeRes.emperorHat, 'star_crown');
  assert.equal(wardrobeRes.gentooHat, 'star_crown');

  // Verify tapping empty top 20% sky while bottom sheet is expanded shrinks menu back to default (52%)
  const shrinkRes = vm.runInContext(`
    setBottomSheetState('expanded');
    const before = sheetSnapState;
    handleScreenTap(200, 95);
    ({ before, after: sheetSnapState });
  `, ctx);
  assert.equal(shrinkRes.before, 'expanded');
  assert.equal(shrinkRes.after, 'default');

  // Verify duplicate owned Legendary/Mythic perk grants instant fish bonus without exceeding count 1
  const dupPerkCheck = vm.runInContext(`
    const legPerk = AURORA_PERKS_POOL.find(p => p.rarity === 'legendary');
    state.addCollectedPerk(legPerk);
    state.isAuroraModalOpen = true;
    state.currentAuroraCards = [legPerk];
    const fishBefore = state.fish;
    selectAuroraPerk(0, false);
    const entry = state.collectedPerks.find(p => p.id === legPerk.id);
    ({
      countAfter: entry ? entry.count : 0,
      fishGained: state.fish - fishBefore
    });
  `, ctx);
  assert.equal(dupPerkCheck.countAfter, 1);
  assert.ok(dupPerkCheck.fishGained >= 250, 'Duplicate owned Legendary perk must grant instant fish bonus');

  // Verify Stats tab displays Sky Events Caught, Parades Witnessed, and Colony Cap (and NO Best Sky Combo)
  sheetContent.children = [];
  vm.runInContext(`
    state.skyEventsCaught = 7;
    state.currentTab = 'stats';
    updateSheetContent();
  `, ctx);
  const statsHtml = sheetContent.children.map(c => c.innerHTML).join('\n');
  assert.match(statsHtml, /Sky Events Caught/);
  assert.match(statsHtml, /Colony Cap/);
  assert.match(statsHtml, /Parades Witnessed/);
  assert.doesNotMatch(statsHtml, /Best Sky Combo/);

  // Verify Next Milestone Compass, Persistent Offline DPS isolation, and Rebirth permanent vs run scope
  const v27Checks = vm.runInContext(`
    const msBeforeSkip = updateMilestoneBarUI();
    skipActiveMilestone();
    const msAfterSkip = updateMilestoneBarUI();
    state.skippedMilestones = [];
    state.frenzyTimer = 60;
    state.hotspotHoleId = 1;
    state.hotspotActiveTimer = 30;
    state.hotspotSurgeTimer = 20;
    state.paradeBoostTimer = 60;
    const liveDpsBoosted = state.calculateDPS();
    const offlineDpsBase = state.calculatePersistentOfflineDPS();
    state.frenzyTimer = 0;
    state.hotspotHoleId = null;
    state.hotspotActiveTimer = 0;
    state.hotspotSurgeTimer = 0;
    state.paradeBoostTimer = 0;
    const offlineDpsClean = state.calculatePersistentOfflineDPS();
    ({
      msBeforeId: msBeforeSkip.id,
      msAfterId: msAfterSkip.id,
      liveDpsBoosted,
      offlineDpsBase,
      offlineDpsClean
    });
  `, ctx);
  assert.notEqual(v27Checks.msBeforeId, v27Checks.msAfterId, 'Skip must advance milestone compass');
  assert.ok(v27Checks.liveDpsBoosted > v27Checks.offlineDpsBase, 'Live boosted DPS should exceed persistent offline baseline');
  assert.ok(Math.abs(v27Checks.offlineDpsBase - v27Checks.offlineDpsClean) < 1e-6, 'Persistent offline DPS must ignore all transient timers');

  // Verify Rebirth reset clears Wardrobe hats, run milestones, active Hotspot & hotspot surge while keeping permanent milestones, tabs & Sky/Parade stats
  const postRebirth = vm.runInContext(`
    state.completedPermanentMilestones = ['recruit_5_adelie'];
    state.completedRunMilestones = ['carve_fourth_hole', 'castle_tier_1'];
    state.hotspotHoleId = 2;
    state.hotspotActiveTimer = 25;
    state.hotspotSurgeTimer = 15;
    state.runFish = 1_500_000;
    executeGlacialRebirthReset(state.getPendingPrestigeShards());
    ({
      unlockedHats: state.unlockedHats,
      equippedHat: state.equippedHat,
      adelieHat: state.getSpeciesHat('adelie'),
      skyEventsCaught: state.skyEventsCaught,
      paradesWitnessed: state.paradesWitnessed,
      permMilestones: state.completedPermanentMilestones,
      runMilestones: state.completedRunMilestones,
      hotspotHoleId: state.hotspotHoleId,
      hotspotActiveTimer: state.hotspotActiveTimer,
      hotspotSurgeTimer: state.hotspotSurgeTimer
    });
  `, ctx);
  assert.deepEqual(Array.from(postRebirth.unlockedHats), ['none']);
  assert.equal(postRebirth.equippedHat, 'none');
  assert.equal(postRebirth.adelieHat, 'none');
  assert.equal(postRebirth.skyEventsCaught, 7);
  assert.equal(postRebirth.paradesWitnessed, 1);
  assert.ok(Array.from(postRebirth.permMilestones).includes('recruit_5_adelie'));
  assert.deepEqual(Array.from(postRebirth.runMilestones), []);
  assert.equal(postRebirth.hotspotHoleId, null);
  assert.equal(postRebirth.hotspotActiveTimer, 0);
  assert.equal(postRebirth.hotspotSurgeTimer, 0);

  // Verify themed Glacial Rebirth modal opens cleanly and dismisses via Android Back button
  vm.runInContext(`
    state.runFish = 1_500_000;
    openRebirthConfirmModal();
  `, ctx);
  assert.equal(getEl('rebirth-confirm-modal').style.display, 'flex');
  assert.match(getEl('rebirth-confirm-essence-val').textContent, /^\+\d+ 💎$/);
  assert.equal(sandbox.handleAndroidBackButton(), true);
  assert.equal(getEl('rebirth-confirm-modal').style.display, 'none');
});
