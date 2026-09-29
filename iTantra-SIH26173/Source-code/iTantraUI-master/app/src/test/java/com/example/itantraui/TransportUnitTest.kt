package com.example.itantraui

import com.example.itantraui.communication.ConnectionState
import com.example.itantraui.communication.InMemoryTestTransport
import com.example.itantraui.communication.PeerDevice
import com.example.itantraui.protocol.ProtocolFrame
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class TransportUnitTest {

    private lateinit var transport: InMemoryTestTransport

    @Before
    fun setUp() {
        transport = InMemoryTestTransport()
    }

    @After
    fun tearDown() {
        transport.release()
    }

    @Test
    fun testInitialConnectionState() {
        // 1. Initial connection state must be DISCONNECTED
        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
        assertTrue(transport.discoveredPeers.value.isEmpty())
    }

    @Test
    fun testStartStopDiscoveryTransitions() = runBlocking {
        // 2. Start discovery -> DISCOVERING
        transport.startDiscovery()
        assertEquals(ConnectionState.DISCOVERING, transport.connectionState.value)

        // 2. Stop discovery -> DISCONNECTED
        transport.stopDiscovery()
        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
        assertTrue(transport.discoveredPeers.value.isEmpty())
    }

    @Test
    fun testPeerDiscoveryEventHandling() = runBlocking {
        // 3. Peer discovery populates discovered peers flow
        transport.startDiscovery()
        val peers = transport.discoveredPeers.value
        assertEquals(1, peers.size)

        val peer = peers.first()
        assertEquals("test_peer_02", peer.deviceId)
        assertEquals("Field_Unit_02", peer.deviceName)
        assertEquals(-55, peer.signalStrengthRssi)
    }

    @Test
    fun testConnectDisconnectStateTransitions() = runBlocking {
        // 4. Connect -> CONNECTED
        val peer = PeerDevice("peer_100", "Test Peer")
        val success = transport.connect(peer)

        assertTrue(success)
        assertEquals(ConnectionState.CONNECTED, transport.connectionState.value)

        // 4. Disconnect -> DISCONNECTED
        transport.disconnect()
        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
    }

    @Test
    fun testByteArraySendAndReceive() = runBlocking {
        // 5. Connect and send raw byte array
        val peer = PeerDevice("peer_101", "Receiver Peer")
        transport.connect(peer)

        val testPayload = "Hello iTantra Mesh".toByteArray(Charsets.UTF_8)

        val deferredReceived = async {
            transport.incomingData.first()
        }

        val sendSuccess = transport.send(testPayload)
        assertTrue(sendSuccess)

        val receivedBytes = deferredReceived.await()
        assertArrayEquals(testPayload, receivedBytes)
    }

    @Test
    fun testNoDataCorruptionInTransportAbstraction() = runBlocking {
        // 6. Send ProtocolFrame wire bytes through transport and ensure no byte corruption
        val peer = PeerDevice("peer_102", "Frame Peer")
        transport.connect(peer)

        val originalFrame = ProtocolFrame(
            isEmergency = true,
            isCompressed = true,
            isEncrypted = true,
            payload = byteArrayOf(0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08)
        )
        val wireBytes = originalFrame.toWireBytes()

        val deferredReceived = async {
            transport.incomingData.first()
        }

        transport.send(wireBytes)

        val receivedWireBytes = deferredReceived.await()
        val restoredFrame = ProtocolFrame.fromWireBytes(receivedWireBytes)

        assertEquals(originalFrame.isEmergency, restoredFrame.isEmergency)
        assertEquals(originalFrame.isCompressed, restoredFrame.isCompressed)
        assertEquals(originalFrame.isEncrypted, restoredFrame.isEncrypted)
        assertArrayEquals(originalFrame.payload, restoredFrame.payload)
    }

    @Test
    fun testProperCleanupWhenStopped() = runBlocking {
        // 7. Cleanup upon release
        transport.startDiscovery()
        val peer = PeerDevice("peer_103", "Cleanup Peer")
        transport.connect(peer)

        assertEquals(ConnectionState.CONNECTED, transport.connectionState.value)

        transport.release()

        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
        assertTrue(transport.discoveredPeers.value.isEmpty())
    }
}
