package com.example.itantraui.viewmodel

import com.example.itantraui.CommState
import com.example.itantraui.LinkStatus
import com.example.itantraui.communication.PeerDevice
import com.example.itantraui.communication.TransportDiagnostics

enum class SpeechPipelineState {
    IDLE, LISTENING, VAD_DETECTING, TRANSCRIBING, SENDING, RECEIVING, SPEAKING, ERROR
}

/**
 * Immutable UI State holder for iTantra communication.
 *
 * Designed to prevent excessive recompositions on low-end devices by grouping
 * UI properties into an immutable data structure exposed via StateFlow.
 */
data class CommunicationUiState(
    val commState: CommState = CommState.IDLE,
    val selectedLanguage: String = "English",
    val isEmergencyMode: Boolean = false,
    val linkStatus: LinkStatus = LinkStatus.DISCONNECTED,
    val draftMessage: String = "",
    val receivedMessage: String = "",
    val wireByteSize: Int = 0,
    val isProcessing: Boolean = false,
    val errorMessage: String? = null,
    val discoveredPeers: List<PeerDevice> = emptyList(),
    val activePeerName: String? = null,
    val sentMessageCount: Int = 0,
    val receivedMessageCount: Int = 0,
    val transportDiagnostics: TransportDiagnostics = TransportDiagnostics(),
    val isRecordingVoice: Boolean = false,
    val speechPipelineState: SpeechPipelineState = SpeechPipelineState.IDLE,
    val yourSpeech: String = "",
    val voiceAudioEnergy: Float = 0f,
    val sttLatencyMs: Long = 0L,
    val ttsLatencyMs: Long = 0L,
    val voiceStatusText: String = "VOICE READY",
    val isDarkTheme: Boolean = true,
    val isTtsSpeaking: Boolean = false,
    val microphonePermissionGranted: Boolean = false,
    val speechModelState: String = "INITIALIZING"
)
