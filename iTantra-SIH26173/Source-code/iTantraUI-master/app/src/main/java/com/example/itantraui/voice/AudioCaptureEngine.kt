package com.example.itantraui.voice

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Microphone audio capture engine using 16 kHz PCM Mono AudioRecord + VAD processing off the UI thread.
 */
class AudioCaptureEngine(
    private val context: Context,
    private val vadEngine: VadEngine = VadEngine(context)
) {
    private var audioRecord: AudioRecord? = null
    private var captureJob: Job? = null
    @Volatile private var isCapturing = false
    private val captureMutex = Mutex()

    private val _audioEnergy = MutableStateFlow(0f)
    val audioEnergy: StateFlow<Float> = _audioEnergy.asStateFlow()

    private val _hasSpeechDetected = MutableStateFlow(false)
    val hasSpeechDetected: StateFlow<Boolean> = _hasSpeechDetected.asStateFlow()
    private val _captureError = MutableStateFlow<String?>(null)
    val captureError: StateFlow<String?> = _captureError.asStateFlow()

    fun checkMicrophonePermission(): Boolean {
        return try {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        } catch (_: Throwable) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun startCapture(
        scope: CoroutineScope,
        onPcmDataReady: (ShortArray, Int) -> Unit,
        onSpeechSegment: (ShortArray) -> Unit = {}
    ): Boolean = withContext(Dispatchers.IO) {
        captureMutex.withLock {
        if (!checkMicrophonePermission()) {
            return@withLock false
        }
        if (isCapturing) return@withLock true

        try {
            stopCaptureInternal()
            try {
                vadEngine.initialize()
                vadEngine.resetStream()
            } catch (error: Exception) {
                Log.e(TAG, "Silero VAD initialization failed", error)
                _captureError.value = "Offline voice detection could not be initialized"
                return@withLock false
            }

            val sampleRate = 16000
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            if (minBufferSize <= 0) {
                Log.e(TAG, "AudioRecord returned invalid minimum buffer size: $minBufferSize")
                return@withLock false
            }
            val bufferSize = (minBufferSize * 2).coerceAtLeast(3200)

            val record = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                record.release()
                Log.e(TAG, "AudioRecord failed to initialize")
                return@withLock false
            }

            audioRecord = record
            _captureError.value = null
            _hasSpeechDetected.value = false
            record.startRecording()
            isCapturing = true
            Log.i(TAG, "AudioRecord started: source=MIC sampleRate=$sampleRate channels=1 encoding=PCM_16BIT minBuffer=$minBufferSize buffer=$bufferSize state=${record.recordingState}")

            captureJob = scope.launch(Dispatchers.IO) {
                val pcmBuffer = ShortArray(1600) // 100 ms frame at 16 kHz
                val segment = ShortArrayAccumulator()
                var hasSpeech = false
                var silentFrames = 0
                var loggedSpeech = false
                var speechStartElapsedMs = 0L
                var statsWindowStartMs = SystemClock.elapsedRealtime()
                var statsSamples = 0L
                var statsNonZero = 0L
                var statsSquareSum = 0.0
                var statsMin = Short.MAX_VALUE.toInt()
                var statsMax = Short.MIN_VALUE.toInt()
                var statsReadCalls = 0
                var latestVadProbability = 0f
                val endSilenceFrames = 8 // 800 ms at 100 ms per frame
                val maxSegmentSamples = sampleRate * 20
                fun logSegment(reason: String, samples: ShortArray) {
                    val peak = maxOf(
                        kotlin.math.abs(samples.minOf { it.toInt() }),
                        kotlin.math.abs(samples.maxOf { it.toInt() })
                    )
                    val rms = kotlin.math.sqrt(samples.sumOf { sample ->
                        val normalized = sample / 32768.0
                        normalized * normalized
                    } / samples.size)
                    val endElapsedMs = SystemClock.elapsedRealtime()
                    Log.i(TAG, "[VAD] speechEnd reason=$reason speechStartElapsedMs=$speechStartElapsedMs speechEndElapsedMs=$endElapsedMs sampleRate=$sampleRate channels=1 pcm=PCM16 samples=${samples.size} durationMs=${samples.size * 1000L / sampleRate} peak=$peak rms=$rms")
                }
                while (isCapturing && record.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    val read = record.read(pcmBuffer, 0, pcmBuffer.size)
                    if (read > 0) {
                        statsReadCalls++
                        for (index in 0 until read) {
                            val sample = pcmBuffer[index].toInt()
                            statsMin = minOf(statsMin, sample)
                            statsMax = maxOf(statsMax, sample)
                            if (sample != 0) statsNonZero++
                            val normalized = sample / 32768.0
                            statsSquareSum += normalized * normalized
                        }
                        statsSamples += read
                        val vad = try {
                            vadEngine.processFrame(pcmBuffer, read)
                        } catch (error: OutOfMemoryError) {
                            Log.e(TAG, "Insufficient memory for Silero VAD inference", error)
                            _captureError.value = "Not enough memory for offline voice detection"
                            isCapturing = false
                            break
                        } catch (error: Exception) {
                            Log.e(TAG, "Silero VAD inference failed", error)
                            _captureError.value = "Offline voice detection failed"
                            isCapturing = false
                            break
                        }
                        latestVadProbability = vad.probability
                        _audioEnergy.value = vad.rmsAmplitude
                        if (vad.isSpeech) {
                            if (!loggedSpeech) {
                                speechStartElapsedMs = SystemClock.elapsedRealtime()
                                Log.i(TAG, "[VAD] speechStart elapsedMs=$speechStartElapsedMs probability=${vad.probability} threshold=0.5 rms=${vad.rmsAmplitude}")
                                loggedSpeech = true
                            }
                            _hasSpeechDetected.value = true
                            hasSpeech = true
                            silentFrames = 0
                            segment.append(pcmBuffer, read)
                            if (segment.size >= maxSegmentSamples) {
                                val samples = segment.toShortArray()
                                logSegment("max-duration", samples)
                                onSpeechSegment(samples)
                                segment.clear()
                                hasSpeech = false
                                loggedSpeech = false
                                _hasSpeechDetected.value = false
                            }
                        } else if (hasSpeech) {
                            segment.append(pcmBuffer, read)
                            silentFrames++
                            if (silentFrames >= endSilenceFrames || segment.size >= maxSegmentSamples) {
                                val samples = segment.toShortArray()
                                val endReason = if (silentFrames >= endSilenceFrames) "pause-${silentFrames * 100}ms" else "max-duration"
                                logSegment(endReason, samples)
                                onSpeechSegment(samples)
                                segment.clear()
                                hasSpeech = false
                                loggedSpeech = false
                                _hasSpeechDetected.value = false
                                silentFrames = 0
                            }
                        } else {
                            _hasSpeechDetected.value = false
                        }
                        onPcmDataReady(pcmBuffer, read)
                        val now = SystemClock.elapsedRealtime()
                        if (now - statsWindowStartMs >= PCM_DIAGNOSTICS_INTERVAL_MS) {
                            val rms = if (statsSamples == 0L) 0.0 else kotlin.math.sqrt(statsSquareSum / statsSamples)
                            val peak = maxOf(kotlin.math.abs(statsMin), kotlin.math.abs(statsMax))
                            Log.i(TAG, "[AUDIO] elapsedMs=$now windowMs=${now - statsWindowStartMs} readCalls=$statsReadCalls samples=$statsSamples sampleRate=$sampleRate channels=1 pcm=PCM16 min=$statsMin max=$statsMax peak=$peak nonZero=$statsNonZero rms=$rms vadProbability=$latestVadProbability speech=$hasSpeech recordingState=${record.recordingState}")
                            statsWindowStartMs = now
                            statsSamples = 0L
                            statsNonZero = 0L
                            statsSquareSum = 0.0
                            statsMin = Short.MAX_VALUE.toInt()
                            statsMax = Short.MIN_VALUE.toInt()
                            statsReadCalls = 0
                        }
                    } else if (read < 0) {
                        Log.e(TAG, "AudioRecord read failed with code $read")
                        _captureError.value = "Microphone recording failed (AudioRecord $read)"
                        isCapturing = false
                    }
                }
                if (hasSpeech && segment.size > 0) {
                    val samples = segment.toShortArray()
                    logSegment("capture-stop", samples)
                    onSpeechSegment(samples)
                }
            }
            true
        } catch (e: OutOfMemoryError) {
            Log.e(TAG, "Insufficient memory while starting microphone capture", e)
            _captureError.value = "Not enough memory to start offline voice capture"
            stopCaptureInternal()
            false
        } catch (e: Exception) {
            Log.e(TAG, "Unable to start microphone capture", e)
            _captureError.value = "Unable to access microphone: ${e.message ?: "device is unavailable"}"
            stopCaptureInternal()
            false
        }
        }
    }

    suspend fun stopCapture() = withContext(Dispatchers.IO) {
        captureMutex.withLock { stopCaptureInternal() }
    }

    /** Synchronous final cleanup for ViewModel destruction. */
    fun releaseResources() {
        stopCaptureInternal()
        vadEngine.release()
    }

    private fun stopCaptureInternal() {
        isCapturing = false
        captureJob?.cancel()
        captureJob = null

        val record = audioRecord
        audioRecord = null
        if (record != null) {
            try {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) record.stop()
            } catch (e: Exception) {
                Log.e(TAG, "Error while stopping microphone capture", e)
            } finally {
                try {
                    record.release()
                } catch (e: Exception) {
                    Log.e(TAG, "Error while releasing microphone capture", e)
                }
            }
        }
        _audioEnergy.value = 0f
    }

    companion object {
        private const val TAG = "iTantraAudio"
        private const val PCM_DIAGNOSTICS_INTERVAL_MS = 1000L
    }

    /** Compact growable PCM buffer used only for one bounded utterance at a time. */
    private class ShortArrayAccumulator {
        private var data = ShortArray(16000)
        var size: Int = 0
            private set

        fun append(source: ShortArray, count: Int) {
            if (count <= 0) return
            val required = size + count
            if (required > data.size) data = data.copyOf(maxOf(required, data.size * 2))
            source.copyInto(data, size, 0, count)
            size = required
        }

        fun toShortArray(): ShortArray = data.copyOf(size)
        fun clear() { size = 0 }
    }
}
