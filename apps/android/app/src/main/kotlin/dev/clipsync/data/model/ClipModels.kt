package dev.clipsync.data.model

import java.security.MessageDigest

enum class ClipContentType {
    TEXT,
    URL,
    IMAGE,
    FILE
}

data class ClipItem(
    val id: String,
    val sourceDeviceId: String,
    val contentType: ClipContentType,
    val content: String,
    val sizeBytes: Long,
    val hash: String,
    val isPinned: Boolean = false,
    val isFavourite: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
) {
    companion object {
        fun createTextItem(
            sourceDeviceId: String,
            rawText: String
        ): ClipItem {
            val normalized = rawText.replace("\r\n", "\n").replace('\r', '\n')
            val isUrl = normalized.trim().let {
                it.startsWith("http://", ignoreCase = true) || it.startsWith("https://", ignoreCase = true)
            }
            val type = if (isUrl) ClipContentType.URL else ClipContentType.TEXT
            val bytes = normalized.toByteArray(Charsets.UTF_8)
            val hash = MessageDigest.getInstance("SHA-256")
                .digest(bytes)
                .joinToString("") { "%02x".format(it) }

            val now = System.currentTimeMillis()
            return ClipItem(
                id = "clip-$sourceDeviceId-$now",
                sourceDeviceId = sourceDeviceId,
                contentType = type,
                content = normalized,
                sizeBytes = bytes.size.toLong(),
                hash = hash,
                createdAt = now
            )
        }
    }
}

data class PairedDevice(
    val id: String,
    val name: String,
    val platform: String,
    val isOnline: Boolean,
    val lastSeenAt: Long = System.currentTimeMillis()
)
