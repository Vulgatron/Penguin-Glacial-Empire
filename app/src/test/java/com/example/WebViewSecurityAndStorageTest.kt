package com.example

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.test.core.app.ApplicationProvider
import androidx.webkit.WebViewAssetLoader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class WebViewSecurityAndStorageTest {

  private lateinit var context: Context

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    // Ensure clean storage state before each test
    SaveStorageManager(context).apply {
      clearSave()
      shutdown()
    }
  }

  private fun fakeRequest(url: String, isMainFrame: Boolean = true): WebResourceRequest {
    val parsed = Uri.parse(url)
    return object : WebResourceRequest {
      override fun getUrl(): Uri = parsed
      override fun isForMainFrame(): Boolean = isMainFrame
      override fun isRedirect(): Boolean = false
      override fun hasGesture(): Boolean = true
      override fun getMethod(): String = "GET"
      override fun getRequestHeaders(): MutableMap<String, String> = mutableMapOf()
    }
  }

  @Test
  fun `WebViewSecurityPolicy validates trusted local asset URLs and blocks unsafe schemes or traversal`() {
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl(WebViewSecurityPolicy.APP_ENTRY_URL))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/js/economy.js"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/js/sound-engine.js"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/js/castle-renderer.js"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/js/parade-event.js"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/js/prestige-cutscene.js"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/js/launch-splash.js"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/styles/core.css"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/styles/splash-cutscene.css"))
    assertTrue(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/styles/game.css"))

    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("file:///android_asset/index.html"))
    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("http://appassets.androidplatform.net/assets/index.html"))
    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/assets/../secret.txt"))
    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("https://appassets.androidplatform.net/other/index.html"))
    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("https://evil.example.com/assets/index.html"))
    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("javascript:alert(1)"))
    assertFalse(WebViewSecurityPolicy.isTrustedAppUrl("content://com.example.provider/data"))
  }

  @Test
  fun `WebViewSecurityPolicy enforces subresource allowlist and safe external browser URLs`() {
    assertTrue(WebViewSecurityPolicy.isAllowedSubresource(Uri.parse(WebViewSecurityPolicy.APP_ENTRY_URL)))
    assertTrue(WebViewSecurityPolicy.isAllowedSubresource(Uri.parse("https://fonts.googleapis.com/css2?family=Fredoka")))
    assertTrue(WebViewSecurityPolicy.isAllowedSubresource(Uri.parse("https://fonts.gstatic.com/s/fredoka/v1/font.woff2")))
    assertFalse(WebViewSecurityPolicy.isAllowedSubresource(Uri.parse("https://tracker.evil.example/pixel.js")))
    assertFalse(WebViewSecurityPolicy.isAllowedSubresource(Uri.parse("http://fonts.googleapis.com/css2")))

    assertTrue(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("https://developer.android.com/guide")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("http://insecure.example.com")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("file:///etc/passwd")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("intent://scan/#Intent;end")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("https://user:pass@example.com")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("https://localhost:8443/admin")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("https://127.0.0.1/internal")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("https://169.254.169.254/latest/meta-data")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse("https://10.0.0.1/router")))
    assertFalse(WebViewSecurityPolicy.isSafeExternalBrowserUrl(Uri.parse(WebViewSecurityPolicy.APP_ENTRY_URL)))
  }

  @Test
  fun `WebViewSecurityPolicy normalizes allowlisted haptics and rejects arbitrary inputs`() {
    assertEquals("tap", WebViewSecurityPolicy.normalizeHapticType("TAP"))
    assertEquals("collect", WebViewSecurityPolicy.normalizeHapticType(" collect "))
    assertEquals("penguin_tap", WebViewSecurityPolicy.normalizeHapticType("penguin_tap"))
    assertEquals("celebrate", WebViewSecurityPolicy.normalizeHapticType("celebrate"))

    assertNull(WebViewSecurityPolicy.normalizeHapticType(null))
    assertNull(WebViewSecurityPolicy.normalizeHapticType(""))
    assertNull(WebViewSecurityPolicy.normalizeHapticType("vibrate_forever"))
    assertNull(WebViewSecurityPolicy.normalizeHapticType("a".repeat(100)))
  }

  @Test
  fun `MainActivity configureHardenedSettings locks down WebView settings`() {
    val webView = WebView(context)
    MainActivity.configureHardenedSettings(webView.settings)

    assertTrue(webView.settings.javaScriptEnabled)
    assertTrue(webView.settings.domStorageEnabled)
    assertFalse(webView.settings.databaseEnabled)
    assertFalse(webView.settings.allowFileAccess)
    assertFalse(webView.settings.allowContentAccess)
    @Suppress("DEPRECATION")
    assertFalse(webView.settings.allowFileAccessFromFileURLs)
    @Suppress("DEPRECATION")
    assertFalse(webView.settings.allowUniversalAccessFromFileURLs)
    assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, webView.settings.mixedContentMode)
    assertFalse(webView.settings.javaScriptCanOpenWindowsAutomatically)
    assertFalse(webView.settings.supportMultipleWindows())
    webView.destroy()
  }

  @Test
  fun `HardenedWebViewClient restricts navigation, opens safe external HTTPS links externally, and blocks disallowed subresources`() {
    val openedExternal = mutableListOf<Uri>()
    val assetLoader = WebViewAssetLoader.Builder()
      .setDomain(WebViewSecurityPolicy.APP_ASSETS_HOST)
      .addPathHandler(
        WebViewSecurityPolicy.APP_ASSETS_PREFIX,
        WebViewAssetLoader.AssetsPathHandler(context)
      )
      .build()

    val client = MainActivity.HardenedWebViewClient(
      assetLoader = assetLoader,
      onCommittedUrlChanged = {},
      onOpenExternalUrl = { uri -> openedExternal.add(uri) }
    )
    val webView = WebView(context)

    // Trusted app URL navigates inside WebView
    assertFalse(client.shouldOverrideUrlLoading(webView, fakeRequest(WebViewSecurityPolicy.APP_ENTRY_URL)))
    assertTrue(openedExternal.isEmpty())

    // Safe main-frame external HTTPS link is blocked from WebView and delegated to system browser
    assertTrue(client.shouldOverrideUrlLoading(webView, fakeRequest("https://example.org/docs", isMainFrame = true)))
    assertEquals(1, openedExternal.size)
    assertEquals("https://example.org/docs", openedExternal[0].toString())

    // Unsafe schemes, private IPs, and subframe redirects are blocked AND never opened externally
    assertTrue(client.shouldOverrideUrlLoading(webView, fakeRequest("file:///android_asset/index.html", isMainFrame = true)))
    assertTrue(client.shouldOverrideUrlLoading(webView, fakeRequest("http://evil.example/phish", isMainFrame = true)))
    assertTrue(client.shouldOverrideUrlLoading(webView, fakeRequest("https://127.0.0.1/secret", isMainFrame = true)))
    assertTrue(client.shouldOverrideUrlLoading(webView, fakeRequest("https://example.org/subframe", isMainFrame = false)))
    assertEquals(1, openedExternal.size)

    // Subresource interception: 403 for untrusted third-party, null passthrough for Google Fonts
    val blocked = client.shouldInterceptRequest(webView, fakeRequest("https://untrusted.cdn.example/evil.js", isMainFrame = false))
    assertNotNull(blocked)
    assertEquals(403, blocked?.statusCode)

    val allowedFont = client.shouldInterceptRequest(webView, fakeRequest("https://fonts.googleapis.com/css2?family=Fredoka", isMainFrame = false))
    assertNull(allowedFont)

    webView.destroy()
  }

  @Test
  fun `WebAppInterface enforces trusted origin and validates save payloads and haptic types`() {
    val storage = SaveStorageManager(context)
    var currentOrigin: String? = "https://evil.example.com/attack.html"
    val bridge = MainActivity.WebAppInterface(context, storage) { currentOrigin }

    val validJson = """{"saveVersion":2,"fish":500,"glacierLevel":2}"""

    // Untrusted origin is completely denied
    assertFalse(bridge.saveGame(validJson))
    assertFalse(bridge.saveGameSync(validJson))
    assertEquals("", bridge.loadGame())
    assertFalse(bridge.clearSave())
    assertEquals("{}", bridge.getStorageHealth())
    assertFalse(bridge.triggerHaptic("tap"))

    // Legacy file:// origin is also denied now that WebViewAssetLoader is active
    currentOrigin = "file:///android_asset/index.html"
    assertFalse(bridge.saveGameSync(validJson))

    // Trusted local app origin is authorized
    currentOrigin = WebViewSecurityPolicy.APP_ENTRY_URL
    assertTrue(bridge.saveGameSync(validJson))
    assertEquals(validJson, bridge.loadGame())

    // Malformed, non-object, and oversized payloads are rejected without overwriting valid save
    assertFalse(bridge.saveGameSync("not json"))
    assertFalse(bridge.saveGameSync("[1,2,3]"))
    assertFalse(bridge.saveGameSync("""{"pad":"${"x".repeat(WebViewSecurityPolicy.MAX_SAVE_PAYLOAD_BYTES + 100)}"}"""))
    assertEquals(validJson, bridge.loadGame())

    // Invalid haptic type is rejected
    assertFalse(bridge.triggerHaptic("malicious_haptic"))

    assertTrue(bridge.clearSave())
    assertEquals("", bridge.loadGame())
    storage.shutdown()
  }

  @Test
  fun `SaveStorageManager performs async atomic writes, skips duplicates, quarantines corruption, and recovers backups`() {
    val storage = SaveStorageManager(context)
    val save1 = """{"saveVersion":2,"fish":1200,"glacierLevel":3}"""
    val save2 = """{"saveVersion":2,"fish":4800,"glacierLevel":5}"""

    assertTrue(storage.saveAsync(save1))
    assertTrue(storage.flush(2000L))
    val loaded1 = storage.loadSaveDetailed()
    assertEquals("prefs", loaded1.source)
    assertEquals(save1, loaded1.data)
    assertFalse(loaded1.recovered)

    // Save a second snapshot so backupFile has save2 and lastGoodFile has save1
    assertTrue(storage.saveSync(save2))
    assertEquals(save2, storage.loadSave())

    // Corrupt primary SharedPreferences -> should quarantine and recover cleanly from backupFile (save2)
    val prefs = context.getSharedPreferences(SaveStorageManager.PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().putString(SaveStorageManager.KEY_SAVE_STATE, "{corrupted-primary-json").commit()

    val recoveredFromBackup = storage.loadSaveDetailed()
    assertEquals("backup", recoveredFromBackup.source)
    assertTrue(recoveredFromBackup.recovered)
    assertEquals(save2, recoveredFromBackup.data)
    assertTrue(File(context.filesDir, SaveStorageManager.CORRUPT_QUARANTINE_FILENAME).exists())

    // Corrupt BOTH primary AND backup -> should recover cleanly from lastGoodFile (save1)
    prefs.edit().putString(SaveStorageManager.KEY_SAVE_STATE, "{corrupted-again").commit()
    File(context.filesDir, SaveStorageManager.BACKUP_FILENAME).writeText("{corrupted-backup")

    val recoveredFromLastGood = storage.loadSaveDetailed()
    assertEquals("last_good", recoveredFromLastGood.source)
    assertTrue(recoveredFromLastGood.recovered)
    assertEquals(save1, recoveredFromLastGood.data)

    // Explicit clearSave wipes everything cleanly
    assertTrue(storage.clearSave())
    assertEquals("", storage.loadSave())
    assertFalse(File(context.filesDir, SaveStorageManager.BACKUP_FILENAME).exists())
    assertFalse(File(context.filesDir, SaveStorageManager.LAST_GOOD_FILENAME).exists())
    storage.shutdown()
  }

  @Test
  fun `SaveStorageManager cleans up orphaned temp files from interrupted writes without damaging valid saves`() {
    val storage = SaveStorageManager(context)
    val validSave = """{"saveVersion":2,"fish":3210,"glacierLevel":4}"""
    assertTrue(storage.saveSync(validSave))

    val staleBackupTmp = File(context.filesDir, "${SaveStorageManager.BACKUP_FILENAME}.tmp")
    val staleLastGoodTmp = File(context.filesDir, "${SaveStorageManager.LAST_GOOD_FILENAME}.tmp")
    staleBackupTmp.writeText("{partial-write")
    staleLastGoodTmp.writeText("{partial-write")
    assertTrue(staleBackupTmp.exists())
    assertTrue(staleLastGoodTmp.exists())

    val loaded = storage.loadSaveDetailed()
    assertEquals(validSave, loaded.data)
    assertFalse(loaded.recovered)
    assertFalse(staleBackupTmp.exists())
    assertFalse(staleLastGoodTmp.exists())
    storage.shutdown()
  }

  @Test
  fun `HardenedWebViewClient handles renderer process crashes cleanly via onRenderProcessGone`() {
    var crashHandledCount = 0
    val assetLoader = WebViewAssetLoader.Builder()
      .setDomain(WebViewSecurityPolicy.APP_ASSETS_HOST)
      .addPathHandler(
        WebViewSecurityPolicy.APP_ASSETS_PREFIX,
        WebViewAssetLoader.AssetsPathHandler(context)
      )
      .build()

    val client = MainActivity.HardenedWebViewClient(
      assetLoader = assetLoader,
      onCommittedUrlChanged = {},
      onOpenExternalUrl = {},
      onRendererCrash = { crashHandledCount += 1 }
    )
    val webView = WebView(context)
    assertTrue(client.onRenderProcessGone(webView, null))
    assertEquals(1, crashHandledCount)
    webView.destroy()
  }

  @Test
  fun `MainActivity back button JS delegates cleanly to handleAndroidBackButton`() {
    assertTrue(MainActivity.BACK_BUTTON_JS.contains("window.handleAndroidBackButton"))
    assertTrue(MainActivity.BACK_BUTTON_JS.contains("factory-reset-modal"))
    assertTrue(MainActivity.BACK_BUTTON_JS.contains("bottom-sheet"))
  }
}
