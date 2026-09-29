package com.example.itantraui.voice

import android.content.Context
import android.util.Log
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.io.File
import java.nio.FloatBuffer
import java.nio.LongBuffer
import kotlin.math.sqrt

/** Silero VAD v6 ONNX streaming adapter. Calls are made from AudioCaptureEngine's IO worker. */
class VadEngine(private val context: Context) {
    data class VadResult(val isSpeech: Boolean, val rmsAmplitude: Float, val probability: Float)

    private var environment: OrtEnvironment? = null
    private var session: OrtSession? = null
    private var state = FloatArray(2 * 128)
    private val contextSamples = FloatArray(CONTEXT_SIZE)
    private val pending = FloatArray(WINDOW_SIZE)
    private var pendingCount = 0
    private var lastProbability = 0f

    @Synchronized
    fun initialize() {
        if (session != null) return
        val model = File(context.filesDir, "speech/silero_vad.onnx")
        model.parentFile?.mkdirs()
        if (!model.exists() || model.length() != MODEL_BYTES) {
            context.assets.open("models/silero_vad.onnx").use { input ->
                model.outputStream().use(input::copyTo)
            }
        }
        require(model.length() == MODEL_BYTES) { "Packaged Silero VAD model has unexpected size" }

        val env = OrtEnvironment.getEnvironment()
        val options = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(1)
            setInterOpNumThreads(1)
            setExecutionMode(OrtSession.SessionOptions.ExecutionMode.SEQUENTIAL)
        }
        environment = env
        session = env.createSession(model.absolutePath, options)
        options.close()
        Log.i(TAG, "Silero VAD initialized modelBytes=${model.length()} sampleRate=$SAMPLE_RATE windowSamples=$WINDOW_SIZE contextSamples=$CONTEXT_SIZE speechThreshold=$SPEECH_THRESHOLD")
    }

    @Synchronized
    fun processFrame(pcmBuffer: ShortArray, readSize: Int): VadResult {
        require(readSize in 0..pcmBuffer.size) { "Invalid PCM frame size" }
        if (readSize == 0) return VadResult(false, 0f, lastProbability)
        check(session != null && environment != null) { "Silero VAD has not been initialized" }

        var sumSquare = 0.0
        var readPeakProbability = lastProbability
        for (index in 0 until readSize) {
            val sample = pcmBuffer[index] / 32768.0f
            sumSquare += sample * sample
            pending[pendingCount++] = sample
            if (pendingCount == WINDOW_SIZE) {
                inferWindow()
                readPeakProbability = maxOf(readPeakProbability, lastProbability)
            }
        }
        val rms = sqrt(sumSquare / readSize).toFloat()
        return VadResult(readPeakProbability >= SPEECH_THRESHOLD, rms, readPeakProbability)
    }

    private fun inferWindow() {
        val env = checkNotNull(environment)
        val ort = checkNotNull(session)
        val input = FloatArray(CONTEXT_SIZE + WINDOW_SIZE)
        contextSamples.copyInto(input)
        pending.copyInto(input, CONTEXT_SIZE)

        val waveform = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), longArrayOf(1, input.size.toLong()))
        val recurrentState = OnnxTensor.createTensor(env, FloatBuffer.wrap(state.copyOf()), longArrayOf(2, 1, 128))
        val sampleRate = OnnxTensor.createTensor(env, LongBuffer.wrap(longArrayOf(SAMPLE_RATE.toLong())), longArrayOf())
        try {
            val inputs: Map<String, OnnxTensor> = mapOf("input" to waveform, "state" to recurrentState, "sr" to sampleRate)
            val result: OrtSession.Result = ort.run(inputs)
            result.use { values ->
                val probabilityTensor = values.get("output").get() as OnnxTensor
                lastProbability = probabilityTensor.getFloatBuffer().get(0)
                val stateTensor = values.get("stateN").get() as OnnxTensor
                stateTensor.getFloatBuffer().get(state)
            }
        } finally {
            waveform.close()
            recurrentState.close()
            sampleRate.close()
        }

        input.copyInto(contextSamples, 0, WINDOW_SIZE, input.size)
        pendingCount = 0
    }

    @Synchronized
    fun resetStream() {
        state.fill(0f)
        contextSamples.fill(0f)
        pending.fill(0f)
        pendingCount = 0
        lastProbability = 0f
    }

    @Synchronized
    fun release() {
        try { session?.close() } catch (_: Exception) {}
        session = null
        environment = null
        resetStream()
    }

    companion object {
        private const val TAG = "iTantraAudio"
        const val SAMPLE_RATE = 16_000
        private const val WINDOW_SIZE = 512 // Silero streaming window: 32 ms at 16 kHz.
        private const val CONTEXT_SIZE = 64
        private const val SPEECH_THRESHOLD = 0.5f
        private const val MODEL_BYTES = 2_327_524L // Pinned Silero VAD ONNX artifact.
    }
}
