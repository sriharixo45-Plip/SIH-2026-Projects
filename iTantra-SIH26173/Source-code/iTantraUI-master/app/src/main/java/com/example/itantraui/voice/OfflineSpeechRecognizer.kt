package com.example.itantraui.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer as AndroidSpeechRecognizer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Interface abstraction for Speech Recognition engines.
 * Allows switching between Android Device-Provided recognition service and bundled ONNX models.
 */
interface SpeechRecognizerEngine {
    val engineName: String
    fun initialize(config: LanguageConfig): Boolean
    fun startListening(onResult: (String?, Long) -> Unit, onError: (String) -> Unit)
    fun stopListening()
    fun release()
}

/**
 * Android Device-Provided Speech Recognition Engine.
 * Requests offline speech recognition (`EXTRA_PREFER_OFFLINE = true`).
 * NOTE: Device-dependent; requires local offline voice pack installed in Android settings for Airplane mode.
 */
class DeviceProvidedSpeechRecognizerEngine(
    private val context: Context
) : SpeechRecognizerEngine {

    override val engineName: String = "Device-Provided (Requests Offline)"

    private var androidRecognizer: AndroidSpeechRecognizer? = null
    private var currentConfig: LanguageConfig = LanguageConfig.ENGLISH
    private var startTimeMs: Long = 0L
    private val mainHandler = Handler(Looper.getMainLooper())

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    override fun initialize(config: LanguageConfig): Boolean {
        currentConfig = config
        return try {
            mainHandler.post {
                if (AndroidSpeechRecognizer.isRecognitionAvailable(context)) {
                    if (androidRecognizer == null) {
                        androidRecognizer = AndroidSpeechRecognizer.createSpeechRecognizer(context)
                    }
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun startListening(onResult: (String?, Long) -> Unit, onError: (String) -> Unit) {
        mainHandler.post {
            try {
                if (androidRecognizer == null) {
                    if (AndroidSpeechRecognizer.isRecognitionAvailable(context)) {
                        androidRecognizer = AndroidSpeechRecognizer.createSpeechRecognizer(context)
                    }
                }

                val recognizer = androidRecognizer
                if (recognizer == null) {
                    onError("Speech recognizer service unavailable")
                    return@post
                }

                startTimeMs = System.currentTimeMillis()
                _isListening.value = true

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, currentConfig.sttLocale.toString())
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                }

                recognizer.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {
                        _isListening.value = false
                    }

                    override fun onError(error: Int) {
                        _isListening.value = false
                        val errorText = when (error) {
                            AndroidSpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized"
                            AndroidSpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout"
                            AndroidSpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                            AndroidSpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "RECORD_AUDIO permission required"
                            else -> "STT error code $error"
                        }
                        onError(errorText)
                    }

                    override fun onResults(results: Bundle?) {
                        _isListening.value = false
                        val latencyMs = System.currentTimeMillis() - startTimeMs
                        val matches = results?.getStringArrayList(AndroidSpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull()?.trim()
                        onResult(text, latencyMs)
                    }

                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                recognizer.startListening(intent)
            } catch (e: Exception) {
                _isListening.value = false
                onError("STT Exception: ${e.message ?: "Unknown"}")
            }
        }
    }

    override fun stopListening() {
        mainHandler.post {
            try {
                _isListening.value = false
                androidRecognizer?.stopListening()
            } catch (_: Exception) {}
        }
    }

    override fun release() {
        mainHandler.post {
            try {
                _isListening.value = false
                androidRecognizer?.destroy()
                androidRecognizer = null
            } catch (_: Exception) {}
        }
    }
}

// Alias for backwards compatibility
typealias OfflineSpeechRecognizerEngine = DeviceProvidedSpeechRecognizerEngine
