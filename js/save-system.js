(function (root, factory) {
  const economy = (typeof module === 'object' && module.exports)
    ? require('./economy.js')
    : (root.GlacialCore && root.GlacialCore.Economy);
  const daily = (typeof module === 'object' && module.exports)
    ? require('./daily-system.js')
    : (root.GlacialCore && root.GlacialCore.DailySystem);
  const api = factory(economy, daily);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.SaveSystem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Economy, DailySystem) {
  'use strict';

  const CURRENT_SAVE_VERSION = 2;
  const STORAGE_KEY = 'PENGUIN_GLACIAL_SAVE';
  const BACKUP_STORAGE_KEY = 'PENGUIN_GLACIAL_SAVE_BACKUP';
  const QUARANTINE_STORAGE_KEY = 'PENGUIN_GLACIAL_SAVE_CORRUPT';
  const MAX_SAVE_BYTES = 512 * 1024;
  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  const DEFAULT_SPECIES_IDS = ['adelie', 'gentoo', 'chinstrap', 'emperor', 'cyber'];
  const DEFAULT_TRAIT_IDS = ['optimistic', 'lazy', 'greedy', 'energetic', 'focused', 'thrifty'];
  const DEFAULT_TECH_IDS = [
    'thermal_parkas',
    'reinforced_line',
    'smooth_ice',
    'bioluminescent_krill',
    'cryo_storage',
    'aurora_coils'
  ];

  function safeNum(val, fallback, min, max) {
    if (Economy && Economy.sanitizeFiniteNumber) {
      return Economy.sanitizeFiniteNumber(val, fallback, min, max);
    }
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function safeInt(val, fallback, min, max) {
    return Math.floor(safeNum(val, fallback, min, max));
  }

  function isPlainObject(v) {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  /**
   * Migrates legacy saves (v0/v1 without saveVersion or runFish/goldenFishTimer) to CURRENT_SAVE_VERSION.
   */
  function migrateSaveData(rawObj) {
    if (!isPlainObject(rawObj)) {
      return { data: null, migratedFrom: null, migrated: false };
    }

    const originalVersion = Number.isInteger(rawObj.saveVersion) && rawObj.saveVersion >= 1
      ? rawObj.saveVersion
      : 0;
    const copy = Object.assign({}, rawObj);
    let version = originalVersion;

    // v0 -> v1: backfill runFish, totalEssenceEarned, rebirthHistory, and routine toast toggle
    if (version < 1) {
      const totalRebirths = safeInt(copy.totalRebirths, 0, 0, 1e6);
      const fish = safeNum(copy.fish, 0, 0, 1e300);
      const levelFish = safeNum(copy.levelFish, 0, 0, 1e300);
      const lifetimeFish = safeNum(copy.lifetimeFish, fish, 0, 1e300);
      if (typeof copy.runFish !== 'number' || !Number.isFinite(copy.runFish)) {
        copy.runFish = totalRebirths > 0 ? Math.max(fish, levelFish) : lifetimeFish;
      }
      if (typeof copy.totalEssenceEarned !== 'number' || !Number.isFinite(copy.totalEssenceEarned)) {
        copy.totalEssenceEarned = Math.max(0, safeInt(copy.prestigeShards, 0, 0, 1e12));
      }
      if (!Array.isArray(copy.rebirthHistory)) {
        copy.rebirthHistory = [];
      }
      if (typeof copy.disableRoutineToasts !== 'boolean') {
        copy.disableRoutineToasts = false;
      }
      version = 1;
    }

    // v1 -> v2: add explicit saveVersion, goldenFishTimer, savedAt metadata
    if (version < 2) {
      if (typeof copy.goldenFishTimer !== 'number' || !Number.isFinite(copy.goldenFishTimer)) {
        copy.goldenFishTimer = 0;
      }
      if (typeof copy.savedAt !== 'number' || !Number.isFinite(copy.savedAt)) {
        copy.savedAt = safeNum(copy.lastSaveTime, 0, 0, Number.MAX_SAFE_INTEGER);
      }
      version = 2;
    }

    copy.saveVersion = CURRENT_SAVE_VERSION;
    return {
      data: copy,
      migratedFrom: originalVersion,
      migrated: originalVersion < CURRENT_SAVE_VERSION
    };
  }

  /**
   * Validates and repairs every field of a save object against NaN, Infinity, negatives,
   * malformed arrays/objects, prototype keys, future timestamps, and overflow.
   */
  function sanitizeSaveData(rawObj, schemaDefs = {}, nowMs = Date.now()) {
    const speciesIds = Array.isArray(schemaDefs.speciesIds) && schemaDefs.speciesIds.length > 0
      ? schemaDefs.speciesIds
      : DEFAULT_SPECIES_IDS;
    const traitIds = Array.isArray(schemaDefs.traitIds) && schemaDefs.traitIds.length > 0
      ? schemaDefs.traitIds
      : DEFAULT_TRAIT_IDS;
    const techIds = Array.isArray(schemaDefs.techIds) && schemaDefs.techIds.length > 0
      ? schemaDefs.techIds
      : DEFAULT_TECH_IDS;
    const weatherCount = safeInt(schemaDefs.weatherCount, 3, 1, 20);
    const weatherCycleSec = safeNum(schemaDefs.weatherCycleSeconds, 300, 10, 86400);
    const maxSafe = Economy ? Economy.MAX_SAFE_RESOURCE : 1e300;
    const safeNow = safeNum(nowMs, Date.now(), 0, Number.MAX_SAFE_INTEGER);

    const migrated = migrateSaveData(rawObj);
    const src = migrated.data || {};
    const repairs = [];

    const fish = safeNum(src.fish, 0, 0, maxSafe);
    if (src.fish !== undefined && src.fish !== fish) repairs.push('fish');

    const levelFish = safeNum(src.levelFish, 0, 0, maxSafe);
    const runFish = Math.max(fish, safeNum(src.runFish, fish, 0, maxSafe));
    const lifetimeFish = Math.max(runFish, safeNum(src.lifetimeFish, runFish, 0, maxSafe));
    const glacierLevel = safeInt(src.glacierLevel, 1, 1, 10000);
    const prestigeShards = safeInt(src.prestigeShards, 0, 0, 1e12);
    const totalEssenceEarned = Math.max(prestigeShards, safeInt(src.totalEssenceEarned, prestigeShards, 0, 1e12));

    // Sanitize penguins map
    const penguins = {};
    const srcPenguins = isPlainObject(src.penguins) ? src.penguins : {};
    let totalPenguinCount = 0;

    speciesIds.forEach((spId) => {
      const rawEntry = isPlainObject(srcPenguins[spId]) ? srcPenguins[spId] : {};
      const count = safeInt(rawEntry.count, spId === 'adelie' ? 1 : 0, 0, 1e7);
      totalPenguinCount += count;

      const rawNextTrait = typeof rawEntry.nextTrait === 'string' ? rawEntry.nextTrait : '';
      const nextTrait = traitIds.includes(rawNextTrait) ? rawNextTrait : traitIds[0];

      const traitCounts = {};
      let assigned = 0;
      if (isPlainObject(rawEntry.traitCounts)) {
        for (const [k, v] of Object.entries(rawEntry.traitCounts)) {
          if (FORBIDDEN_KEYS.has(k) || !traitIds.includes(k)) continue;
          const cnt = safeInt(v, 0, 0, count);
          if (cnt > 0 && assigned < count) {
            const take = Math.min(cnt, count - assigned);
            traitCounts[k] = take;
            assigned += take;
          }
        }
      }
      if (assigned < count) {
        traitCounts[nextTrait] = (traitCounts[nextTrait] || 0) + (count - assigned);
      }

      penguins[spId] = {
        count,
        level: Math.max(1, Math.floor(1 + count / 10)),
        nextTrait,
        traitCounts
      };
    });

    // Guarantee at least 1 starter penguin so the colony can never brick into 0 penguins
    if (totalPenguinCount === 0 && penguins.adelie) {
      penguins.adelie.count = 1;
      penguins.adelie.level = 1;
      penguins.adelie.traitCounts = { [penguins.adelie.nextTrait]: 1 };
      repairs.push('starter_penguin');
    }

    // Sanitize tech map
    const tech = {};
    const srcTech = isPlainObject(src.tech) ? src.tech : {};
    techIds.forEach((techId) => {
      tech[techId] = safeInt(srcTech[techId], 0, 0, 1e6);
    });

    // Sanitize collected perks
    const collectedPerks = [];
    if (Array.isArray(src.collectedPerks)) {
      const seenPerks = new Map();
      for (const p of src.collectedPerks) {
        if (!isPlainObject(p) || typeof p.id !== 'string' || !p.id.trim()) continue;
        const id = p.id.slice(0, 60);
        const rarity = ['common', 'rare', 'legendary', 'mythic'].includes(p.rarity) ? p.rarity : 'common';
        const count = safeInt(p.count, 1, 1, 10000);
        if (seenPerks.has(id)) {
          seenPerks.get(id).count = Math.min(10000, seenPerks.get(id).count + count);
        } else {
          const entry = {
            id,
            name: typeof p.name === 'string' ? p.name.slice(0, 100) : id,
            rarity,
            icon: typeof p.icon === 'string' ? p.icon.slice(0, 8) : '✨',
            desc: typeof p.desc === 'string' ? p.desc.slice(0, 240) : '',
            count,
            isLegendary: rarity === 'legendary',
            isPreserved: rarity === 'legendary' || rarity === 'mythic',
            firstAcquiredAt: safeNum(p.firstAcquiredAt, safeNow, 0, safeNow),
            lastAcquiredAt: safeNum(p.lastAcquiredAt, safeNow, 0, safeNow)
          };
          seenPerks.set(id, entry);
          collectedPerks.push(entry);
        }
        if (collectedPerks.length >= 200) break;
      }
    }

    // Sanitize unlocked achievements (guards against prototype pollution & invalid entries)
    const unlockedAchievements = {};
    if (isPlainObject(src.unlockedAchievements)) {
      let count = 0;
      for (const [k, v] of Object.entries(src.unlockedAchievements)) {
        if (FORBIDDEN_KEYS.has(k) || k.length > 80) continue;
        if (v) {
          unlockedAchievements[k] = typeof v === 'number' && Number.isFinite(v) ? v : true;
          count++;
          if (count >= 250) break;
        }
      }
    }

    // Sanitize rebirth history
    const rebirthHistory = [];
    if (Array.isArray(src.rebirthHistory)) {
      for (const item of src.rebirthHistory.slice(0, 100)) {
        if (!isPlainObject(item)) continue;
        rebirthHistory.push({
          rebirthNumber: safeInt(item.rebirthNumber, rebirthHistory.length + 1, 1, 1e6),
          timestamp: safeNum(item.timestamp, safeNow, 0, safeNow),
          essenceGained: safeInt(item.essenceGained, 0, 0, 1e12),
          totalEssenceAfter: safeInt(item.totalEssenceAfter, 0, 0, 1e12),
          runFish: safeNum(item.runFish, 0, 0, maxSafe),
          glacierLevel: safeInt(item.glacierLevel, 1, 1, 10000)
        });
      }
    }

    // Sanitize speech logs
    const speechLog = {};
    const speechLogExpanded = {};
    const srcSpeechLog = isPlainObject(src.speechLog) ? src.speechLog : {};
    const srcSpeechExp = isPlainObject(src.speechLogExpanded) ? src.speechLogExpanded : {};
    speciesIds.forEach((spId, idx) => {
      const rawArr = Array.isArray(srcSpeechLog[spId]) ? srcSpeechLog[spId] : [];
      speechLog[spId] = rawArr.slice(0, 50).filter(isPlainObject).map((entry, eIdx) => ({
        id: typeof entry.id === 'string' ? entry.id.slice(0, 64) : `${safeNow}_${eIdx}`,
        speciesId: spId,
        text: typeof entry.text === 'string' ? entry.text.slice(0, 300) : '',
        category: entry.category === 'trait' ? 'trait' : (entry.category === 'myth' ? 'myth' : 'fact'),
        traitId: typeof entry.traitId === 'string' && traitIds.includes(entry.traitId) ? entry.traitId : traitIds[0],
        traitName: typeof entry.traitName === 'string' ? entry.traitName.slice(0, 40) : 'Optimistic',
        traitIcon: typeof entry.traitIcon === 'string' ? entry.traitIcon.slice(0, 8) : '☀️',
        traitColor: typeof entry.traitColor === 'string' ? entry.traitColor.slice(0, 24) : '#34d399',
        timestamp: safeNum(entry.timestamp, safeNow, 0, safeNow)
      }));
      speechLogExpanded[spId] = typeof srcSpeechExp[spId] === 'boolean' ? srcSpeechExp[spId] : idx === 0;
    });

    // Clamp timestamps so future-tampered clocks cannot produce bogus negative elapsed intervals
    const rawLastSave = safeNum(src.lastSaveTime, 0, 0, Number.MAX_SAFE_INTEGER);
    const futureClockDetected = rawLastSave > safeNow + 60_000;
    if (futureClockDetected) repairs.push('future_lastSaveTime');
    const lastSaveTime = futureClockDetected ? safeNow : rawLastSave;

    const rawStartTime = safeNum(src.gameStartTime, safeNow, 0, Number.MAX_SAFE_INTEGER);
    const gameStartTime = rawStartTime > safeNow ? safeNow : rawStartTime;

    const currentDailyKey = DailySystem ? DailySystem.getCycleDateKey(safeNow) : '';
    const dailyObjectives = DailySystem
      ? DailySystem.sanitizeDailyObjectivesState(src.dailyObjectives, currentDailyKey)
      : (isPlainObject(src.dailyObjectives) ? src.dailyObjectives : {});

    return {
      data: {
        saveVersion: CURRENT_SAVE_VERSION,
        savedAt: safeNow,
        fish,
        lifetimeFish,
        runFish,
        glacierLevel,
        levelFish,
        prestigeShards,
        penguins,
        tech,
        collectedPerks,
        unlockedAchievements,
        perkWalkSpeedMult: safeNum(src.perkWalkSpeedMult, 1.0, 0.5, 1e6),
        perkSlideSpeedMult: safeNum(src.perkSlideSpeedMult, 1.0, 0.5, 1e6),
        perkCatchMult: safeNum(src.perkCatchMult, 1.0, 0.5, 1e6),
        clickMult: safeNum(src.clickMult, 1.0, 0.5, 1e6),
        diveSpeedMult: safeNum(src.diveSpeedMult, 1.0, 0.5, 1e6),
        emperorBoost: safeNum(src.emperorBoost, 0, 0, 1e4),
        goldenFishTimer: safeNum(src.goldenFishTimer, 0, 0, 3600),
        muted: typeof src.muted === 'boolean' ? src.muted : false,
        masterVolume: safeNum(src.masterVolume, 0.85, 0, 1),
        sfxVolume: safeNum(src.sfxVolume, 0.9, 0, 1),
        ambientVolume: safeNum(src.ambientVolume, 0.65, 0, 1),
        hapticsEnabled: typeof src.hapticsEnabled === 'boolean' ? src.hapticsEnabled : true,
        lastSaveTime,
        dailyObjectives,
        totalRebirths: safeInt(src.totalRebirths, 0, 0, 1e6),
        totalEssenceEarned,
        rebirthHistory,
        totalAuroraBlessingsClaimed: safeInt(src.totalAuroraBlessingsClaimed, 0, 0, 1e9),
        totalManualClicks: safeInt(src.totalManualClicks, 0, 0, 1e12),
        totalDives: safeInt(src.totalDives, 0, 0, 1e12),
        totalSlides: safeInt(src.totalSlides, 0, 0, 1e12),
        gameStartTime,
        highestDPS: safeNum(src.highestDPS, 0, 0, maxSafe),
        weatherIndex: safeInt(src.weatherIndex, 0, 0, weatherCount - 1),
        weatherTimer: safeNum(src.weatherTimer, weatherCycleSec, 1, weatherCycleSec),
        speechLog,
        speechLogExpanded,
        lastColonySpeechEndedAt: safeNum(src.lastColonySpeechEndedAt, 0, 0, safeNow),
        pendingOfflineFish: safeNum(Math.floor(safeNum(src.pendingOfflineFish, 0, 0, maxSafe)), 0, 0, maxSafe),
        lastSeenFeatureReleaseId: typeof src.lastSeenFeatureReleaseId === 'string'
          ? src.lastSeenFeatureReleaseId.slice(0, 80)
          : '',
        disableRoutineToasts: Boolean(src.disableRoutineToasts),
        dailyReminderEnabled: Boolean(src.dailyReminderEnabled),
        lastDailyReminderDateKey: typeof src.lastDailyReminderDateKey === 'string'
          ? src.lastDailyReminderDateKey.slice(0, 32)
          : ''
      },
      migratedFrom: migrated.migratedFrom,
      migrated: migrated.migrated,
      repairs,
      futureClockDetected
    };
  }

  function tryParseSaveObject(raw) {
    if (typeof raw !== 'string') return { ok: false, reason: 'not_string' };
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > MAX_SAVE_BYTES) return { ok: false, reason: 'empty_or_oversized' };
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return { ok: false, reason: 'not_object_json' };
    try {
      const parsed = JSON.parse(trimmed);
      if (!isPlainObject(parsed)) return { ok: false, reason: 'parsed_not_object' };
      return { ok: true, value: parsed };
    } catch (_) {
      return { ok: false, reason: 'json_parse_error' };
    }
  }

  /**
   * Parses and validates primary save with automatic fallback to known-good backup on corruption.
   */
  function parseAndRecoverSave({ primaryRaw = null, backupRaw = null, schemaDefs = {}, nowMs = Date.now() }) {
    const hasPrimary = typeof primaryRaw === 'string' && primaryRaw.trim().length > 0;
    const hasBackup = typeof backupRaw === 'string' && backupRaw.trim().length > 0;

    if (hasPrimary) {
      const parsed = tryParseSaveObject(primaryRaw);
      if (parsed.ok) {
        const sanitized = sanitizeSaveData(parsed.value, schemaDefs, nowMs);
        return {
          status: 'ok',
          source: 'primary',
          recoveredFromBackup: false,
          corruptedPayload: null,
          ...sanitized
        };
      }
      // Primary was corrupted — try backup before failing
      if (hasBackup) {
        const parsedBackup = tryParseSaveObject(backupRaw);
        if (parsedBackup.ok) {
          const sanitized = sanitizeSaveData(parsedBackup.value, schemaDefs, nowMs);
          return {
            status: 'recovered',
            source: 'backup',
            recoveredFromBackup: true,
            corruptedPayload: primaryRaw,
            ...sanitized
          };
        }
      }
      return {
        status: 'corrupted_unrecoverable',
        source: 'none',
        recoveredFromBackup: false,
        corruptedPayload: primaryRaw,
        data: null,
        migratedFrom: null,
        migrated: false,
        repairs: ['corrupted_save']
      };
    }

    if (hasBackup) {
      const parsedBackup = tryParseSaveObject(backupRaw);
      if (parsedBackup.ok) {
        const sanitized = sanitizeSaveData(parsedBackup.value, schemaDefs, nowMs);
        return {
          status: 'recovered',
          source: 'backup',
          recoveredFromBackup: true,
          corruptedPayload: null,
          ...sanitized
        };
      }
    }

    return {
      status: 'empty',
      source: 'none',
      recoveredFromBackup: false,
      corruptedPayload: null,
      data: null,
      migratedFrom: null,
      migrated: false,
      repairs: []
    };
  }

  /**
   * Computes a lightweight fingerprint excluding volatile timestamps so unchanged saves skip I/O.
   */
  function computeStateFingerprint(saveObj) {
    if (!isPlainObject(saveObj)) return '';
    const clone = Object.assign({}, saveObj);
    delete clone.lastSaveTime;
    delete clone.savedAt;
    return JSON.stringify(clone);
  }

  /**
   * Throttled, deduplicated persistence coordinator for browser/WebView save calls.
   */
  function createPersistenceController(options = {}) {
    const autosaveIntervalMs = safeInt(options.autosaveIntervalMs, 15000, 1000, 120000);
    const writeFn = typeof options.writeFn === 'function' ? options.writeFn : () => false;
    const nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();

    let lastFingerprint = '';
    let lastWriteMs = 0;
    let totalWrites = 0;
    let skippedUnchanged = 0;
    let skippedThrottled = 0;
    let saveBlockedForCorruption = false;

    function save(saveObj, opts = {}) {
      if (saveBlockedForCorruption && !opts.forceAfterRecovery) {
        return { written: false, reason: 'corruption_guard' };
      }
      if (!isPlainObject(saveObj)) {
        return { written: false, reason: 'invalid_object' };
      }
      const now = nowFn();
      const immediate = Boolean(opts.immediate);
      const sync = Boolean(opts.sync);
      const fingerprint = computeStateFingerprint(saveObj);

      if (!opts.force && fingerprint === lastFingerprint) {
        skippedUnchanged++;
        return { written: false, reason: 'unchanged' };
      }

      if (!immediate && !sync && lastWriteMs > 0 && (now - lastWriteMs) < autosaveIntervalMs) {
        skippedThrottled++;
        return { written: false, reason: 'throttled' };
      }

      const jsonStr = JSON.stringify(saveObj);
      if (jsonStr.length > MAX_SAVE_BYTES) {
        return { written: false, reason: 'oversized' };
      }

      const ok = Boolean(writeFn(jsonStr, { immediate, sync }));
      if (ok) {
        lastFingerprint = fingerprint;
        lastWriteMs = now;
        totalWrites++;
      }
      return { written: ok, reason: ok ? 'written' : 'write_failed', bytes: jsonStr.length };
    }

    function markLoaded(saveObj) {
      lastFingerprint = computeStateFingerprint(saveObj);
      lastWriteMs = nowFn();
      saveBlockedForCorruption = false;
    }

    function setCorruptionGuard(blocked) {
      saveBlockedForCorruption = Boolean(blocked);
    }

    function reset() {
      lastFingerprint = '';
      lastWriteMs = 0;
      saveBlockedForCorruption = false;
    }

    function getMetrics() {
      return { totalWrites, skippedUnchanged, skippedThrottled, autosaveIntervalMs, saveBlockedForCorruption };
    }

    return {
      save,
      markLoaded,
      setCorruptionGuard,
      reset,
      getMetrics
    };
  }

  return {
    CURRENT_SAVE_VERSION,
    STORAGE_KEY,
    BACKUP_STORAGE_KEY,
    QUARANTINE_STORAGE_KEY,
    MAX_SAVE_BYTES,
    migrateSaveData,
    sanitizeSaveData,
    tryParseSaveObject,
    parseAndRecoverSave,
    computeStateFingerprint,
    createPersistenceController
  };
});
