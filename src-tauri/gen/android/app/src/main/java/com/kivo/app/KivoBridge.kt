package com.kivo.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Native helpers the web UI cannot do itself: download the new APK, check it, and hand it to
 * the Android package installer. Exposed to the WebView as `window.KivoAndroid`.
 *
 * Progress is pushed back to the page as a `kivo:apk-update` CustomEvent whose detail is
 * `{ status: "downloading" | "verifying" | "installing" | "error", percent?, message? }`.
 */
class KivoBridge(private val context: Context, private val webView: WebView) {

    private val busy = AtomicBoolean(false)

    /** True when the user has allowed Kivo to install apps ("Install unknown apps"). */
    @JavascriptInterface
    fun canInstallPackages(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    /** Opens the system screen where the user grants "Install unknown apps" to Kivo. */
    @JavascriptInterface
    fun openInstallSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + context.packageName)
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /** Opens a phone call, SMS, WhatsApp chat or Kivo release page in the matching Android app. */
    @JavascriptInterface
    fun openExternal(url: String): Boolean {
        val allowed = EXTERNAL_PREFIXES.any { url.startsWith(it) }
        if (!allowed) return false
        return try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Downloads the release APK at [url], verifies it and opens the installer.
     * Only Kivo's own GitHub release downloads are accepted. Returns false if the request
     * was rejected or an update is already running.
     */
    @JavascriptInterface
    fun downloadAndInstall(url: String): Boolean {
        if (!url.startsWith(ALLOWED_PREFIX) || !url.endsWith(".apk")) {
            emit("error", message = "Alamat pembaruan tidak dikenali.")
            return false
        }
        if (!busy.compareAndSet(false, true)) return false

        Thread {
            try {
                val apk = download(url)
                emit("verifying")
                verifyChecksum(url, apk)
                verifyPackage(apk)
                emit("installing", 100)
                install(apk)
            } catch (e: UpdateException) {
                emit("error", message = e.message ?: "Pembaruan gagal.")
            } catch (e: Exception) {
                emit("error", message = "Pembaruan gagal: " + (e.message ?: e.javaClass.simpleName))
            } finally {
                busy.set(false)
            }
        }.start()
        return true
    }

    private fun download(url: String): File {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val target = File(dir, "kivo-update.apk")

        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000
            readTimeout = 30000
            instanceFollowRedirects = true
        }
        try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) {
                throw UpdateException("Server pembaruan menjawab " + conn.responseCode + ".")
            }
            val total = conn.contentLengthLong
            var done = 0L
            var lastPercent = -1
            conn.inputStream.use { input ->
                target.outputStream().use { output ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        output.write(buf, 0, n)
                        done += n
                        if (total > 0) {
                            val percent = (done * 100 / total).toInt()
                            if (percent != lastPercent) {
                                lastPercent = percent
                                emit("downloading", percent)
                            }
                        }
                    }
                }
            }
            if (total > 0 && done != total) {
                throw UpdateException("Unduhan tidak lengkap. Coba lagi.")
            }
        } finally {
            conn.disconnect()
        }
        return target
    }

    /** The release publishes `<apk>.sha256`; when it is reachable the download must match it. */
    private fun verifyChecksum(url: String, apk: File) {
        val expected = try {
            val conn = (URL("$url.sha256").openConnection() as HttpURLConnection).apply {
                connectTimeout = 10000
                readTimeout = 10000
            }
            try {
                if (conn.responseCode != HttpURLConnection.HTTP_OK) return
                conn.inputStream.bufferedReader().readText().trim().split(Regex("\\s+")).firstOrNull()
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            return
        }
        if (expected == null || expected.length != 64) return

        val digest = MessageDigest.getInstance("SHA-256")
        apk.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                digest.update(buf, 0, n)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        if (!actual.equals(expected, ignoreCase = true)) {
            apk.delete()
            throw UpdateException("Berkas pembaruan rusak (checksum tidak cocok). Coba lagi.")
        }
    }

    /** Refuses an APK that Android would reject anyway, with a message people can act on. */
    @Suppress("DEPRECATION")
    private fun verifyPackage(apk: File) {
        val pm = context.packageManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else 0
        val archive = pm.getPackageArchiveInfo(apk.absolutePath, flags)
            ?: throw UpdateException("Berkas pembaruan bukan APK yang valid.")
        if (archive.packageName != context.packageName) {
            throw UpdateException("Berkas pembaruan bukan untuk aplikasi Kivo.")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val installed = pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            val oldSigners = installed.signingInfo?.apkContentsSigners
            val newSigners = archive.signingInfo?.apkContentsSigners
            if (oldSigners != null && newSigners != null && oldSigners.isNotEmpty() && newSigners.isNotEmpty() &&
                !oldSigners.toSet().containsAll(newSigners.toSet())
            ) {
                throw UpdateException(
                    "Pembaruan ditandatangani dengan kunci berbeda sehingga tidak bisa menimpa versi ini. " +
                        "Hapus aplikasi lalu pasang APK terbaru (data di HP akan hilang, cadangkan dulu)."
                )
            }
        }
    }

    private fun install(apk: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun emit(status: String, percent: Int? = null, message: String? = null) {
        val detail = JSONObject().put("status", status)
        if (percent != null) detail.put("percent", percent)
        if (message != null) detail.put("message", message)
        val js = "window.dispatchEvent(new CustomEvent('kivo:apk-update',{detail:" + detail.toString() + "}))"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    private class UpdateException(message: String) : Exception(message)

    companion object {
        private const val ALLOWED_PREFIX = "https://github.com/AchiraStudio/kivo/releases/download/"
        private val EXTERNAL_PREFIXES = listOf(
            "tel:",
            "sms:",
            "https://wa.me/",
            "https://github.com/AchiraStudio/kivo/"
        )
    }
}
