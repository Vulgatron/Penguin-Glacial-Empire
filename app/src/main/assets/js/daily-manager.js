(function (root, factory) {
  const dailySystem = (typeof module === 'object' && module.exports)
    ? require('./daily-system.js')
    : (root.GlacialCore && root.GlacialCore.DailySystem);
  const economy = (typeof module === 'object' && module.exports)
    ? require('./economy.js')
    : (root.GlacialCore && root.GlacialCore.Economy);
  const api = factory(dailySystem, economy);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.DailyManager = api;
  if (typeof root !== 'undefined') {
    root.DailyObjectivesManager = api.DailyObjectivesManager;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CoreDaily, CoreEconomy) {
  'use strict';

  class DailyObjectivesManager {
    constructor(deps = {}) {
      this._deps = deps || {};
      this.dateKey = this.getCycleDateKey();
      this.streakCount = 0;
      this.bestStreak = 0;
      this.lastStreakDateKey = '';
      this.permanentFishBonusPct = 0;
      this.totalGoalsCompleted = 0;
      this.dailyBonusCleared = 0;
      this.bonusObjective = null;
      this.objectives = this.getDefaultObjectives(this.dateKey);
    }

    _getState() {
      if (typeof this._deps.getState === 'function') return this._deps.getState();
      return typeof globalThis !== 'undefined' ? globalThis.state : null;
    }

    _getSound() {
      if (typeof this._deps.getSound === 'function') return this._deps.getSound();
      return typeof globalThis !== 'undefined' ? globalThis.sound : null;
    }

    _showToast(msg, icon, opts) {
      const fn = this._deps.showToast || (typeof globalThis !== 'undefined' ? globalThis.showToast : null);
      if (typeof fn === 'function') fn(msg, icon, opts);
    }

    _openDailyTab() {
      const fn = this._deps.openDailyTab || (typeof globalThis !== 'undefined' ? globalThis.openDailyTabFromNotification : null);
      if (typeof fn === 'function') fn();
    }

    _updateSheetContent() {
      const fn = this._deps.updateSheetContent || (typeof globalThis !== 'undefined' ? globalThis.updateSheetContent : null);
      if (typeof fn === 'function') fn();
    }

    _updateHUD() {
      const fn = this._deps.updateHUD || (typeof globalThis !== 'undefined' ? globalThis.updateHUD : null);
      if (typeof fn === 'function') fn();
    }

    // Daily reset occurs every day at 3:00 AM local time.
    getCycleDateKey(nowMs = Date.now()) {
      if (CoreDaily) return CoreDaily.getCycleDateKey(nowMs);
      const shifted = new Date(nowMs - 3 * 3600 * 1000);
      const y = shifted.getFullYear();
      const m = String(shifted.getMonth() + 1).padStart(2, '0');
      const d = String(shifted.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    shiftCycleDateKey(dateKey, deltaDays = 0) {
      if (CoreDaily) return CoreDaily.shiftCycleDateKey(dateKey, deltaDays);
      const parts = String(dateKey || '').split('-').map(n => parseInt(n, 10));
      if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) {
        return '';
      }
      const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    getPreviousCycleDateKey(dateKey = this.dateKey) {
      return this.shiftCycleDateKey(dateKey, -1);
    }

    isConsecutiveCycleDay(prevKey, nextKey) {
      if (CoreDaily) return CoreDaily.isConsecutiveCycleDay(prevKey, nextKey);
      if (!prevKey || !nextKey) return false;
      return this.shiftCycleDateKey(prevKey, 1) === nextKey;
    }

    syncStreakStatusForCycle(currentKey = this.dateKey) {
      if (CoreDaily) {
        const synced = CoreDaily.syncStreakForCycle(this, currentKey);
        this.streakCount = synced.streakCount;
        this.bestStreak = synced.bestStreak;
        this.lastStreakDateKey = synced.lastStreakDateKey;
        return;
      }
      if (
        this.lastStreakDateKey &&
        this.lastStreakDateKey !== currentKey &&
        !this.isConsecutiveCycleDay(this.lastStreakDateKey, currentKey)
      ) {
        this.streakCount = 0;
      }
    }

    getTimeUntilNextResetText(nowMs = Date.now()) {
      const now = new Date(nowMs);
      const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3, 0, 0, 0);
      if (now.getTime() >= nextReset.getTime()) {
        nextReset.setDate(nextReset.getDate() + 1);
      }
      const diffMs = Math.max(0, nextReset.getTime() - nowMs);
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      return `${hrs}h ${mins}m`;
    }

    hashDateKey(dateKey) {
      let h = 2166136261 >>> 0;
      const str = String(dateKey || 'default');
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    createSeededRng(seedNum) {
      let s = (seedNum || 1) >>> 0;
      return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
      };
    }

    getGoalScaleTier(completedCount = this.totalGoalsCompleted) {
      const completed = Math.max(0, Number(completedCount) || 0);
      return 1 + Math.floor(completed / 3);
    }

    getGoalScaleMultiplier(completedCount = this.totalGoalsCompleted) {
      const completed = Math.max(0, Number(completedCount) || 0);
      return 1 + completed * 0.15;
    }

    formatGoalCount(num) {
      if (typeof this._deps.formatNumber === 'function') {
        return this._deps.formatNumber(num);
      }
      if (CoreEconomy && typeof CoreEconomy.formatNumber === 'function') {
        return CoreEconomy.formatNumber(num);
      }
      return Number(num || 0).toLocaleString();
    }

    formatObjectiveDesc(type, target, fallback = '') {
      const fmt = this.formatGoalCount(target);
      switch (type) {
        case 'slides':
          return `Perform ${fmt} belly slide${target === 1 ? '' : 's'} across ice sheets`;
        case 'collect_fish':
          return `Collect ${fmt} fish from diving, hauls, or tapping`;
        case 'taps':
          return `Tap the ice shelf or cheer penguins ${fmt} time${target === 1 ? '' : 's'}`;
        case 'penguin_taps':
          return `Cheer directly on ${fmt} penguin${target === 1 ? '' : 's'} on the ice`;
        case 'dives':
          return `Complete ${fmt} dive${target === 1 ? '' : 's'} at fishing holes`;
        case 'aurora':
          return `Claim ${fmt} Aurora Blessing event${target === 1 ? '' : 's'}`;
        case 'recruits':
          return `Recruit ${fmt} new penguin${target === 1 ? '' : 's'} to the squad`;
        case 'tech_upgrades':
          return `Research ${fmt} Glacier Tech upgrade${target === 1 ? '' : 's'}`;
        case 'blizzard_fish':
          return `Gather ${fmt} fish during a Blizzard storm`;
        default:
          return fallback;
      }
    }

    scaleObjectiveTemplate(template, completedCount = this.totalGoalsCompleted, options = {}) {
      const completed = Math.max(0, Number(completedCount) || 0);
      const tier = this.getGoalScaleTier(completed);

      const fishTargetMult = 1 + completed * 0.25 + Math.pow(completed, 1.25) * 0.08;
      const actionTargetMult = 1 + Math.min(4.0, completed * 0.12);
      const rewardFishMult = 1 + completed * 0.30 + Math.pow(completed, 1.25) * 0.10;

      let scaledTarget = template.target;
      if (template.type === 'collect_fish' || template.type === 'blizzard_fish') {
        const raw = template.target * fishTargetMult;
        const step = raw >= 20000 ? 500 : (raw >= 5000 ? 100 : 50);
        scaledTarget = Math.max(template.target, Math.round(raw / step) * step);
      } else if (
        template.type === 'taps' ||
        template.type === 'penguin_taps' ||
        template.type === 'dives' ||
        template.type === 'slides'
      ) {
        scaledTarget = Math.max(template.target, Math.round(template.target * actionTargetMult));
      } else if (template.type === 'recruits' || template.type === 'tech_upgrades') {
        scaledTarget = Math.min(template.target + 8, template.target + Math.floor(completed / 4));
      } else if (template.type === 'aurora') {
        scaledTarget = Math.min(5, template.target + Math.floor(completed / 8));
      }

      let scaledRewardAmount = template.rewardAmount;
      let rewardLabel = template.rewardLabel;
      if (template.rewardType === 'fish') {
        const rawReward = template.rewardAmount * rewardFishMult;
        const rStep = rawReward >= 10000 ? 250 : (rawReward >= 2000 ? 50 : 25);
        scaledRewardAmount = Math.max(template.rewardAmount, Math.round(rawReward / rStep) * rStep);
        rewardLabel = `+${this.formatGoalCount(scaledRewardAmount)} 🐟 Fish`;
      } else if (template.rewardType === 'shards') {
        scaledRewardAmount = Math.min(5, template.rewardAmount + Math.floor(completed / 6));
        rewardLabel = `+${scaledRewardAmount} 💎 Frost Essence`;
      }

      const desc = this.formatObjectiveDesc(template.type, scaledTarget, template.desc);

      return {
        ...template,
        id: options.id || template.id,
        title: options.title || template.title,
        target: scaledTarget,
        desc,
        rewardAmount: scaledRewardAmount,
        rewardLabel,
        scaleTier: tier,
        isBonus: Boolean(options.isBonus),
        progress: 0,
        claimed: false
      };
    }

    getTemplateCategories() {
      return [
        [
          { id: 'obj_slides_5', type: 'slides', title: 'Glacial Sledder', desc: 'Perform 5 belly slides across ice sheets', icon: '🛷', target: 5, rewardType: 'fish', rewardAmount: 300, rewardLabel: '+300 🐟 Fish' },
          { id: 'obj_slides_14', type: 'slides', title: 'Belly-Slide Blitz', desc: 'Perform 14 belly slides across ice sheets', icon: '🛷', target: 14, rewardType: 'fish', rewardAmount: 850, rewardLabel: '+850 🐟 Fish' }
        ],
        [
          { id: 'obj_fish_500', type: 'collect_fish', title: 'Tundra Catch', desc: 'Collect 500 fish from diving or tapping', icon: '🐟', target: 500, rewardType: 'fish', rewardAmount: 500, rewardLabel: '+500 🐟 Fish' },
          { id: 'obj_fish_2500', type: 'collect_fish', title: 'Bountiful Ice Haul', desc: 'Collect 2,500 fish from diving or tapping', icon: '🐟', target: 2500, rewardType: 'fish', rewardAmount: 1800, rewardLabel: '+1.8K 🐟 Fish' },
          { id: 'obj_fish_10k', type: 'collect_fish', title: 'Glacier Feast', desc: 'Collect 10,000 fish for the colony depot', icon: '🐠', target: 10000, rewardType: 'shards', rewardAmount: 1, rewardLabel: '+1 💎 Frost Essence' }
        ],
        [
          { id: 'obj_taps_20', type: 'taps', title: 'Cheering Flipper', desc: 'Tap the screen or cheer penguins 20 times', icon: '👆', target: 20, rewardType: 'fish', rewardAmount: 350, rewardLabel: '+350 🐟 Fish' },
          { id: 'obj_taps_50', type: 'taps', title: 'Rhythmic Chime', desc: 'Tap the ice shelf or penguins 50 times', icon: '👆', target: 50, rewardType: 'fish', rewardAmount: 900, rewardLabel: '+900 🐟 Fish' }
        ],
        [
          { id: 'obj_ptap_8', type: 'penguin_taps', title: 'Penguin Whisperer', desc: 'Cheer directly on 8 penguins on the ice', icon: '🐧', target: 8, rewardType: 'fish', rewardAmount: 550, rewardLabel: '+550 🐟 Fish' },
          { id: 'obj_ptap_18', type: 'penguin_taps', title: 'Morale Captain', desc: 'Cheer directly on 18 penguins on the ice', icon: '💖', target: 18, rewardType: 'fish', rewardAmount: 1200, rewardLabel: '+1.2K 🐟 Fish' }
        ],
        [
          { id: 'obj_dives_8', type: 'dives', title: 'Ice Hole Diver', desc: 'Complete 8 dives at fishing holes', icon: '🤿', target: 8, rewardType: 'fish', rewardAmount: 600, rewardLabel: '+600 🐟 Fish' },
          { id: 'obj_dives_22', type: 'dives', title: 'Abyssal Plunger', desc: 'Complete 22 dives at fishing holes', icon: '🤿', target: 22, rewardType: 'fish', rewardAmount: 1600, rewardLabel: '+1.6K 🐟 Fish' }
        ],
        [
          { id: 'obj_aurora_1', type: 'aurora', title: 'Aurora Seeker', desc: 'Claim 1 Aurora Blessing event', icon: '✨', target: 1, rewardType: 'shards', rewardAmount: 1, rewardLabel: '+1 💎 Frost Essence' },
          { id: 'obj_aurora_2', type: 'aurora', title: 'Cosmic Watcher', desc: 'Claim 2 Aurora Blessing events', icon: '🌌', target: 2, rewardType: 'shards', rewardAmount: 2, rewardLabel: '+2 💎 Frost Essence' }
        ],
        [
          { id: 'obj_recruits_2', type: 'recruits', title: 'Colony Expansion', desc: 'Recruit 2 new penguins to the squad', icon: '🧭', target: 2, rewardType: 'fish', rewardAmount: 700, rewardLabel: '+700 🐟 Fish' },
          { id: 'obj_recruits_5', type: 'recruits', title: 'Squad Marshal', desc: 'Recruit 5 new penguins to the squad', icon: '🏅', target: 5, rewardType: 'shards', rewardAmount: 1, rewardLabel: '+1 💎 Frost Essence' }
        ],
        [
          { id: 'obj_tech_1', type: 'tech_upgrades', title: 'Polar Researcher', desc: 'Research 1 Glacier Tech upgrade', icon: '🔬', target: 1, rewardType: 'fish', rewardAmount: 750, rewardLabel: '+750 🐟 Fish' },
          { id: 'obj_tech_3', type: 'tech_upgrades', title: 'Cryo Innovator', desc: 'Research 3 Glacier Tech upgrades', icon: '🔬', target: 3, rewardType: 'shards', rewardAmount: 1, rewardLabel: '+1 💎 Frost Essence' }
        ],
        [
          { id: 'obj_blizzard_300', type: 'blizzard_fish', title: 'Storm Harvester', desc: 'Gather 300 fish during a Blizzard storm', icon: '🌨️', target: 300, rewardType: 'fish', rewardAmount: 950, rewardLabel: '+950 🐟 Fish' }
        ]
      ];
    }

    getDefaultObjectives(dateKey = this.dateKey, completedCount = this.totalGoalsCompleted) {
      const templatesByCategory = this.getTemplateCategories();
      const rng = this.createSeededRng(this.hashDateKey(dateKey));

      const candidates = templatesByCategory.map(variants => {
        const picked = variants[Math.floor(rng() * variants.length)];
        return this.scaleObjectiveTemplate(picked, completedCount);
      });

      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = candidates[i];
        candidates[i] = candidates[j];
        candidates[j] = tmp;
      }

      const selected = candidates.slice(0, 5);
      if (!selected.some(o => o.rewardType === 'shards')) {
        const shardFallback = candidates.find(o => o.rewardType === 'shards');
        if (shardFallback) {
          selected[selected.length - 1] = shardFallback;
        }
      }
      return selected;
    }

    createScaledBonusObjective() {
      const activeCategories = this.getTemplateCategories().filter(variants =>
        ['slides', 'collect_fish', 'taps', 'penguin_taps', 'dives'].includes(variants[0].type)
      );
      const pool = activeCategories.flat();
      const seed = this.hashDateKey(`${this.dateKey}_bonus_${this.dailyBonusCleared}_${this.totalGoalsCompleted}`);
      const rng = this.createSeededRng(seed);
      const picked = pool[Math.floor(rng() * pool.length)] || pool[0];
      const bonusNum = (this.dailyBonusCleared || 0) + 1;
      return this.scaleObjectiveTemplate(picked, this.totalGoalsCompleted, {
        id: `bonus_${this.dateKey}_${bonusNum}_${this.totalGoalsCompleted}`,
        title: `${picked.title} (Bonus #${bonusNum})`,
        isBonus: true
      });
    }

    ensureBonusObjectiveState() {
      const allDailyClaimed = Array.isArray(this.objectives) && this.objectives.length > 0 && this.objectives.every(o => o.claimed);
      if (allDailyClaimed && !this.bonusObjective) {
        this.bonusObjective = this.createScaledBonusObjective();
      }
    }

    checkDailyReset(nowMs = Date.now()) {
      const currentKey = this.getCycleDateKey(nowMs);
      this.syncStreakStatusForCycle(currentKey);
      if (this.dateKey !== currentKey) {
        this.dateKey = currentKey;
        this.dailyBonusCleared = 0;
        this.bonusObjective = null;
        this.objectives = this.getDefaultObjectives(currentKey, this.totalGoalsCompleted);
        const st = this._getState();
        if (st && typeof st.save === 'function') {
          st.save();
          if (st.currentTab === 'daily') {
            this._updateSheetContent();
          }
        }
        this._showToast('📅 Daily Goals refreshed for the new day!', '🎯', {
          category: 'goal',
          onClick: () => this._openDailyTab(),
          durationMs: 4200
        });
        return true;
      }
      return false;
    }

    track(type, amount = 1) {
      this.checkDailyReset();
      let updated = false;
      const targets = Array.isArray(this.objectives) ? [...this.objectives] : [];
      if (this.bonusObjective && !this.bonusObjective.claimed) {
        targets.push(this.bonusObjective);
      }
      const snd = this._getSound();
      targets.forEach(obj => {
        if (obj.type === type && !obj.claimed) {
          if (obj.progress < obj.target) {
            obj.progress = Math.min(obj.target, obj.progress + amount);
            updated = true;
            if (obj.progress >= obj.target) {
              this._showToast(`🎯 Objective Ready: "${obj.title}"!`, '🎁', {
                category: 'goal',
                onClick: () => this._openDailyTab(),
                durationMs: 4500
              });
              if (snd && snd.playChirp) snd.playChirp();
            }
          }
        }
      });
      const st = this._getState();
      if (updated && st && st.currentTab === 'daily') {
        this._updateSheetContent();
      }
    }

    claim(id, nowMs = Date.now(), silent = false) {
      let obj = this.objectives.find(o => o.id === id);
      if (!obj && this.bonusObjective && this.bonusObjective.id === id) {
        obj = this.bonusObjective;
      }
      if (!obj || obj.claimed || obj.progress < obj.target) return false;

      const st = this._getState();
      const snd = this._getSound();

      obj.claimed = true;
      this.totalGoalsCompleted = (this.totalGoalsCompleted || 0) + 1;
      if (!silent && snd && snd.playLevelUp) snd.playLevelUp();

      const cycleKey = this.dateKey || this.getCycleDateKey(nowMs);
      this.syncStreakStatusForCycle(cycleKey);

      let streakToast = '';
      if (CoreDaily) {
        const streakRes = CoreDaily.applyStreakForGoalClaim(this, cycleKey);
        this.streakCount = streakRes.streakCount;
        this.bestStreak = streakRes.bestStreak;
        this.lastStreakDateKey = streakRes.lastStreakDateKey;
        this.permanentFishBonusPct = streakRes.permanentFishBonusPct;
        streakToast = streakRes.streakToast;
      } else if (this.lastStreakDateKey !== cycleKey) {
        const isConsecutive = this.isConsecutiveCycleDay(this.lastStreakDateKey, cycleKey);
        if (isConsecutive) {
          this.streakCount = (this.streakCount || 0) + 1;
          const bonusGain = 2;
          this.permanentFishBonusPct = (this.permanentFishBonusPct || 0) + bonusGain;
          streakToast = `🔥 ${this.streakCount}-Day Streak! +${bonusGain}% Permanent Fish Bonus (+${this.permanentFishBonusPct}% total)!`;
        } else {
          this.streakCount = 1;
          streakToast = '🔥 1-Day Streak started! Complete a goal tomorrow for +2% Permanent Fish!';
        }
        this.lastStreakDateKey = cycleKey;
        if (this.streakCount > (this.bestStreak || 0)) {
          this.bestStreak = this.streakCount;
        }
      }

      if (obj.rewardType === 'fish' && st) {
        if (typeof st.addFish === 'function') st.addFish(obj.rewardAmount);
        if (!silent && snd && snd.triggerHaptic) snd.triggerHaptic('collect');
      } else if (obj.rewardType === 'shards' && st) {
        const safeShards = CoreEconomy ? CoreEconomy.sanitizeInteger(obj.rewardAmount, 1, 1, 100) : Math.max(1, Math.floor(obj.rewardAmount || 1));
        st.prestigeShards = (st.prestigeShards || 0) + safeShards;
        st.totalEssenceEarned = (st.totalEssenceEarned || 0) + safeShards;
        if (!silent && snd && snd.triggerHaptic) snd.triggerHaptic('collect');
      }

      if (obj.isBonus) {
        this.dailyBonusCleared = (this.dailyBonusCleared || 0) + 1;
        this.bonusObjective = this.createScaledBonusObjective();
      } else {
        this.ensureBonusObjectiveState();
      }

      if (!silent) {
        if (st) {
          if (typeof st.calculateDPS === 'function') st.calculateDPS();
          if (typeof st.save === 'function') st.save({ immediate: true });
        }
        this._showToast(streakToast || `🎁 Claimed ${obj.rewardLabel}!`, '🎁', { category: 'goal' });
        this._updateSheetContent();
        this._updateHUD();
      }
      return { rewardType: obj.rewardType, rewardAmount: obj.rewardAmount, streakToast };
    }

    claimAllReady(nowMs = Date.now()) {
      const readyIds = this.objectives
        .filter(o => !o.claimed && o.progress >= o.target)
        .map(o => o.id);
      if (this.bonusObjective && !this.bonusObjective.claimed && this.bonusObjective.progress >= this.bonusObjective.target) {
        readyIds.push(this.bonusObjective.id);
      }
      if (readyIds.length === 0) return 0;

      let claimedCount = 0;
      let totalFish = 0;
      let totalShards = 0;
      let streakMsg = '';

      readyIds.forEach(id => {
        const res = this.claim(id, nowMs, true);
        if (res) {
          claimedCount++;
          if (res.rewardType === 'fish') totalFish += res.rewardAmount;
          if (res.rewardType === 'shards') totalShards += res.rewardAmount;
          if (res.streakToast) streakMsg = res.streakToast;
        }
      });

      if (claimedCount > 0) {
        const snd = this._getSound();
        const st = this._getState();
        if (snd) {
          if (snd.playLevelUp) snd.playLevelUp();
          if (snd.triggerHaptic) snd.triggerHaptic('collect');
        }
        if (st) {
          if (typeof st.calculateDPS === 'function') st.calculateDPS();
          if (typeof st.save === 'function') st.save();
        }
        const parts = [];
        if (totalFish > 0) parts.push(`+${this.formatGoalCount(totalFish)} 🐟`);
        if (totalShards > 0) parts.push(`+${totalShards} 💎`);
        const summary = `🎁 Claimed ${claimedCount} Goals (${parts.join(' & ')})!`;
        this._showToast(streakMsg ? `${summary} ${streakMsg}` : summary, '🎁', { category: 'goal', durationMs: 3800 });
        this._updateSheetContent();
        this._updateHUD();
      }
      return claimedCount;
    }

    getClaimableCount() {
      let count = this.objectives.filter(o => !o.claimed && o.progress >= o.target).length;
      if (this.bonusObjective && !this.bonusObjective.claimed && this.bonusObjective.progress >= this.bonusObjective.target) {
        count += 1;
      }
      return count;
    }
  }

  return {
    DailyObjectivesManager
  };
});
