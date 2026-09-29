package com.example.itantraui.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * Offline Text-to-Speech (TTS) Engine wrapping Android native TextToSpeech.
 * Selects only locally installed Android voices; network-required voices are rejected.
 */
class OfflineTtsEngine(
    private val context: Context
) : TextToSpeech.OnInitListener, TtsEngine {

    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var currentConfig: LanguageConfig = LanguageConfig.ENGLISH

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _ttsStatus = MutableStateFlow("Initializing...")
    val ttsStatus: StateFlow<String> = _ttsStatus.asStateFlow()

    private var lastTtsLatencyMs: Long = 0L
    private var languageAvailable = false
    private val _offlineLanguageCodes = MutableStateFlow<Set<String>>(emptySet())
    val offlineLanguageCodes: StateFlow<Set<String>> = _offlineLanguageCodes.asStateFlow()

    fun initialize(config: LanguageConfig) {
        currentConfig = config
        if (tts == null) {
            tts = TextToSpeech(context.applicationContext, this)
        } else if (isInitialized) {
            setTtsLanguage(config)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isInitialized = true
            refreshOfflineLanguages()
            setTtsLanguage(currentConfig)
            setupUtteranceListener()
        } else {
            isInitialized = false
            _ttsStatus.value = "TTS Initialization Failed"
        }
    }

    private fun setTtsLanguage(config: LanguageConfig) {
        val ttsEngine = tts ?: return
        try {
            refreshOfflineLanguages()
            val availability = ttsEngine.isLanguageAvailable(config.ttsLocale)
            when (availability) {
                TextToSpeech.LANG_AVAILABLE,
                TextToSpeech.LANG_COUNTRY_AVAILABLE,
                TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE -> {
                    val localVoice = ttsEngine.voices?.firstOrNull {
                        it.locale.language == config.ttsLocale.language && !it.isNetworkConnectionRequired
                    }
                    languageAvailable = localVoice != null && ttsEngine.setVoice(localVoice) == TextToSpeech.SUCCESS
                    _ttsStatus.value = if (languageAvailable) "Local voice available (${config.displayName})"
                    else "No local voice installed for ${config.displayName}"
                }
                TextToSpeech.LANG_MISSING_DATA -> {
                    languageAvailable = false
                    _ttsStatus.value = "Voice pack missing for ${config.displayName}"
                }
                TextToSpeech.LANG_NOT_SUPPORTED -> {
                    languageAvailable = false
                    _ttsStatus.value = "${config.displayName} is unsupported by this TTS engine"
                }
                else -> {
                    languageAvailable = ttsEngine.setLanguage(config.ttsLocale) >= TextToSpeech.LANG_AVAILABLE
                    _ttsStatus.value = if (languageAvailable) "Available (${config.displayName})" else "${config.displayName} is unavailable"
                }
            }
        } catch (_: Exception) {
            languageAvailable = false
            _ttsStatus.value = "Unable to select local ${config.displayName} TTS voice"
        }
    }

    private fun setupUtteranceListener() {
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                _isSpeaking.value = true
            }

            override fun onDone(utteranceId: String?) {
                _isSpeaking.value = false
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                _isSpeaking.value = false
            }
        })
    }

    override fun speak(text: String, language: String): Boolean {
        val requestedConfig = LanguageConfig.fromLanguageName(language)
        if (requestedConfig.languageCode != currentConfig.languageCode) {
            currentConfig = requestedConfig
            if (isInitialized) setTtsLanguage(requestedConfig)
        }
        if (!isInitialized || text.isBlank() || !languageAvailable) return false

        try {
            val startMs = System.currentTimeMillis()
            val utteranceId = "msg_${System.currentTimeMillis()}"
            val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
            if (result == TextToSpeech.SUCCESS) {
                val latency = System.currentTimeMillis() - startMs
                lastTtsLatencyMs = latency
                return true
            }
        } catch (_: Exception) {
            _isSpeaking.value = false
        }
        return false
    }

    private fun refreshOfflineLanguages() {
        val codes = tts?.voices.orEmpty()
            .filterNot { it.isNetworkConnectionRequired }
            .map { it.locale.language.lowercase(Locale.ROOT) }
            .toSet()
        _offlineLanguageCodes.value = codes
    }

    fun speak(text: String, onLatencyMeasured: ((Long) -> Unit)? = null) {
        val start = System.currentTimeMillis()
        if (speak(text, currentConfig.languageCode)) onLatencyMeasured?.invoke(System.currentTimeMillis() - start)
    }

    override fun stop() {
        try {
            tts?.stop()
            _isSpeaking.value = false
        } catch (_: Exception) {}
    }

    fun release() {
        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
            isInitialized = false
            _isSpeaking.value = false
        } catch (_: Exception) {}
    }
}
