package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
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

class MainActivity : ComponentActivity() {

  private var webView: WebView? = null

  class WebAppInterface(private val context: Context) {
    private val prefs = context.getSharedPreferences("penguin_save_data", Context.MODE_PRIVATE)
    private val backupFile = java.io.File(context.filesDir, "penguin_save_backup.json")

    @JavascriptInterface
    fun saveGame(data: String): Boolean {
      var prefSaved = false
      var fileSaved = false
      try {
        prefSaved = prefs.edit().putString("save_state", data).commit()
      } catch (e: Exception) {
        // Log or ignore
      }
      try {
        backupFile.writeText(data)
        fileSaved = true
      } catch (e: Exception) {
        // Log or ignore
      }
      return prefSaved || fileSaved
    }

    @JavascriptInterface
    fun loadGame(): String {
      try {
        val prefData = prefs.getString("save_state", "") ?: ""
        if (prefData.isNotBlank() && prefData.startsWith("{")) {
          return prefData
        }
      } catch (e: Exception) {
        // Ignore and fallback to file
      }

      try {
        if (backupFile.exists()) {
          val fileData = backupFile.readText()
          if (fileData.isNotBlank() && fileData.startsWith("{")) {
            // Restore back to prefs as well
            prefs.edit().putString("save_state", fileData).apply()
            return fileData
          }
        }
      } catch (e: Exception) {
        // Ignore
      }
      return ""
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
    fun triggerHaptic(type: String): Boolean {
      return try {
        val v = vibrator ?: return false
        if (!v.hasVibrator()) return false

        val durationMs: Long
        val amplitude: Int
        when (type) {
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

    @JavascriptInterface
    fun clearSave(): Boolean {
      var cleared = false
      try {
        cleared = prefs.edit().remove("save_state").commit()
      } catch (e: Exception) {
        // Ignore
      }
      try {
        if (backupFile.exists()) {
          backupFile.delete()
        }
      } catch (e: Exception) {
        // Ignore
      }
      return cleared
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          webView?.evaluateJavascript(
            """
            (function() {
              const whatsNewModal = document.getElementById('whats-new-modal');
              if (whatsNewModal && whatsNewModal.style.display === 'flex') {
                const dismissBtn = document.getElementById('whats-new-dismiss-btn');
                if (dismissBtn) {
                  dismissBtn.click();
                } else {
                  whatsNewModal.style.display = 'none';
                }
                return true;
              }
              const offlineModal = document.getElementById('offline-modal');
              if (offlineModal && offlineModal.style.display === 'flex') {
                return true;
              }
              const modal = document.getElementById('aurora-modal');
              if (modal && modal.classList.contains('open')) {
                return false;
              }
              const sheet = document.getElementById('bottom-sheet');
              const pill = document.getElementById('collapsed-pill');
              if (sheet && !sheet.classList.contains('collapsed')) {
                sheet.classList.add('collapsed');
                if (pill) pill.classList.remove('hidden');
                return true;
              }
              return false;
            })()
            """.trimIndent()
          ) { result ->
            if (result != "true") {
              webView?.evaluateJavascript("if (typeof state !== 'undefined' && state.save) { state.save(); }", null)
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

            settings.apply {
              javaScriptEnabled = true
              domStorageEnabled = true
              databaseEnabled = true
              allowFileAccess = true
              allowContentAccess = true
              @Suppress("DEPRECATION")
              allowFileAccessFromFileURLs = true
              @Suppress("DEPRECATION")
              allowUniversalAccessFromFileURLs = true
              mediaPlaybackRequiresUserGesture = false
              useWideViewPort = true
              loadWithOverviewMode = true
              cacheMode = WebSettings.LOAD_NO_CACHE
            }

            setBackgroundColor(android.graphics.Color.parseColor("#061121"))
            clearCache(true)
            addJavascriptInterface(WebAppInterface(context), "AndroidBridge")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {}

            loadUrl("file:///android_asset/index.html")
            webView = this
          }
        }
      )
    }
  }

  override fun onPause() {
    super.onPause()
    webView?.evaluateJavascript("if (typeof state !== 'undefined' && state.save) { state.save(); }", null)
    webView?.onPause()
  }

  override fun onStop() {
    super.onStop()
    webView?.evaluateJavascript("if (typeof state !== 'undefined' && state.save) { state.save(); }", null)
  }

  override fun onResume() {
    super.onResume()
    webView?.onResume()
  }

  override fun onDestroy() {
    webView?.evaluateJavascript("if (typeof state !== 'undefined' && state.save) { state.save(); }", null)
    webView?.destroy()
    webView = null
    super.onDestroy()
  }
}
