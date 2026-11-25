(function (globalScope) {
  'use strict';

  // Reuses Glacial Empire's native procedural SVG vector sprites
  const PrestigeSpriteFactory = {
    emperorDefs(p) {
      return `
        <linearGradient id="${p}EmpCoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="${p}EmpAscCoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="52%" stop-color="#1d4ed8" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="${p}EmpCrown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <linearGradient id="${p}EmpAscBelly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="65%" stop-color="#e0f2fe" />
          <stop offset="100%" stop-color="#fde68a" />
        </linearGradient>
      `;
    },
    emperorGroup(p) {
      return `
        <g class="cs-emperor-base">
          <ellipse cx="0" cy="48" rx="30" ry="7" fill="#0369a1" opacity="0.38" />
          <ellipse cx="-12" cy="44" rx="10" ry="4.5" fill="#fb923c" />
          <ellipse cx="12" cy="44" rx="10" ry="4.5" fill="#fb923c" />
          <ellipse cx="-29" cy="8" rx="9" ry="23" transform="rotate(16 -29 8)" fill="#0f172a" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="1.2" />
          <ellipse cx="29" cy="8" rx="9" ry="23" transform="rotate(-18 29 8)" fill="#0f172a" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="1.2" />
          <ellipse cx="0" cy="4" rx="28" ry="40" fill="url(#${p}EmpCoat)" />
          <ellipse cx="1" cy="11" rx="20" ry="30" fill="#f8fafc" />
          <ellipse cx="1" cy="-14" rx="16" ry="8" fill="#fbbf24" opacity="0.85" />
          <ellipse cx="-14" cy="-24" rx="6" ry="7" fill="#facc15" />
          <ellipse cx="15" cy="-24" rx="6" ry="7" fill="#facc15" />
          <circle cx="0" cy="-28" r="19" fill="#0f172a" />
          <circle cx="-7" cy="-30" r="3.4" fill="#ffffff" />
          <circle cx="-6.3" cy="-30.4" r="1.8" fill="#020617" />
          <circle cx="8" cy="-30" r="3.4" fill="#ffffff" />
          <circle cx="8.7" cy="-30.4" r="1.8" fill="#020617" />
          <polygon points="0,-26 11,-21 0,-17 -6,-21" fill="#fb923c" />
          <polygon points="-13,-44 -10,-58 -3,-49 1,-61 6,-49 12,-57 14,-44" fill="url(#${p}EmpCrown)" stroke="#fef08a" stroke-width="1.2" stroke-linejoin="round" />
          <circle cx="1" cy="-50" r="2.2" fill="#38bdf8" />
        </g>
        <g class="cs-emperor-ascended" opacity="0">
          <ellipse cx="0" cy="4" rx="46" ry="56" fill="#38bdf8" opacity="0.22" />
          <ellipse cx="-12" cy="44" rx="10" ry="4.5" fill="#fde047" />
          <ellipse cx="12" cy="44" rx="10" ry="4.5" fill="#fde047" />
          <ellipse cx="-30" cy="5" rx="9.5" ry="23" transform="rotate(28 -30 5)" fill="url(#${p}EmpAscCoat)" stroke="#fef08a" stroke-width="1.6" />
          <ellipse cx="30" cy="5" rx="9.5" ry="23" transform="rotate(-28 30 5)" fill="url(#${p}EmpAscCoat)" stroke="#fef08a" stroke-width="1.6" />
          <ellipse cx="0" cy="4" rx="28.5" ry="40.5" fill="url(#${p}EmpAscCoat)" stroke="#bae6fd" stroke-width="1.8" />
          <ellipse cx="1" cy="11" rx="20.5" ry="30.5" fill="url(#${p}EmpAscBelly)" />
          <ellipse cx="1" cy="-14" rx="17" ry="8.5" fill="#fde047" opacity="0.95" />
          <ellipse cx="-14" cy="-24" rx="6.2" ry="7.2" fill="#fef08a" />
          <ellipse cx="15" cy="-24" rx="6.2" ry="7.2" fill="#fef08a" />
          <circle cx="0" cy="-28" r="19.2" fill="url(#${p}EmpAscCoat)" stroke="#e0f2fe" stroke-width="1.5" />
          <circle cx="-7" cy="-30" r="3.6" fill="#e0f2fe" />
          <circle cx="-6.3" cy="-30.2" r="1.6" fill="#38bdf8" />
          <circle cx="8" cy="-30" r="3.6" fill="#e0f2fe" />
          <circle cx="8.7" cy="-30.2" r="1.6" fill="#38bdf8" />
          <polygon points="0,-26 11,-21 0,-17 -6,-21" fill="#fde047" stroke="#ffffff" stroke-width="0.7" />
          <polygon points="-14,-44 -11,-60 -3,-50 1,-64 6,-50 13,-59 15,-44" fill="url(#${p}EmpCrown)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
          <polygon points="1,-56 4.5,-50 1,-45 -2.5,-50" fill="#e0f2fe" />
          <path d="M-26,-52 L-23,-45 L-16,-42 L-23,-39 L-26,-32 L-29,-39 L-36,-42 L-29,-45 Z" fill="#fef08a" opacity="0.92" />
          <path d="M27,-48 L29,-43 L34,-41 L29,-39 L27,-34 L25,-39 L20,-41 L25,-43 Z" fill="#bae6fd" opacity="0.95" />
        </g>
      `;
    },
    iglooDefs(p) {
      return `
        <linearGradient id="${p}IglooDome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f0f9ff" />
          <stop offset="58%" stop-color="#bae6fd" />
          <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>
        <radialGradient id="${p}IglooGlow" cx="50%" cy="65%" r="55%">
          <stop offset="0%" stop-color="#fde047" />
          <stop offset="55%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#92400e" />
        </radialGradient>
      `;
    },
    iglooGroup(p) {
      return `
        <ellipse cx="0" cy="4" rx="56" ry="11" fill="#0369a1" opacity="0.38" />
        <path d="M-48,2 A48,46 0 0,1 48,2 Z" fill="url(#${p}IglooDome)" stroke="#e0f2fe" stroke-width="1.6" />
        <path d="M-43,-12 Q0,-18 43,-12" stroke="#7dd3fc" stroke-width="1.4" opacity="0.85" fill="none" />
        <path d="M-33,-26 Q0,-31 33,-26" stroke="#7dd3fc" stroke-width="1.4" opacity="0.85" fill="none" />
        <line x1="-18" y1="-28" x2="-21" y2="-14" stroke="#7dd3fc" stroke-width="1.3" />
        <line x1="16" y1="-28" x2="19" y2="-14" stroke="#7dd3fc" stroke-width="1.3" />
        <line x1="0" y1="-44" x2="0" y2="-28" stroke="#7dd3fc" stroke-width="1.3" />
        <path d="M-19,2 L-19,-18 A19,19 0 0,1 19,-18 L19,2 Z" fill="#bae6fd" stroke="#e0f2fe" stroke-width="1.5" />
        <path d="M-13,2 L-13,-14 A13,13 0 0,1 13,-14 L13,2 Z" fill="url(#${p}IglooGlow)" />
        <circle cx="0" cy="-16" r="3" fill="#fef08a" />
      `;
    },
    adelieGroup() {
      return `
        <ellipse cx="-8" cy="27" rx="7.5" ry="3.5" fill="#fb923c" />
        <ellipse cx="8" cy="27" rx="7.5" ry="3.5" fill="#fb923c" />
        <ellipse cx="-21" cy="3" rx="6.5" ry="15" transform="rotate(24 -21 3)" fill="#1e293b" />
        <ellipse cx="21" cy="2" rx="6.5" ry="15" transform="rotate(-30 21 2)" fill="#1e293b" />
        <ellipse cx="0" cy="2" rx="20" ry="26" fill="#0f172a" />
        <ellipse cx="0" cy="7" rx="14" ry="19" fill="#f8fafc" />
        <circle cx="0" cy="-18" r="14" fill="#0f172a" />
        <circle cx="-5.5" cy="-19" r="3.6" fill="#ffffff" />
        <circle cx="-5.2" cy="-19" r="1.9" fill="#020617" />
        <circle cx="5.5" cy="-19" r="3.6" fill="#ffffff" />
        <circle cx="5.8" cy="-19" r="1.9" fill="#020617" />
        <ellipse cx="-9" cy="-14" rx="2.8" ry="1.6" fill="#fda4af" opacity="0.7" />
        <ellipse cx="9" cy="-14" rx="2.8" ry="1.6" fill="#fda4af" opacity="0.7" />
        <polygon points="-4,-15 4,-15 0,-10" fill="#f97316" />
        <g transform="translate(24, -4) rotate(-18)">
          <ellipse cx="0" cy="0" rx="11" ry="5.5" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1.2" />
          <polygon points="-10,0 -17,-5 -17,5" fill="#0284c7" />
          <circle cx="5" cy="-1.2" r="1.5" fill="#020617" />
        </g>
      `;
    },
    cyberGroup() {
      return `
        <ellipse cx="-8" cy="29" rx="8" ry="3.6" fill="#38bdf8" />
        <ellipse cx="8" cy="29" rx="8" ry="3.6" fill="#38bdf8" />
        <ellipse cx="-22" cy="4" rx="7" ry="16" transform="rotate(20 -22 4)" fill="#1e293b" stroke="#22d3ee" stroke-width="1.2" />
        <ellipse cx="22" cy="4" rx="7" ry="16" transform="rotate(-22 22 4)" fill="#1e293b" stroke="#22d3ee" stroke-width="1.2" />
        <ellipse cx="0" cy="3" rx="21" ry="27" fill="#0f172a" stroke="#38bdf8" stroke-width="1.2" />
        <ellipse cx="0" cy="8" rx="14.5" ry="19.5" fill="#e2e8f0" />
        <polygon points="0,-2 6,5 0,12 -6,5" fill="#22d3ee" stroke="#ffffff" stroke-width="1" />
        <line x1="0" y1="-31" x2="0" y2="-40" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
        <circle cx="0" cy="-42" r="3" fill="#22d3ee" />
        <circle cx="0" cy="-19" r="14.5" fill="#0f172a" stroke="#38bdf8" stroke-width="1" />
        <rect x="-11" y="-24" width="22" height="7.5" rx="3.8" fill="#06b6d4" stroke="#a5f3fc" stroke-width="1.2" />
        <line x1="-6" y1="-20.2" x2="6" y2="-20.2" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.9" />
        <polygon points="-4,-14 4,-14 0,-9" fill="#38bdf8" />
      `;
    },
    sliderGroup() {
      return `
        <g transform="translate(-28, -18)">
          <ellipse cx="7" cy="24" rx="5.5" ry="2.8" transform="rotate(-14 7 24)" fill="#fb923c" />
          <ellipse cx="9" cy="28" rx="5" ry="2.4" transform="rotate(8 9 28)" fill="#f97316" />
          <ellipse cx="26" cy="23" rx="17" ry="9.5" transform="rotate(4 26 23)" fill="#0f172a" stroke="#7dd3fc" stroke-opacity="0.45" stroke-width="0.9" />
          <ellipse cx="27" cy="26.5" rx="14" ry="5.5" transform="rotate(3 27 26.5)" fill="#f8fafc" />
          <ellipse cx="23" cy="21" rx="8.5" ry="3.4" transform="rotate(-24 23 21)" fill="#1e293b" stroke="#38bdf8" stroke-opacity="0.55" stroke-width="0.9" />
          <circle cx="40.5" cy="17" r="8.2" fill="#0f172a" />
          <path d="M33 20 Q24 14 15 16" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round" fill="none" />
          <path d="M34 21 Q27 17 20 19.5" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" fill="none" />
          <circle cx="43.5" cy="15.2" r="2.5" fill="#ffffff" />
          <circle cx="44.2" cy="15" r="1.35" fill="#020617" />
          <circle cx="44.6" cy="14.5" r="0.5" fill="#ffffff" />
          <ellipse cx="42" cy="18.6" rx="1.9" ry="1.1" fill="#fda4af" opacity="0.8" />
          <polygon points="47.5,15.2 54.5,17.4 47.2,19.4" fill="#fb923c" />
        </g>
      `;
    },
    iceFloeGroup(p) {
      return `
        <polygon points="-98,18 -54,0 56,2 98,18 78,42 -72,42" fill="#0c4a6e" />
        <polygon points="-98,14 -54,-4 56,-2 98,14 66,28 -68,28" fill="url(#${p}IglooDome)" stroke="#e0f2fe" stroke-width="1.6" />
        <polygon points="-80,8 -71,-22 -61,10" fill="#7dd3fc" opacity="0.88" />
        <polygon points="-66,11 -59,-10 -52,12" fill="#bae6fd" opacity="0.92" />
        <polygon points="58,10 67,-18 76,12" fill="#7dd3fc" opacity="0.86" />
      `;
    },
    horizonGroup(p) {
      return `
        <polygon points="0,1000 0,740 135,645 275,730 435,610 605,718 775,625 920,722 1000,670 1000,1000" fill="url(#${p}MtnBack)" />
        <polygon points="0,1000 0,805 185,725 355,792 540,708 730,795 905,716 1000,765 1000,1000" fill="url(#${p}MtnFront)" />
        <path d="M0,842 Q250,812 500,838 T1000,828 L1000,1000 L0,1000 Z" fill="url(#${p}IceShelf)" />
      `;
    },
    frostCrystalPolygon(r = 12) {
      return `0,${-r} ${(r * 0.62).toFixed(1)},0 0,${r} ${(-r * 0.62).toFixed(1)},0`;
    },
    iceShardPolygon(r = 16) {
      const w = (r * (0.34 + Math.random() * 0.24)).toFixed(1);
      const h = (r * (0.85 + Math.random() * 0.4)).toFixed(1);
      const skew = ((Math.random() - 0.5) * r * 0.35).toFixed(1);
      return `0,${-h} ${w},${skew} 0,${(r * 0.62).toFixed(1)} ${-w},${(-skew).toFixed(1)}`;
    }
  };

  function formatPrestigeBonusPctSafe(shards) {
    const economy = globalScope.GlacialCore && globalScope.GlacialCore.Economy;
    if (economy && typeof economy.formatPrestigeBonusPct === 'function') {
      return economy.formatPrestigeBonusPct(shards);
    }
    const pct = Math.max(0, Math.floor(Number(shards) || 0)) * 1.25;
    return Number(pct.toFixed(2)).toString();
  }

  function calculatePrestigeMultiplierSafe(shards) {
    const economy = globalScope.GlacialCore && globalScope.GlacialCore.Economy;
    if (economy && typeof economy.calculatePrestigeMultiplier === 'function') {
      return economy.calculatePrestigeMultiplier(shards);
    }
    return 1 + Math.max(0, Math.floor(Number(shards) || 0)) * 0.0125;
  }

  class PrestigeCutsceneController {
    constructor(deps = {}) {
      this.soundRef = deps.sound || null;
      this.getStateRef = typeof deps.getState === 'function' ? deps.getState : null;
      this.isActive = false;
      this.overlayEl = null;
      this.rafId = null;
      this.winterScoreCtrl = null;
      this.lastComboKey = '';
      this.runCounter = 0;
      this.currentConfig = null;
      this.hasExecutedReset = false;
      this.resetResult = null;
      this.onCompleteCb = null;
      this.onClimaxResetCb = null;
      this.isSkipping = false;
      this.skipFadeStart = 0;
    }

    _getSound() {
      if (this.soundRef) return this.soundRef;
      if (typeof globalScope.sound !== 'undefined') return globalScope.sound;
      return null;
    }

    _getState() {
      if (this.getStateRef) return this.getStateRef();
      if (typeof globalScope.state !== 'undefined') return globalScope.state;
      return null;
    }

    pickRandomizedConfig() {
      const atmospheres = ['blizzard', 'aurora', 'eclipse'];
      const choreographies = ['ascension', 'shattering', 'stampede'];
      let atmosphere = atmospheres[Math.floor(Math.random() * atmospheres.length)];
      let choreography = choreographies[Math.floor(Math.random() * choreographies.length)];
      if (`${atmosphere}:${choreography}` === this.lastComboKey) {
        atmosphere = atmospheres[(atmospheres.indexOf(atmosphere) + 1 + Math.floor(Math.random() * 2)) % atmospheres.length];
        choreography = choreographies[(choreographies.indexOf(choreography) + 1 + Math.floor(Math.random() * 2)) % choreographies.length];
      }
      this.lastComboKey = `${atmosphere}:${choreography}`;
      return {
        atmosphere,
        choreography,
        hueShift: Math.round(-16 + Math.random() * 34),
        shakeScale: 0.85 + Math.random() * 0.4,
        ambientCount: 40 + Math.floor(Math.random() * 22),
        shardCount: 30 + Math.floor(Math.random() * 16),
        debrisCount: 16 + Math.floor(Math.random() * 10),
        rayCount: 16 + Math.floor(Math.random() * 8),
        ringSpinDir: Math.random() < 0.5 ? 1 : -1,
        streakAngleDeg: 24 + Math.random() * 14
      };
    }

    play({ pendingShards = 1, onClimaxReset = null, onComplete = null } = {}) {
      if (this.isActive) return null;
      this.isActive = true;
      this.hasExecutedReset = false;
      this.resetResult = null;
      this.isSkipping = false;
      this.skipFadeStart = 0;
      this.onClimaxResetCb = onClimaxReset;
      this.onCompleteCb = onComplete;

      const soundInst = this._getSound();
      if (soundInst && typeof soundInst.setCutsceneMode === 'function') {
        // Immediately silence all background penguin SFX, ambient wind, and non-cutscene haptics
        soundInst.setCutsceneMode(true);
      }

      const cfg = this.pickRandomizedConfig();
      this.currentConfig = cfg;
      const prefix = `pcs${++this.runCounter}_`;
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const makeSvgEl = (tag, attrs = {}) => {
        const el = document.createElementNS(SVG_NS, tag);
        Object.keys(attrs).forEach(k => el.setAttribute(k, String(attrs[k])));
        return el;
      };

      const overlay = document.createElement('div');
      overlay.id = 'prestige-cutscene-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Glacial Rebirth Prestige Sequence');

      const skyStops = cfg.atmosphere === 'blizzard'
        ? ['#020c1f', '#0a294d', '#124675']
        : cfg.atmosphere === 'aurora'
          ? ['#020617', '#08203e', '#0c2f4f']
          : ['#01030c', '#090f29', '#191338'];

      const currentState = this._getState();
      const projectedShards = ((currentState && currentState.prestigeShards) || 0) + Math.max(0, Math.floor(Number(pendingShards) || 0));
      const projectedMult = calculatePrestigeMultiplierSafe(projectedShards);
      const projectedPctStr = formatPrestigeBonusPctSafe(projectedShards);
      const projectedRebirthNum = ((currentState && currentState.totalRebirths) || 0) + 1;

      overlay.innerHTML = `
        <div class="prestige-cs-camera" id="${prefix}cam">
          <svg class="prestige-cs-svg-bg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="${prefix}Sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${skyStops[0]}" />
                <stop offset="56%" stop-color="${skyStops[1]}" />
                <stop offset="100%" stop-color="${skyStops[2]}" />
              </linearGradient>
              <linearGradient id="${prefix}MtnBack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1e4976" stop-opacity="0.72" />
                <stop offset="100%" stop-color="#05142b" stop-opacity="0.98" />
              </linearGradient>
              <linearGradient id="${prefix}MtnFront" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.34" />
                <stop offset="52%" stop-color="#0c2d57" stop-opacity="0.92" />
                <stop offset="100%" stop-color="#030d1e" stop-opacity="1" />
              </linearGradient>
              <linearGradient id="${prefix}IceShelf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#bae6fd" stop-opacity="0.34" />
                <stop offset="100%" stop-color="#030c1c" stop-opacity="0.98" />
              </linearGradient>
              <linearGradient id="${prefix}Aurora1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0" />
                <stop offset="28%" stop-color="#34d399" stop-opacity="0.46" />
                <stop offset="56%" stop-color="#38bdf8" stop-opacity="0.52" />
                <stop offset="82%" stop-color="#a855f7" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#a855f7" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="${prefix}Aurora2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#a855f7" stop-opacity="0" />
                <stop offset="30%" stop-color="#8b5cf6" stop-opacity="0.44" />
                <stop offset="58%" stop-color="#2dd4bf" stop-opacity="0.48" />
                <stop offset="84%" stop-color="#38bdf8" stop-opacity="0.2" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="${prefix}AscBeam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.95" />
                <stop offset="45%" stop-color="#38bdf8" stop-opacity="0.62" />
                <stop offset="100%" stop-color="#fde047" stop-opacity="0.18" />
              </linearGradient>
              <radialGradient id="${prefix}EclipseHalo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#020617" stop-opacity="1" />
                <stop offset="48%" stop-color="#020617" stop-opacity="1" />
                <stop offset="56%" stop-color="#fef08a" stop-opacity="0.95" />
                <stop offset="72%" stop-color="#38bdf8" stop-opacity="0.45" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="1000" height="1000" fill="url(#${prefix}Sky)" />
            <g id="${prefix}StarsLayer"></g>
            <g id="${prefix}AtmoLayer"></g>
            <g id="${prefix}HorizonLayer">${PrestigeSpriteFactory.horizonGroup(prefix)}</g>
          </svg>

          <svg class="prestige-cs-svg-hero" viewBox="-360 -360 720 720" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              ${PrestigeSpriteFactory.emperorDefs(prefix)}
              ${PrestigeSpriteFactory.iglooDefs(prefix)}
              <radialGradient id="${prefix}HeroAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#fef08a" stop-opacity="0.88" />
                <stop offset="42%" stop-color="#38bdf8" stop-opacity="0.48" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </radialGradient>
              <radialGradient id="${prefix}HeroCyanGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.85" />
                <stop offset="45%" stop-color="#38bdf8" stop-opacity="0.52" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </radialGradient>
              <radialGradient id="${prefix}HeroGoldGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.92" />
                <stop offset="46%" stop-color="#fde047" stop-opacity="0.55" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
              </radialGradient>
            </defs>

            <rect id="${prefix}AscBeamRect" x="-40" y="-420" width="80" height="840" fill="url(#${prefix}AscBeam)" opacity="0" />

            <g id="${prefix}EclipseGroup" opacity="0">
              <g id="${prefix}EclipseRays" opacity="0"></g>
              <circle cx="0" cy="-26" r="142" fill="url(#${prefix}EclipseHalo)" />
              <circle id="${prefix}EclipseDisc" cx="0" cy="-26" r="70" fill="#020617" stroke="#fef08a" stroke-width="3.5" />
            </g>

            <g id="${prefix}StructuresGroup" transform="translate(0, 128)">
              <g transform="translate(0, 26) scale(1.65)">${PrestigeSpriteFactory.iceFloeGroup(prefix)}</g>
              <g transform="translate(-128, 28) scale(0.95)">${PrestigeSpriteFactory.iglooGroup(prefix)}</g>
              <g transform="translate(122, 16) scale(0.88)">${PrestigeSpriteFactory.cyberGroup()}</g>
              <g transform="translate(-44, 24) scale(0.76)">${PrestigeSpriteFactory.adelieGroup()}</g>
            </g>

            <circle id="${prefix}HeroAuraCircle" cx="0" cy="0" r="118" fill="url(#${prefix}HeroAura)" opacity="0" />
            <circle id="${prefix}HeroCoreGlow" cx="0" cy="0" r="88" fill="url(#${prefix}HeroCyanGlow)" opacity="0" />

            <g id="${prefix}EnergyRings" transform="translate(0, -16)">
              <circle id="${prefix}Ring1" cx="0" cy="0" r="175" fill="none" stroke="#7dd3fc" stroke-width="2.6" stroke-dasharray="22 14" opacity="0" />
              <circle id="${prefix}Ring2" cx="0" cy="0" r="138" fill="none" stroke="#fde047" stroke-width="2.2" stroke-dasharray="14 10" opacity="0" />
              <circle id="${prefix}Ring3" cx="0" cy="0" r="102" fill="none" stroke="#c084fc" stroke-width="2.0" stroke-dasharray="8 8" opacity="0" />
            </g>

            <g id="${prefix}CrackLines" transform="translate(0, -16)" opacity="0" stroke="#e0f2fe" stroke-linecap="round" fill="none">
              <path d="M0,0 L-58,-72 L-96,-54" stroke-width="2.5" />
              <path d="M0,0 L64,-68 L108,-96" stroke-width="2.5" />
              <path d="M0,0 L86,28 L124,14" stroke-width="2.2" />
              <path d="M0,0 L-82,36 L-122,68" stroke-width="2.2" />
              <path d="M0,0 L12,88 L-14,128" stroke-width="2.0" />
              <path d="M0,0 L-18,-96 L18,-132" stroke-width="2.0" />
            </g>

            <g id="${prefix}HeroEmperor" transform="translate(0, 62) scale(1.65)">
              ${PrestigeSpriteFactory.emperorGroup(prefix)}
            </g>

            <g id="${prefix}StampedeLayer"></g>

            <circle id="${prefix}Shockwave" cx="0" cy="-16" r="18" fill="none" stroke="#ffffff" stroke-width="10" opacity="0" />
            <g id="${prefix}AmbientParticles"></g>
            <g id="${prefix}ShardParticles"></g>
            <g id="${prefix}DebrisParticles"></g>
          </svg>
        </div>

        <div class="prestige-cs-vignette" id="${prefix}Vignette"></div>
        <div class="prestige-cs-flash" id="${prefix}Flash"></div>

        <div class="prestige-cs-typo-layer">
          <div class="prestige-cs-banner" id="${prefix}Banner">
            <div class="prestige-cs-kicker">✦ GLACIAL REBIRTH ASCENSION ✦</div>
            <div class="prestige-cs-tier-title" id="${prefix}TierTitle">REBIRTH TIER #${projectedRebirthNum}</div>
            <div class="prestige-cs-mult-row">
              <span class="prestige-cs-mult-pill" id="${prefix}MultPill">${projectedMult.toFixed(2)}× OUTPUT (+${projectedPctStr}%)</span>
              <span class="prestige-cs-essence-pill" id="${prefix}EssencePill">+${pendingShards} 💎</span>
            </div>
          </div>
        </div>

        <button type="button" class="prestige-cs-skip-btn" id="${prefix}SkipBtn" aria-label="Skip prestige cutscene">Skip &gt;&gt;</button>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;

      const camEl = overlay.querySelector(`#${prefix}cam`);
      const starsLayer = overlay.querySelector(`#${prefix}StarsLayer`);
      const atmoLayer = overlay.querySelector(`#${prefix}AtmoLayer`);
      const horizonLayer = overlay.querySelector(`#${prefix}HorizonLayer`);
      const ascBeamRect = overlay.querySelector(`#${prefix}AscBeamRect`);
      const eclipseGroup = overlay.querySelector(`#${prefix}EclipseGroup`);
      const eclipseRays = overlay.querySelector(`#${prefix}EclipseRays`);
      const structuresGroup = overlay.querySelector(`#${prefix}StructuresGroup`);
      const heroAuraCircle = overlay.querySelector(`#${prefix}HeroAuraCircle`);
      const heroCoreGlow = overlay.querySelector(`#${prefix}HeroCoreGlow`);
      const ring1 = overlay.querySelector(`#${prefix}Ring1`);
      const ring2 = overlay.querySelector(`#${prefix}Ring2`);
      const ring3 = overlay.querySelector(`#${prefix}Ring3`);
      const crackLines = overlay.querySelector(`#${prefix}CrackLines`);
      const heroEmperor = overlay.querySelector(`#${prefix}HeroEmperor`);
      const heroBase = heroEmperor.querySelector('.cs-emperor-base');
      const heroAsc = heroEmperor.querySelector('.cs-emperor-ascended');
      const stampedeLayer = overlay.querySelector(`#${prefix}StampedeLayer`);
      const shockwaveEl = overlay.querySelector(`#${prefix}Shockwave`);
      const ambientLayer = overlay.querySelector(`#${prefix}AmbientParticles`);
      const shardLayer = overlay.querySelector(`#${prefix}ShardParticles`);
      const debrisLayer = overlay.querySelector(`#${prefix}DebrisParticles`);
      const vignetteEl = overlay.querySelector(`#${prefix}Vignette`);
      const flashEl = overlay.querySelector(`#${prefix}Flash`);
      const bannerEl = overlay.querySelector(`#${prefix}Banner`);
      const tierTitleEl = overlay.querySelector(`#${prefix}TierTitle`);
      const multPillEl = overlay.querySelector(`#${prefix}MultPill`);
      const essencePillEl = overlay.querySelector(`#${prefix}EssencePill`);
      const skipBtn = overlay.querySelector(`#${prefix}SkipBtn`);

      const stars = [];
      for (let i = 0; i < 34; i++) {
        const sx = Math.random() * 1000;
        const sy = Math.random() * 680;
        const sr = 1 + Math.random() * 2.2;
        const el = makeSvgEl('circle', { cx: sx.toFixed(1), cy: sy.toFixed(1), r: sr.toFixed(1), fill: '#e0f2fe', opacity: '0.5' });
        starsLayer.appendChild(el);
        stars.push({ el, phase: Math.random() * Math.PI * 2, speed: 1.5 + Math.random() * 3 });
      }

      const blizzardStreaks = [];
      const auroraRibbons = [];
      const eclipseRayEls = [];

      if (cfg.atmosphere === 'blizzard') {
        const rad = (cfg.streakAngleDeg * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const streakCount = 44 + Math.floor(Math.random() * 20);
        for (let i = 0; i < streakCount; i++) {
          const len = 65 + Math.random() * 145;
          const el = makeSvgEl('line', {
            x1: 0, y1: 0,
            x2: (dx * len).toFixed(1), y2: (dy * len).toFixed(1),
            stroke: i % 3 === 0 ? '#e0f2fe' : '#7dd3fc',
            'stroke-width': (1.4 + Math.random() * 2.4).toFixed(1),
            'stroke-linecap': 'round',
            opacity: (0.28 + Math.random() * 0.55).toFixed(2)
          });
          atmoLayer.appendChild(el);
          blizzardStreaks.push({
            el,
            x: Math.random() * 1200 - 100,
            y: Math.random() * 1200 - 100,
            speed: 780 + Math.random() * 720,
            dx, dy
          });
        }
      } else if (cfg.atmosphere === 'aurora') {
        for (let r = 0; r < 3; r++) {
          const pathEl = makeSvgEl('path', {
            d: 'M-50,240 Q250,150 500,220 T1050,190 L1050,420 Q750,350 500,400 T-50,380 Z',
            fill: `url(#${prefix}Aurora${(r % 2) + 1})`,
            opacity: (0.44 + r * 0.14).toFixed(2)
          });
          atmoLayer.appendChild(pathEl);
          auroraRibbons.push({ el: pathEl, baseY: 130 + r * 95, amp: 36 + r * 18, phase: r * 2.1, speed: 0.9 + r * 0.32 });
        }
      } else if (cfg.atmosphere === 'eclipse') {
        eclipseGroup.setAttribute('opacity', '1');
        for (let i = 0; i < cfg.rayCount; i++) {
          const angle = (i / cfg.rayCount) * 360 + (Math.random() - 0.5) * 8;
          const rayLen = 220 + Math.random() * 210;
          const halfW = 6 + Math.random() * 11;
          const poly = makeSvgEl('polygon', {
            points: `0,0 ${-halfW},${-rayLen} ${halfW},${-rayLen}`,
            fill: i % 2 === 0 ? '#fef08a' : '#e0f2fe',
            opacity: (0.35 + Math.random() * 0.45).toFixed(2),
            transform: `translate(0, -26) rotate(${angle.toFixed(1)})`
          });
          eclipseRays.appendChild(poly);
          eclipseRayEls.push({ el: poly, baseAngle: angle, spin: (Math.random() - 0.5) * 8 });
        }
      }

      const stampedeSprites = [];
      if (cfg.choreography === 'stampede') {
        const runnerCount = 15 + Math.floor(Math.random() * 6);
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < runnerCount; i++) {
          const kindRoll = i % 3;
          const g = makeSvgEl('g', { opacity: '0' });
          g.innerHTML = kindRoll === 0
            ? PrestigeSpriteFactory.sliderGroup()
            : kindRoll === 1
              ? PrestigeSpriteFactory.adelieGroup()
              : PrestigeSpriteFactory.cyberGroup();
          stampedeLayer.appendChild(g);
          const depth = 0.65 + (i / runnerCount) * 0.95;
          stampedeSprites.push({
            el: g,
            dir,
            startTime: 1.85 + (i / runnerCount) * 2.45,
            duration: 1.55 + Math.random() * 0.65,
            yBase: -220 + ((i * 73) % 440),
            scale: depth * (kindRoll === 0 ? 1.55 : 0.95),
            bobPhase: Math.random() * Math.PI * 2
          });
        }
      }

      const ambientParticles = [];
      for (let i = 0; i < cfg.ambientCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startDist = 230 + Math.random() * 210;
        const size = 3 + Math.random() * 5.5;
        const isDiamond = i % 3 === 0;
        const el = isDiamond
          ? makeSvgEl('polygon', {
              points: PrestigeSpriteFactory.frostCrystalPolygon(size),
              fill: i % 2 === 0 ? '#bae6fd' : '#fde68a',
              opacity: '0'
            })
          : makeSvgEl('circle', {
              cx: 0, cy: 0, r: (size * 0.65).toFixed(1),
              fill: cfg.atmosphere === 'aurora' && i % 2 === 0 ? '#6ee7b7' : '#e0f2fe',
              opacity: '0'
            });
        ambientLayer.appendChild(el);
        ambientParticles.push({
          el,
          angle,
          startDist,
          orbitSpeed: (0.45 + Math.random() * 1.1) * cfg.ringSpinDir,
          phase: Math.random(),
          spinSpeed: (Math.random() - 0.5) * 220
        });
      }

      const shards = [];
      for (let i = 0; i < cfg.shardCount; i++) {
        const angle = (i / cfg.shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const size = 10 + Math.random() * 18;
        const fills = ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#fde68a'];
        const el = makeSvgEl('polygon', {
          points: PrestigeSpriteFactory.iceShardPolygon(size),
          fill: fills[i % fills.length],
          stroke: '#ffffff',
          'stroke-width': '0.9',
          opacity: '0'
        });
        shardLayer.appendChild(el);
        shards.push({
          el,
          angle,
          speed: 220 + Math.random() * 380,
          rot0: Math.random() * 360,
          spin: (Math.random() - 0.5) * 520
        });
      }

      const debris = [];
      for (let i = 0; i < cfg.debrisCount; i++) {
        const size = 7 + Math.random() * 11;
        const el = makeSvgEl('polygon', {
          points: PrestigeSpriteFactory.iceShardPolygon(size),
          fill: i % 3 === 0 ? '#fef08a' : '#bae6fd',
          stroke: '#e0f2fe',
          'stroke-width': '0.8',
          opacity: '0'
        });
        debrisLayer.appendChild(el);
        debris.push({
          el,
          x0: (Math.random() - 0.5) * 560,
          y0: -120 + Math.random() * 360,
          vx: (Math.random() - 0.5) * 26,
          vy: -(16 + Math.random() * 28),
          rot0: Math.random() * 360,
          spin: (Math.random() - 0.5) * 65,
          phase: Math.random() * Math.PI * 2
        });
      }

      const runResetOnce = () => {
        if (this.hasExecutedReset) return this.resetResult;
        this.hasExecutedReset = true;
        if (typeof this.onClimaxResetCb === 'function') {
          this.resetResult = this.onClimaxResetCb();
        }
        const st = this._getState();
        const finalShards = (st && st.prestigeShards) || pendingShards;
        const res = this.resetResult || {
          totalRebirths: (st && st.totalRebirths) || 1,
          essenceGained: pendingShards,
          totalEssenceAfter: finalShards,
          multiplierPct: formatPrestigeBonusPctSafe(finalShards),
          multiplierFactor: (st && typeof st.getPrestigeMultiplier === 'function')
            ? st.getPrestigeMultiplier()
            : calculatePrestigeMultiplierSafe(finalShards)
        };
        tierTitleEl.textContent = `REBIRTH TIER #${res.totalRebirths}`;
        multPillEl.textContent = `${res.multiplierFactor.toFixed(2)}× OUTPUT (+${res.multiplierPct}%)`;
        essencePillEl.textContent = `+${res.essenceGained} 💎 (${res.totalEssenceAfter} Total)`;
        return res;
      };

      const stopScore = () => {
        if (this.winterScoreCtrl) {
          this.winterScoreCtrl.stop();
          this.winterScoreCtrl = null;
        }
      };

      const cleanupAndFinish = () => {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        stopScore();
        runResetOnce();
        if (this.overlayEl) {
          this.overlayEl.remove();
          this.overlayEl = null;
        }
        this.isActive = false;
        const s = this._getSound();
        if (s && typeof s.setCutsceneMode === 'function') {
          s.setCutsceneMode(false);
        }
        const cb = this.onCompleteCb;
        const result = this.resetResult;
        this.onCompleteCb = null;
        this.onClimaxResetCb = null;
        if (typeof cb === 'function') {
          cb(result);
        }
      };

      const blockBgEvent = (e) => { e.stopPropagation(); };
      overlay.addEventListener('click', blockBgEvent);
      overlay.addEventListener('pointerdown', blockBgEvent);
      overlay.addEventListener('touchstart', blockBgEvent, { passive: true });

      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isSkipping) return;
        this.isSkipping = true;
        this.skipFadeStart = performance.now();
        stopScore();
        runResetOnce();
      });

      // Start fun winter-themed procedural Web Audio soundtrack
      if (soundInst && typeof soundInst.startPrestigeWinterScore === 'function') {
        this.winterScoreCtrl = soundInst.startPrestigeWinterScore();
      }
      let climaxAudioFired = false;

      const startPerf = performance.now();
      let prevPerf = startPerf;

      const easeInOut = (x) => {
        const c = Math.max(0, Math.min(1, x));
        return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
      };

      const tick = (now) => {
        if (!this.isActive) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - prevPerf) / 1000));
        prevPerf = now;

        if (this.isSkipping) {
          const skipT = Math.min(1, Math.max(0, (now - this.skipFadeStart) / 320));
          overlay.style.opacity = String(1 - skipT);
          if (skipT >= 1) {
            cleanupAndFinish();
            return;
          }
          this.rafId = requestAnimationFrame(tick);
          return;
        }

        const t = Math.max(0, (now - startPerf) / 1000);
        if (t >= 10.0) {
          cleanupAndFinish();
          return;
        }

        // 1. Overlay Entry (0.0-0.35s) & Smooth Luminous Fade-Out (9.0-10.0s, WebView-safe)
        if (t < 0.35) {
          overlay.style.opacity = String(Math.min(1, t / 0.35));
        } else if (t >= 9.0) {
          const exitU = Math.min(1, (t - 9.0) / 1.0);
          const easedExit = easeInOut(exitU);
          overlay.style.opacity = String(Math.max(0, 1 - easedExit));
        } else {
          overlay.style.opacity = '1';
        }

        // 2. Optional Skip Button reveal after 1.5s
        if (t >= 1.5 && !skipBtn.classList.contains('is-visible')) {
          skipBtn.classList.add('is-visible');
        }

        // 3. Winter-Themed Procedural Audio Timeline
        if (this.winterScoreCtrl) {
          this.winterScoreCtrl.update(t);
        }
        if (!climaxAudioFired && t >= 5.85) {
          climaxAudioFired = true;
          if (this.winterScoreCtrl) {
            this.winterScoreCtrl.triggerClimax();
          }
          if (soundInst && typeof soundInst.triggerHaptic === 'function') {
            soundInst.triggerHaptic('celebrate', 0, { allowInCutscene: true });
          }
        }

        // 4. Exact 6.0s Climax State Reset Execution
        if (t >= 6.0 && !this.hasExecutedReset) {
          runResetOnce();
        }

        // 5. Camera Shake & Atmospheric Color Grading
        let shakeAmp = 0;
        if (t < 2.0) {
          shakeAmp = (t / 2.0) * 3.2;
        } else if (t < 5.5) {
          shakeAmp = 3.2 + ((t - 2.0) / 3.5) * 9.5;
        } else if (t < 6.5) {
          const climaxPeak = 1 - Math.abs((t - 5.75) / 0.75);
          shakeAmp = 10 + Math.max(0, climaxPeak) * 18;
        } else if (t < 8.0) {
          shakeAmp = (1 - (t - 6.5) / 1.5) * 4.5;
        }
        const atmoShakeBoost = cfg.atmosphere === 'blizzard' ? 1.35 : 1.0;
        const sx = (Math.random() - 0.5) * 2 * shakeAmp * cfg.shakeScale * atmoShakeBoost;
        const sy = (Math.random() - 0.5) * 2 * shakeAmp * cfg.shakeScale * atmoShakeBoost;
        camEl.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0)`;

        const vigOp = t < 2.0 ? (0.45 + (t / 2.0) * 0.45) : t < 5.5 ? 0.9 : t < 6.5 ? 0.45 : 0.62;
        vignetteEl.style.opacity = vigOp.toFixed(3);

        // 6. Update Stars & Chosen Atmosphere
        for (let i = 0; i < stars.length; i++) {
          const st = stars[i];
          const op = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.speed + st.phase));
          st.el.setAttribute('opacity', op.toFixed(2));
        }

        if (cfg.atmosphere === 'blizzard') {
          const galeMult = t < 2.0 ? 0.8 : t < 6.5 ? 1.55 : 0.65;
          for (let i = 0; i < blizzardStreaks.length; i++) {
            const s = blizzardStreaks[i];
            s.x += s.dx * s.speed * galeMult * dt;
            s.y += s.dy * s.speed * galeMult * dt;
            if (s.x > 1120) s.x -= 1240;
            if (s.y > 1120) s.y -= 1240;
            s.el.setAttribute('transform', `translate(${s.x.toFixed(1)}, ${s.y.toFixed(1)})`);
          }
        } else if (cfg.atmosphere === 'aurora') {
          for (let i = 0; i < auroraRibbons.length; i++) {
            const rb = auroraRibbons[i];
            const wave1 = Math.sin(t * rb.speed + rb.phase) * rb.amp;
            const wave2 = Math.cos(t * rb.speed * 0.85 + rb.phase + 1.2) * rb.amp;
            const y0 = rb.baseY + wave1;
            const y1 = rb.baseY - wave2;
            const y2 = rb.baseY + wave1 * 0.7;
            rb.el.setAttribute('d', `M-60,${y0.toFixed(1)} Q260,${(y1 - 60).toFixed(1)} 500,${y2.toFixed(1)} T1060,${y1.toFixed(1)} L1060,${(y1 + 210).toFixed(1)} Q740,${(y2 + 160).toFixed(1)} 500,${(y0 + 195).toFixed(1)} T-60,${(y0 + 180).toFixed(1)} Z`);
          }
        } else if (cfg.atmosphere === 'eclipse') {
          const rayOp = t < 5.45 ? 0 : t < 6.5 ? Math.min(1, (t - 5.45) / 0.35) : Math.max(0.28, 1 - (t - 6.5) * 0.28);
          const rayScale = t < 5.45 ? 0.35 : Math.min(1.35, 0.35 + (t - 5.45) * 1.6);
          eclipseRays.setAttribute('opacity', rayOp.toFixed(3));
          for (let i = 0; i < eclipseRayEls.length; i++) {
            const r = eclipseRayEls[i];
            const ang = r.baseAngle + t * r.spin;
            r.el.setAttribute('transform', `translate(0, -26) rotate(${ang.toFixed(1)}) scale(${rayScale.toFixed(2)})`);
          }
        }

        // 7. Chosen Choreography Animation
        const escU = easeInOut((t - 2.0) / 3.5);
        const isAscended = t >= 5.65;
        heroBase.setAttribute('opacity', isAscended ? '0' : '1');
        heroAsc.setAttribute('opacity', isAscended ? '1' : '0');

        let heroY = 62;
        let heroScale = 1.65;
        let structY = 128;
        let structOp = 1;
        let horizonY = 0;

        if (cfg.choreography === 'ascension') {
          horizonY = escU * 240;
          structY = 128 + escU * 290;
          structOp = Math.max(0, 1 - escU * 1.15);
          heroY = 62 - escU * 92 + (t >= 6.5 ? Math.sin((t - 6.5) * 2.8) * 9 : 0);
          heroScale = 1.55 + escU * 0.55;
          const beamOp = t < 1.6 ? 0 : t < 5.5 ? Math.min(0.82, (t - 1.6) / 3.4) : t < 6.5 ? 1 : Math.max(0.28, 0.85 - (t - 6.5) * 0.18);
          const beamW = 28 + escU * 190 + (t >= 5.5 ? 110 : 0);
          ascBeamRect.setAttribute('opacity', beamOp.toFixed(3));
          ascBeamRect.setAttribute('x', (-beamW * 0.5).toFixed(1));
          ascBeamRect.setAttribute('width', beamW.toFixed(1));
        } else if (cfg.choreography === 'shattering') {
          const zoomU = t < 5.5 ? escU : 1;
          structY = 128 + zoomU * 120;
          structOp = t < 5.5 ? Math.max(0.12, 1 - zoomU * 0.85) : 0;
          heroY = 46 - zoomU * 76 + (t >= 6.5 ? Math.sin((t - 6.5) * 2.6) * 7 : 0);
          heroScale = t < 5.5
            ? (1.6 + zoomU * 1.08)
            : t < 6.5
              ? (2.68 - easeInOut((t - 5.5) / 1.0) * 0.52)
              : 2.16;
          const crackOp = t < 2.2 ? 0 : t < 5.55 ? Math.min(0.95, (t - 2.2) / 2.6) : 0;
          crackLines.setAttribute('opacity', crackOp.toFixed(3));
          const crackScale = 0.72 + zoomU * 0.52;
          crackLines.setAttribute('transform', `translate(0, ${(heroY - 8).toFixed(1)}) scale(${crackScale.toFixed(2)})`);
          ascBeamRect.setAttribute('opacity', t >= 5.5 ? Math.max(0.18, 0.7 - (t - 5.5) * 0.14).toFixed(3) : '0');
        } else {
          structY = 128 + (t >= 5.5 ? 48 : escU * 32);
          structOp = t < 5.5 ? 0.92 : 0.72;
          heroY = t < 5.5 ? 54 - escU * 52 : -22 + Math.sin((t - 5.5) * 2.7) * 8;
          heroScale = t < 5.5 ? (1.45 + escU * 0.45) : 2.1;
          for (let i = 0; i < stampedeSprites.length; i++) {
            const sp = stampedeSprites[i];
            const localU = (t - sp.startTime) / sp.duration;
            if (localU < 0 || localU > 1) {
              sp.el.setAttribute('opacity', '0');
            } else {
              const startX = -460 * sp.dir;
              const endX = 460 * sp.dir;
              const x = startX + (endX - startX) * localU;
              const y = sp.yBase + Math.sin(localU * Math.PI * 5 + sp.bobPhase) * 14;
              const fade = localU < 0.12 ? localU / 0.12 : localU > 0.85 ? (1 - localU) / 0.15 : 1;
              sp.el.setAttribute('opacity', fade.toFixed(2));
              sp.el.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)}) scale(${(sp.scale * sp.dir).toFixed(2)}, ${sp.scale.toFixed(2)})`);
            }
          }
          ascBeamRect.setAttribute('opacity', t >= 5.5 ? Math.max(0.16, 0.62 - (t - 5.5) * 0.12).toFixed(3) : '0');
        }

        horizonLayer.setAttribute('transform', `translate(0, ${horizonY.toFixed(1)})`);
        structuresGroup.setAttribute('transform', `translate(0, ${structY.toFixed(1)})`);
        structuresGroup.setAttribute('opacity', structOp.toFixed(3));

        const breathe = t >= 6.5 ? (1 + Math.sin((t - 6.5) * 3.4) * 0.04) : 1;
        heroEmperor.setAttribute('transform', `translate(0, ${heroY.toFixed(1)}) scale(${(heroScale * breathe).toFixed(3)})`);

        // Pure vector radial glow behind Emperor Penguin (artifact-free on Android WebView)
        const auraOp = t < 2.0 ? (t / 2.0) * 0.30 : t < 5.5 ? (0.30 + escU * 0.58) : (0.72 + Math.sin(t * 4.5) * 0.20);
        const auraScale = t < 5.5 ? (0.78 + escU * 0.58) : (1.30 + Math.sin(t * 3.8) * 0.14);
        heroAuraCircle.setAttribute('opacity', auraOp.toFixed(3));
        heroAuraCircle.setAttribute('transform', `translate(0, ${(heroY - 10).toFixed(1)}) scale(${auraScale.toFixed(2)})`);

        if (heroCoreGlow) {
          const coreGlowUrl = isAscended ? `url(#${prefix}HeroGoldGlow)` : `url(#${prefix}HeroCyanGlow)`;
          if (heroCoreGlow.getAttribute('fill') !== coreGlowUrl) {
            heroCoreGlow.setAttribute('fill', coreGlowUrl);
          }
          const coreScale = t < 2.0 ? 0.72 : t < 5.5 ? (0.72 + escU * 0.62) : t < 6.5 ? 1.52 : (1.18 + Math.sin(t * 4.2) * 0.14);
          const coreOp = t < 2.0 ? (0.28 + (t / 2.0) * 0.22) : t < 5.5 ? (0.50 + escU * 0.36) : (0.76 + Math.sin(t * 4.2) * 0.16);
          heroCoreGlow.setAttribute('opacity', coreOp.toFixed(3));
          heroCoreGlow.setAttribute('transform', `translate(0, ${(heroY - 8).toFixed(1)}) scale(${coreScale.toFixed(2)})`);
        }

        // 8. Tightening Concentric Energy Rings
        const ringTighten = t < 5.5 ? (1.22 - Math.min(1, t / 5.5) * 0.72) : (0.65 + (t - 5.5) * 0.22);
        const ringOp = t < 0.8 ? 0 : t < 5.5 ? Math.min(0.88, (t - 0.8) / 2.5) : Math.max(0, 0.85 - (t - 5.5) * 0.65);
        const ringSpeed = (38 + escU * 185) * cfg.ringSpinDir;
        ring1.setAttribute('opacity', ringOp.toFixed(3));
        ring2.setAttribute('opacity', (ringOp * 0.9).toFixed(3));
        ring3.setAttribute('opacity', (ringOp * 0.8).toFixed(3));
        ring1.setAttribute('transform', `rotate(${(t * ringSpeed).toFixed(1)}) scale(${ringTighten.toFixed(3)})`);
        ring2.setAttribute('transform', `rotate(${(-t * ringSpeed * 1.35).toFixed(1)}) scale(${(ringTighten * 0.96).toFixed(3)})`);
        ring3.setAttribute('transform', `rotate(${(t * ringSpeed * 1.8).toFixed(1)}) scale(${(ringTighten * 0.92).toFixed(3)})`);

        // 9. Converging Ambient Particles
        for (let i = 0; i < ambientParticles.length; i++) {
          const p = ambientParticles[i];
          if (t < 5.6) {
            const pullRate = t < 2.0 ? 0.35 : 0.72;
            const cycle = (p.phase + t * pullRate) % 1;
            const dist = p.startDist * (1 - easeInOut(cycle));
            const ang = p.angle + t * p.orbitSpeed;
            const px = Math.cos(ang) * dist;
            const py = (heroY - 12) + Math.sin(ang) * dist * 0.85;
            const op = cycle < 0.15 ? cycle / 0.15 : cycle > 0.85 ? (1 - cycle) / 0.15 : 0.88;
            p.el.setAttribute('opacity', op.toFixed(2));
            p.el.setAttribute('transform', `translate(${px.toFixed(1)}, ${py.toFixed(1)}) rotate(${(t * p.spinSpeed).toFixed(1)})`);
          } else {
            p.el.setAttribute('opacity', '0');
          }
        }

        // 10. Climax Screen Flash, Shockwave & Radial Ice Shards
        if (t >= 5.5 && t <= 6.65) {
          const cu = (t - 5.5) / 1.15;
          const flashPeak = cu < 0.18 ? (cu / 0.18) : Math.max(0, 1 - (cu - 0.18) / 0.65);
          flashEl.style.opacity = (flashPeak * 0.95).toFixed(3);

          const swR = 18 + easeInOut(cu) * 440;
          const swOp = Math.max(0, 1 - cu * 1.15);
          shockwaveEl.setAttribute('cy', String((heroY - 10).toFixed(1)));
          shockwaveEl.setAttribute('r', swR.toFixed(1));
          shockwaveEl.setAttribute('stroke-width', Math.max(1.5, 14 * (1 - cu)).toFixed(1));
          shockwaveEl.setAttribute('opacity', swOp.toFixed(3));
        } else {
          flashEl.style.opacity = '0';
          shockwaveEl.setAttribute('opacity', '0');
        }

        if (t >= 5.5 && t <= 7.8) {
          const st = t - 5.5;
          const drag = 1 - Math.exp(-st * 1.45);
          const shardOp = st < 0.1 ? st / 0.1 : Math.max(0, 1 - (st - 0.55) / 1.6);
          for (let i = 0; i < shards.length; i++) {
            const sh = shards[i];
            const d = sh.speed * drag * 0.85;
            const sxPos = Math.cos(sh.angle) * d;
            const syPos = (heroY - 12) + Math.sin(sh.angle) * d + st * st * 18;
            const rot = sh.rot0 + sh.spin * st;
            sh.el.setAttribute('opacity', shardOp.toFixed(2));
            sh.el.setAttribute('transform', `translate(${sxPos.toFixed(1)}, ${syPos.toFixed(1)}) rotate(${rot.toFixed(1)})`);
          }
        } else {
          for (let i = 0; i < shards.length; i++) shards[i].el.setAttribute('opacity', '0');
        }

        // 11. Spring-Physics Typography Slam
        if (t >= 6.0) {
          const bt = t - 6.0;
          const springScale = 1 - Math.exp(-7.2 * bt) * Math.cos(14.5 * bt);
          const translateY = Math.exp(-7.2 * bt) * 34;
          const bannerOp = Math.min(1, bt / 0.14);
          bannerEl.style.opacity = bannerOp.toFixed(3);
          bannerEl.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${Math.max(0.2, springScale).toFixed(3)})`;
        }

        // 12. Low-Gravity Aftermath Floating Ice Debris
        if (t >= 6.2) {
          const dtAfter = t - 6.2;
          const debOp = dtAfter < 0.45 ? dtAfter / 0.45 : t > 8.9 ? Math.max(0, 1 - (t - 8.9) / 0.9) : 0.82;
          for (let i = 0; i < debris.length; i++) {
            const db = debris[i];
            const dxPos = db.x0 + db.vx * dtAfter + Math.sin(dtAfter * 1.4 + db.phase) * 14;
            const dyPos = db.y0 + db.vy * dtAfter;
            const rot = db.rot0 + db.spin * dtAfter;
            db.el.setAttribute('opacity', debOp.toFixed(2));
            db.el.setAttribute('transform', `translate(${dxPos.toFixed(1)}, ${dyPos.toFixed(1)}) rotate(${rot.toFixed(1)})`);
          }
        }

        this.rafId = requestAnimationFrame(tick);
      };

      this.rafId = requestAnimationFrame(tick);
      return cfg;
    }
  }

  const api = {
    PrestigeSpriteFactory,
    PrestigeCutsceneController
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.GlacialCore = globalScope.GlacialCore || {};
    globalScope.GlacialCore.PrestigeCutscene = api;
    globalScope.PrestigeSpriteFactory = PrestigeSpriteFactory;
    globalScope.PrestigeCutsceneController = PrestigeCutsceneController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
