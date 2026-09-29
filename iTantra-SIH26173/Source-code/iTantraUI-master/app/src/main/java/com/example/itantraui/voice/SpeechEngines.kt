package com.example.itantraui.voice

/** Boundary for a future local STT implementation (Phase 2). */
interface SpeechEngine {
    suspend fun transcribe(audio: ShortArray, language: LanguageConfig): String
}

/** Boundary for local speech output. */
interface TtsEngine {
    fun speak(text: String, language: String): Boolean
    fun stop()
}
