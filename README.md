# Penguin Glacial Empire (v2.0)

An incremental/idle penguin colony game built with vanilla HTML5 Canvas, CSS, modular JavaScript, Progressive Web App (PWA) support, and a hardened Android WebView wrapper in Kotlin.

## Architecture Overview

```text
.
├── index.html                  # Single canonical web game entrypoint (auto-synced to Android assets)
├── js/
│   ├── economy.js              # Pure overflow/NaN-safe economy, bulk buys, offline cap & Golden Fish math
│   ├── daily-system.js         # 3:00 AM daily cycle keys, streak tracking, idempotent claims & sanitization
│   ├── save-system.js          # Schema v2 migrations, validation, corruption recovery & throttled persistence
│   └── push-client.js          # Hosted PWA vs Android WebView detection, config validation & 15-min window math
├── sw.js                       # PWA service worker (caches index.html, icons, and js/ modules; no mid-session reload)
├── manifest.webmanifest        # PWA manifest
├── push-config.json            # Public Web Push client config (never store private keys here)
├── icons/                      # App icons
├── push-relay/
│   ├── relay-core.js           # Hardened Worker logic (CORS, rate limiting, SSRF guards, 15-min reminder window)
│   ├── worker.js               # Cloudflare Worker fetch() & scheduled() entrypoints
│   └── wrangler.toml           # Cloudflare Worker schedule & configuration template
├── tests/
│   ├── game-core.test.mjs      # Node.js unit & invariant tests for economy, saves, Golden Fish, splash & push client
│   └── push-relay.test.mjs     # Node.js tests for push relay security, scheduling & 404/410 cleanup
└── app/
    ├── build.gradle.kts        # Android build with automatic `syncWebAssets` Gradle task before every build
    └── src/
        ├── main/java/com/example/
        │   ├── MainActivity.kt            # Hardened WebViewAssetLoader container + origin-checked AndroidBridge
        │   ├── WebViewSecurityPolicy.kt   # Trusted local origin, subresource allowlist, external browser & haptic policy
        │   └── SaveStorageManager.kt      # Serialized async save queue, atomic backup rotation & corruption quarantine
        └── test/java/com/example/
            └── WebViewSecurityAndStorageTest.kt # Robolectric & unit tests for WebView hardening & native persistence
```

## Single Canonical Web Source

All web code is authored in the project root (`index.html`, `js/`, `icons/`, `manifest.webmanifest`, `push-config.json`).

During Android builds, Gradle automatically runs the `syncWebAssets` task (hooked into `preBuild`) to copy those canonical files into `app/src/main/assets/`. Do not hand-edit `app/src/main/assets/index.html` — edit the root files instead and rebuild.

## Local Development & Testing

### 1. Run JavaScript Syntax & Unit Tests (Node.js 20+)

```bash
node --check js/economy.js js/daily-system.js js/save-system.js js/push-client.js sw.js push-relay/relay-core.js push-relay/worker.js
node --test tests/*.test.mjs
```

### 2. Run Android Asset Sync, Unit/Robolectric Tests & Build

```bash
gradle :app:syncWebAssets
gradle :app:testDebugUnitTest
gradle :app:assembleDebug
```

## Android WebView Security Model

- Bundled web assets are served over AndroidX WebKit `WebViewAssetLoader` at `https://appassets.androidplatform.net/assets/index.html` instead of `file://`.
- File access (`allowFileAccess`, `allowContentAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`), WebSQL `databaseEnabled`, mixed content, geolocation, and popup windows are disabled.
- Navigation and redirects are restricted to the trusted local asset origin; legitimate public `https://` links open in the system browser while unsafe schemes (`file://`, `http://`, `intent://`, `javascript:`) and private/loopback hosts are blocked.
- Every `AndroidBridge` call validates the committed WebView origin, enforces JSON object structure and a 512 KB payload limit, never accepts arbitrary file paths, and restricts haptics to an explicit allowlist (`tap`, `collect`, `penguin_tap`, `celebrate`).

## Save Reliability, Versioning & Offline Cap

- Saves are schema-versioned (`saveVersion: 2`) with automatic migration from legacy v0/v1 saves.
- Every field is sanitized on load (protecting against `NaN`, `Infinity`, negative balances, prototype pollution keys, 0-penguin deadlocks, and future-tampered device clocks).
- Routine autosaves run on a throttled 15-second cadence and skip disk I/O when colony state is unchanged; critical milestones (purchases, rebirths, offline catch claims, daily claims, factory reset, and lifecycle pauses) flush immediately.
- Android native saves run on a dedicated single-threaded async queue with atomic temp-file-sync-rename writes, keeping both a primary backup (`penguin_save_backup.json`) and a secondary known-good snapshot (`penguin_save_last_good.json`), plus corruption quarantine (`penguin_save_corrupted.json`) so damaged data never silently erases progress.
- Offline earnings pay full offline efficiency (`2/3` DPS) for up to 24 hours, followed by diminishing returns (`25%`) up to a 7-day ceiling, and return `0` if the system clock moves backward.

## Push Notification Relay Setup (Hosted Web PWA Only)

Web Push is intentionally scoped to hosted HTTPS PWA installs and hidden/disabled inside the bundled Android WebView.

To enable background daily reminders on your hosted PWA:

1. **Generate a VAPID key pair** (keep the private key secret; never commit it).
2. **Create a Cloudflare KV namespace** and set its ID in `push-relay/wrangler.toml`.
3. **Set `ALLOWED_ORIGIN`** in `push-relay/wrangler.toml` to your exact production HTTPS PWA origin (e.g., `https://your-domain.example`). Production CORS fails closed if unset.
4. **Store secrets in Cloudflare Workers:**
   ```bash
   wrangler secret put VAPID_PUBLIC_KEY
   wrangler secret put VAPID_PRIVATE_KEY
   wrangler secret put VAPID_SUBJECT
   ```
5. **Deploy the Worker** (`wrangler deploy` inside `push-relay/`). The Worker runs every 15 minutes (`*/15 * * * *`) and matches each subscriber's configured `reminderHour` and `reminderMinute` within a 15-minute window, automatically pruning expired `404`/`410` subscriptions.
6. **Populate public client values in `/push-config.json`:**
   ```json
   {
     "vapidPublicKey": "<YOUR_PUBLIC_VAPID_KEY>",
     "subscribeApiUrl": "https://<your-worker>.workers.dev/subscribe",
     "unsubscribeApiUrl": "https://<your-worker>.workers.dev/unsubscribe",
     "defaultReminderHour": 8,
     "defaultReminderMinute": 0
   }
   ```
