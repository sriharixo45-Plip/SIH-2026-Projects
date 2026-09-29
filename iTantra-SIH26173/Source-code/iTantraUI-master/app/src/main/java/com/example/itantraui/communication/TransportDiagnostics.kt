package com.example.itantraui.communication

/**
 * Immutable snapshot of real hardware transport diagnostics, permission state, & socket telemetry.
 */
data class TransportDiagnostics(
    val transportType: String = "Wi-Fi Direct",
    val socketProtocol: String = "TCP",
    val localDeviceName: String = "Unavailable",
    val localDeviceMac: String = "Unavailable",
    val localIpAddress: String = "Unavailable",
    val remoteDeviceName: String = "Not connected",
    val remoteDeviceMac: String = "Unavailable",
    val remoteIpAddress: String = "Not connected",
    val remotePort: Int = 0,
    val tcpConnectionState: String = "Disconnected",
    val handshakeState: String = "Not started",
    val isGroupOwner: Boolean? = null,
    val serverPort: Int = 8888,
    val lastEvent: String = "Transport initialized",
    val permissionsGranted: Boolean = false,
    val isWifiEnabled: Boolean = false,
    val isLocationEnabled: Boolean = false,
    val sttLatencyMs: Long = 0L,
    val ttsLatencyMs: Long = 0L,
    val audioRecordStatus: String = "Idle",
    val audioEnergy: Float = 0f,
    val ttsStatusText: String = "System Voice Pack (Local)"
)
