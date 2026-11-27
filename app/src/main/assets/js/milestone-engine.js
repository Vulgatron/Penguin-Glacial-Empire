(function (root, factory) {
  const economy = (typeof module === 'object' && module.exports)
    ? require('./economy.js')
    : (root.GlacialCore && root.GlacialCore.Economy);
  const wardrobe = (typeof module === 'object' && module.exports)
    ? require('./wardrobe.js')
    : (root.GlacialCore && root.GlacialCore.Wardrobe);
  const api = factory(economy, wardrobe);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.MilestoneEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Economy, Wardrobe) {
  'use strict';

  const ALL_TAB_IDS = ['penguins', 'tech', 'glacier', 'daily', 'log', 'prestige', 'stats', 'settings'];
  const STARTER_TAB_IDS = ['penguins', 'stats', 'settings'];
  const READY_NOW_BONUS = 200;

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function safeInt(v) {
    return Math.max(0, Math.floor(safeNum(v)));
  }

  function fmt(n) {
    if (Economy && typeof Economy.formatNumber === 'function') {
      return Economy.formatNumber(n);
    }
    return String(Math.floor(safeNum(n)));
  }

  function extractSnapshot(state = {}) {
    const penguins = state.penguins || {};
    const speciesCount = (id) => safeInt(penguins[id] && penguins[id].count);
    const adelie = speciesCount('adelie');
    const gentoo = speciesCount('gentoo');
    const chinstrap = speciesCount('chinstrap');
    const emperor = speciesCount('emperor');
    const cyber = speciesCount('cyber');
    const totalPenguins = adelie + gentoo + chinstrap + emperor + cyber;

    const tech = state.tech || {};
    let totalTechLevels = 0;
    for (const k of Object.keys(tech)) {
      totalTechLevels += safeInt(tech[k]);
    }

    const dailyObj = state.dailyObjectives || {};
    const dailyStreak = safeInt(dailyObj.streak);
    const dailiesCompleted = Array.isArray(dailyObj.objectives)
      ? dailyObj.objectives.filter(o => o && (o.claimed || o.completed)).length
      : 0;

    let speechCount = 0;
    if (state.speechLog && typeof state.speechLog === 'object') {
      for (const k of Object.keys(state.speechLog)) {
        if (Array.isArray(state.speechLog[k])) speechCount += state.speechLog[k].length;
      }
    }

    const fish = safeNum(state.fish);
    const runFish = Math.max(fish, safeNum(state.runFish));
    const lifetimeFish = Math.max(runFish, safeNum(state.lifetimeFish));
    const glacierLevel = Math.max(1, safeInt(state.glacierLevel || 1));
    const iglooTier = safeInt(state.iglooTier);
    const fishingHolesUnlocked = Math.max(3, Math.min(6, safeInt(state.fishingHolesUnlocked || 3)));
    const totalRebirths = safeInt(state.totalRebirths);
    const prestigeShards = safeInt(state.prestigeShards);
    const pendingShards = Economy && typeof Economy.calculatePendingPrestigeShards === 'function'
      ? Economy.calculatePendingPrestigeShards(runFish)
      : (runFish >= 150000 ? Math.floor(Math.cbrt(runFish / 150000)) : 0);
    const skyEventsCaught = safeInt(state.skyEventsCaught);
    const paradesWitnessed = safeInt(state.paradesWitnessed);
    const unlockedHats = Array.isArray(state.unlockedHats) ? state.unlockedHats : ['none'];
    const ownedPaidHats = unlockedHats.filter(id => id && id !== 'none').length;

    const nextIglooDef = Economy && typeof Economy.getNextIglooTierDef === 'function'
      ? Economy.getNextIglooTierDef(iglooTier)
      : null;
    const nextHoleDef = Economy && typeof Economy.getNextFishingHoleDef === 'function'
      ? Economy.getNextFishingHoleDef(fishingHolesUnlocked)
      : null;

    const iglooTier1Def = Economy && typeof Economy.getIglooTierDef === 'function'
      ? Economy.getIglooTierDef(1)
      : { cost: 65000, name: 'Lantern-Lit Igloo' };
    const iglooTier3Def = Economy && typeof Economy.getIglooTierDef === 'function'
      ? Economy.getIglooTierDef(3)
      : { cost: 45000000, name: 'Frosted Citadel' };
    const hole4Def = Economy && Array.isArray(Economy.FISHING_HOLE_DEFS) && Economy.FISHING_HOLE_DEFS[3]
      ? Economy.FISHING_HOLE_DEFS[3]
      : { cost: 15000, name: 'Western Shelf Basin' };

    return {
      fish,
      runFish,
      lifetimeFish,
      glacierLevel,
      iglooTier,
      fishingHolesUnlocked,
      totalRebirths,
      prestigeShards,
      pendingShards,
      skyEventsCaught,
      paradesWitnessed,
      unlockedHats,
      ownedPaidHats,
      adelie,
      gentoo,
      chinstrap,
      emperor,
      cyber,
      totalPenguins,
      totalTechLevels,
      dailyStreak,
      dailiesCompleted,
      speechCount,
      nextIglooDef,
      nextHoleDef,
      iglooTier1Cost: safeNum(iglooTier1Def.cost || 65000),
      iglooTier3Cost: safeNum(iglooTier3Def.cost || 45000000),
      hole4Cost: safeNum(hole4Def.cost || 15000),
      completedPermanentMilestones: Array.isArray(state.completedPermanentMilestones)
        ? state.completedPermanentMilestones
        : [],
      completedRunMilestones: Array.isArray(state.completedRunMilestones)
        ? state.completedRunMilestones
        : [],
      skippedMilestones: Array.isArray(state.skippedMilestones)
        ? state.skippedMilestones
        : []
    };
  }

  /**
   * Derives unlocked tabs monotonically from progression (earned tabs never relock).
   */
  function evaluateUnlockedTabs(state = {}, existingTabs = []) {
    const snap = extractSnapshot(state);
    const unlocked = new Set(STARTER_TAB_IDS);

    if (Array.isArray(existingTabs)) {
      for (const tabId of existingTabs) {
        if (ALL_TAB_IDS.includes(tabId)) unlocked.add(tabId);
      }
    }
    if (Array.isArray(state.unlockedTabs)) {
      for (const tabId of state.unlockedTabs) {
        if (ALL_TAB_IDS.includes(tabId)) unlocked.add(tabId);
      }
    }

    if (snap.totalPenguins >= 3 || snap.lifetimeFish >= 35 || snap.totalTechLevels >= 1) {
      unlocked.add('tech');
    }
    if (snap.totalTechLevels >= 1 || snap.lifetimeFish >= 150 || snap.dailyStreak >= 1 || snap.dailiesCompleted >= 1) {
      unlocked.add('daily');
    }
    if (snap.glacierLevel >= 2 || snap.totalPenguins >= 8 || snap.speechCount >= 1) {
      unlocked.add('log');
    }
    if (
      snap.lifetimeFish >= 1500 ||
      snap.glacierLevel >= 3 ||
      snap.chinstrap >= 1 ||
      snap.iglooTier >= 1 ||
      snap.fishingHolesUnlocked > 3
    ) {
      unlocked.add('glacier');
    }
    if (
      snap.lifetimeFish >= 25000 ||
      snap.emperor >= 1 ||
      snap.totalRebirths >= 1 ||
      snap.prestigeShards > 0
    ) {
      unlocked.add('prestige');
    }

    return ALL_TAB_IDS.filter(id => unlocked.has(id));
  }

  /**
   * Returns visible tabs for the bottom menu.
   * NOTE: showAllTabs controls tab visibility ONLY—it never weakens actual unlock/cost gates.
   */
  function getVisibleTabs(state = {}) {
    if (state && state.showAllTabs) {
      return ALL_TAB_IDS.slice();
    }
    return evaluateUnlockedTabs(state);
  }

  // 12 Curated Guided Milestones with explicit permanent vs run scope and discrete impact tiers
  const GUIDED_MILESTONES = [
    {
      id: 'recruit_5_adelie',
      orderIndex: 1,
      scope: 'permanent',
      icon: '🐧',
      title: 'Recruit 5 Adélie Scouts',
      whyItMatters: 'Builds steady early fish flow and unlocks the Tech Lab.',
      unlocksNext: '🔬 Tech Lab & faster dives',
      targetTab: 'penguins',
      targetCardId: 'penguin-card-adelie',
      getImpactTier: () => 220,
      isCompleted: (s) => s.adelie >= 5 || s.totalPenguins >= 6 || s.totalRebirths >= 1,
      isEligible: () => true,
      isIrrelevant: (s) => s.totalRebirths >= 1,
      isReadyNow: (s) => s.fish >= 15,
      getProgress: (s) => {
        const cur = Math.min(5, s.adelie);
        return { current: cur, target: 5, ratio: cur / 5, label: `${cur}/5 Adélie` };
      }
    },
    {
      id: 'first_tech_upgrade',
      orderIndex: 2,
      scope: 'permanent',
      icon: '🔬',
      title: 'Research First Tech Upgrade',
      whyItMatters: 'Multiplies every penguin catch across your whole colony.',
      unlocksNext: '🎯 Daily Objectives & streaks',
      targetTab: 'tech',
      targetCardId: 'tech-card-thermal_parkas',
      getImpactTier: () => 240,
      isCompleted: (s) => s.totalTechLevels >= 1 || s.totalRebirths >= 1,
      isEligible: (s) => s.totalPenguins >= 3 || s.lifetimeFish >= 35,
      isIrrelevant: (s) => s.totalRebirths >= 1,
      isReadyNow: (s) => s.fish >= 50,
      getProgress: (s) => {
        const cur = Math.min(1, s.totalTechLevels);
        return { current: cur, target: 1, ratio: cur, label: `${cur}/1 Tech` };
      }
    },
    {
      id: 'recruit_first_gentoo',
      orderIndex: 3,
      scope: 'permanent',
      icon: '🛷',
      title: 'Recruit a Gentoo Skater',
      whyItMatters: '5× Adélie catch and belly-slides faster under Clear skies.',
      unlocksNext: '☀️ Clear-sky speed synergy',
      targetTab: 'penguins',
      targetCardId: 'penguin-card-gentoo',
      getImpactTier: () => 260,
      isCompleted: (s) => s.gentoo >= 1 || s.totalRebirths >= 1,
      isEligible: (s) => s.lifetimeFish >= 25 || s.totalPenguins >= 3,
      isIrrelevant: (s) => s.totalRebirths >= 1,
      isReadyNow: (s) => s.fish >= 100,
      getProgress: (s) => {
        const ratio = s.gentoo >= 1 ? 1 : Math.min(0.99, s.fish / 100);
        return { current: s.gentoo >= 1 ? 100 : Math.floor(s.fish), target: 100, ratio, label: s.gentoo >= 1 ? '1/1' : `${fmt(s.fish)}/100 🐟` };
      }
    },
    {
      id: 'reach_glacier_lv2',
      orderIndex: 4,
      scope: 'permanent',
      icon: '✨',
      title: 'Reach Glacier Level 2',
      whyItMatters: 'Triggers your first Aurora Blessing perk choice and Colony Log.',
      unlocksNext: '💬 Colony Log & Aurora Perks',
      targetTab: 'penguins',
      targetCardId: 'penguin-card-gentoo',
      getImpactTier: () => 250,
      isCompleted: (s) => s.glacierLevel >= 2 || s.totalRebirths >= 1,
      isEligible: (s) => s.totalPenguins >= 3 || s.lifetimeFish >= 40,
      isIrrelevant: (s) => s.totalRebirths >= 1,
      isReadyNow: () => false,
      getProgress: (s) => {
        const req = Economy && Economy.calculateLevelRequirement ? Economy.calculateLevelRequirement(1) : 198;
        const ratio = s.glacierLevel >= 2 ? 1 : Math.min(0.99, s.runFish / Math.max(1, req));
        return { current: Math.floor(s.runFish), target: req, ratio, label: `Lv.${s.glacierLevel}/2` };
      }
    },
    {
      id: 'recruit_first_chinstrap',
      orderIndex: 5,
      scope: 'permanent',
      icon: '🤿',
      title: 'Recruit a Chinstrap Diver',
      whyItMatters: 'Rapid deep-sea diver with +40% bonus during Light Snow.',
      unlocksNext: '🏰 Glacier Sanctuary tab',
      targetTab: 'penguins',
      targetCardId: 'penguin-card-chinstrap',
      getImpactTier: () => 280,
      isCompleted: (s) => s.chinstrap >= 1 || s.totalRebirths >= 1,
      isEligible: (s) => s.gentoo >= 1 || s.lifetimeFish >= 250,
      isIrrelevant: (s) => s.totalRebirths >= 1,
      isReadyNow: (s) => s.fish >= 800,
      getProgress: (s) => {
        const ratio = s.chinstrap >= 1 ? 1 : Math.min(0.99, s.fish / 800);
        return { current: Math.floor(s.fish), target: 800, ratio, label: `${fmt(s.fish)}/800 🐟` };
      }
    },
    {
      id: 'recruit_first_emperor',
      orderIndex: 6,
      scope: 'permanent',
      icon: '👑',
      title: 'Recruit an Emperor Monarch',
      whyItMatters: 'Inspires nearby penguins and surges during polar Blizzards.',
      unlocksNext: '✨ Prestige tab preview',
      targetTab: 'penguins',
      targetCardId: 'penguin-card-emperor',
      getImpactTier: () => 300,
      isCompleted: (s) => s.emperor >= 1 || s.totalRebirths >= 1,
      isEligible: (s) => s.chinstrap >= 1 || s.lifetimeFish >= 1200,
      isIrrelevant: (s) => s.totalRebirths >= 1,
      isReadyNow: (s) => s.fish >= 5000,
      getProgress: (s) => {
        const ratio = s.emperor >= 1 ? 1 : Math.min(0.99, s.fish / 5000);
        return { current: Math.floor(s.fish), target: 5000, ratio, label: `${fmt(s.fish)}/5K 🐟` };
      }
    },
    {
      id: 'carve_fourth_hole',
      orderIndex: 7,
      scope: 'run',
      icon: '🕳️',
      title: 'Carve 4th Fishing Hole',
      whyItMatters: 'Unlocked at 5 Rebirths! Adds +10 diving slots and expands Hotspot rotation.',
      unlocksNext: '🕳️ 4/6 Fishing Holes & Colony Pennants',
      targetTab: 'glacier',
      targetCardId: 'glacier-fishing-holes-card',
      getImpactTier: () => 310,
      isCompleted: (s) => s.fishingHolesUnlocked >= 4,
      isEligible: (s) => s.totalRebirths >= 5,
      isIrrelevant: () => false,
      isReadyNow: (s) => s.totalRebirths >= 5 && s.fish >= s.hole4Cost,
      getProgress: (s) => {
        const target = Math.max(1, s.hole4Cost);
        const ratio = s.fishingHolesUnlocked >= 4 ? 1 : Math.min(0.99, s.fish / target);
        return { current: Math.floor(s.fish), target, ratio, label: `${fmt(s.fish)}/${fmt(target)} 🐟` };
      }
    },
    {
      id: 'castle_tier_1',
      orderIndex: 8,
      scope: 'run',
      icon: '🏮',
      title: 'Upgrade to Lantern-Lit Igloo',
      whyItMatters: 'Transforms your snow depot and lights up Frost Lanterns before Rebirth.',
      unlocksNext: '🏮 Ice Castle Tier 1 & Lantern Path',
      targetTab: 'glacier',
      targetCardId: 'glacier-igloo-castle-card',
      // Deliberately outranks First Rebirth before Castle Tier 1 is experienced on Run 1
      getImpactTier: (s) => (s.totalRebirths === 0 ? 380 : 250),
      isCompleted: (s) => s.iglooTier >= 1,
      isEligible: (s) => s.emperor >= 1 || s.lifetimeFish >= 12000 || s.fishingHolesUnlocked >= 4,
      isIrrelevant: () => false,
      isReadyNow: (s) => s.fish >= s.iglooTier1Cost,
      getProgress: (s) => {
        const target = Math.max(1, s.iglooTier1Cost);
        const ratio = s.iglooTier >= 1 ? 1 : Math.min(0.99, s.fish / target);
        return { current: Math.floor(s.fish), target, ratio, label: `${fmt(s.fish)}/${fmt(target)} 🐟` };
      }
    },
    {
      id: 'catch_sky_or_parade',
      orderIndex: 9,
      scope: 'permanent',
      icon: '🌠',
      title: 'Catch 3 Rare Sky/Ice Events',
      whyItMatters: 'Rare Shooting Stars and Krill Swarms grant instant fish and surge active Hotspots.',
      unlocksNext: '⚡ Rare Event Mastery',
      targetTab: 'stats',
      targetCardId: 'stats-colony-activity-card',
      getImpactTier: () => 210,
      isCompleted: (s) => s.skyEventsCaught >= 3 || s.paradesWitnessed >= 1,
      isEligible: (s) => s.glacierLevel >= 2 || s.totalPenguins >= 8,
      isIrrelevant: () => false,
      isReadyNow: () => false,
      getProgress: (s) => {
        const cur = Math.min(3, s.skyEventsCaught);
        return { current: cur, target: 3, ratio: cur / 3, label: `${cur}/3 Events` };
      }
    },
    {
      id: 'first_rebirth',
      orderIndex: 10,
      scope: 'permanent',
      icon: '💎',
      title: 'Perform First Glacial Rebirth',
      whyItMatters: 'Earns permanent Frost Essence (+1.25% each) and raises the Rebirth Monument.',
      unlocksNext: '🌌 Rebirth Star Monument',
      targetTab: 'prestige',
      targetCardId: 'prestige-rebirth-btn',
      // Recommended AFTER Castle Tier 1 on Run 1, while Rebirth remains usable at 150K anytime
      getImpactTier: (s) => (s.iglooTier >= 1 ? 420 : 270),
      isCompleted: (s) => s.totalRebirths >= 1,
      isEligible: (s) => s.lifetimeFish >= 25000 || s.emperor >= 1 || s.iglooTier >= 1,
      isIrrelevant: () => false,
      isReadyNow: (s) => s.pendingShards >= 1 && s.iglooTier >= 1,
      getProgress: (s) => {
        const target = 150000;
        const ratio = s.totalRebirths >= 1 ? 1 : Math.min(1, s.runFish / target);
        return { current: Math.floor(s.runFish), target, ratio, label: `${fmt(s.runFish)}/150K 🐟` };
      }
    },
    {
      id: 'castle_tier_3',
      orderIndex: 11,
      scope: 'run',
      icon: '🏰',
      title: 'Build the Frosted Citadel',
      whyItMatters: 'Raises twin watch turrets, colony banners, and Aurora Crystal Monoliths.',
      unlocksNext: '💎 Aurora Crystal Monoliths',
      targetTab: 'glacier',
      targetCardId: 'glacier-igloo-castle-card',
      getImpactTier: () => 290,
      isCompleted: (s) => s.iglooTier >= 3,
      isEligible: (s) => s.iglooTier >= 1 || s.totalRebirths >= 1,
      isIrrelevant: () => false,
      isReadyNow: (s) => s.iglooTier === 2 && s.fish >= s.iglooTier3Cost,
      getProgress: (s) => {
        const cur = Math.min(3, s.iglooTier);
        return { current: cur, target: 3, ratio: cur / 3, label: `Tier ${cur}/3` };
      }
    },
    {
      id: 'first_wardrobe_accessory',
      orderIndex: 12,
      scope: 'permanent',
      icon: '🧣',
      title: 'Unlock a Colony Wardrobe Hat',
      whyItMatters: 'Unlocks at 6 Rebirths! Dress your colony or mix hats per species using Frost Essence.',
      unlocksNext: '🎩 Ultra-Prestige Colony Style',
      targetTab: 'glacier',
      targetCardId: 'glacier-wardrobe-card',
      getImpactTier: () => 260,
      isCompleted: (s) => s.ownedPaidHats >= 1,
      isEligible: (s) => s.totalRebirths >= 6,
      isIrrelevant: () => false,
      isReadyNow: (s) => s.totalRebirths >= 6 && s.prestigeShards >= 100,
      getProgress: (s) => {
        const cur = Math.min(100, s.prestigeShards);
        return { current: cur, target: 100, ratio: s.ownedPaidHats >= 1 ? 1 : cur / 100, label: `${cur}/100 💎` };
      }
    }
  ];

  const GUIDED_BY_ID = new Map(GUIDED_MILESTONES.map(m => [m.id, m]));

  function buildDynamicEndgameGoals(snap) {
    const goals = [];

    if (snap.nextHoleDef && snap.totalRebirths >= 5) {
      const target = Math.max(1, safeNum(snap.nextHoleDef.cost));
      goals.push({
        id: `dynamic_hole_${snap.nextHoleDef.id}`,
        orderIndex: 101,
        scope: 'run',
        icon: '🕳️',
        title: `Carve ${snap.nextHoleDef.name}`,
        whyItMatters: 'Adds +10 diving slots and widens Hotspot Fishing Hole variety.',
        unlocksNext: `${snap.nextHoleDef.id}/6 Fishing Holes`,
        targetTab: 'glacier',
        targetCardId: 'glacier-fishing-holes-card',
        impactTier: 280,
        readyNow: snap.fish >= target,
        reason: snap.fish >= target ? 'affordable_major_unlock' : 'dynamic_endgame',
        progress: {
          current: Math.floor(snap.fish),
          target,
          ratio: Math.min(0.99, snap.fish / target),
          label: `${fmt(snap.fish)}/${fmt(target)} 🐟`
        }
      });
    }

    if (snap.nextIglooDef) {
      const target = Math.max(1, safeNum(snap.nextIglooDef.cost));
      goals.push({
        id: `dynamic_castle_${snap.nextIglooDef.tier}`,
        orderIndex: 102,
        scope: 'run',
        icon: snap.nextIglooDef.icon || '🏰',
        title: `Upgrade to ${snap.nextIglooDef.name}`,
        whyItMatters: snap.nextIglooDef.desc || 'Upgrades your glacial fortress on the ice shelf.',
        unlocksNext: `Castle Tier ${snap.nextIglooDef.tier}/5`,
        targetTab: 'glacier',
        targetCardId: 'glacier-igloo-castle-card',
        impactTier: 290,
        readyNow: snap.fish >= target,
        reason: snap.fish >= target ? 'affordable_major_unlock' : 'dynamic_endgame',
        progress: {
          current: Math.floor(snap.fish),
          target,
          ratio: Math.min(0.99, snap.fish / target),
          label: `${fmt(snap.fish)}/${fmt(target)} 🐟`
        }
      });
    }

    const wardrobeItems = Wardrobe && Array.isArray(Wardrobe.WARDROBE_ITEMS) ? Wardrobe.WARDROBE_ITEMS : [];
    const nextHat = snap.totalRebirths >= 6
      ? wardrobeItems.find(item => item.costEssence > 0 && !snap.unlockedHats.includes(item.id))
      : null;
    if (nextHat) {
      const target = Math.max(1, nextHat.costEssence);
      goals.push({
        id: `dynamic_hat_${nextHat.id}`,
        orderIndex: 103,
        scope: 'run',
        icon: nextHat.icon || '🎩',
        title: `Unlock ${nextHat.name}`,
        whyItMatters: 'Purely cosmetic ultra-prestige headgear for your colony.',
        unlocksNext: `${nextHat.icon} ${nextHat.name}`,
        targetTab: 'glacier',
        targetCardId: 'glacier-wardrobe-card',
        impactTier: 250,
        readyNow: snap.prestigeShards >= target,
        reason: snap.prestigeShards >= target ? 'affordable_major_unlock' : 'dynamic_endgame',
        progress: {
          current: snap.prestigeShards,
          target,
          ratio: Math.min(0.99, snap.prestigeShards / target),
          label: `${fmt(snap.prestigeShards)}/${fmt(target)} 💎`
        }
      });
    }

    // Always offer a Rebirth growth goal if player has more essence to claim
    const essenceGoal = Math.max(5, Math.ceil((snap.prestigeShards + 1) * 0.25));
    if (snap.pendingShards >= essenceGoal) {
      goals.push({
        id: `dynamic_rebirth_surge`,
        orderIndex: 104,
        scope: 'run',
        icon: '✨',
        title: `Claim +${fmt(snap.pendingShards)} Frost Essence`,
        whyItMatters: 'Locks in a permanent global fish multiplier for faster future runs.',
        unlocksNext: `+${(snap.pendingShards * 1.25).toFixed(1)}% permanent yield`,
        targetTab: 'prestige',
        targetCardId: 'prestige-rebirth-btn',
        impactTier: 310,
        readyNow: true,
        reason: 'affordable_major_unlock',
        progress: {
          current: snap.pendingShards,
          target: essenceGoal,
          ratio: 1,
          label: `+${fmt(snap.pendingShards)} 💎 ready`
        }
      });
    }

    return goals;
  }

  /**
   * Synchronizes permanent & run-scoped milestone completion lists.
   * Returns updated arrays plus newly completed milestone objects.
   */
  function syncCompletedMilestones(state = {}) {
    const snap = extractSnapshot(state);
    const permSet = new Set(snap.completedPermanentMilestones.filter(id => GUIDED_BY_ID.has(id)));
    const runSet = new Set(snap.completedRunMilestones.filter(id => GUIDED_BY_ID.has(id)));
    const newlyCompleted = [];

    for (const def of GUIDED_MILESTONES) {
      const targetSet = def.scope === 'permanent' ? permSet : runSet;
      if (targetSet.has(def.id)) continue;
      if (def.isCompleted(snap)) {
        targetSet.add(def.id);
        newlyCompleted.push({
          id: def.id,
          title: def.title,
          icon: def.icon,
          scope: def.scope
        });
      }
    }

    return {
      completedPermanentMilestones: Array.from(permSet),
      completedRunMilestones: Array.from(runSet),
      newlyCompleted
    };
  }

  /**
   * Deterministic, explainable milestone selector with stable tie-breaking and zero flicker.
   */
  function selectActiveMilestone(state = {}, options = {}) {
    const snap = extractSnapshot(state);
    const synced = syncCompletedMilestones(state);
    const permSet = new Set(synced.completedPermanentMilestones);
    const runSet = new Set(synced.completedRunMilestones);
    const skippedSet = new Set(snap.skippedMilestones);
    const currentShownId = typeof options.currentShownId === 'string' ? options.currentShownId : null;

    const candidates = [];

    for (const def of GUIDED_MILESTONES) {
      const isDone = def.scope === 'permanent' ? permSet.has(def.id) : runSet.has(def.id);
      if (isDone) continue;
      if (def.isIrrelevant(snap)) continue;
      if (skippedSet.has(def.id)) continue;
      if (!def.isEligible(snap)) continue;

      const readyNow = Boolean(def.isReadyNow(snap));
      const impactTier = safeInt(def.getImpactTier(snap));
      const score = impactTier + (readyNow ? READY_NOW_BONUS : 0);
      let reason = 'major_progression';
      if (def.id === 'castle_tier_1' && snap.totalRebirths === 0 && snap.runFish >= 150000) {
        reason = 'castle_before_rebirth';
      } else if (readyNow) {
        reason = 'affordable_major_unlock';
      } else if (def.orderIndex <= 4) {
        reason = 'core_onboarding';
      }

      candidates.push({
        id: def.id,
        orderIndex: def.orderIndex,
        scope: def.scope,
        icon: def.icon,
        title: def.title,
        whyItMatters: def.whyItMatters,
        unlocksNext: def.unlocksNext,
        targetTab: def.targetTab,
        targetCardId: def.targetCardId,
        impactTier,
        readyNow,
        score,
        reason,
        isDynamic: false,
        canSkip: true,
        progress: def.getProgress(snap)
      });
    }

    // If all eligible guided milestones are finished or skipped, build dynamic endgame goals
    if (candidates.length === 0) {
      const dynamicGoals = buildDynamicEndgameGoals(snap);
      for (const g of dynamicGoals) {
        if (skippedSet.has(g.id)) continue;
        candidates.push({
          ...g,
          score: g.impactTier + (g.readyNow ? READY_NOW_BONUS : 0),
          isDynamic: true,
          canSkip: true
        });
      }
    }

    if (candidates.length === 0) {
      return {
        milestone: {
          id: 'all_milestones_complete',
          orderIndex: 999,
          scope: 'permanent',
          icon: '🏆',
          title: 'All Current Milestones Complete',
          whyItMatters: 'Your glacial empire has mastered every milestone in this run.',
          unlocksNext: 'Keep growing or Rebirth for Frost Essence',
          targetTab: 'stats',
          targetCardId: null,
          impactTier: 0,
          readyNow: false,
          score: 0,
          reason: 'all_complete',
          isDynamic: true,
          canSkip: false,
          progress: { current: 1, target: 1, ratio: 1, label: 'Mastered' }
        },
        ...synced
      };
    }

    // Deterministic sort: highest discrete score -> lowest orderIndex -> lexical id
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.id.localeCompare(b.id);
    });

    let chosen = candidates[0];

    // Stickiness rule: keep currentShownId unless strictly outranked by a higher discrete score
    if (currentShownId) {
      const existing = candidates.find(c => c.id === currentShownId);
      if (existing && chosen.score <= existing.score) {
        chosen = existing;
      }
    }

    return {
      milestone: chosen,
      ...synced
    };
  }

  function sanitizeMilestoneSaveFields(raw = {}, derivedState = {}) {
    const validGuidedIds = new Set(GUIDED_MILESTONES.map(m => m.id));
    const perm = [];
    const run = [];
    const skipped = [];

    if (Array.isArray(raw.completedPermanentMilestones)) {
      for (const id of raw.completedPermanentMilestones) {
        if (typeof id === 'string' && validGuidedIds.has(id) && !perm.includes(id)) {
          const def = GUIDED_BY_ID.get(id);
          if (def && def.scope === 'permanent') perm.push(id);
        }
      }
    }
    if (Array.isArray(raw.completedRunMilestones)) {
      for (const id of raw.completedRunMilestones) {
        if (typeof id === 'string' && validGuidedIds.has(id) && !run.includes(id)) {
          const def = GUIDED_BY_ID.get(id);
          if (def && def.scope === 'run') run.push(id);
        }
      }
    }
    if (Array.isArray(raw.skippedMilestones)) {
      for (const id of raw.skippedMilestones) {
        if (typeof id === 'string' && id.length > 0 && id.length <= 64 && !skipped.includes(id)) {
          skipped.push(id);
        }
        if (skipped.length >= 40) break;
      }
    }

    const synced = syncCompletedMilestones({
      ...derivedState,
      completedPermanentMilestones: perm,
      completedRunMilestones: run
    });

    const unlockedTabs = evaluateUnlockedTabs(derivedState, raw.unlockedTabs);
    const showAllTabs = Boolean(raw.showAllTabs);
    const milestoneBarExpanded = Boolean(raw.milestoneBarExpanded);

    return {
      completedPermanentMilestones: synced.completedPermanentMilestones,
      completedRunMilestones: synced.completedRunMilestones,
      skippedMilestones: skipped,
      unlockedTabs,
      showAllTabs,
      milestoneBarExpanded
    };
  }

  return {
    ALL_TAB_IDS,
    STARTER_TAB_IDS,
    READY_NOW_BONUS,
    GUIDED_MILESTONES,
    extractSnapshot,
    evaluateUnlockedTabs,
    getVisibleTabs,
    syncCompletedMilestones,
    selectActiveMilestone,
    sanitizeMilestoneSaveFields
  };
});
