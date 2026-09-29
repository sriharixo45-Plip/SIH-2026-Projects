package com.example.itantraui.voice

import android.content.Context
import android.os.Environment
import android.os.SystemClock
import android.util.Log
import com.whispercpp.whisper.WhisperContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

/** Offline recognizer backed by the upstream whisper.cpp Android JNI module. */
class WhisperCppSpeechEngine(context: Context) : SpeechEngine {
    private val appContext = context.applicationContext
    private val inferenceMutex = Mutex()
    @Volatile private var whisperContext: WhisperContext? = null
    @Volatile private var loadedModelPath: String? = null
    private val validatedModelTimestamps = mutableMapOf<String, Long>()

    val modelFile: File get() = modelFile(LanguageConfig.ENGLISH)

    fun modelFile(language: LanguageConfig): File = File(modelsDirectory(), modelFilename(language))

    private fun modelsDirectory(): File {
        val emulatedRoot = Environment.getExternalStorageDirectory().absolutePath
        val root = appContext.getExternalFilesDirs(null)
            .firstOrNull { it != null && it.absolutePath.startsWith(emulatedRoot) }
            ?: appContext.filesDir
        return File(root, "models")
    }

    override suspend fun transcribe(audio: ShortArray, language: LanguageConfig): String = withContext(Dispatchers.Default) {
        require(LanguageConfig.fromCode(language.languageCode) != null) {
            "Offline speech recognition does not support ${language.displayName}"
        }
        require(audio.isNotEmpty()) { "Speech segment is empty" }
        if (audio.size < MIN_SPEECH_SAMPLES) throw IllegalArgumentException("Speech segment is too short")

        inferenceMutex.withLock {
            val model = modelFile(language)
            if (!isModelFileValid(model)) {
                throw IllegalStateException(
                    "Offline ${language.displayName} model missing. Provision ${model.name} into " +
                        "${model.parentFile?.absolutePath} using tools/provision_whisper_model.ps1."
                )
            }

            if (loadedModelPath != model.absolutePath) {
                whisperContext?.release()
                whisperContext = null
                loadedModelPath = null
            }
            val context = whisperContext ?: withContext(Dispatchers.IO) {
                try {
                    Log.i(TAG, "Loading modelPath=${model.absolutePath} model=${model.name} bytes=${model.length()} language=${language.languageCode}")
                    WhisperContext.createContextFromFile(model.absolutePath)
                } catch (error: OutOfMemoryError) {
                    throw IllegalStateException("Not enough memory to load the offline ${language.displayName} model", error)
                } catch (error: Exception) {
                    Log.e(TAG, "Whisper model initialization failed", error)
                    throw IllegalStateException("Unable to initialize the local Whisper model", error)
                } catch (error: LinkageError) {
                    Log.e(TAG, "Whisper native runtime could not be loaded", error)
                    throw IllegalStateException("Whisper native runtime is unsupported on this device", error)
                }
            }.also {
                whisperContext = it
                loadedModelPath = model.absolutePath
                Log.i(TAG, "Model loaded modelPath=${model.absolutePath} bytes=${model.length()} language=${language.languageCode}")
            }

            val normalized = FloatArray(audio.size) { index -> audio[index] / 32768.0f }
            val peak = maxOf(kotlin.math.abs(audio.minOf { it.toInt() }), kotlin.math.abs(audio.maxOf { it.toInt() }))
            val rms = kotlin.math.sqrt(audio.sumOf { sample ->
                val normalizedSample = sample / 32768.0
                normalizedSample * normalizedSample
            } / audio.size)
            val inferenceStartMs = SystemClock.elapsedRealtime()
            Log.i(TAG, "[WHISPER] inferenceStart modelPath=${model.absolutePath} modelBytes=${model.length()} loaded=${whisperContext === context} language=${language.languageCode} inputSamples=${audio.size} audioSeconds=${"%.3f".format(audio.size / 16000.0)} rateHz=16000 channels=1 pcm=PCM16 floatNormalization=sample/32768.0 peak=$peak rms=$rms")
            val text = try {
                context.transcribeData(normalized, printTimestamp = false, language = language.languageCode).trim()
            } catch (error: OutOfMemoryError) {
                Log.e(TAG, "Whisper inference ran out of memory", error)
                throw IllegalStateException("Not enough memory to transcribe this speech segment", error)
            } catch (error: Exception) {
                Log.e(TAG, "Whisper transcription failed", error)
                throw IllegalStateException("Offline transcription failed", error)
            }
            Log.i(TAG, "[WHISPER] inferenceComplete model=${model.name} language=${language.languageCode} elapsedMs=${SystemClock.elapsedRealtime() - inferenceStartMs} chars=${text.length} result=${text.take(160)}")
            if (text.isBlank()) throw IllegalStateException("No ${language.displayName} speech was recognized")
            text
        }
    }

    suspend fun isModelProvisioned(): Boolean = withContext(Dispatchers.IO) {
        isModelFileValid(modelFile(LanguageConfig.ENGLISH))
    }

    suspend fun isModelProvisioned(language: LanguageConfig): Boolean = withContext(Dispatchers.IO) {
        isModelFileValid(modelFile(language))
    }

    /** Validates and loads the selected model before the UI reports voice input as ready. */
    suspend fun initializeModel(language: LanguageConfig) = withContext(Dispatchers.Default) {
        inferenceMutex.withLock {
            val model = modelFile(language)
            check(isModelFileValid(model)) { "model_missing" }
            Log.i(TAG, "Startup model validated model=${model.name} language=${language.languageCode} readable=${model.canRead()}")
            if (loadedModelPath != model.absolutePath) {
                whisperContext?.release()
                whisperContext = null
                loadedModelPath = null
            }
            if (whisperContext == null) {
                val loaded = withContext(Dispatchers.IO) {
                    WhisperContext.createContextFromFile(model.absolutePath)
                }
                whisperContext = loaded
                loadedModelPath = model.absolutePath
                Log.i(TAG, "Startup model loaded model=${model.name} language=${language.languageCode}")
            }
        }
    }

    private fun isModelFileValid(model: File): Boolean {
        if (!model.isFile || model.length() < MIN_MODEL_BYTES) return false
        synchronized(validatedModelTimestamps) {
            if (validatedModelTimestamps[model.absolutePath] == model.lastModified()) return true
        }
        return try {
            verifyOfficialModel(model)
            synchronized(validatedModelTimestamps) {
                validatedModelTimestamps[model.absolutePath] = model.lastModified()
            }
            true
        } catch (error: Exception) {
            Log.e(TAG, "Whisper model validation failed", error)
            false
        }
    }

    fun release() {
        val current = whisperContext ?: return
        whisperContext = null
        loadedModelPath = null
        CoroutineScope(Dispatchers.IO).let { scope ->
            scope.launch { try { current.release() } catch (error: Exception) { Log.w(TAG, "Whisper release failed", error) } }
        }
    }

    private fun verifyOfficialModel(file: File) {
        val digest = MessageDigest.getInstance("SHA-1")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        check(actual == expectedSha1(file.name)) { "Offline Whisper model checksum did not match the upstream model registry" }
    }

    private fun expectedSha1(filename: String): String = when (filename) {
        ENGLISH_MODEL_FILENAME -> ENGLISH_MODEL_SHA1
        MODEL_FILENAME -> MULTILINGUAL_MODEL_SHA1
        else -> error("Unsupported offline Whisper model: $filename")
    }

    private fun modelFilename(language: LanguageConfig): String =
        if (language.languageCode == "en") ENGLISH_MODEL_FILENAME else MODEL_FILENAME

    companion object {
        const val MODEL_FILENAME = "ggml-tiny.bin"
        const val ENGLISH_MODEL_FILENAME = "ggml-tiny.en.bin"
        private const val MULTILINGUAL_MODEL_SHA1 = "bd577a113a864445d4c299885e0cb97d4ba92b5f"
        private const val ENGLISH_MODEL_SHA1 = "c78c86eb1a8faa21b369bcd33207cc90d64ae9df"
        private const val MIN_MODEL_BYTES = 70L * 1024L * 1024L
        private const val MIN_SPEECH_SAMPLES = 4_000 // 250 ms at 16 kHz.
        private const val TAG = "iTantraWhisper"
    }
}
