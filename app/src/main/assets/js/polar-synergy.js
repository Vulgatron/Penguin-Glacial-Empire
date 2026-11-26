(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.PolarSynergy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOTSPOT_SURGE_DURATION_SEC = 20;
  const HOTSPOT_EVENT_SURGE_ADD = 0.25;
  const MAX_HOTSPOT_BONUS = 0.85; // Hard cap: +85% (1.85x max Hotspot multiplier)

  /**
   * Canonical Weather -> Species Synergy + Hotspot Fishing Hole profiles.
   * Global weather bonus is applied ONCE in calculateEffectiveYield.
   */
  const WEATHER_SYNERGY_PROFILES = {
    clear: {
      weatherId: 'clear',
      title: 'Sunlit Shoal',
      badge: '☀️ Adélie & Gentoo +35% • Sunlit Hotspot +50%',
      shortTag: '☀️ Sunlit +35%',
      globalWeatherMult: 1.0,
      boostedSpecies: ['adelie', 'gentoo'],
      speciesCatchMult: 1.35,
      speciesSpeedMult: 1.15,
      speciesDiveSpeedMult: 1.0,
      hotspotBaseBonus: 0.50,
      hotspotLabel: 'Sunlit Shoal',
      hotspotColor: '#fbbf24',
      hotspotSecondary: '#38bdf8'
    },
    light_snow: {
      weatherId: 'light_snow',
      title: 'Krill Drift',
      badge: '❄️ Chinstrap +40% • Krill Hotspot +50%',
      shortTag: '❄️ Krill +40%',
      globalWeatherMult: 1.0,
      boostedSpecies: ['chinstrap'],
      speciesCatchMult: 1.40,
      speciesSpeedMult: 1.0,
      speciesDiveSpeedMult: 1.20,
      hotspotBaseBonus: 0.50,
      hotspotLabel: 'Krill Drift',
      hotspotColor: '#fb7185',
      hotspotSecondary: '#38bdf8'
    },
    blizzard: {
      weatherId: 'blizzard',
      title: 'Storm Surge',
      badge: '🌨️ All +20% • Emperor & Cyber +35% • Surge Hotspot +60%',
      shortTag: '🌨️ Storm +35%',
      globalWeatherMult: 1.20,
      boostedSpecies: ['emperor', 'cyber'],
      speciesCatchMult: 1.35,
      speciesSpeedMult: 1.0,
      speciesDiveSpeedMult: 1.0,
      hotspotBaseBonus: 0.60,
      hotspotLabel: 'Surge Trench',
      hotspotColor: '#c084fc',
      hotspotSecondary: '#38bdf8'
    }
  };

  const DEFAULT_PARADE_SPECIES_MULT = 1.35;

  function getWeatherSynergyProfile(weatherId) {
    return WEATHER_SYNERGY_PROFILES[weatherId] || WEATHER_SYNERGY_PROFILES.clear;
  }

  /**
   * Computes species weather synergy ONCE.
   * Parade Rule (Anti-Double-Counting): During a Penguin Parade, every species activates
   * synergy once, NEVER stacking an extra duplicate species multiplier on top of an
   * already-matched weather bonus.
   */
  function getSpeciesSynergy(speciesId, weatherId, paradeActive = false) {
    const profile = getWeatherSynergyProfile(weatherId);
    const isWeatherMatched = profile.boostedSpecies.includes(speciesId);
    if (isWeatherMatched) {
      return {
        active: true,
        source: paradeActive ? 'weather_and_parade_capped' : 'weather',
        catchMult: profile.speciesCatchMult,
        speedMult: profile.speciesSpeedMult,
        diveSpeedMult: profile.speciesDiveSpeedMult,
        label: profile.shortTag
      };
    }
    if (paradeActive) {
      return {
        active: true,
        source: 'parade',
        catchMult: DEFAULT_PARADE_SPECIES_MULT,
        speedMult: 1.10,
        diveSpeedMult: 1.10,
        label: '🎺 Parade +35%'
      };
    }
    return {
      active: false,
      source: 'none',
      catchMult: 1.0,
      speedMult: 1.0,
      diveSpeedMult: 1.0,
      label: ''
    };
  }

  /**
   * Computes Hotspot Fishing Hole multiplier with additive, hard-capped Event Surge.
   * Formula: 1 + min(MAX_HOTSPOT_BONUS, hotspotBaseBonus + (hotspotSurgeTimer > 0 ? 0.25 : 0))
   */
  function getHotspotMultiplier(weatherId, isAtHotspot, hotspotSurgeTimer = 0) {
    if (!isAtHotspot) return 1.0;
    const profile = getWeatherSynergyProfile(weatherId);
    const surgeActive = Number.isFinite(Number(hotspotSurgeTimer)) && Number(hotspotSurgeTimer) > 0;
    const additiveBonus = Math.min(
      MAX_HOTSPOT_BONUS,
      profile.hotspotBaseBonus + (surgeActive ? HOTSPOT_EVENT_SURGE_ADD : 0)
    );
    return 1 + additiveBonus;
  }

  /**
   * Single documented catch yield calculation preventing accidental double-counting:
   *   Effective Catch = Base Catch × Global Weather × Species Synergy × Hotspot Multiplier
   */
  function calculateEffectiveYield(params = {}) {
    const baseCatch = Number.isFinite(Number(params.baseCatch)) && Number(params.baseCatch) > 0
      ? Number(params.baseCatch)
      : 0;
    const weatherId = params.weatherId || 'clear';
    const speciesId = params.speciesId || 'adelie';
    const paradeActive = Boolean(params.paradeActive);
    const isAtHotspot = Boolean(params.isAtHotspot);
    const hotspotSurgeTimer = clampHotspotSurgeTimer(params.hotspotSurgeTimer);

    const profile = getWeatherSynergyProfile(weatherId);
    const globalWeatherMult = profile.globalWeatherMult;
    const speciesSyn = getSpeciesSynergy(speciesId, weatherId, paradeActive);
    const hotspotMult = getHotspotMultiplier(weatherId, isAtHotspot, hotspotSurgeTimer);
    const totalMult = globalWeatherMult * speciesSyn.catchMult * hotspotMult;

    return {
      effectiveCatch: baseCatch * totalMult,
      globalWeatherMult,
      speciesSynergyMult: speciesSyn.catchMult,
      hotspotMult,
      totalMult,
      synergySource: speciesSyn.source
    };
  }

  /**
   * Deterministically selects one unlocked fishing hole as the active Hotspot for a weather cycle.
   */
  function selectHotspotHoleId(weatherId, unlockedHoleIds = [1, 2, 3], rotationEpoch = 0) {
    const ids = Array.isArray(unlockedHoleIds) && unlockedHoleIds.length > 0
      ? unlockedHoleIds.filter(id => Number.isFinite(Number(id)))
      : [1, 2, 3];
    if (ids.length === 0) return 1;
    const weatherOffset = weatherId === 'light_snow' ? 1 : (weatherId === 'blizzard' ? 2 : 0);
    const epoch = Number.isFinite(Number(rotationEpoch)) ? Math.max(0, Math.floor(Number(rotationEpoch))) : 0;
    const idx = (weatherOffset + epoch) % ids.length;
    return ids[idx];
  }

  function clampHotspotSurgeTimer(sec) {
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(HOTSPOT_SURGE_DURATION_SEC, n);
  }

  /**
   * Stable 4-Rule Hotspot Routing for diving penguins:
   * 1. Prefer the active Hotspot Hole if it has an open dive slot.
   * 2. If penguin already committed to a targetHoleId (walking or diving), KEEP IT
   *    even if weather rotates the Hotspot mid-walk.
   * 3. Re-evaluate only after dive completes & fish is delivered (targetHoleId === null).
   * 4. Fall back cleanly to normal hole selection if the Hotspot is full or unavailable.
   */
  function chooseFishingHoleForPenguin(params = {}) {
    const {
      currentTargetHoleId = null,
      holes = [],
      hotspotHoleId = null,
      rng = Math.random
    } = params;

    if (!Array.isArray(holes) || holes.length === 0) return null;

    // Rule 2: Keep committed target while walking/sliding/diving (no indecisive switching)
    if (currentTargetHoleId !== null && currentTargetHoleId !== undefined) {
      const committed = holes.find(h => h && h.id === currentTargetHoleId);
      if (committed) {
        return committed;
      }
    }

    const hasCapacity = (h) => {
      const cap = Number.isFinite(h.maxCapacity) ? h.maxCapacity : (Number.isFinite(h.slots) ? h.slots : 10);
      const occ = Number.isFinite(h.occupants) ? h.occupants : 0;
      return occ < cap;
    };

    // Rule 1: Prefer active Hotspot Hole if an open diving slot is available
    if (hotspotHoleId !== null && hotspotHoleId !== undefined) {
      const hotspot = holes.find(h => h && h.id === hotspotHoleId);
      if (hotspot && hasCapacity(hotspot)) {
        return hotspot;
      }
    }

    // Rule 4: Fall back to available holes (least crowded / random tie-break)
    const available = holes.filter(h => h && hasCapacity(h));
    const pool = available.length > 0 ? available : holes;
    let minOcc = Infinity;
    for (const h of pool) {
      const occ = Number.isFinite(h.occupants) ? h.occupants : 0;
      if (occ < minOcc) minOcc = occ;
    }
    const leastCrowded = pool.filter(h => (Number.isFinite(h.occupants) ? h.occupants : 0) <= minOcc);
    const pickPool = leastCrowded.length > 0 ? leastCrowded : pool;
    const r = typeof rng === 'function' ? rng() : Math.random();
    const idx = Math.max(0, Math.min(pickPool.length - 1, Math.floor(r * pickPool.length)));
    return pickPool[idx];
  }

  /**
   * Computes persistent baseline DPS strictly excluding transient active boosts
   * (hotspotSurgeTimer, starlightFrenzyTimer, paradeBoost, transient weather/hotspot spikes)
   * so offline earnings can never leak expired transient bonuses.
   */
  function stripTransientBoostsForOffline(basePersistentDps) {
    const n = Number(basePersistentDps);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
  }

  return {
    HOTSPOT_SURGE_DURATION_SEC,
    HOTSPOT_EVENT_SURGE_ADD,
    MAX_HOTSPOT_BONUS,
    WEATHER_SYNERGY_PROFILES,
    DEFAULT_PARADE_SPECIES_MULT,
    getWeatherSynergyProfile,
    getSpeciesSynergy,
    getHotspotMultiplier,
    calculateEffectiveYield,
    selectHotspotHoleId,
    clampHotspotSurgeTimer,
    chooseFishingHoleForPenguin,
    stripTransientBoostsForOffline
  };
});
