package com.example.itantraui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.itantraui.CommState
import com.example.itantraui.LinkStatus
import com.example.itantraui.communication.ConnectionState
import com.example.itantraui.communication.InMemoryTestTransport
import com.example.itantraui.communication.PeerDevice
import com.example.itantraui.communication.Transport
import com.example.itantraui.compression.Compressor
import com.example.itantraui.compression.GzipCompressor
import com.example.itantraui.protocol.MessagePacket
import com.example.itantraui.protocol.ProtocolFrame
import com.example.itantraui.security.AesCryptoEngine
import com.example.itantraui.security.CryptoEngine
import com.example.itantraui.voice.AudioCaptureEngine
import com.example.itantraui.voice.LanguageConfig
import com.example.itantraui.voice.OfflineTtsEngine
import com.example.itantraui.voice.WhisperCppSpeechEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * ViewModel managing the iTantra offline communication pipeline.
 *
 * Threading & Memory Safety Rules for Low-End Smartphones:
 * - All compression, binary framing, and encryption operations execute on `Dispatchers.Default`
 *   to avoid blocking the UI thread.
 * - Minimal allocations and immediate garbage collection of temporary buffers.
 */
class CommunicationViewModel(
    private val compressor: Compressor = GzipCompressor(),
    private val cryptoEngine: CryptoEngine = AesCryptoEngine(),
    private val transport: Transport = InMemoryTestTransport()
) : ViewModel() {

    private val _uiState = MutableStateFlow(CommunicationUiState())
    val uiState: StateFlow<CommunicationUiState> = _uiState.asStateFlow()

    // Voice Capture & Synthesis Engines
    private var appContext: Context? = null
    private var audioCaptureEngine: AudioCaptureEngine? = null
    private var ttsEngine: OfflineTtsEngine? = null
    private var speechEngine: WhisperCppSpeechEngine? = null
    private var currentLangConfig: LanguageConfig = LanguageConfig.TAMIL

    // 256-bit default symmetric session key (32 bytes) for prototype pipeline test
    private val sessionKey = ByteArray(32) { 0x07.toByte() }

    init {
        // Collect incoming transport bytes off the main thread
        viewModelScope.launch {
            transport.incomingData.collect { wireBytes ->
                processReceivedWireFrame(wireBytes)
            }
        }

        // Collect transport connection state updates
        viewModelScope.launch {
            transport.connectionState.collect { connState ->
                val linkStatus = when (connState) {
                    ConnectionState.DISCONNECTED -> LinkStatus.DISCONNECTED
                    ConnectionState.DISCOVERING -> LinkStatus.DISCOVERING
                    ConnectionState.CONNECTING, ConnectionState.HANDSHAKING -> LinkStatus.CONNECTING
                    ConnectionState.CONNECTED -> LinkStatus.CONNECTED
                    ConnectionState.ERROR -> LinkStatus.DISCONNECTED
                }
                _uiState.update { state ->
                    state.copy(
                        linkStatus = linkStatus,
                        activePeerName = when (connState) {
                            ConnectionState.CONNECTED -> state.activePeerName
                                ?: state.transportDiagnostics.remoteDeviceName.takeUnless { it == "Not connected" || it == "Unavailable" }
                            ConnectionState.DISCONNECTED, ConnectionState.ERROR -> null
                            else -> state.activePeerName
                        }
                    )
                }
            }
        }

        // Collect discovered peers updates
        viewModelScope.launch {
            transport.discoveredPeers.collect { peers ->
                _uiState.update { it.copy(discoveredPeers = peers) }
            }
        }

        // Collect real transport diagnostics telemetry updates
        viewModelScope.launch {
            transport.diagnosticsInfo.collect { diagnostics ->
                _uiState.update { it.copy(transportDiagnostics = diagnostics) }
            }
        }
    }

    fun initVoiceEngines(context: Context) {
        val app = context.applicationContext
        appContext = app

        val prefs = app.getSharedPreferences("itantra_settings", Context.MODE_PRIVATE)
        val savedLangName = prefs.getString("target_comm_language", "Tamil") ?: "Tamil"
        _uiState.update { it.copy(isDarkTheme = prefs.getBoolean("dark_theme", true)) }

        currentLangConfig = LanguageConfig.fromLanguageName(savedLangName)
        _uiState.update { it.copy(selectedLanguage = currentLangConfig.displayName) }

        if (audioCaptureEngine == null) {
            val capture = AudioCaptureEngine(app)
            val tts = OfflineTtsEngine(app)
            val speech = WhisperCppSpeechEngine(app)

            tts.initialize(currentLangConfig)

            audioCaptureEngine = capture
            ttsEngine = tts
            speechEngine = speech

            viewModelScope.launch {
                capture.audioEnergy.collect { energy ->
                    _uiState.update { it.copy(voiceAudioEnergy = energy) }
                }
            }
            viewModelScope.launch {
                capture.captureError.collect { error ->
                    if (error != null) _uiState.update {
                        it.copy(
                            isRecordingVoice = false,
                            commState = CommState.IDLE,
                            speechPipelineState = SpeechPipelineState.ERROR,
                            errorMessage = when {
                                error.contains("VAD", true) || error.contains("voice detection", true) -> "Voice detection unavailable"
                                error.contains("permission", true) -> "Microphone permission required"
                                else -> "Microphone unavailable. Check the microphone and try again."
                            }
                        )
                    }
                }
            }

            viewModelScope.launch {
                tts.ttsStatus.collect { status ->
                    _uiState.update { state ->
                        state.copy(
                            voiceStatusText = status,
                            transportDiagnostics = state.transportDiagnostics.copy(
                                ttsStatusText = status
                            )
                        )
                    }
                }
            }
            viewModelScope.launch {
                initializeSelectedSpeechModel(speech, currentLangConfig)
            }
            viewModelScope.launch {
                tts.isSpeaking.collect { speaking ->
                    _uiState.update {
                        it.copy(
                            isTtsSpeaking = speaking,
                            speechPipelineState = if (speaking) SpeechPipelineState.SPEAKING
                                else if (it.speechPipelineState == SpeechPipelineState.SPEAKING) SpeechPipelineState.IDLE
                                else it.speechPipelineState,
                            commState = if (!speaking && it.commState == CommState.SPEAKING) CommState.IDLE else it.commState
                        )
                    }
                }
            }
        }
    }

    fun setLanguage(language: String) {
        if (_uiState.value.isRecordingVoice) {
            viewModelScope.launch { audioCaptureEngine?.stopCapture() }
            _uiState.update { it.copy(isRecordingVoice = false, speechPipelineState = SpeechPipelineState.IDLE) }
        }
        currentLangConfig = LanguageConfig.fromLanguageName(language)
        _uiState.update { it.copy(selectedLanguage = currentLangConfig.displayName) }

        appContext?.let { ctx ->
            val prefs = ctx.getSharedPreferences("itantra_settings", Context.MODE_PRIVATE)
            prefs.edit().putString("target_comm_language", currentLangConfig.displayName).apply()
        }

        ttsEngine?.initialize(currentLangConfig)
        speechEngine?.let { speech ->
            _uiState.update { it.copy(speechModelState = "INITIALIZING") }
            viewModelScope.launch { initializeSelectedSpeechModel(speech, currentLangConfig) }
        }
    }

    private suspend fun initializeSelectedSpeechModel(speech: WhisperCppSpeechEngine, language: LanguageConfig) {
        _uiState.update { it.copy(speechModelState = "INITIALIZING") }
        val state = try {
            speech.initializeModel(language)
            "READY"
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            android.util.Log.e("iTantraVoice", "Selected offline voice model could not be initialized", error)
            if (error.message == "model_missing") "MISSING" else "ERROR"
        }
        if (currentLangConfig.languageCode == language.languageCode) {
            _uiState.update { it.copy(speechModelState = state) }
        }
    }

    fun setDarkTheme(enabled: Boolean) {
        _uiState.update { it.copy(isDarkTheme = enabled) }
        appContext?.getSharedPreferences("itantra_settings", Context.MODE_PRIVATE)
            ?.edit()?.putBoolean("dark_theme", enabled)?.apply()
    }

    fun setEmergencyMode(enabled: Boolean) {
        _uiState.update { it.copy(isEmergencyMode = enabled) }
    }

    fun setErrorMessage(message: String?) {
        _uiState.update { it.copy(errorMessage = message) }
    }

    fun setMicrophonePermissionGranted(granted: Boolean) {
        _uiState.update { it.copy(microphonePermissionGranted = granted) }
    }

    fun startPeerDiscovery() {
        viewModelScope.launch {
            transport.startDiscovery()
        }
    }

    fun stopPeerDiscovery() {
        viewModelScope.launch {
            transport.stopDiscovery()
        }
    }

    fun connectPeer(peer: PeerDevice) {
        viewModelScope.launch {
            _uiState.update { it.copy(commState = CommState.PROCESSING, isProcessing = true) }
            val success = transport.connect(peer)
            if (success) {
                _uiState.update {
                    it.copy(
                        activePeerName = if (it.linkStatus == LinkStatus.CONNECTED) peer.deviceName else it.activePeerName,
                        commState = CommState.IDLE,
                        isProcessing = false
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        errorMessage = "Failed to connect to ${peer.deviceName}",
                        commState = CommState.IDLE,
                        isProcessing = false
                    )
                }
            }
        }
    }

    fun disconnectPeer() {
        viewModelScope.launch {
            transport.disconnect()
            _uiState.update { it.copy(activePeerName = null, linkStatus = LinkStatus.DISCONNECTED) }
        }
    }

    fun startVoiceRecording() {
        val capture = audioCaptureEngine
        if (capture == null) {
            _uiState.update { it.copy(errorMessage = "Voice input is starting. Try again shortly.") }
            return
        }

        if (_uiState.value.speechModelState != "READY") {
            val message = when (_uiState.value.speechModelState) {
                "MISSING" -> "Offline voice model unavailable for ${currentLangConfig.displayName}"
                "ERROR" -> "Voice model could not be loaded"
                else -> "Voice input is starting. Try again shortly."
            }
            _uiState.update { it.copy(errorMessage = message) }
            return
        }

        if (!capture.checkMicrophonePermission()) {
            _uiState.update { it.copy(microphonePermissionGranted = false, errorMessage = "Microphone permission required") }
            return
        }

        viewModelScope.launch {
            val language = currentLangConfig
            _uiState.update {
                it.copy(
                    commState = CommState.LISTENING,
                    speechPipelineState = SpeechPipelineState.LISTENING,
                    isRecordingVoice = true,
                    yourSpeech = "",
                    voiceStatusText = "LISTENING · starting microphone and Silero VAD",
                    microphonePermissionGranted = true,
                    errorMessage = null
                )
            }

            var firstPcm = true
            val captureStarted = capture.startCapture(
                scope = viewModelScope,
                onPcmDataReady = { _, _ ->
                    if (firstPcm) {
                        firstPcm = false
                        _uiState.update {
                            it.copy(
                                speechPipelineState = SpeechPipelineState.VAD_DETECTING,
                                voiceStatusText = "VAD_DETECTING · Silero is analyzing microphone audio"
                            )
                        }
                    }
                },
                onSpeechSegment = { segment ->
                    viewModelScope.launch { transcribeAndSend(segment, language) }
                }
            )

            if (captureStarted) {
            } else {
                _uiState.update {
                    it.copy(
                        commState = CommState.IDLE,
                        isRecordingVoice = false,
                        speechPipelineState = SpeechPipelineState.ERROR,
                        errorMessage = "Unable to access microphone. Check that it is available and try again."
                    )
                }
            }
        }
    }

    fun stopAndFinalizeVoiceRecording() {
        viewModelScope.launch {
            audioCaptureEngine?.stopCapture()
            _uiState.update {
                it.copy(
                    commState = CommState.IDLE,
                    voiceStatusText = if (it.speechPipelineState == SpeechPipelineState.TRANSCRIBING || it.speechPipelineState == SpeechPipelineState.SENDING)
                        it.voiceStatusText else "IDLE · listening stopped",
                    isRecordingVoice = false,
                    speechPipelineState = if (it.speechPipelineState == SpeechPipelineState.TRANSCRIBING || it.speechPipelineState == SpeechPipelineState.SENDING)
                        it.speechPipelineState else SpeechPipelineState.IDLE
                )
            }
        }
    }

    private suspend fun transcribeAndSend(segment: ShortArray, language: LanguageConfig) {
        _uiState.update {
            it.copy(
                speechPipelineState = SpeechPipelineState.TRANSCRIBING,
                voiceStatusText = "TRANSCRIBING · offline ${language.displayName} Whisper is processing speech"
            )
        }
        try {
            val startMs = System.currentTimeMillis()
            val text = checkNotNull(speechEngine) { "Offline multilingual STT is not initialized" }
                .transcribe(segment, language)
            _uiState.update {
                it.copy(
                    yourSpeech = text,
                    sttLatencyMs = System.currentTimeMillis() - startMs,
                    speechPipelineState = SpeechPipelineState.SENDING,
                    voiceStatusText = "SENDING · transcription ready"
                )
            }
            processAndPrepareMessage(text, packetLanguage = language.displayName)
        } catch (error: Exception) {
            android.util.Log.e("iTantraVoice", "Offline speech pipeline failed", error)
            _uiState.update {
                it.copy(
                    speechPipelineState = SpeechPipelineState.ERROR,
                    voiceStatusText = "ERROR · speech could not be understood",
                    isRecordingVoice = false,
                    errorMessage = when {
                        error.message?.contains("model missing", true) == true -> "Offline voice model unavailable"
                        error.message?.contains("initialize", true) == true -> "Voice model could not be loaded"
                        else -> "Speech could not be understood"
                    }
                )
            }
        }
    }

    fun testSpeaker() {
        val phrase = when (currentLangConfig.languageCode) {
            "hi" -> "iTantra स्पीकर परीक्षण। स्पीकर काम कर रहा है।"
            "bn" -> "iTantra স্পিকার পরীক্ষা। স্পিকার কাজ করছে।"
            "ta" -> "iTantra ஒலிபெருக்கி சோதனை. ஒலி இயங்குகிறது."
            "te" -> "iTantra స్పీకర్ పరీక్ష. ధ్వని పనిచేస్తోంది."
            "ml" -> "iTantra സ്പീക്കർ പരിശോധന. ശബ്ദം പ്രവർത്തിക്കുന്നു."
            "kn" -> "iTantra ಸ್ಪೀಕರ್ ಪರೀಕ್ಷೆ. ಧ್ವನಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿದೆ."
            "mr" -> "iTantra स्पीकर चाचणी. आवाज सुरू आहे."
            "gu" -> "iTantra સ્પીકર પરીક્ષણ. અવાજ કાર્યરત છે."
            "pa" -> "iTantra ਸਪੀਕਰ ਜਾਂਚ। ਆਵਾਜ਼ ਚੱਲ ਰਹੀ ਹੈ।"
            else -> "iTantra speaker test. The speaker is working."
        }
        if (ttsEngine?.speak(phrase, currentLangConfig.languageCode) != true) {
            val unavailable = _uiState.value.voiceStatusText.contains("unavailable", true) ||
                _uiState.value.voiceStatusText.contains("missing", true) ||
                _uiState.value.voiceStatusText.contains("unsupported", true)
            _uiState.update {
                it.copy(errorMessage = if (unavailable) "Selected language is unavailable in the installed TTS engine" else "Speaker/TTS unavailable")
            }
        } else {
            _uiState.update { it.copy(errorMessage = null, commState = CommState.SPEAKING, isTtsSpeaking = true) }
        }
    }

    fun stopSpeaking() {
        ttsEngine?.stop()
        _uiState.update { it.copy(isTtsSpeaking = false, commState = CommState.IDLE) }
    }

    /**
     * Processes outgoing text through the complete backend pipeline:
     * Packet -> Serialization -> Compression -> Encryption -> Wire Frame Encoding -> Transport Send
     *
     * Executed off the main thread (`Dispatchers.Default`).
     */
    fun processAndPrepareMessage(text: String, packetLanguage: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(commState = CommState.PROCESSING, isProcessing = true) }

            val frameBytes = withContext(Dispatchers.Default) {
                // 1. Create packet
                val packet = MessagePacket(
                    messageId = UUID.randomUUID().toString(),
                    senderId = "Field_Unit_01",
                    text = text,
                    language = packetLanguage ?: _uiState.value.selectedLanguage,
                    isEmergency = _uiState.value.isEmergencyMode
                )

                // 2. Serialize to bytes
                val packetBytes = packet.toByteArray()

                // 3. Compress bytes
                val compressedBytes = compressor.compress(packetBytes)

                // 4. Encrypt compressed payload
                val encryptedBytes = cryptoEngine.encrypt(compressedBytes, sessionKey)

                // 5. Wrap into protocol frame
                val frame = ProtocolFrame(
                    isEmergency = packet.isEmergency,
                    isCompressed = true,
                    isEncrypted = true,
                    payload = encryptedBytes
                )

                frame.toWireBytes()
            }

            // Transmit frame via Transport abstraction if connected
            val sent = transport.send(frameBytes)

            _uiState.update {
                it.copy(
                    commState = if (sent) CommState.TRANSMITTING else CommState.TEXT_READY,
                    speechPipelineState = if (sent) SpeechPipelineState.IDLE else SpeechPipelineState.ERROR,
                    voiceStatusText = if (sent) "IDLE · message sent securely" else "ERROR · transport send failed",
                    draftMessage = text,
                    wireByteSize = frameBytes.size,
                    isProcessing = false,
                    sentMessageCount = if (sent) it.sentMessageCount + 1 else it.sentMessageCount,
                    errorMessage = if (!sent) "Transport not connected. Message ready locally." else null
                )
            }
        }
    }

    /**
     * Decodes an incoming wire frame through the reverse pipeline:
     * Wire Frame -> Decryption -> Decompression -> Deserialization -> MessagePacket
     *
     * Executed off the main thread (`Dispatchers.Default`).
     */
    fun processReceivedWireFrame(wireBytes: ByteArray) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(commState = CommState.TRANSMITTING, speechPipelineState = SpeechPipelineState.RECEIVING,
                    voiceStatusText = "RECEIVING · decoding incoming message")
            }

            val packet = withContext(Dispatchers.Default) {
                try {
                    // 1. Parse wire frame
                    val frame = ProtocolFrame.fromWireBytes(wireBytes)

                    // 2. Decrypt payload if encrypted
                    val compressedBytes = if (frame.isEncrypted) {
                        cryptoEngine.decrypt(frame.payload, sessionKey)
                    } else {
                        frame.payload
                    }

                    // 3. Decompress payload if compressed
                    val packetBytes = if (frame.isCompressed) {
                        compressor.decompress(compressedBytes)
                    } else {
                        compressedBytes
                    }

                    // 4. Deserialize to MessagePacket
                    MessagePacket.fromByteArray(packetBytes)
                } catch (e: Exception) {
                    null
                }
            }

            if (packet != null) {
                _uiState.update {
                    it.copy(
                        commState = CommState.RECEIVED,
                        receivedMessage = packet.text,
                        receivedMessageCount = it.receivedMessageCount + 1,
                        errorMessage = null
                    )
                }

                // Speak received text with a locally installed system voice when available.
                val spoke = ttsEngine?.speak(packet.text, packet.language) == true
                if (spoke) {
                    _uiState.update {
                        it.copy(
                        commState = CommState.SPEAKING,
                            speechPipelineState = SpeechPipelineState.SPEAKING,
                            voiceStatusText = "SPEAKING · received message",
                            isTtsSpeaking = true,
                            errorMessage = null
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(errorMessage = "Selected language is unavailable in the installed TTS engine")
                    }
                }
            } else {
                _uiState.update {
                    it.copy(
                        commState = CommState.IDLE,
                        speechPipelineState = SpeechPipelineState.ERROR,
                        errorMessage = "Failed to decode incoming packet"
                    )
                }
            }
        }
    }

    override fun onCleared() {
        audioCaptureEngine?.releaseResources()
        speechEngine?.release()
        ttsEngine?.release()
        transport.release()
        super.onCleared()
    }
}

class CommunicationViewModelFactory(
    private val transport: Transport
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return CommunicationViewModel(transport = transport) as T
    }
}
