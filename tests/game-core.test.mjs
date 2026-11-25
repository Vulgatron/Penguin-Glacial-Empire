import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Economy = require('../js/economy.js');
const DailySystem = require('../js/daily-system.js');
const SaveSystem = require('../js/save-system.js');
const PushClient = require('../js/push-client.js');

const ROOT = path.resolve(import.meta.dirname, '..');

test('Economy: number formatting handles normal, large, negative, and non-finite values', () => {
  assert.equal(Economy.formatNumber(0), '0');
  assert.equal(Economy.formatNumber(999), '999');
  assert.equal(Economy.formatNumber(1500), '1.5K');
  assert.equal(Economy.formatNumber(2_500_000), '2.5M');
  assert.equal(Economy.formatNumber(-1200), '-1.2K');
  assert.equal(Economy.formatNumber(NaN), '0');
  assert.equal(Economy.formatNumber(Infinity), '0');
  assert.match(Economy.formatNumber(1e45), /e\+45$/i);
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

test('Economy: prestige shards and glacier level scaling preserve progression rules', () => {
  assert.equal(Economy.calculatePendingPrestigeShards(149_999), 0);
  assert.equal(Economy.calculatePendingPrestigeShards(150_000), 1);
  assert.equal(Economy.calculatePendingPrestigeShards(150_000 * 8), 2);
  assert.equal(Economy.calculatePrestigeMultiplier(20), 2.0);
  assert.equal(Economy.calculateLevelRequirement(1), Math.floor(150 * 1.32));
  assert.equal(Number.isFinite(Economy.calculateLevelRequirement(9999)), true);
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
});

test('SaveSystem: backup recovery on corrupted primary and non-destructive unrecoverable detection', () => {
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

test('PushClient: distinguishes Android WebView local origin from hosted Web PWA and validates config', () => {
  assert.equal(
    PushClient.isLocalAndroidWebViewHost({ protocol: 'https:', hostname: 'appassets.androidplatform.net' }, false),
    true
  );
  assert.equal(
    PushClient.isHostedWebPwa({ protocol: 'https:', hostname: 'appassets.androidplatform.net' }, false),
    false
  );
  assert.equal(
    PushClient.isHostedWebPwa({ protocol: 'https:', hostname: 'glacial-empire.example.com' }, true),
    false
  );
  assert.equal(
    PushClient.isHostedWebPwa({ protocol: 'https:', hostname: 'glacial-empire.example.com' }, false),
    true
  );

  // Unconfigured default push-config.json
  const emptyCheck = PushClient.validatePushConfig({
    vapidPublicKey: '',
    subscribeApiUrl: '',
    unsubscribeApiUrl: '',
    defaultReminderHour: 8,
    defaultReminderMinute: 0
  });
  assert.equal(emptyCheck.configured, false);
  assert.equal(emptyCheck.partiallyConfigured, false);

  // Rejects non-HTTPS subscribe URL
  const badUrl = PushClient.validatePushConfig({
    vapidPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    subscribeApiUrl: 'http://insecure.example.com/subscribe'
  });
  assert.equal(badUrl.configured, false);
  assert.equal(badUrl.partiallyConfigured, true);
  assert.ok(badUrl.issues.includes('invalid_subscribe_url'));

  // Valid config passes
  const good = PushClient.validatePushConfig({
    vapidPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    subscribeApiUrl: 'https://relay.example.com/subscribe',
    unsubscribeApiUrl: 'https://relay.example.com/unsubscribe',
    defaultReminderHour: 8,
    defaultReminderMinute: 30
  });
  assert.equal(good.configured, true);
  assert.equal(PushClient.formatReminderTime(8, 30), '8:30 AM');

  // 15-minute window respects reminderMinute
  assert.equal(PushClient.matchesReminderWindow({ currentHour: 8, currentMinute: 30, targetHour: 8, targetMinute: 30 }), true);
  assert.equal(PushClient.matchesReminderWindow({ currentHour: 8, currentMinute: 44, targetHour: 8, targetMinute: 30 }), true);
  assert.equal(PushClient.matchesReminderWindow({ currentHour: 8, currentMinute: 45, targetHour: 8, targetMinute: 30 }), false);
  assert.equal(PushClient.matchesReminderWindow({ currentHour: 0, currentMinute: 5, targetHour: 23, targetMinute: 55 }), true);

  // Foreground trigger respects reminderMinute and prevents duplicate same-day trigger
  const at815 = new Date(2026, 4, 15, 8, 15, 0).getTime();
  const at831 = new Date(2026, 4, 15, 8, 31, 0).getTime();
  assert.equal(PushClient.shouldTriggerForegroundReminder({
    enabled: true, permission: 'granted', nowMs: at815,
    reminderHour: 8, reminderMinute: 30, lastNotifiedDateKey: '', cycleKey: '2026-05-15'
  }), false);
  assert.equal(PushClient.shouldTriggerForegroundReminder({
    enabled: true, permission: 'granted', nowMs: at831,
    reminderHour: 8, reminderMinute: 30, lastNotifiedDateKey: '', cycleKey: '2026-05-15'
  }), true);
  assert.equal(PushClient.shouldTriggerForegroundReminder({
    enabled: true, permission: 'granted', nowMs: at831,
    reminderHour: 8, reminderMinute: 30, lastNotifiedDateKey: '2026-05-15', cycleKey: '2026-05-15'
  }), false);
});

test('Integration invariants: viewport zoom policy preserved, splash-to-offline sequencing, no SW forced reload', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  // Explicit exclusion: keep user-scalable=no intact
  assert.match(html, /<meta\s+name="viewport"[^>]*user-scalable=no/i);

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
  assert.match(html, /PGE_SKIP_SPLASH_ONCE/);
  const claimIdx = html.indexOf('function claimOfflineCatch()');
  const claimBlock = html.slice(claimIdx, claimIdx + 1200);
  assert.ok(claimIdx > 0);
  assert.doesNotMatch(claimBlock, /flushPendingSwReload|location\.reload/);
  assert.match(html, /window\.flushPendingSwReload\s*=\s*function\(\)\s*\{\s*return false;\s*\}/);

  // Golden Fish fixes present in index.html
  assert.match(html, /getVisibleGlacierBottomY/);
  assert.match(html, /computeGoldenFishCooldownStep/);
  assert.match(html, /goldenFishTimerSec:\s*state\.goldenFishTimer/);
});
