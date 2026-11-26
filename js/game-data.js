(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.GameData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PENGUIN_SPECIES = [
    {
      id: 'adelie',
      name: 'Adélie Scout',
      avatar: '🐧',
      accentColor: '#34d399',
      desc: 'Lightweight & swift waddler',
      baseCost: 15,
      costMult: 1.15,
      baseYield: 1,
      baseSpeed: 1.6,
      diveTime: 1.5,
      color: '#1e293b'
    },
    {
      id: 'gentoo',
      name: 'Gentoo Skater',
      avatar: '🛷',
      accentColor: '#fb923c',
      desc: 'Belly-slides across ice at high velocity',
      baseCost: 100,
      costMult: 1.16,
      baseYield: 5,
      baseSpeed: 2.5,
      diveTime: 1.2,
      color: '#ea580c'
    },
    {
      id: 'chinstrap',
      name: 'Chinstrap Diver',
      avatar: '🤿',
      accentColor: '#38bdf8',
      desc: 'Deep marine specialist with large catch capacity',
      baseCost: 800,
      costMult: 1.17,
      baseYield: 24,
      baseSpeed: 1.8,
      diveTime: 0.9,
      color: '#0284c7'
    },
    {
      id: 'emperor',
      name: 'Emperor Monarch',
      avatar: '👑',
      accentColor: '#fbbf24',
      desc: 'Regal majesty with aura speeding up nearby penguins',
      baseCost: 5000,
      costMult: 1.18,
      baseYield: 120,
      baseSpeed: 1.2,
      diveTime: 1.8,
      color: '#f59e0b'
    },
    {
      id: 'cyber',
      name: 'Cyber/Mecha Penguin',
      avatar: '🤖',
      accentColor: '#22d3ee',
      desc: 'Equipped with rocket thrusters & sub-zero lasers',
      baseCost: 35000,
      costMult: 1.20,
      baseYield: 650,
      baseSpeed: 3.2,
      diveTime: 0.6,
      color: '#38bdf8'
    }
  ];

  const PENGUIN_TRAITS = [
    { id: 'optimistic', name: 'Optimistic', icon: '☀️', color: '#34d399', effectLabel: '+20% waddle speed', speedMult: 1.20, costMult: 1.0, yieldMult: 1.0, diveSpeedMult: 1.0 },
    { id: 'lazy', name: 'Lazy', icon: '💤', color: '#94a3b8', effectLabel: '-20% speed, -15% cost', speedMult: 0.80, costMult: 0.85, yieldMult: 1.0, diveSpeedMult: 1.0 },
    { id: 'greedy', name: 'Greedy', icon: '💰', color: '#fbbf24', effectLabel: '+20% catch, +10% cost', speedMult: 1.0, costMult: 1.10, yieldMult: 1.20, diveSpeedMult: 1.0 },
    { id: 'energetic', name: 'Energetic', icon: '⚡', color: '#38bdf8', effectLabel: '+25% dive speed', speedMult: 1.05, costMult: 1.0, yieldMult: 1.0, diveSpeedMult: 1.25 },
    { id: 'focused', name: 'Focused', icon: '🎯', color: '#c084fc', effectLabel: '+15% catch, -5% speed', speedMult: 0.95, costMult: 1.0, yieldMult: 1.15, diveSpeedMult: 1.0 },
    { id: 'thrifty', name: 'Thrifty', icon: '🏷️', color: '#2dd4bf', effectLabel: '-10% recruit cost', speedMult: 1.0, costMult: 0.90, yieldMult: 1.0, diveSpeedMult: 1.0 }
  ];

  const WEATHER_CYCLE_SECONDS = 300; // 5 minutes per weather state
  const COLONY_SPEECH_INTERVAL_SECONDS = 300; // 5 minutes per colony between speakers
  const COLONY_SPEECH_INTERVAL_MS = COLONY_SPEECH_INTERVAL_SECONDS * 1000;

  const WEATHER_TYPES = [
    { id: 'clear', name: 'Clear', icon: '☀️', yieldMult: 1.0, snowFactor: 0.1, windFactor: 0.25, fogFactor: 0.0, badgeColor: '#38bdf8', desc: 'Crisp polar skies with clear visibility.' },
    { id: 'light_snow', name: 'Light Snow', icon: '❄️', yieldMult: 1.0, snowFactor: 0.42, windFactor: 0.75, fogFactor: 0.08, badgeColor: '#93c5fd', desc: 'Gentle Antarctic snowfall drifting across the shelf.' },
    { id: 'blizzard', name: 'Blizzard', icon: '🌨️', yieldMult: 1.20, snowFactor: 1.0, windFactor: 3.4, fogFactor: 1.0, badgeColor: '#c084fc', desc: 'Heavy whiteout storm decreases visibility, +20% Fish Yield!' }
  ];

  function getTraitDef(traitId) {
    return PENGUIN_TRAITS.find(t => t.id === traitId) || PENGUIN_TRAITS[0];
  }

  function rollRandomTraitId(rng) {
    const rand = typeof rng === 'function' ? rng() : Math.random();
    const idx = Math.max(0, Math.min(PENGUIN_TRAITS.length - 1, Math.floor(rand * PENGUIN_TRAITS.length)));
    return PENGUIN_TRAITS[idx].id;
  }

  // Verified true penguin facts spoken in-character by penguins
  const PENGUIN_TRUE_FACTS = {
    general: [
      'True fact: Our black-and-white tuxedo pattern is called countershading — it camouflages us from predators above and below!',
      'True fact: Penguins have a special supraorbital gland above our eyes that filters salt from seawater so we can drink it safely!',
      'True fact: Unlike flying birds with hollow bones, penguins have dense, solid bones that help us dive deeper underwater!',
      'True fact: We spread waterproofing oil from a preen gland near our tails across tightly packed feathers to stay warm!',
      'True fact: Penguins do not have teeth — backward-facing spines on our tongues and throats help us grip slippery fish!',
      'True fact: Penguins leap out of the water in arcs called porpoising to take quick breaths without slowing down!',
      'True fact: Once a year, penguins replace every single feather at once during a dry-land phase called a catastrophic molt!',
      'True fact: Penguins actually have knees! They stay tucked cleanly inside our warm, feathered lower bodies.'
    ],
    adelie: [
      'Adélie fact: We gift smooth, round pebbles when building our nests — and sometimes sneak extra stones from neighbors!',
      'Adélie fact: Named in 1840 after Adèle Dumont d’Urville, we are one of the true Antarctic mainland breeding penguins!',
      'Adélie fact: Adélie colonies follow the edge of shifting sea ice for thousands of kilometers each winter to reach sunlight!'
    ],
    gentoo: [
      'Gentoo fact: Gentoos are the fastest underwater swimming birds on Earth, clocking speeds up to 22 mph (36 km/h)!',
      'Gentoo fact: You can always recognize a Gentoo by the bright white patch across the top of our head and orange-red bill!',
      'Gentoo fact: When snow gets deep, Gentoos tuck our flippers and toboggan belly-first to glide smoothly over ice!'
    ],
    chinstrap: [
      'Chinstrap fact: That crisp black band under my chin looks like a tiny helmet strap, giving Chinstraps our name!',
      'Chinstrap fact: Chinstrap penguins take thousands of tiny 4-second microsleeps a day while guarding our nests!',
      'Chinstrap fact: Chinstraps are bold divers that plunge up to 70 meters deep hunting Antarctic krill and fish!'
    ],
    emperor: [
      'Emperor fact: Emperors are the tallest living penguin species, standing up to 4 feet (1.2 meters) tall!',
      'Emperor fact: Emperor dads balance a single egg on our feet under a warm brood pouch all through Antarctic winter!',
      'Emperor fact: Emperor penguins can dive deeper than any other bird — over 500 meters (1,800 ft) on one breath!',
      'Emperor fact: Emperor colonies huddle together in rotating shifts to share body heat against -40°C polar blizzards!'
    ],
    cyber: [
      'Penguin science fact: Penguin plumage packs over 100 interlocking feathers per square inch to lock out icy water!',
      'Hydrodynamic fact: Penguins swim using rigid wings as underwater hydrofoils, practically flying beneath the waves!',
      'Bio-thermal fact: Counter-current heat exchange keeps blood warm inside our legs while our feet stand on sub-zero ice!'
    ]
  };

  // Myth-busted penguin misconceptions paired with why each myth is incorrect
  const PENGUIN_MYTH_BUSTERS = {
    general: [
      'Myth: "Penguins only live in freezing Antarctica." Incorrect: While several species breed on Antarctic ice, most penguins live along temperate coasts—and Galápagos penguins live right on the equator!',
      'Myth: "Penguins do not have knees." Incorrect: Penguins actually have complete leg bones including femurs and knees, tucked neatly inside their feathered lower bodies for warmth and streamlining!',
      'Myth: "Polar bears hunt penguins in the wild." Incorrect: Wild polar bears live only in the Arctic North and penguins live in the Southern Hemisphere, so the two never cross paths in nature!',
      'Myth: "All penguins build nests out of snow and ice." Incorrect: Most species dig soil burrows, nest in coastal grass, or stack pebbles—and Emperors incubate eggs directly on their warm feet!',
      'Myth: "Penguins mate with the same partner forever." Incorrect: While many penguins reunite at familiar nest sites, high "divorce" rates happen whenever mates miss nesting timing or lose chicks.',
      'Myth: "Penguins are clumsy and slow everywhere." Incorrect: Penguins toboggan faster across snow than humans walk, climb steep rocky slopes, and rocket up to 6 feet out of the ocean onto ice!',
      'Myth: "Penguins stay warm solely from thick body fat." Incorrect: Interlocking, oil-proofed feathers trap a thermal air barrier that provides over 80% of our insulation—blubber alone is not enough!',
      'Myth: "Penguin wings are useless little stubs." Incorrect: Our stiff, flattened wings are underwater hydrofoils engineered for "flying" through ocean currents at high speed!'
    ],
    adelie: [
      'Myth: "Adélie penguins only eat fish." Incorrect: Tiny Antarctic krill actually make up the majority of an Adélie’s summer diet alongside small polar silverfish!'
    ],
    gentoo: [
      'Myth: "Gentoos always toboggan everywhere on land." Incorrect: Gentoos mostly waddle upright to protect their webbed feet and only slide belly-first when fresh snow or slick downhill ice speeds travel!'
    ],
    chinstrap: [
      'Myth: "A Chinstrap’s black band is just random belly speckles." Incorrect: It is a crisp, genetically distinct facial strap stretching ear-to-ear beneath the throat that identifies our species!'
    ],
    emperor: [
      'Myth: "Boss Emperors hoard the warm huddle center all winter." Incorrect: Emperor colonies rotate constantly in slow, wave-like steps so every bird takes equal turns inside and on the windy edge!'
    ],
    cyber: [
      'Myth: "Penguins die of thirst if they drink ocean water." Incorrect: Specialized supraorbital glands above our eyes filter excess salt straight out of seawater and flush brine droplets through our beaks!'
    ]
  };

  // In-character sayings tailored to each penguin's assigned trait
  const PENGUIN_TRAIT_SAYINGS = {
    optimistic: [
      'Nothing beats a fresh polar breeze — +20% waddle speed ahead!',
      'Even a whiteout blizzard feels bright when you waddle with a smile!',
      'Best glacier day ever! Who wants to race to the fishing hole?',
      'The snow is sparkling and the fish are practically waving at us!'
    ],
    lazy: [
      '*Yawn*... Can we please move the fishing hole closer to the igloo?',
      'Why sprint across the glacier when an 80% chill waddle gets you there too?',
      'Go on ahead... gliding slowly is my top energy-saving strategy.',
      'Honestly, taking a little snooze on this sunbeam sounds wonderful.'
    ],
    greedy: [
      'Dibs on the fattest silvery cod hiding under that ice hole!',
      'Count every fin twice — my pouch hauls +20% more fish per dive!',
      'More fish, shinier scales, taller stacks inside the igloo vault!',
      'No sharing this bucket — wait, maybe one extra sardine under each flipper.'
    ],
    energetic: [
      'SPLASH TIME! Watch me dive and surface +25% faster than the ripples!',
      'Zero hesitation — turbo flippers locked and ready for another plunge!',
      'Just finished 50 flipper-jacks! Let us hit the freezing water right now!',
      'Can not stop, will not stop! Quickest dive turnaround on the ice shelf!'
    ],
    focused: [
      'Locking eyes on a silver school darting right beneath the ice...',
      'Steady stride, calm breath, +15% precision catch every single dive.',
      'Tune out the freezing gusts — track the ripples and strike true.',
      'Careful aim always brings back heavier baskets to the colony depot.'
    ],
    thrifty: [
      'Smart recruiting saves 10% fish upfront for bigger glacier upgrades!',
      'Budget tip from ice HQ: bundle up, waste zero krill, grow steady!',
      'Scored a cozy bunk in the igloo at a crisp colony discount!',
      'Every single fish saved today builds tomorrow’s frosted empire!'
    ]
  };

  // Ordered newest-first; contains only the current update notice so launch alerts stay focused
  const APP_FEATURE_RELEASES = [
    {
      id: '2026-11-update-v26',
      version: '2.6',
      title: "What's New in Update 2.6",
      subtitle: '80% sky-view menu cap, interactive Shooting Stars & Krill Swarms, Ultra-Prestige Colony Wardrobe, and modular JS engine!',
      features: [
        {
          icon: '📱',
          title: '80% Vertical Menu Cap & Sky-Tap Shrink',
          desc: 'The colony drawer now caps cleanly at 80% height so your top HUD and aurora sky always stay visible and interactive — tap empty sky above the menu to shrink it back.'
        },
        {
          icon: '🌠',
          title: 'Sky & Ice Mini-Events + Starlight Frenzy',
          desc: 'Tap Shooting Stars gliding through the upper sky and shimmering Krill Swarms near the waterline to build a 1×–5× Sky Combo and trigger a 15-second 2× Starlight Frenzy!'
        },
        {
          icon: '🎩',
          title: 'Ultra-Prestige Colony Wardrobe (Per-Species Mixing)',
          desc: 'Unlock 5 luxury Frost Essence hats (100 to 10,000 💎) with tap-again purchase safety, mix hats per penguin species or dress the whole colony at once. Purely visual & resets on Rebirth.'
        },
        {
          icon: '📊',
          title: 'Expanded Stats & Modular JS Architecture',
          desc: 'Track lifetime Sky Events Caught, Best Sky Combo, and Parades Witnessed in the Stats tab, backed by 6 freshly extracted modular JS engines for faster maintenance and scaling.'
        }
      ]
    }
  ];
  const LATEST_FEATURE_RELEASE = APP_FEATURE_RELEASES[0];

  // Balance & Colony Constants
  const GLACIER_LEVEL_BONUS_RATE = 0.0425; // +4.25% per Glacier Level
  const COLONY_SIZE_BONUS_RATE = 0.1275;   // +12.75% per Penguin Level (every 10 recruits)
  const MAX_VISIBLE_PER_COLONY = 6;        // Max 6 visible sprites per unlocked species

  const COLONY_SYNERGIES = [
    {
      id: 'syn_ice_scouts',
      name: 'Ice Scout Pair',
      icon: '🛷',
      reqText: '10+ Adélie & 5+ Gentoo',
      buffText: '+6% Walk & Slide Speed',
      check: (s) => (s.penguins.adelie?.count || 0) >= 10 && (s.penguins.gentoo?.count || 0) >= 5,
      apply: (agg) => { agg.walkSlideMult *= 1.06; }
    },
    {
      id: 'syn_deep_crew',
      name: 'Deep-Sea Crew',
      icon: '🤿',
      reqText: '10+ Gentoo & 5+ Chinstrap',
      buffText: '+8% Dive Speed',
      check: (s) => (s.penguins.gentoo?.count || 0) >= 10 && (s.penguins.chinstrap?.count || 0) >= 5,
      apply: (agg) => { agg.diveSpeedMult *= 1.08; }
    },
    {
      id: 'syn_royal_court',
      name: 'Royal Court',
      icon: '👑',
      reqText: '10+ Chinstrap & 5+ Emperor',
      buffText: '+10% Catch Yield',
      check: (s) => (s.penguins.chinstrap?.count || 0) >= 10 && (s.penguins.emperor?.count || 0) >= 5,
      apply: (agg) => { agg.catchYieldMult *= 1.10; }
    },
    {
      id: 'syn_frost_singularity',
      name: 'Frost Singularity',
      icon: '🤖',
      reqText: '5+ Emperor & 1+ Cyber',
      buffText: '+12% All Fish Output',
      check: (s) => (s.penguins.emperor?.count || 0) >= 5 && (s.penguins.cyber?.count || 0) >= 1,
      apply: (agg) => { agg.allFishMult *= 1.12; }
    }
  ];

  const GLACIER_TECH = [
    {
      id: 'thermal_parkas',
      name: 'Thermal Insulation',
      icon: '🧥',
      desc: 'Colony waddles +15% faster per level',
      baseCost: 50,
      costMult: 1.35,
      effect: 0.15
    },
    {
      id: 'reinforced_line',
      name: 'Reinforced Fishing Lines',
      icon: '🎣',
      desc: 'Catch capacity +25% per level',
      baseCost: 200,
      costMult: 1.4,
      effect: 0.25
    },
    {
      id: 'smooth_ice',
      name: 'Smooth Ice Polishing',
      icon: '⛸️',
      desc: 'Slide velocity & frequency +30% per level',
      baseCost: 1000,
      costMult: 1.45,
      effect: 0.30
    },
    {
      id: 'bioluminescent_krill',
      name: 'Bioluminescent Krill',
      icon: '🦐',
      desc: 'Tap clicks yield +50% extra fish per level',
      baseCost: 5000,
      costMult: 1.5,
      effect: 0.50
    },
    {
      id: 'cryo_storage',
      name: 'Sub-Zero Cryo Storage',
      icon: '❄️',
      desc: 'Depot banking bonus +20% per level',
      baseCost: 25000,
      costMult: 1.6,
      effect: 0.20
    },
    {
      id: 'aurora_coils',
      name: 'Aurora Resonance Coils',
      icon: '🌌',
      desc: 'Aurora Blessing events arrive 4s faster per level',
      baseCost: 100000,
      costMult: 1.7,
      effect: 4
    }
  ];

  // 28 UNIQUE AURORA BLESSING PERKS
  const AURORA_PERKS_POOL = [
    { id: 't_pebble', tier: 1, rarity: 'trivial', name: 'Chilly Pebble', icon: '🪨', desc: 'Tripped on a smooth arctic pebble. +1 Flat Fish immediately.', grant: (g) => { g.addFish(1); } },
    { id: 't_slush', tier: 1, rarity: 'trivial', name: 'Slushy Feet (Debuff)', icon: '🧊', desc: 'Cold slush! -8% waddle speed for 20s, but grants +5 flat fish.', grant: (g) => { g.addFish(5); g.slushDebuffTimer = 20; } },
    { id: 't_breeze', tier: 1, rarity: 'trivial', name: 'Breeze of Frost', icon: '💨', desc: 'A tiny polar gust blows by. +0.5% temporary slide speed.', grant: (g) => { g.tempSpeedBoost += 0.005; } },

    { id: 'c_booties', tier: 2, rarity: 'common', name: 'Thermal Booties', icon: '🥾', desc: '+15% penguin waddle speed across all species permanently.', grant: () => {} },
    { id: 'c_herring', tier: 2, rarity: 'common', name: 'Schooling Herring', icon: '🐟', desc: 'Dense fish school in the hole! +20% catch capacity permanently.', grant: () => {} },
    { id: 'c_quickcatch', tier: 2, rarity: 'common', name: 'Quick Net Catch', icon: '⏱️', desc: 'Instantly gain 30 seconds of passive colony fish production.', grant: (g) => { g.addFish(Math.max(25, g.dps * 30)); } },
    { id: 'c_flappers', tier: 2, rarity: 'common', name: 'Crisp Flappers', icon: '🪽', desc: '+35% manual screen and penguin tap/click fish yield.', grant: () => {} },
    { id: 'c_sonar', tier: 2, rarity: 'common', name: 'Echo Ice Finder', icon: '📡', desc: '+12% catch yield and +10% dive speed permanently.', grant: () => {} },
    { id: 'c_wax', tier: 2, rarity: 'common', name: 'Glacier Belly Wax', icon: '🧈', desc: '+25% belly-slide speed and +10% tap fish yield permanently.', grant: () => {} },
    { id: 'c_krill_snack', tier: 2, rarity: 'common', name: 'Krill Ration Crate', icon: '🦐', desc: 'Instantly harvest 45 seconds of passive colony fish production.', grant: (g) => { g.addFish(Math.max(40, g.dps * 45)); } },

    { id: 'r_sledding', tier: 3, rarity: 'rare', name: 'Glacial Sledding League', icon: '🛷', desc: 'Gentoo and sliding penguins gain +50% slide speed permanently.', grant: () => {} },
    { id: 'r_trench', tier: 3, rarity: 'rare', name: 'Deep Trench Oxygen', icon: '🌊', desc: 'Diving cycle 25% faster and carries +40% dive capacity.', grant: () => {} },
    { id: 'r_squid', tier: 3, rarity: 'rare', name: 'Abyssal Squid Haul', icon: '🦑', desc: 'Instantly harvest 100 seconds of passive colony fish production.', grant: (g) => { g.addFish(Math.max(90, g.dps * 100)); } },
    { id: 'r_magnetic', tier: 3, rarity: 'rare', name: 'Aurora Magnetic Krill', icon: '🧲', desc: 'Rare Golden Fish spawns swim across the ice shelf twice as often for 120s.', grant: (g) => { g.goldenFishTimer = 120; } },
    { id: 'r_cryo_net', tier: 3, rarity: 'rare', name: 'Cryo-Weave Trawler', icon: '🕸️', desc: '+30% catch capacity and +20% tap fish yield permanently.', grant: () => {} },
    { id: 'r_storm_sail', tier: 3, rarity: 'rare', name: 'Gale-Force Flippers', icon: '⛵', desc: '+25% waddle speed and +30% belly-slide speed permanently.', grant: () => {} },
    { id: 'r_polar_surge', tier: 3, rarity: 'rare', name: 'Polar Current Surge', icon: '🌀', desc: 'Double (2x) all fish yield for 60s and immediately gain 75s of fish!', grant: (g) => { g.polarSurgeTimer = 60; g.addFish(Math.max(70, g.dps * 75)); } },
    { id: 'r_ember_lantern', tier: 3, rarity: 'rare', name: 'Thermal Igloo Lanterns', icon: '🏮', desc: '+20% dive speed and +25% catch capacity permanently.', grant: () => {} },

    { id: 'l_frenzy', tier: 4, rarity: 'legendary', name: 'Blizzard Feeding Frenzy', icon: '🌨️', desc: 'Antarctic storm triples (3x) fish yield for 45s & grants +15% catch permanently!', grant: (g) => { g.frenzyTimer = 45; } },
    { id: 'l_monarch', tier: 4, rarity: 'legendary', name: "Emperor's Royal Decree", icon: '👑', desc: 'Emperor Monarch aura +100%, and boosts all penguin speeds by +50% permanently.', grant: () => {} },
    { id: 'l_mammoth', tier: 4, rarity: 'legendary', name: 'Mammoth Ice Cache', icon: '🦣', desc: 'Unearth frozen cache (+300s instant fish) & gain +20% catch yield permanently!', grant: (g) => { g.addFish(Math.max(250, g.dps * 300)); } },
    { id: 'l_glacier_heart', tier: 4, rarity: 'legendary', name: 'Heart of the Glacier', icon: '💠', desc: 'Permanent +50% catch yield and +35% tap yield across all rebirths!', grant: () => {} },
    { id: 'l_chrono_flipper', tier: 4, rarity: 'legendary', name: 'Chrono-Slide Mastery', icon: '⏳', desc: 'Permanent +40% waddle speed, +60% slide speed, and +30% dive speed!', grant: () => {} },
    { id: 'l_golden_aurora', tier: 4, rarity: 'legendary', name: 'Golden Aurora Conduit', icon: '🌟', desc: 'Permanent +40% catch yield & activates 240s Golden Fish frequency boost!', grant: (g) => { g.goldenFishTimer = Math.max(g.goldenFishTimer || 0, 240); } },

    { id: 'm_supernova', tier: 5, rarity: 'mythic', name: 'Cosmic Glacial Supernova', icon: '🌌', desc: '+35% catch & +30% speed forever, plus 60s of +4x yield & instant 600s fish!', grant: (g) => { g.addFish(Math.max(600, g.dps * 600)); g.supernovaTimer = 60; } },
    { id: 'm_eternal_frost', tier: 5, rarity: 'mythic', name: "Eternal Sovereign's Mantle", icon: '🔱', desc: 'Mythic power retained forever: +100% catch yield, +50% speed, and +50% dive speed!', grant: () => {} },
    { id: 'm_starlight_nexus', tier: 5, rarity: 'mythic', name: 'Starlight Tap Singularity', icon: '💫', desc: 'Mythic radiance retained forever: +150% tap yield, +60% slide speed & +450s fish!', grant: (g) => { g.addFish(Math.max(450, g.dps * 450)); } },
    { id: 'm_glacial_ascension', tier: 5, rarity: 'mythic', name: 'Glacial Ascension Core', icon: '❄️', desc: 'Mythic core retained forever: +75% catch & tap yield, plus 45s 3x Frenzy!', grant: (g) => { g.frenzyTimer = Math.max(g.frenzyTimer || 0, 45); } }
  ];

  const ACHIEVEMENTS_LIST = [
    {
      id: 'ach_first_tap',
      title: 'Frosty Flapper',
      icon: '👆',
      desc: 'Tap the screen or a penguin to cheer your colony',
      check: (s) => (s.totalManualClicks || 0) >= 1,
      progress: (s) => ({ cur: Math.min(1, s.totalManualClicks || 0), max: 1 })
    },
    {
      id: 'ach_colony_five',
      title: 'Waddle Squad',
      icon: '🐧',
      desc: 'Recruit a colony of 5 or more penguins',
      check: (s) => {
        let c = 0; Object.keys(s.penguins).forEach(k => c += s.penguins[k].count);
        return c >= 5;
      },
      progress: (s) => {
        let c = 0; Object.keys(s.penguins).forEach(k => c += s.penguins[k].count);
        return { cur: Math.min(5, c), max: 5 };
      }
    },
    {
      id: 'ach_colony_twenty',
      title: 'Colony Empire',
      icon: '🏛️',
      desc: 'Grow your colony to 20 or more penguins',
      check: (s) => {
        let c = 0; Object.keys(s.penguins).forEach(k => c += s.penguins[k].count);
        return c >= 20;
      },
      progress: (s) => {
        let c = 0; Object.keys(s.penguins).forEach(k => c += s.penguins[k].count);
        return { cur: Math.min(20, c), max: 20 };
      }
    },
    {
      id: 'ach_emperor',
      title: 'Imperial Crown',
      icon: '👑',
      desc: 'Recruit an Emperor Monarch to inspire the ice shelf',
      check: (s) => Boolean(s.penguins.emperor && s.penguins.emperor.count >= 1),
      progress: (s) => ({ cur: (s.penguins.emperor && s.penguins.emperor.count >= 1) ? 1 : 0, max: 1 })
    },
    {
      id: 'ach_cyber',
      title: 'Cybernetic Polar Era',
      icon: '🤖',
      desc: 'Recruit a futuristic Cyber / Mecha Penguin',
      check: (s) => Boolean(s.penguins.cyber && s.penguins.cyber.count >= 1),
      progress: (s) => ({ cur: (s.penguins.cyber && s.penguins.cyber.count >= 1) ? 1 : 0, max: 1 })
    },
    {
      id: 'ach_dives_25',
      title: 'Deep Ice Trench',
      icon: '🤿',
      desc: 'Complete 25 successful fishing hole dives',
      check: (s) => (s.totalDives || 0) >= 25,
      progress: (s) => ({ cur: Math.min(25, s.totalDives || 0), max: 25 })
    },
    {
      id: 'ach_slides_20',
      title: 'Belly Sledding Ace',
      icon: '🛷',
      desc: 'Perform 20 swift belly slides across the snow',
      check: (s) => (s.totalSlides || 0) >= 20,
      progress: (s) => ({ cur: Math.min(20, s.totalSlides || 0), max: 20 })
    },
    {
      id: 'ach_glacier_lvl5',
      title: 'Glacial Outpost',
      icon: '🧊',
      desc: 'Expand the colony ice shelf to Level 5',
      check: (s) => s.glacierLevel >= 5,
      progress: (s) => ({ cur: Math.min(5, s.glacierLevel), max: 5 })
    },
    {
      id: 'ach_glacier_lvl15',
      title: 'Polar Stronghold',
      icon: '🏔️',
      desc: 'Expand the colony ice shelf to Level 15',
      check: (s) => s.glacierLevel >= 15,
      progress: (s) => ({ cur: Math.min(15, s.glacierLevel), max: 15 })
    },
    {
      id: 'ach_fish_10k',
      title: 'Bountiful Tundra',
      icon: '🐟',
      desc: 'Accumulate 10,000 Lifetime Fish',
      check: (s) => (s.lifetimeFish || 0) >= 10000,
      progress: (s) => ({ cur: Math.min(10000, Math.floor(s.lifetimeFish || 0)), max: 10000 })
    },
    {
      id: 'ach_fish_1m',
      title: 'Glacial Millionaire',
      icon: '💰',
      desc: 'Accumulate 1,000,000 Lifetime Fish',
      check: (s) => (s.lifetimeFish || 0) >= 1000000,
      progress: (s) => ({ cur: Math.min(1000000, Math.floor(s.lifetimeFish || 0)), max: 1000000 })
    },
    {
      id: 'ach_tech_10',
      title: 'Cryo Innovation',
      icon: '🔬',
      desc: 'Research 10 total Glacier Tech upgrades',
      check: (s) => {
        let lvl = 0; Object.keys(s.tech).forEach(k => lvl += s.tech[k]);
        return lvl >= 10;
      },
      progress: (s) => {
        let lvl = 0; Object.keys(s.tech).forEach(k => lvl += s.tech[k]);
        return { cur: Math.min(10, lvl), max: 10 };
      }
    },
    {
      id: 'ach_aurora_3',
      title: 'Celestial Attunement',
      icon: '✨',
      desc: 'Claim 3 Aurora Blessing perks from the polar sky',
      check: (s) => (s.totalAuroraBlessingsClaimed || 0) >= 3,
      progress: (s) => ({ cur: Math.min(3, s.totalAuroraBlessingsClaimed || 0), max: 3 })
    },
    {
      id: 'ach_legendary_perk',
      title: 'Crown of the Aurora',
      icon: '🌟',
      desc: 'Collect a Legendary Aurora Blessing perk',
      check: (s) => Boolean(s.collectedPerks && s.collectedPerks.some(p => p.rarity === 'legendary')),
      progress: (s) => ({ cur: (s.collectedPerks && s.collectedPerks.some(p => p.rarity === 'legendary')) ? 1 : 0, max: 1 })
    },
    {
      id: 'ach_mythic_perk',
      title: 'Mythic Astral Bond',
      icon: '🌌',
      desc: 'Collect a Mythic Aurora Blessing perk',
      check: (s) => Boolean(s.collectedPerks && s.collectedPerks.some(p => p.rarity === 'mythic')),
      progress: (s) => ({ cur: (s.collectedPerks && s.collectedPerks.some(p => p.rarity === 'mythic')) ? 1 : 0, max: 1 })
    },
    {
      id: 'ach_prestige_first',
      title: 'Celestial Rebirth',
      icon: '💎',
      desc: 'Perform Glacial Rebirth and collect Frost Essence',
      check: (s) => (s.totalRebirths || 0) >= 1,
      progress: (s) => ({ cur: Math.min(1, s.totalRebirths || 0), max: 1 })
    },
    {
      id: 'ach_prestige_3',
      title: 'Cycle of Frost',
      icon: '❄️',
      desc: 'Perform 3 Glacial Rebirths',
      check: (s) => (s.totalRebirths || 0) >= 3,
      progress: (s) => ({ cur: Math.min(3, s.totalRebirths || 0), max: 3 })
    },
    {
      id: 'ach_prestige_5',
      title: 'Eternal Penguin',
      icon: '🌌',
      desc: 'Perform 5 Glacial Rebirths',
      check: (s) => (s.totalRebirths || 0) >= 5,
      progress: (s) => ({ cur: Math.min(5, s.totalRebirths || 0), max: 5 })
    },
    {
      id: 'ach_prestige_10',
      title: 'Timeless Sovereign',
      icon: '👑',
      desc: 'Perform 10 Glacial Rebirths',
      check: (s) => (s.totalRebirths || 0) >= 10,
      progress: (s) => ({ cur: Math.min(10, s.totalRebirths || 0), max: 10 })
    },
    {
      id: 'ach_essence_10',
      title: 'Essence Collector',
      icon: '🔮',
      desc: 'Accumulate 10 or more cumulative Frost Essence',
      check: (s) => Math.max(s.prestigeShards || 0, s.totalEssenceEarned || 0) >= 10,
      progress: (s) => ({ cur: Math.min(10, Math.floor(Math.max(s.prestigeShards || 0, s.totalEssenceEarned || 0))), max: 10 })
    },
    {
      id: 'ach_essence_50',
      title: 'Astral Reactor',
      icon: '🌠',
      desc: 'Accumulate 50 or more cumulative Frost Essence',
      check: (s) => Math.max(s.prestigeShards || 0, s.totalEssenceEarned || 0) >= 50,
      progress: (s) => ({ cur: Math.min(50, Math.floor(Math.max(s.prestigeShards || 0, s.totalEssenceEarned || 0))), max: 50 })
    },
    {
      id: 'ach_essence_250',
      title: 'Celestial Singularity',
      icon: '✨',
      desc: 'Accumulate 250 or more cumulative Frost Essence',
      check: (s) => Math.max(s.prestigeShards || 0, s.totalEssenceEarned || 0) >= 250,
      progress: (s) => ({ cur: Math.min(250, Math.floor(Math.max(s.prestigeShards || 0, s.totalEssenceEarned || 0))), max: 250 })
    }
  ];

  const GLACIAL_LORE_CHRONICLES = [
    {
      id: 'lore_prologue',
      chapter: 'Prologue',
      title: 'The Great Frostfall',
      date: 'Day 1 of the Great Freeze',
      icon: '📜',
      reqText: 'Available from the start of your journey',
      check: () => true,
      text: 'When the Southern Skies ignited in eternal emerald luminescence, our forebears laid the foundational snow-bricks of the first Igloo Depot. The cold was biting, but the resolve of the colony was forged in adamant ice. Here on the floating shelves, we carve our destiny.'
    },
    {
      id: 'lore_ch1',
      chapter: 'Chapter I',
      title: 'The Scouts of Adélie Bay',
      date: 'Expedition Log 14',
      icon: '🐧',
      reqText: 'Collect 1,000 Lifetime Fish',
      check: (s) => (s.lifetimeFish || 0) >= 1000,
      text: 'With swift flippers carving trails through freezing seafoam, the brave Adélie Scouts ventured beyond the safety of the colony shore. They mapped the three abyssal ice holes whose currents pulse with shimmering Arctic Herring and silver cod.'
    },
    {
      id: 'lore_ch2',
      chapter: 'Chapter II',
      title: 'The Blue Ice Racers',
      date: 'Expedition Log 48',
      icon: '🛷',
      reqText: 'Collect 25,000 Lifetime Fish',
      check: (s) => (s.lifetimeFish || 0) >= 25000,
      text: 'The sleek Gentoo discoverers uncovered a sacred art: frictionless belly-sliding across the polished blue ice sheets. Gliding at breakneck velocity, they deliver fresh catches to the depot in record time, cheering through the sub-zero blizzards.'
    },
    {
      id: 'lore_ch3',
      chapter: 'Chapter III',
      title: 'Depths of the Chinstrap Trench',
      date: 'Expedition Log 112',
      icon: '🤿',
      reqText: 'Collect 500,000 Lifetime Fish',
      check: (s) => (s.lifetimeFish || 0) >= 500000,
      text: 'Plunging beneath the pressure of the abyssal thermoclines, the hardy Chinstrap Divers reached depths unseen by daylight. In the deep trenches, they unearthed bioluminescent krill blooms and primal ice relics humming with ancient energy.'
    },
    {
      id: 'lore_ch4',
      chapter: 'Chapter IV',
      title: 'Crown of the Emperor',
      date: 'Expedition Log 260',
      icon: '👑',
      reqText: 'Collect 10,000,000 Lifetime Fish',
      check: (s) => (s.lifetimeFish || 0) >= 10000000,
      text: 'Adorned in majestic golden plumage, the Emperor Monarch stepped onto the high glacier pinnacle. With a resonant, booming call that shook the snowdrifts, an aura of sovereign discipline swept through the ranks, supercharging the entire colony.'
    },
    {
      id: 'lore_ch5',
      chapter: 'Chapter V',
      title: 'Cybernetic Polar Renaissance',
      date: 'Chronicle of the Future',
      icon: '🤖',
      reqText: 'Perform 1 Glacial Rebirth',
      check: (s) => (s.totalRebirths || 0) >= 1,
      text: 'Fusing eternal frost essence with superconductive auroral photonics, the colony engineered the Cyber Mecha-Penguins. Equipped with cryo-thrusters and sub-atomic sonar visors, the empire now rules the glacial expanse for all eternity.'
    }
  ];

  function formatPct(value) {
    const rounded = Math.round((Number(value) || 0) * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
      return String(Math.round(rounded));
    }
    return rounded.toFixed(2).replace(/0$/, '');
  }

  function formatWeatherCountdown(seconds) {
    const clamped = Math.max(0, Math.ceil(Number(seconds) || 0));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function formatPlaytime(ms) {
    const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }

  function getColonyRank(lifetimeFish) {
    const val = Number(lifetimeFish) || 0;
    if (val >= 1000000000) return '🌌 Cosmic Glacial Sovereign';
    if (val >= 100000000) return '👑 Grand Emperor of Antarctica';
    if (val >= 10000000) return '🔱 Sub-Zero Archon';
    if (val >= 1000000) return '🏔️ Glacier Baron';
    if (val >= 100000) return '🤿 Master Ice Fisher';
    if (val >= 10000) return '🧊 Tundra Expeditionist';
    if (val >= 1000) return '🐧 Colony Organizer';
    return '❄️ Frosty Apprentice';
  }

  return {
    PENGUIN_SPECIES,
    PENGUIN_TRAITS,
    WEATHER_CYCLE_SECONDS,
    COLONY_SPEECH_INTERVAL_SECONDS,
    COLONY_SPEECH_INTERVAL_MS,
    WEATHER_TYPES,
    getTraitDef,
    rollRandomTraitId,
    PENGUIN_TRUE_FACTS,
    PENGUIN_MYTH_BUSTERS,
    PENGUIN_TRAIT_SAYINGS,
    APP_FEATURE_RELEASES,
    LATEST_FEATURE_RELEASE,
    GLACIER_LEVEL_BONUS_RATE,
    COLONY_SIZE_BONUS_RATE,
    MAX_VISIBLE_PER_COLONY,
    COLONY_SYNERGIES,
    GLACIER_TECH,
    AURORA_PERKS_POOL,
    ACHIEVEMENTS_LIST,
    GLACIAL_LORE_CHRONICLES,
    formatPct,
    formatWeatherCountdown,
    formatPlaytime,
    getColonyRank
  };
});
