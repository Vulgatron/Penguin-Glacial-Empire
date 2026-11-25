(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.PushClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ANDROID_LOCAL_ASSET_HOST = 'appassets.androidplatform.net';
  const REMINDER_WINDOW_MINUTES = 15;

  function isLocalAndroidWebViewHost(locationLike, hasAndroidBridge = false) {
    if (hasAndroidBridge) return true;
    if (!locationLike) return false;
    const proto = String(locationLike.protocol || '').toLowerCase();
    const host = String(locationLike.hostname || '').toLowerCase();
    return proto === 'file:' || host === ANDROID_LOCAL_ASSET_HOST;
  }

  function isHostedWebPwa(locationLike, hasAndroidBridge = false) {
    if (isLocalAndroidWebViewHost(locationLike, hasAndroidBridge)) return false;
    if (!locationLike) return false;
    const proto = String(locationLike.protocol || '').toLowerCase();
    const host = String(locationLike.hostname || '').toLowerCase();
    return proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
  }

  function isValidHttpsEndpoint(urlStr) {
    if (typeof urlStr !== 'string' || !urlStr.trim()) return false;
    try {
      const parsed = new URL(urlStr.trim());
      return parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch (_) {
      return false;
    }
  }

  function isValidVapidPublicKey(keyStr) {
    if (typeof keyStr !== 'string') return false;
    const clean = keyStr.trim();
    return clean.length >= 64 && clean.length <= 256 && /^[A-Za-z0-9_-]+={0,2}$/.test(clean);
  }

  function clampHour(val, fallback = 8) {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 0 || n > 23) return fallback;
    return n;
  }

  function clampMinute(val, fallback = 0) {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 0 || n > 59) return fallback;
    return n;
  }

  function formatReminderTime(hour, minute) {
    const h = clampHour(hour, 8);
    const m = clampMinute(minute, 0);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function validatePushConfig(rawConfig) {
    const src = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {};
    const config = {
      vapidPublicKey: typeof src.vapidPublicKey === 'string' ? src.vapidPublicKey.trim() : '',
      subscribeApiUrl: typeof src.subscribeApiUrl === 'string' ? src.subscribeApiUrl.trim() : '',
      unsubscribeApiUrl: typeof src.unsubscribeApiUrl === 'string' ? src.unsubscribeApiUrl.trim() : '',
      defaultReminderHour: clampHour(src.defaultReminderHour, 8),
      defaultReminderMinute: clampMinute(src.defaultReminderMinute, 0)
    };

    const issues = [];
    const hasAnyRelayField = Boolean(config.vapidPublicKey || config.subscribeApiUrl || config.unsubscribeApiUrl);

    if (!config.vapidPublicKey) {
      issues.push('missing_vapid_public_key');
    } else if (!isValidVapidPublicKey(config.vapidPublicKey)) {
      issues.push('invalid_vapid_public_key');
    }

    if (!config.subscribeApiUrl) {
      issues.push('missing_subscribe_url');
    } else if (!isValidHttpsEndpoint(config.subscribeApiUrl)) {
      issues.push('invalid_subscribe_url');
    }

    if (config.unsubscribeApiUrl && !isValidHttpsEndpoint(config.unsubscribeApiUrl)) {
      issues.push('invalid_unsubscribe_url');
    }

    const configured = isValidVapidPublicKey(config.vapidPublicKey) && isValidHttpsEndpoint(config.subscribeApiUrl);
    return {
      configured,
      partiallyConfigured: hasAnyRelayField && !configured,
      issues,
      config
    };
  }

  /**
   * Checks whether the current local (hour, minute) falls inside the 15-minute dispatch window
   * starting at (targetHour, targetMinute) — aligns client reminderMinute with 15-min cron runs.
   */
  function matchesReminderWindow({
    currentHour,
    currentMinute,
    targetHour = 8,
    targetMinute = 0,
    windowMinutes = REMINDER_WINDOW_MINUTES
  }) {
    const curMin = clampHour(currentHour, 0) * 60 + clampMinute(currentMinute, 0);
    const tgtMin = clampHour(targetHour, 8) * 60 + clampMinute(targetMinute, 0);
    const win = Math.max(1, Math.min(60, Math.floor(Number(windowMinutes) || REMINDER_WINDOW_MINUTES)));
    const diff = (curMin - tgtMin + 1440) % 1440;
    return diff >= 0 && diff < win;
  }

  function shouldTriggerForegroundReminder({
    enabled = false,
    permission = 'default',
    nowMs = Date.now(),
    reminderHour = 8,
    reminderMinute = 0,
    lastNotifiedDateKey = '',
    cycleKey = ''
  }) {
    if (!enabled || permission !== 'granted') return false;
    if (!cycleKey || lastNotifiedDateKey === cycleKey) return false;
    const now = new Date(nowMs);
    const curTotalMin = now.getHours() * 60 + now.getMinutes();
    const targetTotalMin = clampHour(reminderHour, 8) * 60 + clampMinute(reminderMinute, 0);
    return curTotalMin >= targetTotalMin;
  }

  return {
    ANDROID_LOCAL_ASSET_HOST,
    REMINDER_WINDOW_MINUTES,
    isLocalAndroidWebViewHost,
    isHostedWebPwa,
    isValidHttpsEndpoint,
    isValidVapidPublicKey,
    clampHour,
    clampMinute,
    formatReminderTime,
    validatePushConfig,
    matchesReminderWindow,
    shouldTriggerForegroundReminder
  };
});
