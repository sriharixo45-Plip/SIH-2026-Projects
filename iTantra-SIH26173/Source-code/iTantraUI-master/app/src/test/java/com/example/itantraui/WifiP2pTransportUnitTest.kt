package com.example.itantraui

import android.content.ContextWrapper
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import com.example.itantraui.communication.ConnectionState
import com.example.itantraui.communication.PeerDevice
import com.example.itantraui.communication.WifiP2pTransport
import com.example.itantraui.protocol.ProtocolFrame
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.ServerSocket
import java.net.Socket

class WifiP2pTransportUnitTest {

    private lateinit var transport: WifiP2pTransport

    @Before
    fun setUp() {
        val dummyContext = ContextWrapper(null)
        transport = WifiP2pTransport(
            context = dummyContext,
            manager = null,
            channel = null
        )
    }

    @After
    fun tearDown() {
        transport.release()
    }

    @Test(timeout = 5000)
    fun testInitialState() {
        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
        assertTrue(transport.discoveredPeers.value.isEmpty())
    }

    @Test(timeout = 5000)
    fun testStartDiscoveryWithoutManagerSetStateToError() = runBlocking {
        transport.startDiscovery()
        assertEquals(ConnectionState.ERROR, transport.connectionState.value)
    }

    @Test(timeout = 5000)
    fun testStopDiscoveryResetsPeersAndState() = runBlocking {
        transport.stopDiscovery()
        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
        assertTrue(transport.discoveredPeers.value.isEmpty())
    }

    @Test(timeout = 5000)
    fun testSendFailsWhenDisconnected() = runBlocking {
        val payload = "Test bytes".toByteArray(Charsets.UTF_8)
        val success = transport.send(payload)
        assertFalse(success)
    }

    @Test(timeout = 5000)
    fun testConnectFailsWhenDeviceNotFoundInMap() = runBlocking {
        val peer = PeerDevice("non_existent_mac", "Unknown Device")
        val result = transport.connect(peer)
        assertFalse(result)
    }

    @Test(timeout = 5000)
    fun testOnPeersAvailablePopulatesStateFlow() {
        val device1 = WifiP2pDevice().apply {
            deviceAddress = "AA:BB:CC:DD:EE:01"
            deviceName = "Unit_Alpha"
            status = WifiP2pDevice.AVAILABLE
        }
        val device2 = WifiP2pDevice().apply {
            deviceAddress = "AA:BB:CC:DD:EE:02"
            deviceName = "Unit_Beta"
            status = WifiP2pDevice.CONNECTED
        }

        val deviceList = WifiP2pDeviceList()
        var mapPopulated = false
        for (field in WifiP2pDeviceList::class.java.declaredFields) {
            field.isAccessible = true
            if (Map::class.java.isAssignableFrom(field.type)) {
                @Suppress("UNCHECKED_CAST")
                val map = field.get(deviceList) as? MutableMap<String, WifiP2pDevice>
                if (map != null) {
                    map[device1.deviceAddress] = device1
                    map[device2.deviceAddress] = device2
                    mapPopulated = true
                    break
                }
            }
        }

        transport.onPeersAvailable(if (mapPopulated) deviceList else null)

        if (mapPopulated) {
            val peers = transport.discoveredPeers.value
            assertEquals(2, peers.size)
            val p1 = peers.find { it.deviceId == "AA:BB:CC:DD:EE:01" }
            assertNotNull(p1)
            assertEquals("Unit_Alpha", p1?.deviceName)
            assertFalse(p1!!.isConnected)
        } else {
            assertTrue(transport.discoveredPeers.value.isEmpty())
        }
    }

    @Test(timeout = 5000)
    fun testSocketSendAndReceiveWireBytes() = runBlocking {
        val serverSocket = ServerSocket(0)
        val port = serverSocket.localPort

        val acceptedSocketDeferred = async(Dispatchers.IO) {
            serverSocket.accept()
        }
        val clientSocket = withContext(Dispatchers.IO) {
            Socket("127.0.0.1", port)
        }
        val acceptedSocket = acceptedSocketDeferred.await()

        transport.setupConnectedSocket(acceptedSocket)
        assertEquals(ConnectionState.CONNECTED, transport.connectionState.value)

        // Create ProtocolFrame wire payload
        val frame = ProtocolFrame(
            isEmergency = true,
            isCompressed = true,
            isEncrypted = true,
            payload = byteArrayOf(0x0A, 0x0B, 0x0C)
        )
        val wireBytes = frame.toWireBytes()

        // 1. Test sending over active socket
        val sendSuccess = transport.send(wireBytes)
        assertTrue(sendSuccess)

        // Verify sent bytes on client side
        val inStream = DataInputStream(clientSocket.getInputStream())
        val sentLen = inStream.readInt()
        val sentBuf = ByteArray(sentLen)
        inStream.readFully(sentBuf)
        assertArrayEquals(wireBytes, sentBuf)

        // 2. Test receiving over socket
        val outStream = DataOutputStream(clientSocket.getOutputStream())
        val incomingFrameBytes = byteArrayOf(0x54, 0x01, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x02)

        val deferredIncoming = async {
            transport.incomingData.first()
        }

        outStream.writeInt(incomingFrameBytes.size)
        outStream.write(incomingFrameBytes)
        outStream.flush()

        val received = deferredIncoming.await()
        assertArrayEquals(incomingFrameBytes, received)

        // Clean teardown
        clientSocket.close()
        acceptedSocket.close()
        serverSocket.close()
    }

    @Test(timeout = 5000)
    fun testOversizedPayloadIsRejectedWithoutAllocation() = runBlocking {
        val serverSocket = ServerSocket(0)
        val port = serverSocket.localPort

        val acceptedSocketDeferred = async(Dispatchers.IO) {
            serverSocket.accept()
        }
        val clientSocket = withContext(Dispatchers.IO) {
            Socket("127.0.0.1", port)
        }
        val acceptedSocket = acceptedSocketDeferred.await()

        transport.setupConnectedSocket(acceptedSocket)

        val disconnectedState = async {
            transport.connectionState.first { it == ConnectionState.DISCONNECTED }
        }

        // Write oversized length (1 MB > 64 KB limit) to stream
        val outStream = DataOutputStream(clientSocket.getOutputStream())
        outStream.writeInt(1024 * 1024)
        outStream.flush()

        disconnectedState.await()

        clientSocket.close()
        acceptedSocket.close()
        serverSocket.close()

        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
    }

    @Test(timeout = 5000)
    fun testReleaseTeardown() {
        transport.release()
        assertEquals(ConnectionState.DISCONNECTED, transport.connectionState.value)
    }
}
