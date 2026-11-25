package com.example

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * Race-free, atomic native persistence manager for Penguin Glacial Empire.
 *
 * Preserves backwards compatibility with legacy SharedPreferences ("penguin_save_data" / "save_state")
 * and internal backup file ("penguin_save_backup.json") so existing Android installs migrate seamlessly
 * from file:// to WebViewAssetLoader HTTPS local origin without losing progress.
 *
 * Reliability & Performance guarantees:
 * - Serialized single-thread async persistence queue (eliminates synchronous commit() hitches)
 * - Skips redundant disk writes when the serialized payload is identical to the last persisted payload
 * - Validates JSON object structure and UTF-8 byte length before overwriting any known-good data
 * - Atomic temp-file write + fsync + rename for backup files
 * - Known-good secondary backup + corruption quarantine so malformed data never silently wipes progress
 */
class SaveStorageManager(
  context: Context,
  private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "glacial-save-writer").apply { isDaemon = true }
  }
) {
  companion object {
    const val PREFS_NAME = "penguin_save_data"
    const val KEY_SAVE_STATE = "save_state"
    const val BACKUP_FILENAME = "penguin_save_backup.json"
    const val LAST_GOOD_FILENAME = "penguin_save_last_good.json"
    const val CORRUPT_QUARANTINE_FILENAME = "penguin_save_corrupted.json"
  }

  private val appContext: Context = context.applicationContext ?: context
  private val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  private val backupFile: File = File(appContext.filesDir, BACKUP_FILENAME)
  private val lastGoodFile: File = File(appContext.filesDir, LAST_GOOD_FILENAME)
  private val quarantineFile: File = File(appContext.filesDir, CORRUPT_QUARANTINE_FILENAME)

  private val lastPersistedPayload = AtomicReference<String?>(null)
  private val recoveredFromCorruption = AtomicBoolean(false)
  private val isShutdown = AtomicBoolean(false)

  sealed class ValidationResult {
    data class Valid(val normalizedJson: String) : ValidationResult()
    data class Invalid(val reason: String) : ValidationResult()
  }

  data class LoadResult(
    val data: String,
    val source: String,
    val recovered: Boolean
  )

  fun validatePayload(raw: String?): ValidationResult {
    if (raw.isNullOrBlank()) {
      return ValidationResult.Invalid("Empty save payload")
    }
    val bytes = raw.toByteArray(StandardCharsets.UTF_8)
    if (bytes.size > WebViewSecurityPolicy.MAX_SAVE_PAYLOAD_BYTES) {
      return ValidationResult.Invalid("Save payload exceeds ${WebViewSecurityPolicy.MAX_SAVE_PAYLOAD_BYTES} bytes")
    }
    val trimmed = raw.trim()
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      return ValidationResult.Invalid("Save payload is not a JSON object")
    }
    return try {
      JSONObject(trimmed)
      ValidationResult.Valid(trimmed)
    } catch (_: Exception) {
      ValidationResult.Invalid("Malformed JSON payload")
    }
  }

  /**
   * Enqueues an asynchronous, race-free save write on the dedicated single-threaded save queue.
   * Returns true if the payload passed validation and was accepted (or already persisted unchanged).
   */
  fun saveAsync(rawData: String?): Boolean {
    val validation = validatePayload(rawData)
    if (validation !is ValidationResult.Valid) {
      return false
    }
    val payload = validation.normalizedJson
    if (payload == lastPersistedPayload.get()) {
      return true
    }
    if (isShutdown.get()) {
      return persistInternal(payload, syncPrefs = true)
    }
    return try {
      executor.execute {
        persistInternal(payload, syncPrefs = false)
      }
      true
    } catch (_: Exception) {
      persistInternal(payload, syncPrefs = true)
    }
  }

  /**
   * Synchronously validates and persists a save payload (used for critical milestones or lifecycle pauses).
   */
  fun saveSync(rawData: String?): Boolean {
    val validation = validatePayload(rawData)
    if (validation !is ValidationResult.Valid) {
      return false
    }
    val payload = validation.normalizedJson
    if (payload == lastPersistedPayload.get()) {
      return true
    }
    if (isShutdown.get()) {
      return persistInternal(payload, syncPrefs = true)
    }
    return try {
      executor.submit<Boolean> {
        persistInternal(payload, syncPrefs = true)
      }.get(2500, TimeUnit.MILLISECONDS)
    } catch (_: Exception) {
      persistInternal(payload, syncPrefs = true)
    }
  }

  /**
   * Waits for all queued async saves to finish writing to disk.
   */
  fun flush(timeoutMs: Long = 2000L): Boolean {
    if (isShutdown.get()) return true
    return try {
      executor.submit { /* barrier */ }.get(timeoutMs, TimeUnit.MILLISECONDS)
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun persistInternal(payload: String, syncPrefs: Boolean): Boolean {
    if (payload == lastPersistedPayload.get()) return true
    var prefSaved = false
    var fileSaved = false

    try {
      val editor = prefs.edit().putString(KEY_SAVE_STATE, payload)
      prefSaved = if (syncPrefs) {
        editor.commit()
      } else {
        editor.apply()
        true
      }
    } catch (_: Exception) {
      prefSaved = false
    }

    try {
      // Preserve previous valid backup in lastGoodFile before replacing backupFile
      if (backupFile.exists()) {
        val prev = runCatching { backupFile.readText(StandardCharsets.UTF_8) }.getOrNull()
        if (validatePayload(prev) is ValidationResult.Valid) {
          writeFileAtomically(lastGoodFile, prev!!)
        }
      }
      writeFileAtomically(backupFile, payload)
      if (!lastGoodFile.exists()) {
        writeFileAtomically(lastGoodFile, payload)
      }
      fileSaved = true
    } catch (_: Exception) {
      fileSaved = false
    }

    if (prefSaved || fileSaved) {
      lastPersistedPayload.set(payload)
    }
    return prefSaved || fileSaved
  }

  /**
   * Loads the save payload with automatic corruption quarantine and fallback recovery:
   * 1. Primary SharedPreferences
   * 2. Atomic backup file (penguin_save_backup.json)
   * 3. Secondary known-good snapshot (penguin_save_last_good.json)
   */
  fun loadSaveDetailed(): LoadResult {
    // Ensure any pending queued writes finish before reading
    flush(1000L)

    var sawCorruptedPrimary = false

    // 1. Primary SharedPreferences
    val prefRaw = runCatching { prefs.getString(KEY_SAVE_STATE, null) }.getOrNull()
    if (!prefRaw.isNullOrBlank()) {
      when (val res = validatePayload(prefRaw)) {
        is ValidationResult.Valid -> {
          lastPersistedPayload.set(res.normalizedJson)
          return LoadResult(res.normalizedJson, "prefs", recovered = false)
        }
        is ValidationResult.Invalid -> {
          sawCorruptedPrimary = true
          quarantineCorruptedData(prefRaw)
        }
      }
    }

    // 2. Primary backup file
    val backupRaw = readFileSafe(backupFile)
    if (!backupRaw.isNullOrBlank()) {
      when (val res = validatePayload(backupRaw)) {
        is ValidationResult.Valid -> {
          healPrimary(res.normalizedJson)
          recoveredFromCorruption.set(sawCorruptedPrimary)
          return LoadResult(res.normalizedJson, "backup", recovered = sawCorruptedPrimary)
        }
        is ValidationResult.Invalid -> {
          if (!sawCorruptedPrimary) {
            sawCorruptedPrimary = true
            quarantineCorruptedData(backupRaw)
          }
        }
      }
    }

    // 3. Last-known-good snapshot
    val lastGoodRaw = readFileSafe(lastGoodFile)
    if (!lastGoodRaw.isNullOrBlank()) {
      when (val res = validatePayload(lastGoodRaw)) {
        is ValidationResult.Valid -> {
          healPrimary(res.normalizedJson)
          runCatching { writeFileAtomically(backupFile, res.normalizedJson) }
          recoveredFromCorruption.set(true)
          return LoadResult(res.normalizedJson, "last_good", recovered = true)
        }
        is ValidationResult.Invalid -> {
          // Unrecoverable across all slots
        }
      }
    }

    return LoadResult("", if (sawCorruptedPrimary) "corrupted_unrecoverable" else "empty", recovered = false)
  }

  fun loadSave(): String = loadSaveDetailed().data

  /**
   * Explicit wipe used ONLY by intentional Factory Reset.
   */
  fun clearSave(): Boolean {
    val action = {
      lastPersistedPayload.set(null)
      recoveredFromCorruption.set(false)
      val prefCleared = runCatching { prefs.edit().remove(KEY_SAVE_STATE).commit() }.getOrDefault(false)
      runCatching { if (backupFile.exists()) backupFile.delete() }
      runCatching { if (lastGoodFile.exists()) lastGoodFile.delete() }
      runCatching { if (quarantineFile.exists()) quarantineFile.delete() }
      prefCleared
    }
    return if (isShutdown.get()) {
      action()
    } else {
      try {
        executor.submit<Boolean> { action() }.get(2000L, TimeUnit.MILLISECONDS)
      } catch (_: Exception) {
        action()
      }
    }
  }

  fun getHealthJson(): String {
    val obj = JSONObject()
    obj.put("hasPrimary", !prefs.getString(KEY_SAVE_STATE, null).isNullOrBlank())
    obj.put("hasBackup", backupFile.exists())
    obj.put("hasLastGood", lastGoodFile.exists())
    obj.put("hasQuarantinedCorrupt", quarantineFile.exists())
    obj.put("recoveredFromCorruption", recoveredFromCorruption.get())
    return obj.toString()
  }

  fun shutdown() {
    if (isShutdown.compareAndSet(false, true)) {
      executor.shutdown()
      runCatching { executor.awaitTermination(2000L, TimeUnit.MILLISECONDS) }
    }
  }

  private fun healPrimary(validJson: String) {
    lastPersistedPayload.set(validJson)
    runCatching { prefs.edit().putString(KEY_SAVE_STATE, validJson).apply() }
  }

  private fun quarantineCorruptedData(corruptRaw: String) {
    runCatching {
      val capped = if (corruptRaw.length > 65536) corruptRaw.substring(0, 65536) else corruptRaw
      writeFileAtomically(quarantineFile, capped)
    }
  }

  private fun readFileSafe(file: File): String? {
    if (!file.exists() || !file.isFile) return null
    if (file.length() <= 0 || file.length() > WebViewSecurityPolicy.MAX_SAVE_PAYLOAD_BYTES * 2L) return null
    return runCatching { file.readText(StandardCharsets.UTF_8) }.getOrNull()
  }

  private fun writeFileAtomically(target: File, content: String) {
    val parent = target.parentFile ?: appContext.filesDir
    if (!parent.exists()) parent.mkdirs()
    val tmp = File(parent, "${target.name}.tmp")
    FileOutputStream(tmp).use { fos ->
      fos.write(content.toByteArray(StandardCharsets.UTF_8))
      fos.flush()
      runCatching { fos.fd.sync() }
    }
    if (!tmp.renameTo(target)) {
      // Fallback for filesystems where renameTo fails if destination exists
      if (target.exists()) {
        target.delete()
      }
      if (!tmp.renameTo(target)) {
        tmp.copyTo(target, overwrite = true)
        tmp.delete()
      }
    }
  }
}
