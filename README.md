# Penguin Glacial Empire (v2.7)

An incremental/idle penguin colony game built with HTML5 Canvas, CSS, modular JavaScript, Progressive Web App (PWA) offline support, and a hardened Android WebView wrapper in Kotlin.

## Architecture Overview

```text
.
├── index.html                  # Single canonical web game entrypoint (auto-synced to Android assets)
├── styles/
│   ├── core.css                # Core game layout, HUD, collapsible Next Milestone bar, 80%-capped sheet & theme styling
│   ├── splash-cutscene.css     # Animated launch splash screen & Glacial Rebirth cutscene styles
│   └── game.css                # Glacier tab (Ice Castle, Fishing Holes & Colony Wardrobe), responsive polish
├── js/
│   ├── economy.js              # Overflow/NaN-safe economy, +1.25%/shard prestige, tuned castle & fishing hole defs, safe frame timing
│   ├── game-data.js            # Species, traits, weather, colony speech, tech, Aurora perks, achievements & lore catalogs
│   ├── wardrobe.js             # Ultra-Prestige Frost Essence Colony Wardrobe, per-species mixing, tap-again confirm & hat vectors
│   ├── milestone-engine.js     # Deterministic priority-scored Next Milestone compass, permanent/run lifecycles & progressive tab reveal
│   ├── polar-synergy.js        # Single-source Weather × Species × Hotspot Fishing Hole stacking math & stable 4-rule hole routing
│   ├── sky-events.js           # Top-20% Shooting Stars, Ice Krill Swarms, 1×–5× Sky Combo & 2× Starlight Frenzy
│   ├── daily-system.js         # 3:00 AM daily cycle keys, streak tracking, idempotent claims & sanitization
│   ├── daily-manager.js        # Daily Objectives manager, modal rendering, badge & celebration banners
│   ├── save-system.js          # Schema v5 migrations, validation, multi-slot recovery & throttled persistence
│   ├── sound-engine.js         # Procedural Web Audio synthesizer, rate-limited species calls, castle/milestone chimes & winter score
│   ├── castle-renderer.js      # Procedural Canvas & SVG renderer for the 6-tier Igloo-to-Ice-Castle + 6 palettes
│   ├── penguin-sprites.js      # Procedural penguin Canvas renderer with Wardrobe hat rendering & cached portraits
│   ├── scene-renderer.js       # Dynamic polar sky, aurora waves, 4 glacier landmarks, glowing Hotspot holes & snow/blizzard renderer
│   ├── parade-event.js         # 15-minute all-colony Penguin Parade choreography & 60s 2× boost scheduler
│   ├── prestige-cutscene.js    # 10-second SVG Glacial Rebirth cutscene controller
│   └── launch-splash.js        # Launch splash screen controller with wall-clock completion guard
├── sw.js                       # Offline PWA service worker (precaches core assets; no mid-session forced reload)
├── manifest.webmanifest        # PWA web app manifest
├── icons/                      # App & PWA icons
├── tests/
│   ├── game-core.test.mjs      # Node.js unit, time-state, invariant & cold-boot smoke tests
│   └── pacing-simulator.mjs    # 4-profile pacing & time-state consistency simulator (Efficient, Casual, Active, Idle)
└── app/
    ├── build.gradle.kts        # Android build with automatic `syncWebAssets` Gradle Sync task
    └── src/
        ├── main/java/com/example/
        │   ├── MainActivity.kt            # Hardened WebViewAssetLoader host, crash recovery & origin-checked bridge
        │   ├── WebViewSecurityPolicy.kt   # Trusted local origin, subresource allowlist, external browser & haptic policy
        │   └── SaveStorageManager.kt      # Serialized async save queue, atomic backup rotation & corruption quarantine
        └── test/java/com/example/
            └── WebViewSecurityAndStorageTest.kt # Robolectric & unit tests for WebView hardening & native persistence
```

## Project Setup & Prerequisites

- **Web & Tests:** Node.js 20+ (uses built-in `node --test`, zero npm dependencies required).
- **Android Build:** Android SDK + JDK 17+ + Gradle (`gradle` CLI). Do not create or commit a `local.properties` file in cloud/CI environments where `ANDROID_SDK_ROOT` is already configured.

## Development Workflow & Asset Synchronization

All web code is authored in the **single canonical source** at the repository root:

- `index.html`
- `styles/core.css`, `styles/splash-cutscene.css`, `styles/game.css`
- `js/economy.js`, `js/game-data.js`, `js/wardrobe.js`, `js/milestone-engine.js`, `js/polar-synergy.js`, `js/sky-events.js`, `js/daily-system.js`, `js/daily-manager.js`, `js/save-system.js`, `js/sound-engine.js`, `js/castle-renderer.js`, `js/penguin-sprites.js`, `js/scene-renderer.js`, `js/parade-event.js`, `js/prestige-cutscene.js`, `js/launch-splash.js`
- `manifest.webmanifest`
- `icons/`

During Android builds, Gradle automatically runs the `syncWebAssets` task (wired to `preBuild`) to mirror those canonical root files into `app/src/main/assets/`:

- `syncWebAssets` uses a Gradle `Sync` task so files deleted from the root are automatically pruned from `app/src/main/assets/`.
- A built-in freshness guard aborts the sync if any file inside `app/src/main/assets/` was edited more recently than its canonical root counterpart, preventing accidental loss of manual edits.
- Never hand-edit files inside `app/src/main/assets/`; edit the root files instead. If you intentionally need to overwrite newer files inside `app/src/main/assets/`, run:

```bash
gradle :app:syncWebAssets -PforceSyncWebAssets=true
```

## Testing Instructions

### 1. JavaScript Syntax & Unit Tests (Node.js 20+)

```bash
node --check js/*.js sw.js
node --test tests/game-core.test.mjs
```

Note: `tests/game-core.test.mjs` also verifies byte-for-byte parity between the canonical root web files and `app/src/main/assets/`. Run `gradle :app:syncWebAssets` first after editing root web files.

### 2. Android Unit & Robolectric Tests

```bash
gradle :app:syncWebAssets :app:testDebugUnitTest
```

## Android Build Instructions

```bash
gradle :app:syncWebAssets
gradle :app:assembleDebug
```

To build a release bundle or APK, use your configured Android signing environment (`gradle :app:assembleRelease` / `gradle :app:bundleRelease`). Do not modify the existing signing configurations or keystore files.

## Android WebView Security Model

- Bundled web assets are served via AndroidX WebKit `WebViewAssetLoader` at `https://appassets.androidplatform.net/assets/index.html` instead of `file://`.
- File access (`allowFileAccess`, `allowContentAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`), WebSQL (`databaseEnabled`), mixed content, geolocation, and popup windows are disabled.
- Navigation and redirects are restricted to the trusted local asset origin; legitimate public `https://` links open in the system browser while unsafe schemes (`file://`, `http://`, `intent://`, `javascript:`) and private/loopback hosts are blocked.
- Every `AndroidBridge` call verifies the committed WebView origin, enforces JSON object structure and a 512 KB payload limit, never accepts arbitrary file paths, and restricts haptics to an explicit allowlist (`tap`, `collect`, `penguin_tap`, `celebrate`).
- WebView renderer process crashes are intercepted via `onRenderProcessGone` to flush saves and recreate the activity gracefully rather than terminating the app.
- Android permissions are strictly minimal (`INTERNET` and `VIBRATE` only; no notification or storage permissions).

## Save Reliability, Versioning & Offline Cap

- Saves are schema-versioned (`saveVersion: 4`) with automatic migration from legacy v0/v1/v2/v3 saves (preserving Ice Castle, Fishing Holes, Colony Wardrobe & Sky/Parade defaults) and forward-version safety for newer schemas.
- Every field is sanitized on load (protecting against `NaN`, `Infinity`, negative balances, prototype pollution keys, 0-penguin deadlocks, and future-tampered device clocks).
- Routine autosaves run on a throttled 15-second cadence and skip disk I/O when colony state is unchanged; critical milestones (purchases, rebirths, offline catch claims, daily claims, factory reset, and lifecycle pauses) flush immediately.
- Multi-slot recovery walks native storage, web primary storage, and validated web backup storage before flagging unrecoverable corruption, quarantining damaged payloads without silently wiping progress.
- Android native saves run on a dedicated single-threaded async queue with atomic temp-file-fsync-rename writes, orphaned `.tmp` cleanup, dual backups (`penguin_save_backup.json` and `penguin_save_last_good.json`), and corruption quarantine (`penguin_save_corrupted.json`).
- Offline earnings pay full offline efficiency (`2/3` DPS) for up to 24 hours, followed by diminishing returns (`25%`) up to a 7-day ceiling, and return `0` if the system clock moves backward.

## PWA Deployment Instructions

Penguin Glacial Empire works as an installable, offline-capable Progressive Web App when hosted over HTTPS (for example, GitHub Pages, Cloudflare Pages, or Netlify):

1. Deploy the repository root static web files (`index.html`, `styles/`, `js/`, `sw.js`, `manifest.webmanifest`, `icons/`).
2. Serve over HTTPS so browsers can register `sw.js` and enable "Add to Home Screen" / PWA installation.
3. No backend server, relay worker, or push notification configuration is required.
4. On updates, bump `CACHE_NAME` in `sw.js` so returning players receive fresh assets on their next launch without mid-session reloads.

## Troubleshooting

- **`syncWebAssets` fails with "Refusing to overwrite newer file(s) in app/src/main/assets":** Copy any intentional changes back into the canonical root file (`index.html`, `styles/`, or `js/`), or run `gradle :app:syncWebAssets -PforceSyncWebAssets=true` if the root file is authoritative.
- **Asset parity test fails in `tests/game-core.test.mjs`:** Run `gradle :app:syncWebAssets` after modifying root web files so `app/src/main/assets/` is updated.
- **PWA serves an older cached build in a browser:** Close all open tabs of the app and reopen it so the waiting service worker activates cleanly on the next cold start.
- **Offline progress shows 0 after changing device time:** Backward device clock changes intentionally return `0` offline earnings to prevent clock-rollback exploits.
