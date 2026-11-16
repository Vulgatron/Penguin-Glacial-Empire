# Daily 8:00 AM PWA Push Relay (GitHub Pages + Android & Apple iOS)

GitHub Pages serves only static files, so background push notifications when the app is closed require a small push relay that holds your **VAPID Private Key**, stores device `PushSubscription` tokens, and triggers at **8:00 AM in each player's local timezone** (talking to both Apple's `web.push.apple.com` and Android's `fcm.googleapis.com`).

This folder gives you a ready-to-deploy **Cloudflare Worker** (free tier: 100k requests/day + Cron Triggers).

## 1. Generate VAPID Keys

Run once locally:

```bash
npx web-push generate-vapid-keys
```

Copy the printed **Public Key** and **Private Key**.

## 2. Deploy the Worker

```bash
cd push-relay
npm install
npx wrangler kv namespace create PUSH_SUBSCRIPTIONS
```

Paste the returned `id` into `wrangler.toml`, set `VAPID_SUBJECT` to your real `mailto:` address (Apple rejects placeholder addresses like `admin@localhost`), and set your secrets:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npm run deploy
```

## 3. Connect Your GitHub Pages PWA

Edit `/push-config.json` in your repository root with your deployed Worker URL and VAPID Public Key:

```json
{
  "vapidPublicKey": "YOUR_VAPID_PUBLIC_KEY",
  "subscribeApiUrl": "https://penguin-push-relay.<your-subdomain>.workers.dev/subscribe",
  "unsubscribeApiUrl": "https://penguin-push-relay.<your-subdomain>.workers.dev/unsubscribe",
  "defaultReminderHour": 8,
  "defaultReminderMinute": 0
}
```

## 4. Apple iOS User Requirement

On iPhone and iPad (iOS 16.4+), Apple only exposes `PushManager` after the user taps **Share → Add to Home Screen** and opens the app from the Home Screen icon, then taps **Enable 8:00 AM Reminders** inside **Settings**.
