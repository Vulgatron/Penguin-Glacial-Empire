(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.DailySystem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_STREAK = 10000;
  const MAX_PERMANENT_BONUS_PCT = 5000;
  const MAX_GOALS_COMPLETED = 1000000;
  const DAILY_RESET_HOUR = 3; // 3:00 AM local time

  function getCycleDateKey(nowMs = Date.now()) {
    const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
    const shifted = new Date(safeNow - DAILY_RESET_HOUR * 3600 * 1000);
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, '0');
    const d = String(shifted.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function shiftCycleDateKey(dateKey, deltaDays = 0) {
    const parts = String(dateKey || '').split('-').map(n => parseInt(n, 10));
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) {
      return '';
    }
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + (deltaDays | 0)));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isConsecutiveCycleDay(prevKey, nextKey) {
    if (!prevKey || !nextKey) return false;
    return shiftCycleDateKey(prevKey, 1) === nextKey;
  }

  function syncStreakForCycle(streakState, currentKey) {
    const streak = Math.max(0, Math.min(MAX_STREAK, Math.floor(Number(streakState && streakState.streakCount) || 0)));
    const best = Math.max(streak, Math.min(MAX_STREAK, Math.floor(Number(streakState && streakState.bestStreak) || 0)));
    const lastKey = typeof (streakState && streakState.lastStreakDateKey) === 'string'
      ? streakState.lastStreakDateKey
      : '';

    let nextStreak = streak;
    if (lastKey && lastKey !== currentKey && !isConsecutiveCycleDay(lastKey, currentKey)) {
      nextStreak = 0;
    }

    return {
      streakCount: nextStreak,
      bestStreak: Math.max(best, nextStreak),
      lastStreakDateKey: lastKey
    };
  }

  /**
   * Computes a streak increment for claiming a daily goal during `cycleKey`.
   * Guarantees idempotence (at most one streak credit per cycle day) and caps permanent bonus safely.
   */
  function applyStreakForGoalClaim(streakState, cycleKey) {
    const synced = syncStreakForCycle(streakState, cycleKey);
    const prevBonus = Math.max(
      0,
      Math.min(MAX_PERMANENT_BONUS_PCT, Math.floor(Number(streakState && streakState.permanentFishBonusPct) || 0))
    );

    if (synced.lastStreakDateKey === cycleKey) {
      return {
        ...synced,
        permanentFishBonusPct: prevBonus,
        incremented: false,
        bonusGainPct: 0,
        streakToast: ''
      };
    }

    const consecutive = isConsecutiveCycleDay(synced.lastStreakDateKey, cycleKey);
    let nextStreak;
    let bonusGain = 0;
    let nextBonus = prevBonus;
    let toast;

    if (consecutive) {
      nextStreak = Math.min(MAX_STREAK, synced.streakCount + 1);
      bonusGain = 2;
      nextBonus = Math.min(MAX_PERMANENT_BONUS_PCT, prevBonus + bonusGain);
      toast = `🔥 ${nextStreak}-Day Streak! +${bonusGain}% Permanent Fish Bonus (+${nextBonus}% total)!`;
    } else {
      nextStreak = 1;
      toast = '🔥 1-Day Streak started! Complete a goal tomorrow for +2% Permanent Fish!';
    }

    return {
      streakCount: nextStreak,
      bestStreak: Math.max(synced.bestStreak, nextStreak),
      lastStreakDateKey: cycleKey,
      permanentFishBonusPct: nextBonus,
      incremented: true,
      bonusGainPct: bonusGain,
      streakToast: toast
    };
  }

  function sanitizeObjectiveEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.slice(0, 80) : null;
    const type = typeof raw.type === 'string' && raw.type.trim().length > 0 ? raw.type.slice(0, 40) : null;
    if (!id || !type) return null;

    const target = Math.max(1, Math.min(1e15, Math.floor(Number(raw.target) || 1)));
    const rawProgress = Number(raw.progress);
    const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.min(target, rawProgress)) : 0;
    const rewardType = raw.rewardType === 'shards' ? 'shards' : 'fish';
    const maxReward = rewardType === 'shards' ? 20 : 1e15;
    const rawReward = Number(raw.rewardAmount);
    const rewardAmount = Number.isFinite(rawReward) ? Math.max(1, Math.min(maxReward, Math.floor(rawReward))) : 1;

    return {
      id,
      type,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : 'Colony Goal',
      desc: typeof raw.desc === 'string' ? raw.desc.slice(0, 240) : '',
      icon: typeof raw.icon === 'string' ? raw.icon.slice(0, 8) : '🎯',
      target,
      progress,
      rewardType,
      rewardAmount,
      rewardLabel: typeof raw.rewardLabel === 'string' ? raw.rewardLabel.slice(0, 80) : `+${rewardAmount}`,
      scaleTier: Math.max(1, Math.min(10000, Math.floor(Number(raw.scaleTier) || 1))),
      isBonus: Boolean(raw.isBonus),
      claimed: Boolean(raw.claimed)
    };
  }

  function sanitizeDailyObjectivesState(rawDaily, currentCycleKey) {
    const src = (rawDaily && typeof rawDaily === 'object') ? rawDaily : {};
    const streak = syncStreakForCycle(src, currentCycleKey);
    const permanentFishBonusPct = Math.max(
      0,
      Math.min(MAX_PERMANENT_BONUS_PCT, Math.floor(Number(src.permanentFishBonusPct) || 0))
    );
    const totalGoalsCompleted = Math.max(
      0,
      Math.min(MAX_GOALS_COMPLETED, Math.floor(Number(src.totalGoalsCompleted) || 0))
    );
    const dateKey = typeof src.dateKey === 'string' ? src.dateKey : '';
    const sameCycle = dateKey === currentCycleKey;

    let objectives = null;
    if (sameCycle && Array.isArray(src.objectives)) {
      const seenIds = new Set();
      const cleaned = [];
      for (const item of src.objectives) {
        const safe = sanitizeObjectiveEntry(item);
        if (safe && !seenIds.has(safe.id)) {
          seenIds.add(safe.id);
          cleaned.push(safe);
        }
        if (cleaned.length >= 10) break;
      }
      if (cleaned.length > 0) {
        objectives = cleaned;
      }
    }

    const dailyBonusCleared = sameCycle
      ? Math.max(0, Math.min(1000, Math.floor(Number(src.dailyBonusCleared) || 0)))
      : 0;
    const bonusObjective = sameCycle ? sanitizeObjectiveEntry(src.bonusObjective) : null;

    return {
      dateKey: currentCycleKey,
      sameCycle: Boolean(sameCycle && objectives),
      objectives,
      streakCount: streak.streakCount,
      bestStreak: streak.bestStreak,
      lastStreakDateKey: streak.lastStreakDateKey,
      permanentFishBonusPct,
      totalGoalsCompleted,
      dailyBonusCleared,
      bonusObjective
    };
  }

  return {
    DAILY_RESET_HOUR,
    MAX_STREAK,
    MAX_PERMANENT_BONUS_PCT,
    MAX_GOALS_COMPLETED,
    getCycleDateKey,
    shiftCycleDateKey,
    isConsecutiveCycleDay,
    syncStreakForCycle,
    applyStreakForGoalClaim,
    sanitizeObjectiveEntry,
    sanitizeDailyObjectivesState
  };
});
