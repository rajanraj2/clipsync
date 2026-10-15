package dev.clipsync

import dev.clipsync.data.model.ClipContentType
import dev.clipsync.data.model.ClipItem
import dev.clipsync.service.AndroidEchoSuppressor
import org.junit.Assert.*
import org.junit.Test

class AndroidSyncLogicTest {

    @Test
    fun testTextNormalizationAndHashing() {
        val raw = "Hello Android\r\nMulti-line"
        val item = ClipItem.createTextItem("android-1", raw)

        assertEquals("Hello Android\nMulti-line", item.content)
        assertEquals(ClipContentType.TEXT, item.contentType)
        assertNotNull(item.hash)
        assertTrue(item.hash.isNotEmpty())
        assertEquals(64, item.hash.length) // SHA-256 hex length
    }

    @Test
    fun testUrlContentTypeDetection() {
        val url = "https://clipsync.dev/api/v1/ws"
        val item = ClipItem.createTextItem("android-1", url)

        assertEquals(ClipContentType.URL, item.contentType)
    }

    @Test
    fun testEchoSuppressionPreventsSelfSyncReflection() {
        val suppressor = AndroidEchoSuppressor(windowMs = 2000L)
        val hash = "test-hash-123"
        val now = 10_000L

        suppressor.recordLocalWrite(hash, currentTime = now)

        // Incoming change event within suppression window
        val isEcho = suppressor.isEchoAndConsume(hash, currentTime = now + 500L)
        assertTrue(isEcho)

        // Token consumed: second event not suppressed
        val secondCheck = suppressor.isEchoAndConsume(hash, currentTime = now + 600L)
        assertFalse(secondCheck)
    }

    @Test
    fun testEchoSuppressionExpiresAfterWindow() {
        val suppressor = AndroidEchoSuppressor(windowMs = 1500L)
        val hash = "test-hash-456"
        val now = 10_000L

        suppressor.recordLocalWrite(hash, currentTime = now)

        // Arrives after 2000ms (> 1500ms window)
        val isEcho = suppressor.isEchoAndConsume(hash, currentTime = now + 2000L)
        assertFalse(isEcho)
    }

    @Test
    fun testConsecutiveDuplicateSuppression() {
        val suppressor = AndroidEchoSuppressor()
        val hash = "dup-hash-789"

        assertFalse(suppressor.isDuplicateOfLastSent(hash))

        suppressor.recordSent(hash)
        assertTrue(suppressor.isDuplicateOfLastSent(hash))
        assertFalse(suppressor.isDuplicateOfLastSent("other-hash"))
    }
}
