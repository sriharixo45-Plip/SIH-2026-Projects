package com.example.itantraui.communication

import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Abstract interface for offline device-to-device transport in iTantra.
 *
 * Supported underlying hardware protocols (evaluated for future integration):
 * 1. Google Nearby Connections API (P2P Cluster / Point-to-Point)
 * 2. Wi-Fi Direct (P2P Group)
 * 3. Bluetooth LE / Classic
 *
 * Low-End Optimization Guidelines:
 * - All state observation uses cold/lightweight Coroutine StateFlow and SharedFlow.
 * - Discovery is strictly manual (`startDiscovery` / `stopDiscovery`) to conserve battery & CPU.
 * - Resources must be immediately freed when calling `release()`.
 */
interface Transport {
    val connectionState: StateFlow<ConnectionState>
    val discoveredPeers: StateFlow<List<PeerDevice>>
    val incomingData: SharedFlow<ByteArray>
    val diagnosticsInfo: StateFlow<TransportDiagnostics>

    /**
     * Starts discovering nearby iTantra peers.
     */
    suspend fun startDiscovery()

    /**
     * Stops peer discovery to save battery and CPU cycles.
     */
    suspend fun stopDiscovery()

    /**
     * Connects to a target peer device.
     */
    suspend fun connect(peer: PeerDevice): Boolean

    /**
     * Disconnects from the current peer.
     */
    suspend fun disconnect()

    /**
     * Transmits raw payload bytes (e.g. ProtocolFrame wire bytes) to the connected peer.
     * Must be called off the main thread.
     */
    suspend fun send(bytes: ByteArray): Boolean

    /**
     * Releases hardware resources, unregisters callbacks, and cancels active coroutine jobs.
     */
    fun release()
}
