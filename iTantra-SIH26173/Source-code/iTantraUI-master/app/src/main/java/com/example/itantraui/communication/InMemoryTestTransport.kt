package com.example.itantraui.communication

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * In-Memory Test Transport for unit testing and local pipeline validation.
 *
 * NOTE: This is strictly an isolated in-memory test harness used for pipeline
 * verification and local integration tests. It is NOT real hardware device-to-device
 * networking. Real hardware transport engines (Nearby Connections / Wi-Fi Direct) will
 * implement the `Transport` interface in a subsequent step.
 */
class InMemoryTestTransport : Transport {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    override val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _discoveredPeers = MutableStateFlow<List<PeerDevice>>(emptyList())
    override val discoveredPeers: StateFlow<List<PeerDevice>> = _discoveredPeers.asStateFlow()

    private val _incomingData = MutableSharedFlow<ByteArray>(replay = 1, extraBufferCapacity = 64)
    override val incomingData: SharedFlow<ByteArray> = _incomingData.asSharedFlow()

    private val _diagnosticsInfo = MutableStateFlow(
        TransportDiagnostics(
            localDeviceName = "Test_Device_Alpha",
            localDeviceMac = "11:22:33:44:55:66"
        )
    )
    override val diagnosticsInfo: StateFlow<TransportDiagnostics> = _diagnosticsInfo.asStateFlow()

    private var activePeer: PeerDevice? = null

    override suspend fun startDiscovery() = withContext(Dispatchers.Default) {
        if (_connectionState.value == ConnectionState.CONNECTED) return@withContext
        _connectionState.value = ConnectionState.DISCOVERING
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = "Discovery started")

        // Populate test peer for discovery testing
        val testPeer = PeerDevice(
            deviceId = "test_peer_02",
            deviceName = "Field_Unit_02",
            signalStrengthRssi = -55
        )
        _discoveredPeers.value = listOf(testPeer)
    }

    override suspend fun stopDiscovery() = withContext(Dispatchers.Default) {
        if (_connectionState.value == ConnectionState.DISCOVERING) {
            _connectionState.value = ConnectionState.DISCONNECTED
        }
        _discoveredPeers.value = emptyList()
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = "Discovery stopped")
    }

    override suspend fun connect(peer: PeerDevice): Boolean = withContext(Dispatchers.Default) {
        _connectionState.value = ConnectionState.CONNECTING
        activePeer = peer.copy(isConnected = true)
        _connectionState.value = ConnectionState.CONNECTED
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            remoteDeviceName = peer.deviceName,
            remoteDeviceMac = peer.deviceId,
            remoteIpAddress = "127.0.0.1",
            localIpAddress = "127.0.0.1",
            tcpConnectionState = "Connected (Test Loopback)",
            lastEvent = "Connected to ${peer.deviceName}"
        )
        true
    }

    override suspend fun disconnect() = withContext(Dispatchers.Default) {
        activePeer = null
        _connectionState.value = ConnectionState.DISCONNECTED
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            remoteDeviceName = "Not connected",
            remoteDeviceMac = "Unavailable",
            remoteIpAddress = "Not connected",
            tcpConnectionState = "Disconnected",
            lastEvent = "Disconnected"
        )
    }

    override suspend fun send(bytes: ByteArray): Boolean = withContext(Dispatchers.IO) {
        if (_connectionState.value != ConnectionState.CONNECTED) return@withContext false

        // In this loopback test implementation, bytes sent are delivered to incomingData flow
        val copy = bytes.copyOf() // Guard against buffer mutation
        _incomingData.tryEmit(copy)
        true
    }

    /**
     * Helper for unit tests to simulate receiving data from an external peer.
     */
    fun simulateIncomingBytesFromPeer(bytes: ByteArray) {
        _incomingData.tryEmit(bytes.copyOf())
    }

    override fun release() {
        _connectionState.value = ConnectionState.DISCONNECTED
        _discoveredPeers.value = emptyList()
        scope.cancel()
    }
}
