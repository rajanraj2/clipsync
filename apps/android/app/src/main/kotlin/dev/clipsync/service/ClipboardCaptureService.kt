package dev.clipsync.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import dev.clipsync.data.model.ClipItem

class ClipboardCaptureService : Service() {

    private lateinit var clipboardManager: ClipboardManager
    private val echoSuppressor = AndroidEchoSuppressor()
    private var isListening = false

    private val clipChangedListener = ClipboardManager.OnPrimaryClipChangedListener {
        handlePrimaryClipChanged()
    }

    override fun onCreate() {
        super.onCreate()
        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())
        startListening()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP_SERVICE) {
            stopListening()
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopListening()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startListening() {
        if (!isListening) {
            clipboardManager.addPrimaryClipChangedListener(clipChangedListener)
            isListening = true
        }
    }

    private fun stopListening() {
        if (isListening) {
            clipboardManager.removePrimaryClipChangedListener(clipChangedListener)
            isListening = false
        }
    }

    private fun handlePrimaryClipChanged() {
        val clip = clipboardManager.primaryClip ?: return
        if (clip.itemCount == 0) return

        val text = clip.getItemAt(0)?.coerceToText(this)?.toString() ?: return
        if (text.isBlank()) return

        val item = ClipItem.createTextItem("android-local", text)

        // Prevent self-sync loop echo
        if (echoSuppressor.isEchoAndConsume(item.hash)) {
            return
        }

        // Prevent consecutive duplicates
        if (echoSuppressor.isDuplicateOfLastSent(item.hash)) {
            return
        }

        echoSuppressor.recordSent(item.hash)

        // Broadcast locally or dispatch to active network transport
        broadcastLocalClipboard(item)
    }

    fun writeIncomingClipToSystem(item: ClipItem) {
        // Record write hash BEFORE writing to system clipboard to suppress echo
        echoSuppressor.recordLocalWrite(item.hash)
        val clip = ClipData.newPlainText("ClipSync", item.content)
        clipboardManager.setPrimaryClip(clip)
    }

    private fun broadcastLocalClipboard(item: ClipItem) {
        val broadcastIntent = Intent(ACTION_NEW_CLIP).apply {
            putExtra(EXTRA_CLIP_CONTENT, item.content)
            putExtra(EXTRA_CLIP_TYPE, item.contentType.name)
            putExtra(EXTRA_CLIP_HASH, item.hash)
            setPackage(packageName)
        }
        sendBroadcast(broadcastIntent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ClipSync Active Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors clipboard and synchronizes with connected devices"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ClipSync Active")
            .setContentText("Clipboard synchronization running")
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "clipsync_foreground_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP_SERVICE = "dev.clipsync.action.STOP"
        const val ACTION_NEW_CLIP = "dev.clipsync.action.NEW_CLIP"
        const val EXTRA_CLIP_CONTENT = "extra_content"
        const val EXTRA_CLIP_TYPE = "extra_type"
        const val EXTRA_CLIP_HASH = "extra_hash"

        fun start(context: Context) {
            val intent = Intent(context, ClipboardCaptureService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
