import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Economy = require('../js/economy.js');
const DailySystem = require('../js/daily-system.js');
const Wardrobe = require('../js/wardrobe.js');
const GameData = require('../js/game-data.js');
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
  assert.equal(Economy.getNextIglooTierDef(5), null);

  assert.equal(Economy.IGLOO_THEMES.length, 6);
  assert.equal(Economy.getIglooThemeDef('glacier').cost, 0);
  assert.equal(Economy.getIglooThemeDef('unknown_theme').id, 'glacier');

  // Fishing holes: 3 starter + 3 purchasable = 6 max
  assert.equal(Economy.MIN_FISHING_HOLES, 3);
  assert.equal(Economy.MAX_FISHING_HOLES, 6);
  assert.equal(Economy.FISHING_HOLE_DEFS.length, 6);
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

  // 12 hours -> full offline rate (2/3 DPS)
  const twelveHours = Economy.calculateOfflineEarnings({
    dps: 30,
    lastSaveTimeMs: now - 12 * 3600 * 1000,
    nowMs: now
  });
  assert.equal(twelveHours.capped, false);
  assert.equal(twelveHours.earned, Math.floor(30 * (12 * 3600) * (2 / 3)));

  // 48 hours -> 24h full + 24h * 0.25 = 30 effective hours
  const fortyEightHours = Economy.calculateOfflineEarnings({
    dps: 30,
    lastSaveTimeMs: now - 48 * 3600 * 1000,
    nowMs: now
  });
  assert.equal(fortyEightHours.capped, true);
  assert.equal(fortyEightHours.effectiveSec, 30 * 3600);
  assert.equal(fortyEightHours.earned, Math.floor(30 * (30 * 3600) * (2 / 3)));

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

  // Next cooldown is halved when boost active
  const baseCd = Economy.computeGoldenFishNextCooldown({ goldenFishTimerSec: 0, rng: () => 0.5 });
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

  // v2 -> v4 migration defaults & sanitization of invalid castle/fishing-hole/wardrobe values
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
  assert.equal(migratedV2.data.saveVersion, 4);
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

  // v3 -> v4 migration preserves v3 castle/holes and initializes wardrobe + sky/parade stats cleanly
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
  assert.equal(clampedV3.data.saveVersion, 4);
  assert.equal(clampedV3.data.iglooTier, 5);
  assert.equal(clampedV3.data.iglooTheme, 'glacier'); // midnight_obsidian not unlocked
  assert.deepEqual(clampedV3.data.unlockedIglooThemes, ['glacier']);
  assert.equal(clampedV3.data.fishingHolesUnlocked, 6);

  // v4 wardrobe & sky/parade stats sanitization strips locked/invalid hats and preserves valid per-species mix
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
  assert.equal(sanitizedV4.migrated, false);
  assert.deepEqual(sanitizedV4.data.unlockedHats, ['none', 'scarf', 'star_crown']);
  assert.equal(sanitizedV4.data.equippedHat, 'none');
  assert.equal(sanitizedV4.data.speciesHats.adelie, 'scarf');
  assert.equal(sanitizedV4.data.speciesHats.emperor, 'star_crown');
  assert.equal(sanitizedV4.data.speciesHats.cyber, 'none');
  assert.equal(sanitizedV4.data.skyEventsCaught, 19);
  assert.equal(sanitizedV4.data.bestSkyCombo, 5);
  assert.equal(sanitizedV4.data.paradesWitnessed, 4);
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
});

test('SkyEvents: Shooting Stars stay in top 20% sky, Krill Swarm respects expanded sheet, Sky Combo builds to 5x & triggers 2x Starlight Frenzy', () => {
  assert.equal(SkyEvents.STARLIGHT_FRENZY_MULTIPLIER, 2);
  assert.equal(SkyEvents.STARLIGHT_FRENZY_DURATION_SEC, 15);
  assert.equal(SkyEvents.SKY_COMBO_MAX, 5);
  assert.equal(SkyEvents.SKY_COMBO_DECAY_SEC, 20);

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

  // Catching 3 events builds Sky Combo 1 -> 2 -> 3 and triggers 15s 2x Starlight Frenzy
  const catch1 = ctrl.tryCatch(ctrl.activeStar.x, ctrl.activeStar.y, { dps: 100, sheetExpanded: true });
  assert.equal(catch1.caught, true);
  assert.equal(catch1.kind, 'shooting_star');
  assert.equal(catch1.comboCount, 1);
  assert.equal(catch1.frenzyTriggered, false);

  // Un-expand sheet -> Krill Swarm can spawn on visible ice shelf
  ctrl.update(0.25, { width: 390, height: 800, sheetExpanded: false, visibleBottomY: 620, isBlocked: false });
  assert.ok(ctrl.activeKrill, 'Expected Krill Swarm to spawn when shelf is visible');
  const catch2 = ctrl.tryCatch(ctrl.activeKrill.x, ctrl.activeKrill.y, { dps: 100, sheetExpanded: false });
  assert.equal(catch2.caught, true);
  assert.equal(catch2.kind, 'krill_swarm');
  assert.equal(catch2.comboCount, 2);
  assert.equal(catch2.frenzyTriggered, false);

  // 3rd catch triggers Starlight Frenzy
  ctrl.spawnShootingStar(390, 800);
  const catch3 = ctrl.tryCatch(ctrl.activeStar.x, ctrl.activeStar.y, { dps: 100, sheetExpanded: true });
  assert.equal(catch3.caught, true);
  assert.equal(catch3.comboCount, 3);
  assert.equal(catch3.frenzyTriggered, true);
  assert.equal(catch3.frenzyDurationSec, 15);

  // Combo decay pauses while blocked by modals/cutscenes, then decays to 0 after 20s unblocked
  ctrl.update(0.25, { width: 390, height: 800, sheetExpanded: true, isBlocked: true });
  assert.equal(ctrl.comboCount, 3);
  for (let i = 0; i < 84; i++) {
    ctrl.update(0.25, { width: 390, height: 800, sheetExpanded: true, isBlocked: false });
  }
  assert.equal(ctrl.comboCount, 0);
  ctrl.resetTransient();
  assert.equal(ctrl.activeStar, null);
  assert.equal(ctrl.activeKrill, null);
});

test('GameData & SceneRenderer & DailyManager: extracted modules expose complete data and safe rendering', () => {
  assert.equal(GameData.PENGUIN_SPECIES.length, 5);
  assert.equal(GameData.GLACIER_TECH.length, 6);
  assert.equal(GameData.AURORA_PERKS_POOL.length, 28);
  assert.equal(GameData.ACHIEVEMENTS_LIST.length, 22);
  assert.equal(GameData.LATEST_FEATURE_RELEASE.version, '2.6');
  assert.equal(typeof DailyManager.DailyObjectivesManager, 'function');
  const sky = SceneRenderer.getCurrentSkyAtmosphere(-15);
  assert.match(sky.top, /^rgb\(/);
});

test('SoundEngine: cutscene mode silences penguin SFX & gameplay haptics while allowing climax celebration haptic & winter score', () => {
  const se = new SoundEngine();
  let hapticCalls = [];
  se.ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { setValueAtTime() {}, setTargetAtTime() {} }, connect() {} }),
    createOscillator: () => ({ type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }),
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

    // Cutscene mode blocks all background penguin/gameplay haptics
    se.setCutsceneMode(true);
    assert.equal(se.triggerHaptic('penguin_tap'), false);
    assert.equal(se.triggerHaptic('collect'), false);
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
  assert.ok(html.split('\n').length < 7500, 'index.html should remain compact after modular JS extraction');

  // 80% vertical menu cap & top-HUD interactivity CSS invariants
  const coreCss = fs.readFileSync(path.join(ROOT, 'styles/core.css'), 'utf8');
  assert.match(coreCss, /#top-bar\s*\{[\s\S]*?z-index:\s*48;/);
  assert.match(coreCss, /#bottom-sheet\.expanded\s*\{[\s\S]*?height:\s*80dvh;[\s\S]*?max-height:\s*80dvh;[\s\S]*?z-index:\s*35;/);
  assert.match(html, /id="sky-combo-pill"/);

  // Version 2.6 consistency across HTML, GameData, Service Worker, Android Gradle, and README
  const gradleKts = fs.readFileSync(path.join(ROOT, 'app/build.gradle.kts'), 'utf8');
  const readmeMd = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(html, /id="splash-version-label"[^>]*>v2\.6</);
  assert.equal(GameData.LATEST_FEATURE_RELEASE.version, '2.6');
  assert.match(sw, /penguin-glacial-empire-v26/);
  assert.match(gradleKts, /versionName\s*=\s*"2\.6"/);
  assert.match(gradleKts, /versionCode\s*=\s*16/);
  assert.match(readmeMd, /Penguin Glacial Empire \(v2\.6\)/);

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

  // Splash started and updates version to v2.6
  assert.equal(rafs.length >= 2, true, 'Expected splash and gameLoop rAF callbacks');
  assert.equal(getEl('splash-version-label').textContent, 'v2.6');

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

  // Verify Glacier tab renders cleanly with 3 cards: Ice Castle, Fishing Holes, and Colony Wardrobe
  const sheetContent = getEl('sheet-content-container');
  sheetContent.children = [];
  vm.runInContext(`
    state.currentTab = 'glacier';
    updateSheetContent();
  `, ctx);
  assert.equal(sheetContent.children.length, 1, 'Expected glacier-tab-container appended to sheet-content-container');
  const glacierWrap = sheetContent.children[0];
  assert.equal(glacierWrap.children.length, 3, 'Expected Ice Castle, Fishing Holes, and Colony Wardrobe cards');
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

  // Verify Wardrobe Frost Essence purchase + per-species hat mixing + Rebirth reset
  const wardrobeRes = vm.runInContext(`
    state.prestigeShards = 500;
    const buyScarf = state.purchaseOrEquipHat('scarf', 'adelie');
    const buyGoggles = state.purchaseOrEquipHat('goggles', 'emperor');
    ({
      buyScarf,
      buyGoggles,
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
  assert.equal(wardrobeRes.shardsLeft, 50); // 500 - 100 - 350
  assert.equal(wardrobeRes.adelieHat, 'scarf');
  assert.equal(wardrobeRes.emperorHat, 'goggles');
  assert.equal(wardrobeRes.gentooHat, 'none');

  // Verify tapping empty top 20% sky while bottom sheet is expanded shrinks menu back to default (52%)
  const shrinkRes = vm.runInContext(`
    setBottomSheetState('expanded');
    const before = sheetSnapState;
    handleScreenTap(200, 95);
    ({ before, after: sheetSnapState });
  `, ctx);
  assert.equal(shrinkRes.before, 'expanded');
  assert.equal(shrinkRes.after, 'default');

  // Verify Stats tab displays Sky Events Caught, Best Sky Combo, and Parades Witnessed
  sheetContent.children = [];
  vm.runInContext(`
    state.skyEventsCaught = 7;
    state.bestSkyCombo = 4;
    state.currentTab = 'stats';
    updateSheetContent();
  `, ctx);
  const statsHtml = sheetContent.children.map(c => c.innerHTML).join('\n');
  assert.match(statsHtml, /Sky Events Caught/);
  assert.match(statsHtml, /Best Sky Combo/);
  assert.match(statsHtml, /Parades Witnessed/);
  assert.match(statsHtml, /4×/);

  // Verify Rebirth reset clears Wardrobe hats while keeping lifetime Sky/Parade stats
  const postRebirth = vm.runInContext(`
    state.runFish = 1_500_000;
    executeGlacialRebirthReset(state.getPendingPrestigeShards());
    ({
      unlockedHats: state.unlockedHats,
      equippedHat: state.equippedHat,
      adelieHat: state.getSpeciesHat('adelie'),
      skyEventsCaught: state.skyEventsCaught,
      bestSkyCombo: state.bestSkyCombo,
      paradesWitnessed: state.paradesWitnessed
    });
  `, ctx);
  assert.deepEqual(Array.from(postRebirth.unlockedHats), ['none']);
  assert.equal(postRebirth.equippedHat, 'none');
  assert.equal(postRebirth.adelieHat, 'none');
  assert.equal(postRebirth.skyEventsCaught, 7);
  assert.equal(postRebirth.bestSkyCombo, 4);
  assert.equal(postRebirth.paradesWitnessed, 1);

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
