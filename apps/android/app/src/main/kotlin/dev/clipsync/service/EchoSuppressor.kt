package dev.clipsync.service

class AndroidEchoSuppressor(
    private val windowMs: Long = 3000L
) {
    private val recentWrites = mutableMapOf<String, Long>()
    private var lastSentHash: String? = null

    @Synchronized
    fun recordLocalWrite(hash: String, currentTime: Long = System.currentTimeMillis()) {
        cleanup(currentTime)
        recentWrites[hash] = currentTime
    }

    @Synchronized
    fun isEchoAndConsume(hash: String, currentTime: Long = System.currentTimeMillis()): Boolean {
        cleanup(currentTime)
        val writeTime = recentWrites[hash] ?: return false
        val elapsed = currentTime - writeTime
        if (elapsed in 0..windowMs) {
            recentWrites.remove(hash)
            return true
        }
        return false
    }

    @Synchronized
    fun isDuplicateOfLastSent(hash: String): Boolean = lastSentHash == hash

    @Synchronized
    fun recordSent(hash: String) {
        lastSentHash = hash
    }

    @Synchronized
    fun clear() {
        recentWrites.clear()
        lastSentHash = null
    }

    private fun cleanup(currentTime: Long) {
        val iterator = recentWrites.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (currentTime - entry.value > windowMs) {
                iterator.remove()
            }
        }
    }
}
