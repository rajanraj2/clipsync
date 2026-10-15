package dev.clipsync

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import dev.clipsync.data.model.ClipContentType
import dev.clipsync.data.model.ClipItem

class SharesheetReceiverActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingShareIntent(intent)
        finish()
    }

    private fun handleIncomingShareIntent(intent: Intent) {
        val action = intent.action
        val type = intent.type ?: return

        when (action) {
            Intent.ACTION_SEND -> {
                if (type == "text/plain") {
                    handleSendText(intent)
                } else if (type.startsWith("image/")) {
                    handleSendImage(intent)
                }
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                handleSendMultiple(intent)
            }
        }
    }

    private fun handleSendText(intent: Intent) {
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!sharedText.isNullOrBlank()) {
            val item = ClipItem.createTextItem("android-sharesheet", sharedText)
            Toast.makeText(this, "Shared to ClipSync: ${item.content.take(30)}...", Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleSendImage(intent: Intent) {
        val imageUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        if (imageUri != null) {
            Toast.makeText(this, "Image queued for ClipSync transfer", Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleSendMultiple(intent: Intent) {
        val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
        if (!uris.isNullOrEmpty()) {
            Toast.makeText(this, "${uris.size} items queued for ClipSync transfer", Toast.LENGTH_SHORT).show()
        }
    }
}
