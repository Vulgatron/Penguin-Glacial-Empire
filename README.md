# Penguin Glacial Empire (v2.0)

An incremental/idle penguin colony game built with HTML5 Canvas, CSS, modular JavaScript, Progressive Web App (PWA) offline support, and a hardened Android WebView wrapper in Kotlin.

## Architecture Overview

```text
.
├── index.html                  # Single canonical web game entrypoint (auto-synced to Android assets)
├── styles/
│   └── game.css                # Responsive polish, accessibility, contrast & reduced-motion styles
├── js/
│   ├── economy.js              # Overflow/NaN-safe economy, HUD formatting, bulk buys, offline cap & Golden Fish math
│   ├── daily-system.js         # 3:00 AM daily cycle keys, streak tracking, idempotent claims & sanitization
│   └── save-system.js          # Schema v2 migrations, validation, multi-slot recovery & throttled persistence
├── sw.js                       # Offline PWA service worker (precaches core assets; no mid-session forced reload)
├── manifest.webmanifest        # PWA web app manifest
├── icons/                      # App & PWA icons
├── tests/
│   └── game-core.test.mjs      # Node.js unit & invariant tests for economy, saves, Golden Fish, PWA & asset sync
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
- `styles/game.css`
- `js/economy.js`, `js/daily-system.js`, `js/save-system.js`
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
node --check js/economy.js js/daily-system.js js/save-system.js sw.js
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

- Saves are schema-versioned (`saveVersion: 2`) with automatic migration from legacy v0/v1 saves and forward-version safety for newer schemas.
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
