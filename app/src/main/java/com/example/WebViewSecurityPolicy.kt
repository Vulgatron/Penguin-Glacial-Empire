package com.example

import android.net.Uri
import java.net.InetAddress
import java.util.Locale

/**
 * Centralized security policy for the Android WebView container and JS bridge.
 *
 * Enforces:
 * - Local bundled assets served strictly over AndroidX WebViewAssetLoader's HTTPS origin
 * - Blocking file://, content://, javascript:, data:, intent://, and arbitrary HTTP(S) navigation
 * - Safe external browser launch for legitimate public HTTPS links only
 * - Strict origin & input allowlist validation for the AndroidBridge JS interface
 */
object WebViewSecurityPolicy {
  const val APP_ASSETS_HOST = "appassets.androidplatform.net"
  const val APP_ASSETS_ORIGIN = "https://$APP_ASSETS_HOST"
  const val APP_ASSETS_PREFIX = "/assets/"
  const val APP_ENTRY_URL = "$APP_ASSETS_ORIGIN${APP_ASSETS_PREFIX}index.html"

  const val MAX_SAVE_PAYLOAD_BYTES = 512 * 1024 // 512 KB generous upper bound for colony saves

  private val ALLOWED_FONT_HOSTS = setOf(
    "fonts.googleapis.com",
    "fonts.gstatic.com"
  )

  val ALLOWED_HAPTIC_TYPES: Set<String> = setOf(
    "tap",
    "collect",
    "penguin_tap",
    "celebrate"
  )

  /**
   * Returns true only for bundled app assets under https://appassets.androidplatform.net/assets/...
   * with no path traversal segments.
   */
  fun isTrustedAppUrl(uri: Uri?): Boolean {
    if (uri == null) return false
    val scheme = uri.scheme?.lowercase(Locale.US) ?: return false
    if (scheme != "https") return false
    val host = uri.host?.lowercase(Locale.US) ?: return false
    if (host != APP_ASSETS_HOST) return false
    if (uri.port != -1 && uri.port != 443) return false
    val path = uri.path ?: return false
    if (!path.startsWith(APP_ASSETS_PREFIX)) return false
    val segments = path.split("/")
    if (segments.any { it == ".." || it == "." }) return false
    return true
  }

  fun isTrustedAppUrl(url: String?): Boolean {
    if (url.isNullOrBlank()) return false
    return try {
      isTrustedAppUrl(Uri.parse(url))
    } catch (_: Exception) {
      false
    }
  }

  /**
   * Verifies that the WebView's currently loaded document origin is our trusted local app origin
   * before allowing privileged native bridge calls.
   */
  fun isTrustedBridgeOrigin(currentUrl: String?): Boolean {
    return isTrustedAppUrl(currentUrl)
  }

  /**
   * Subresources allowed to be fetched by the bundled game document.
   * Only local bundled assets and optional Google Fonts stylesheets/glyphs are permitted.
   */
  fun isAllowedSubresource(uri: Uri?): Boolean {
    if (uri == null) return false
    if (isTrustedAppUrl(uri)) return true
    val scheme = uri.scheme?.lowercase(Locale.US) ?: return false
    val host = uri.host?.lowercase(Locale.US) ?: return false
    if (scheme == "https" && host in ALLOWED_FONT_HOSTS) {
      return true
    }
    return false
  }

  /**
   * Determines whether a user-initiated navigation URL may be handed off to the external system
   * browser. Rejects non-HTTPS schemes, credentials in URLs, and localhost/private/link-local hosts.
   */
  fun isSafeExternalBrowserUrl(uri: Uri?): Boolean {
    if (uri == null) return false
    val scheme = uri.scheme?.lowercase(Locale.US) ?: return false
    if (scheme != "https") return false
    if (!uri.userInfo.isNullOrEmpty()) return false
    val host = uri.host?.lowercase(Locale.US)?.trim() ?: return false
    if (host.isEmpty() || host == APP_ASSETS_HOST) return false
    if (isPrivateOrLocalHost(host)) return false
    return true
  }

  internal fun isPrivateOrLocalHost(host: String): Boolean {
    val clean = host.trim().lowercase(Locale.US).removePrefix("[").removeSuffix("]")
    if (clean.isEmpty()) return true
    if (clean == "localhost" || clean.endsWith(".localhost") || clean.endsWith(".local") || clean.endsWith(".internal")) {
      return true
    }
    // Check numeric IPv4/IPv6 literals without triggering DNS lookups
    val isIpLiteral = clean.matches(Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")) || clean.contains(":")
    if (isIpLiteral) {
      return try {
        val addr = InetAddress.getByName(clean)
        addr.isAnyLocalAddress ||
          addr.isLoopbackAddress ||
          addr.isLinkLocalAddress ||
          addr.isSiteLocalAddress ||
          addr.isMulticastAddress ||
          isCarrierGradeNatOrUniqueLocal(addr.address)
      } catch (_: Exception) {
        true
      }
    }
    return false
  }

  private fun isCarrierGradeNatOrUniqueLocal(bytes: ByteArray): Boolean {
    if (bytes.size == 4) {
      val b0 = bytes[0].toInt() and 0xFF
      val b1 = bytes[1].toInt() and 0xFF
      // 100.64.0.0/10 (CGNAT), 0.0.0.0/8, 169.254.0.0/16 (link-local/metadata)
      if (b0 == 0) return true
      if (b0 == 100 && b1 in 64..127) return true
      if (b0 == 169 && b1 == 254) return true
    } else if (bytes.size == 16) {
      val b0 = bytes[0].toInt() and 0xFF
      // fc00::/7 Unique Local IPv6
      if ((b0 and 0xFE) == 0xFC) return true
    }
    return false
  }

  /**
   * Validates and normalizes haptic event names passed across the JS bridge.
   */
  fun normalizeHapticType(rawType: String?): String? {
    if (rawType.isNullOrBlank() || rawType.length > 32) return null
    val normalized = rawType.trim().lowercase(Locale.US)
    return if (normalized in ALLOWED_HAPTIC_TYPES) normalized else null
  }
}
