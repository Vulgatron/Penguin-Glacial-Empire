package com.example

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

class MainActivity : ComponentActivity() {

  private var webView: WebView? = null
  private lateinit var storageManager: SaveStorageManager

  @Volatile
  private var currentCommittedUrl: String = WebViewSecurityPolicy.APP_ENTRY_URL

  /**
   * Hardened WebViewClient serving local bundled assets over WebViewAssetLoader's HTTPS origin
   * (https://appassets.androidplatform.net/assets/...) and enforcing strict navigation, redirect,
   * and subresource boundaries.
   */
  internal class HardenedWebViewClient(
    private val assetLoader: WebViewAssetLoader,
    private val onCommittedUrlChanged: (String) -> Unit,
    private val onOpenExternalUrl: (Uri) -> Unit,
    private val onRendererCrash: () -> Unit = {}
  ) : WebViewClient() {

    override fun shouldInterceptRequest(
      view: WebView,
      request: WebResourceRequest
    ): WebResourceResponse? {
      val uri = request.url ?: return blockedResponse()
      if (WebViewSecurityPolicy.isTrustedAppUrl(uri)) {
        return assetLoader.shouldInterceptRequest(uri)
      }
      if (WebViewSecurityPolicy.isAllowedSubresource(uri)) {
        return null
      }
      return blockedResponse()
    }

    override fun shouldOverrideUrlLoading(
      view: WebView,
      request: WebResourceRequest
    ): Boolean {
      val uri = request.url ?: return true
      // Allow navigation strictly within our trusted local app origin
      if (WebViewSecurityPolicy.isTrustedAppUrl(uri)) {
        return false
      }
      // Open legitimate user-initiated external HTTPS links in the system browser
      if (request.isForMainFrame && WebViewSecurityPolicy.isSafeExternalBrowserUrl(uri)) {
        onOpenExternalUrl(uri)
      }
      // Block all other in-WebView navigation & redirects (file://, content://, intent://, javascript:, http://)
      return true
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
      super.onPageStarted(view, url, favicon)
      if (!url.isNullOrBlank()) {
        onCommittedUrlChanged(url)
      }
    }

    override fun onPageFinished(view: WebView?, url: String?) {
      super.onPageFinished(view, url)
      if (!url.isNullOrBlank()) {
        onCommittedUrlChanged(url)
      }
    }

    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
      super.doUpdateVisitedHistory(view, url, isReload)
      if (!url.isNullOrBlank()) {
        onCommittedUrlChanged(url)
      }
    }

    override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
      onRendererCrash()
      return true
    }

    private fun blockedResponse(): WebResourceResponse {
      return WebResourceResponse(
        "text/plain",
        "utf-8",
        403,
        "Forbidden",
        mapOf("Cache-Control" to "no-store"),
        ByteArrayInputStream(ByteArray(0))
      )
    }
  }

  /**
   * Hardened native JavaScript bridge ("AndroidBridge").
   * Every call verifies the WebView's trusted local origin and validates all inputs before
   * touching storage or device haptics. Never accepts file paths or arbitrary system commands.
   */
  class WebAppInterface(
    private val context: Context,
    private val storage: SaveStorageManager,
    private val currentOriginProvider: () -> String?
  ) {
    private fun isAuthorizedOrigin(): Boolean {
      return WebViewSecurityPolicy.isTrustedBridgeOrigin(currentOriginProvider())
    }

    @JavascriptInterface
    fun saveGame(data: String?): Boolean {
      if (!isAuthorizedOrigin()) return false
      return storage.saveAsync(data)
    }

    @JavascriptInterface
    fun saveGameSync(data: String?): Boolean {
      if (!isAuthorizedOrigin()) return false
      return storage.saveSync(data)
    }

    @JavascriptInterface
    fun loadGame(): String {
      if (!isAuthorizedOrigin()) return ""
      return storage.loadSave()
    }

    @JavascriptInterface
    fun clearSave(): Boolean {
      if (!isAuthorizedOrigin()) return false
      return storage.clearSave()
    }

    @JavascriptInterface
    fun getStorageHealth(): String {
      if (!isAuthorizedOrigin()) return "{}"
      return storage.getHealthJson()
    }

    private val vibrator: Vibrator? by lazy {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
          manager?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
      } catch (_: Exception) {
        null
      }
    }

    @JavascriptInterface
    fun triggerHaptic(type: String?): Boolean {
      if (!isAuthorizedOrigin()) return false
      val normalized = WebViewSecurityPolicy.normalizeHapticType(type) ?: return false
      return try {
        val v = vibrator ?: return false
        if (!v.hasVibrator()) return false

        val durationMs: Long
        val amplitude: Int
        when (normalized) {
          "celebrate" -> {
            durationMs = 34L
            amplitude = 180
          }
          "collect" -> {
            durationMs = 26L
            amplitude = 140
          }
          "penguin_tap" -> {
            durationMs = 20L
            amplitude = 115
          }
          else -> {
            durationMs = 14L
            amplitude = 75
          }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val effectAmplitude = if (v.hasAmplitudeControl()) amplitude else VibrationEffect.DEFAULT_AMPLITUDE
          v.vibrate(VibrationEffect.createOneShot(durationMs, effectAmplitude))
        } else {
          @Suppress("DEPRECATION")
          v.vibrate(durationMs)
        }
        true
      } catch (_: Exception) {
        false
      }
    }
  }

  internal companion object {
    @SuppressLint("SetJavaScriptEnabled")
    fun configureHardenedSettings(settings: WebSettings) {
      settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        databaseEnabled = false
        allowFileAccess = false
        allowContentAccess = false
        @Suppress("DEPRECATION")
        allowFileAccessFromFileURLs = false
        @Suppress("DEPRECATION")
        allowUniversalAccessFromFileURLs = false
        mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        javaScriptCanOpenWindowsAutomatically = false
        setSupportMultipleWindows(false)
        @Suppress("DEPRECATION")
        setGeolocationEnabled(false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          safeBrowsingEnabled = true
        }
        mediaPlaybackRequiresUserGesture = false
        useWideViewPort = true
        loadWithOverviewMode = true
        cacheMode = WebSettings.LOAD_DEFAULT
      }
    }

    val BACK_BUTTON_JS: String = """
      (function() {
        if (typeof window.handleAndroidBackButton === 'function') {
          return Boolean(window.handleAndroidBackButton());
        }
        const factoryModal = document.getElementById('factory-reset-modal');
        if (factoryModal && factoryModal.style.display === 'flex') {
          if (typeof closeFactoryResetModal === 'function') closeFactoryResetModal();
          else factoryModal.style.display = 'none';
          return true;
        }
        const whatsNewModal = document.getElementById('whats-new-modal');
        if (whatsNewModal && whatsNewModal.style.display === 'flex') {
          const dismissBtn = document.getElementById('whats-new-dismiss-btn');
          if (dismissBtn) dismissBtn.click();
          else whatsNewModal.style.display = 'none';
          return true;
        }
        const offlineModal = document.getElementById('offline-modal');
        if (offlineModal && offlineModal.style.display === 'flex') {
          return true;
        }
        const modal = document.getElementById('aurora-modal');
        if (modal && modal.classList.contains('open')) {
          return true;
        }
        const sheet = document.getElementById('bottom-sheet');
        const pill = document.getElementById('collapsed-pill');
        if (sheet && !sheet.classList.contains('collapsed')) {
          sheet.classList.remove('expanded');
          sheet.classList.add('collapsed');
          if (pill) pill.classList.remove('hidden');
          return true;
        }
        return false;
      })()
    """.trimIndent()
  }

  private fun openExternalInSystemBrowser(uri: Uri) {
    if (!WebViewSecurityPolicy.isSafeExternalBrowserUrl(uri)) return
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      addCategory(Intent.CATEGORY_BROWSABLE)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    try {
      startActivity(intent)
    } catch (_: ActivityNotFoundException) {
      // No external browser available
    }
  }

  private fun requestImmediateSaveFlush() {
    runCatching {
      val activeWebView = webView
      if (activeWebView != null && !isDestroyed) {
        activeWebView.evaluateJavascript(
          "if (typeof window.flushGameSaveNow === 'function') { window.flushGameSaveNow(); } else if (typeof state !== 'undefined' && state.save) { state.save({ immediate: true, sync: true }); }",
          null
        )
      }
    }
    storageManager.flush(1500L)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    storageManager = SaveStorageManager(applicationContext)

    val assetLoader = WebViewAssetLoader.Builder()
      .setDomain(WebViewSecurityPolicy.APP_ASSETS_HOST)
      .addPathHandler(
        WebViewSecurityPolicy.APP_ASSETS_PREFIX,
        WebViewAssetLoader.AssetsPathHandler(this)
      )
      .build()

    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          val activeWebView = webView
          if (activeWebView == null) {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
            isEnabled = true
            return
          }
          activeWebView.evaluateJavascript(BACK_BUTTON_JS) { result ->
            if (result != "true") {
              requestImmediateSaveFlush()
              isEnabled = false
              onBackPressedDispatcher.onBackPressed()
              isEnabled = true
            }
          }
        }
      }
    )

    setContent {
      AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
          WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.MATCH_PARENT
            )

            configureHardenedSettings(settings)

            setBackgroundColor(android.graphics.Color.parseColor("#061121"))
            addJavascriptInterface(
              WebAppInterface(context.applicationContext, storageManager) { currentCommittedUrl },
              "AndroidBridge"
            )
            webChromeClient = WebChromeClient()
            webViewClient = HardenedWebViewClient(
              assetLoader = assetLoader,
              onCommittedUrlChanged = { committed -> currentCommittedUrl = committed },
              onOpenExternalUrl = { uri -> openExternalInSystemBrowser(uri) },
              onRendererCrash = {
                storageManager.flush(1000L)
                if (!isFinishing && !isDestroyed) {
                  runOnUiThread {
                    runCatching { recreate() }
                  }
                }
              }
            )

            currentCommittedUrl = WebViewSecurityPolicy.APP_ENTRY_URL
            loadUrl(WebViewSecurityPolicy.APP_ENTRY_URL)
            webView = this
          }
        }
      )
    }
  }

  override fun onPause() {
    super.onPause()
    requestImmediateSaveFlush()
    webView?.onPause()
  }

  override fun onStop() {
    super.onStop()
    requestImmediateSaveFlush()
  }

  override fun onResume() {
    super.onResume()
    webView?.onResume()
  }

  override fun onDestroy() {
    requestImmediateSaveFlush()
    storageManager.shutdown()
    webView?.removeJavascriptInterface("AndroidBridge")
    webView?.destroy()
    webView = null
    super.onDestroy()
  }
}
