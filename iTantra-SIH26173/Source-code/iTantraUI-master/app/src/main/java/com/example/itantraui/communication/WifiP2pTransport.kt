package com.example.itantraui.communication

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.NetworkInfo
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

/**
 * Native Android Wi-Fi Direct (Wi-Fi P2P) Transport implementation for iTantra.
 *
 * Design constraints for low-end smartphones (2 GB RAM target):
 * - 0 External Dependencies: Built 100% on native `android.net.wifi.p2p` and standard Java Sockets.
 * - Explicit Discovery: `startDiscovery()` and `stopDiscovery()` control radio hardware cycles.
 * - Threading: Socket read/write operations execute on `Dispatchers.IO` off the main thread.
 * - Memory: Capped payload limit (64 KB) prevents memory allocation spikes on 2 GB devices.
 */
class WifiP2pTransport(
    private val context: Context,
    private val manager: WifiP2pManager? = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager,
    private val channel: WifiP2pManager.Channel? = manager?.initialize(context, context.mainLooper, null)
) : Transport, WifiP2pManager.PeerListListener, WifiP2pManager.ConnectionInfoListener {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    override val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _discoveredPeers = MutableStateFlow<List<PeerDevice>>(emptyList())
    override val discoveredPeers: StateFlow<List<PeerDevice>> = _discoveredPeers.asStateFlow()

    private val _incomingData = MutableSharedFlow<ByteArray>(replay = 1, extraBufferCapacity = 64)
    override val incomingData: SharedFlow<ByteArray> = _incomingData.asSharedFlow()

    private val _diagnosticsInfo = MutableStateFlow(
        TransportDiagnostics(
            localDeviceName = getDeviceModelName(),
            permissionsGranted = checkPermissionsGranted(context),
            isWifiEnabled = checkWifiEnabled(context),
            isLocationEnabled = checkLocationEnabled(context)
        )
    )
    override val diagnosticsInfo: StateFlow<TransportDiagnostics> = _diagnosticsInfo.asStateFlow()

    private var activeSocket: Socket? = null
    private var serverSocket: ServerSocket? = null
    private var outputStream: DataOutputStream? = null
    private var receiver: WifiP2pBroadcastReceiver? = null
    private var isReceiverRegistered = false
    private var readerJob: Job? = null
    private var serverJob: Job? = null
    private val isClosing = AtomicBoolean(false)
    private val groupSessionLock = Any()
    @Volatile private var activeGroupSession: String? = null
    /** Claim one TCP/handshake setup per formed P2P group, including while callbacks race. */
    private var connectionSetupClaimed = false

    private val deviceMap = HashMap<String, WifiP2pDevice>()

    init {
        logD(TAG, "Initializing WifiP2pTransport: API=${Build.VERSION.SDK_INT}, manager=${manager != null}, channel=${channel != null}")
        setupBroadcastReceiver()
        updateSystemDiagnostics()
    }

    fun updateSystemDiagnostics(): Boolean {
        val perms = checkPermissionsGranted(context)
        val wifi = checkWifiEnabled(context)
        val location = checkLocationEnabled(context)

        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            permissionsGranted = perms,
            isWifiEnabled = wifi,
            isLocationEnabled = location
        )

        logD(TAG, "System Diagnostics -> API: ${Build.VERSION.SDK_INT}, Required Perms: ${getRequiredPermissionName()}, Granted: $perms, Wi-Fi ON: $wifi, Location ON: $location")
        return perms && wifi
    }

    private fun setupBroadcastReceiver() {
        if (manager == null || channel == null) {
            logE(TAG, "WifiP2pManager or Channel is null. Wi-Fi Direct unavailable.")
            return
        }

        receiver = WifiP2pBroadcastReceiver(
            manager = manager,
            channel = channel,
            onPeersChanged = {
                logD(TAG, "WIFI_P2P_PEERS_CHANGED_ACTION received -> requesting peers via requestPeers()...")
                requestPeers()
            },
            onConnectionChanged = { networkInfo ->
                logD(TAG, "WIFI_P2P_CONNECTION_CHANGED_ACTION: networkInfo.isConnected = ${networkInfo?.isConnected}")
                handleConnectionChange(networkInfo)
            },
            onStateChanged = { isEnabled ->
                logD(TAG, "WIFI_P2P_STATE_CHANGED_ACTION: isEnabled = $isEnabled")
                _diagnosticsInfo.value = _diagnosticsInfo.value.copy(isWifiEnabled = isEnabled)
                if (!isEnabled) {
                    _connectionState.value = ConnectionState.DISCONNECTED
                    _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                        lastEvent = "Wi-Fi P2P Hardware Disabled"
                    )
                }
            },
            onThisDeviceChanged = { device ->
                if (device != null) {
                    val localName = device.deviceName.ifBlank { getDeviceModelName() }
                    val localMac = device.deviceAddress.ifBlank { "Unavailable" }
                    logD(TAG, "WIFI_P2P_THIS_DEVICE_CHANGED_ACTION: Local Name '$localName', MAC '$localMac'")
                    _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                        localDeviceName = localName,
                        localDeviceMac = localMac
                    )
                }
            }
        )

        val intentFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }

        try {
            context.registerReceiver(receiver, intentFilter)
            isReceiverRegistered = true
            logD(TAG, "BroadcastReceiver registered successfully")
        } catch (e: Exception) {
            logE(TAG, "Failed to register BroadcastReceiver: ${e.message}")
            isReceiverRegistered = false
        }
    }

    @SuppressLint("MissingPermission")
    override suspend fun startDiscovery() = withContext(Dispatchers.Default) {
        val permsOk = checkPermissionsGranted(context)
        val wifiOk = checkWifiEnabled(context)
        val locOk = checkLocationEnabled(context)

        logD(TAG, "startDiscovery() invoked -> API Level: ${Build.VERSION.SDK_INT}, Required Perms: ${getRequiredPermissionName()}, Granted: $permsOk, Wi-Fi ON: $wifiOk, Location ON: $locOk")

        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            permissionsGranted = permsOk,
            isWifiEnabled = wifiOk,
            isLocationEnabled = locOk
        )

        if (!permsOk) {
            val msg = "Missing permissions: Grant ${getRequiredPermissionName()} permission to scan"
            logE(TAG, "startDiscovery aborted: $msg")
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = msg)
            return@withContext
        }

        if (!wifiOk) {
            val msg = "Wi-Fi is OFF: Turn ON Wi-Fi radio to scan for nearby units"
            logE(TAG, "startDiscovery aborted: $msg")
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = msg)
            return@withContext
        }

        // On API < 33, Location Services are mandatory for Wi-Fi Direct peer discovery
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && !locOk) {
            val msg = "Location Services OFF: Turn ON Location Mode to discover Wi-Fi Direct peers"
            logE(TAG, "startDiscovery aborted on API < 33: $msg")
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = msg)
            return@withContext
        }

        if (manager == null || channel == null) {
            val msg = "Wi-Fi Direct Manager/Channel unavailable on this device"
            logE(TAG, "startDiscovery aborted: $msg")
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = msg)
            return@withContext
        }

        logD(TAG, "Calling manager.discoverPeers()...")

        try {
            suspendCancellableCoroutine<Unit> { continuation ->
                manager.discoverPeers(channel, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        logD(TAG, "discoverPeers() SUCCESS -> Wi-Fi Direct radio is actively scanning for peers")
                        _connectionState.value = ConnectionState.DISCOVERING
                        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                            lastEvent = "DISCOVERY STARTED (Scanning for nearby field units...)"
                        )
                        if (continuation.isActive) continuation.resume(Unit)
                    }

                    override fun onFailure(reasonCode: Int) {
                        val reasonText = getP2pFailureReasonString(reasonCode)
                        logE(TAG, "discoverPeers() FAILURE: Reason Code $reasonCode ($reasonText)")
                        _connectionState.value = ConnectionState.ERROR
                        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                            lastEvent = "Discovery failed: $reasonText (Code $reasonCode)"
                        )
                        if (continuation.isActive) continuation.resume(Unit)
                    }
                })
            }
        } catch (e: SecurityException) {
            val msg = "SecurityException during discoverPeers: ${e.message}"
            logE(TAG, msg, e)
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = msg)
        } catch (e: Exception) {
            val msg = "Discovery Exception: ${e.message ?: "Unknown"}"
            logE(TAG, msg, e)
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = msg)
        }
    }

    @SuppressLint("MissingPermission")
    override suspend fun stopDiscovery() = withContext(Dispatchers.Default) {
        if (manager != null && channel != null) {
            try {
                suspendCancellableCoroutine<Unit> { continuation ->
                    manager.stopPeerDiscovery(channel, object : WifiP2pManager.ActionListener {
                        override fun onSuccess() {
                            logD(TAG, "stopPeerDiscovery() SUCCESS")
                            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = "Peer discovery stopped")
                            if (continuation.isActive) continuation.resume(Unit)
                        }

                        override fun onFailure(reasonCode: Int) {
                            logE(TAG, "stopPeerDiscovery() FAILURE: Code $reasonCode")
                            if (continuation.isActive) continuation.resume(Unit)
                        }
                    })
                }
            } catch (e: Exception) {
                logE(TAG, "stopPeerDiscovery Exception: ${e.message}")
            }
        }
        if (_connectionState.value == ConnectionState.DISCOVERING) {
            _connectionState.value = ConnectionState.DISCONNECTED
        }
        _discoveredPeers.value = emptyList()
        deviceMap.clear()
    }

    @SuppressLint("MissingPermission")
    private fun requestPeers() {
        if (manager != null && channel != null) {
            try {
                logD(TAG, "Executing manager.requestPeers()...")
                manager.requestPeers(channel, this)
            } catch (e: SecurityException) {
                logE(TAG, "SecurityException in requestPeers: ${e.message}")
            } catch (e: Exception) {
                logE(TAG, "Exception in requestPeers: ${e.message}")
            }
        }
    }

    override fun onPeersAvailable(peers: WifiP2pDeviceList?) {
        if (peers == null) {
            logD(TAG, "onPeersAvailable callback received null device list")
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                lastEvent = "DISCOVERY STARTED • Callback received • Null peer list"
            )
            return
        }

        val deviceList = peers.deviceList
        logD(TAG, "onPeersAvailable callback received -> Total peer count: ${deviceList.size}")

        deviceMap.clear()
        val peerList = mutableListOf<PeerDevice>()

        if (deviceList.isEmpty()) {
            _discoveredPeers.value = emptyList()
            val eventMsg = "DISCOVERY STARTED • Callback received • Peers returned: 0"
            logD(TAG, eventMsg)
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = eventMsg)
            return
        }

        for (device in deviceList) {
            deviceMap[device.deviceAddress] = device
            val statusStr = getP2pDeviceStatusString(device.status)
            logD(TAG, "  -> Peer Discovered: Name='${device.deviceName}', Address='${device.deviceAddress}', Status=$statusStr")

            peerList.add(
                PeerDevice(
                    deviceId = device.deviceAddress,
                    deviceName = device.deviceName.ifBlank { "Field Unit (${device.deviceAddress.takeLast(5)})" },
                    signalStrengthRssi = 0,
                    isConnected = device.status == WifiP2pDevice.CONNECTED
                )
            )
        }

        _discoveredPeers.value = peerList
        val summaryMsg = "Discovered ${peerList.size} peer(s): ${peerList.joinToString { it.deviceName }}"
        logD(TAG, summaryMsg)
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(lastEvent = summaryMsg)
    }

    @SuppressLint("MissingPermission")
    override suspend fun connect(peer: PeerDevice): Boolean = withContext(Dispatchers.Default) {
        if (manager == null || channel == null) {
            logE(TAG, "connect() failed: WifiP2pManager/Channel is null")
            return@withContext false
        }

        val targetDevice = deviceMap[peer.deviceId]
        if (targetDevice == null) {
            logE(TAG, "connect() failed: Target device MAC '${peer.deviceId}' not found in discovered peers map")
            return@withContext false
        }

        val config = WifiP2pConfig().apply {
            deviceAddress = targetDevice.deviceAddress
        }

        logD(TAG, "Initiating connect() to Name='${peer.deviceName}', MAC='${peer.deviceId}'")
        _connectionState.value = ConnectionState.CONNECTING
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            remoteDeviceName = peer.deviceName,
            remoteDeviceMac = peer.deviceId,
            lastEvent = "Connecting to ${peer.deviceName}"
        )

        try {
            suspendCancellableCoroutine { continuation ->
                manager.connect(channel, config, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        logD(TAG, "manager.connect() SUCCESS initiated for '${peer.deviceName}' (Waiting for P2P Group Formation...)")
                        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                            lastEvent = "P2P Group formation initiated for ${peer.deviceName}"
                        )
                        if (continuation.isActive) {
                            continuation.resume(true)
                        }
                    }

                    override fun onFailure(reasonCode: Int) {
                        val reasonText = getP2pFailureReasonString(reasonCode)
                        logE(TAG, "manager.connect() FAILURE for '${peer.deviceName}': Code $reasonCode ($reasonText)")
                        _connectionState.value = ConnectionState.ERROR
                        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                            lastEvent = "P2P connect failed to ${peer.deviceName}: $reasonText"
                        )
                        if (continuation.isActive) {
                            continuation.resume(false)
                        }
                    }
                })
            }
        } catch (e: SecurityException) {
            logE(TAG, "SecurityException during connect()", e)
            _connectionState.value = ConnectionState.ERROR
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                lastEvent = "SecurityException during connect: ${e.message}"
            )
            false
        } catch (e: Exception) {
            logE(TAG, "Exception during connect()", e)
            _connectionState.value = ConnectionState.ERROR
            false
        }
    }

    private fun handleConnectionChange(networkInfo: NetworkInfo?) {
        val isConnected = networkInfo?.isConnected == true
        logD(TAG, "handleConnectionChange: networkInfo.isConnected = $isConnected")

        if (isConnected) {
            logD(TAG, "Network is connected -> requesting connection info...")
            manager?.requestConnectionInfo(channel, this)
        } else {
            if (_connectionState.value == ConnectionState.CONNECTING ||
                _connectionState.value == ConnectionState.HANDSHAKING
            ) {
                // Android may report a transient disconnected NetworkInfo while P2P negotiates.
                // Preserve the in-flight group's setup claim; the formed-group callback follows.
                logD(TAG, "Ignoring transient disconnected NetworkInfo during P2P setup")
                return
            }
            logD(TAG, "Network is disconnected -> closing active sockets")
            closeSocketConnection()
            if (_connectionState.value != ConnectionState.DISCOVERING) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
        }
    }

    override fun onConnectionInfoAvailable(info: WifiP2pInfo?) {
        if (info == null) {
            logD(TAG, "onConnectionInfoAvailable received null info")
            return
        }

        logD(TAG, "onConnectionInfoAvailable: groupFormed=${info.groupFormed}, isGroupOwner=${info.isGroupOwner}, GO_Address=${info.groupOwnerAddress?.hostAddress}")

        if (!info.groupFormed) return

        val groupOwnerAddress = info.groupOwnerAddress?.hostAddress
        val groupSession = "$groupOwnerAddress|${info.isGroupOwner}"
        synchronized(groupSessionLock) {
            val socketAlreadyEstablished = activeSocket?.let { it.isConnected && !it.isClosed } == true
            if (activeGroupSession == groupSession &&
                (connectionSetupClaimed || serverJob?.isActive == true || socketAlreadyEstablished)
            ) {
                logD(TAG, "Duplicate connection-info callback for active/claimed group $groupSession ignored")
                return
            }
            activeGroupSession = groupSession
            connectionSetupClaimed = true
            serverJob?.cancel()
            _connectionState.value = ConnectionState.CONNECTING
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                isGroupOwner = info.isGroupOwner,
                tcpConnectionState = if (info.isGroupOwner) "Starting TCP server on $P2P_PORT" else "Connecting to $groupOwnerAddress:$P2P_PORT",
                handshakeState = "Waiting for TCP",
                lastEvent = "P2P group formed (${if (info.isGroupOwner) "Group Owner / Server" else "Client"}); TCP setup started"
            )

            logD(TAG, "P2P group role=${if (info.isGroupOwner) "Group Owner" else "Client"}, GO=$groupOwnerAddress, TCP port=$P2P_PORT")
            serverJob = scope.launch(Dispatchers.IO) {
                var socket: Socket? = null
                try {
                    if (info.isGroupOwner) {
                        logD(TAG, "Starting single ServerSocket on port $P2P_PORT")
                        val server = ServerSocket(P2P_PORT)
                        serverSocket = server
                        logD(TAG, "ServerSocket listening on 0.0.0.0:$P2P_PORT")
                        socket = server.accept()
                        logD(TAG, "ServerSocket accept() returned peer=${socket.inetAddress?.hostAddress}:${socket.port}")
                    } else {
                        val goIp = groupOwnerAddress ?: throw IOException("Group Owner IP address is unavailable")
                        logD(TAG, "TCP client connecting to GO $goIp:$P2P_PORT (timeout=${TCP_CONNECT_TIMEOUT_MS}ms)")
                        socket = Socket()
                        socket.connect(InetSocketAddress(goIp, P2P_PORT), TCP_CONNECT_TIMEOUT_MS)
                        logD(TAG, "TCP client connected to GO $goIp:$P2P_PORT")
                    }

                    val establishedSocket = checkNotNull(socket)
                    performHandshake(establishedSocket, info.isGroupOwner)
                    setupConnectedSocket(establishedSocket)
                } catch (e: Exception) {
                    logE(TAG, "Connection setup failed for group=$groupSession: ${e.message}", e)
                    try { socket?.close() } catch (_: Exception) {}
                    closeSocketConnection()
                    _connectionState.value = ConnectionState.ERROR
                    _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                        tcpConnectionState = "Failed: ${e.message ?: "Unknown"}",
                        handshakeState = if (e is IOException) "Failed: ${e.message ?: "I/O error"}" else "Failed",
                        lastEvent = "Connection setup failed: ${e.message ?: "Unknown"}"
                    )
                }
            }
        }

    }

    /** A small transport-level protocol check, completed before the link is exposed as CONNECTED. */
    private fun performHandshake(socket: Socket, isGroupOwner: Boolean) {
        val input = DataInputStream(socket.getInputStream())
        val output = DataOutputStream(socket.getOutputStream())
        socket.soTimeout = HANDSHAKE_TIMEOUT_MS
        _connectionState.value = ConnectionState.HANDSHAKING
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            tcpConnectionState = "Connected; protocol handshake in progress",
            handshakeState = "Pending",
            lastEvent = "TCP connected; waiting for peer handshake"
        )
        logD(TAG, "TCP established; handshake pending (${if (isGroupOwner) "server" else "client"})")

        if (isGroupOwner) {
            val magic = input.readInt()
            val version = input.readInt()
            check(magic == HANDSHAKE_MAGIC) { "Peer sent an unknown handshake signature" }
            check(version == HANDSHAKE_VERSION) { "Peer handshake version $version is unsupported" }
            output.writeInt(HANDSHAKE_ACK_MAGIC)
            output.writeInt(HANDSHAKE_VERSION)
            output.flush()
        } else {
            output.writeInt(HANDSHAKE_MAGIC)
            output.writeInt(HANDSHAKE_VERSION)
            output.flush()
            val ackMagic = input.readInt()
            val version = input.readInt()
            check(ackMagic == HANDSHAKE_ACK_MAGIC) { "Group Owner returned an invalid handshake acknowledgement" }
            check(version == HANDSHAKE_VERSION) { "Group Owner handshake version $version is unsupported" }
        }

        socket.soTimeout = 0
        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            handshakeState = "Successful",
            lastEvent = "Transport handshake acknowledged"
        )
        logD(TAG, "Transport handshake and acknowledgement successful")
    }

    /**
     * Socket stream reader setup.
     * Validates length BEFORE allocating ByteArray to prevent OOM on 2 GB RAM devices.
     */
    fun setupConnectedSocket(socket: Socket) {
        activeSocket = socket
        outputStream = DataOutputStream(socket.getOutputStream())
        _connectionState.value = ConnectionState.CONNECTED

        val remoteIp = socket.inetAddress?.hostAddress ?: "Not connected"
        val localIp = socket.localAddress?.hostAddress ?: "Unavailable"
        val remotePort = socket.port

        logD(TAG, "setupConnectedSocket SUCCESS: Remote IP=$remoteIp:$remotePort, Local IP=$localIp")

        _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
            remoteIpAddress = remoteIp,
            localIpAddress = localIp,
            remotePort = remotePort,
            tcpConnectionState = "Connected (TCP + handshake)",
            lastEvent = "TCP socket established with $remoteIp:$remotePort"
        )

        readerJob?.cancel()
        readerJob = scope.launch(Dispatchers.IO) {
            try {
                val inputStream = DataInputStream(socket.getInputStream())
                while (_connectionState.value == ConnectionState.CONNECTED && !socket.isClosed) {
                    val length = inputStream.readInt()
                    // Reject oversized or invalid payload lengths BEFORE allocation
                    if (length <= 0 || length > MAX_PAYLOAD_BYTES) {
                        logE(TAG, "Rejected invalid socket payload length: $length bytes")
                        break
                    }
                    val buffer = ByteArray(length)
                    inputStream.readFully(buffer)
                    logD(TAG, "Received $length wire bytes from $remoteIp")
                    _incomingData.emit(buffer)
                }
            } catch (e: IOException) {
                logD(TAG, "Socket stream closed normally / disconnected: ${e.message}")
            } catch (e: Exception) {
                logE(TAG, "Exception in socket reader job: ${e.message}")
            } finally {
                closeSocketConnection()
            }
        }
    }

    override suspend fun send(bytes: ByteArray): Boolean = withContext(Dispatchers.IO) {
        if (_connectionState.value != ConnectionState.CONNECTED) {
            logE(TAG, "send() failed: Transport not in CONNECTED state")
            return@withContext false
        }
        val stream = outputStream ?: return@withContext false

        return@withContext try {
            stream.writeInt(bytes.size)
            stream.write(bytes)
            stream.flush()
            logD(TAG, "Sent ${bytes.size} wire bytes over active socket")
            true
        } catch (e: Exception) {
            logE(TAG, "send() failed with exception: ${e.message}")
            closeSocketConnection()
            false
        }
    }

    override suspend fun disconnect() = withContext(Dispatchers.Default) {
        logD(TAG, "disconnect() requested by user")
        if (manager != null && channel != null) {
            try {
                suspendCancellableCoroutine<Unit> { continuation ->
                    manager.removeGroup(channel, object : WifiP2pManager.ActionListener {
                        override fun onSuccess() {
                            logD(TAG, "removeGroup() SUCCESS")
                            if (continuation.isActive) continuation.resume(Unit)
                        }

                        override fun onFailure(reasonCode: Int) {
                            logE(TAG, "removeGroup() FAILURE: Code $reasonCode")
                            if (continuation.isActive) continuation.resume(Unit)
                        }
                    })
                }
            } catch (e: Exception) {
                logE(TAG, "removeGroup Exception: ${e.message}")
            }
        }
        closeSocketConnection()
    }

    private fun closeSocketConnection() {
        if (!isClosing.compareAndSet(false, true)) return
        logD(TAG, "Closing socket connections and resetting telemetry state...")
        try {
            readerJob?.cancel()
            serverJob?.cancel()
            try { activeSocket?.shutdownInput() } catch (_: Exception) {}
            try { activeSocket?.shutdownOutput() } catch (_: Exception) {}
            try { activeSocket?.close() } catch (_: Exception) {}
            try { serverSocket?.close() } catch (_: Exception) {}
            try { outputStream?.close() } catch (_: Exception) {}
        } finally {
            readerJob = null
            serverJob = null
            outputStream = null
            activeSocket = null
            serverSocket = null
            synchronized(groupSessionLock) {
                activeGroupSession = null
                connectionSetupClaimed = false
            }
            isClosing.set(false)
            if (_connectionState.value == ConnectionState.CONNECTED) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
            _diagnosticsInfo.value = _diagnosticsInfo.value.copy(
                remoteDeviceName = "Not connected",
                remoteDeviceMac = "Unavailable",
                remoteIpAddress = "Not connected",
                remotePort = 0,
                tcpConnectionState = "Disconnected",
                handshakeState = "Not started",
                lastEvent = "Connection closed"
            )
        }
    }

    override fun release() {
        logD(TAG, "release() called: cleaning up transport resources")
        if (isReceiverRegistered && receiver != null) {
            try {
                context.unregisterReceiver(receiver)
            } catch (_: Exception) {}
            isReceiverRegistered = false
        }
        closeSocketConnection()
        scope.cancel()
    }

    companion object {
        const val TAG = "iTantra-WiFiP2P"
        private const val P2P_PORT = 8888
        private const val TCP_CONNECT_TIMEOUT_MS = 5000
        private const val HANDSHAKE_TIMEOUT_MS = 10000
        private const val HANDSHAKE_MAGIC = 0x49544E31 // ITN1
        private const val HANDSHAKE_ACK_MAGIC = 0x49544131 // ITA1
        private const val HANDSHAKE_VERSION = 1

        /**
         * 64 KB safe payload ceiling for iTantra GZIP-compressed text messages.
         * Prevents heap memory spikes or OutOfMemoryError on 2 GB RAM devices.
         */
        private const val MAX_PAYLOAD_BYTES = 64 * 1024

        private fun logD(tag: String, msg: String) {
            try {
                Log.d(tag, msg)
            } catch (_: Throwable) {
                println("[$tag] $msg")
            }
        }

        private fun logE(tag: String, msg: String, throwable: Throwable? = null) {
            try {
                if (throwable != null) {
                    Log.e(tag, msg, throwable)
                } else {
                    Log.e(tag, msg)
                }
            } catch (_: Throwable) {
                println("[$tag] ERROR: $msg ${throwable?.message ?: ""}")
            }
        }

        private fun getDeviceModelName(): String {
            return try {
                Build.MODEL?.ifBlank { "Android Device" } ?: "Android Device"
            } catch (_: Throwable) {
                "Android Device"
            }
        }

        fun getRequiredPermissionName(): String {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                "NEARBY_WIFI_DEVICES"
            } else {
                "ACCESS_FINE_LOCATION"
            }
        }

        fun checkPermissionsGranted(context: Context): Boolean {
            return try {
                val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES)
                } else {
                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
                }
                perms.all { perm ->
                    ContextCompat.checkSelfPermission(context, perm) == PackageManager.PERMISSION_GRANTED
                }
            } catch (_: Throwable) {
                false
            }
        }

        fun checkWifiEnabled(context: Context): Boolean {
            return try {
                val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                wifiManager?.isWifiEnabled == true
            } catch (_: Throwable) {
                false
            }
        }

        fun checkLocationEnabled(context: Context): Boolean {
            return try {
                val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    locationManager?.isLocationEnabled == true
                } else {
                    @Suppress("DEPRECATION")
                    val mode = Settings.Secure.getInt(
                        context.contentResolver,
                        Settings.Secure.LOCATION_MODE
                    )
                    @Suppress("DEPRECATION")
                    mode != Settings.Secure.LOCATION_MODE_OFF
                }
            } catch (_: Throwable) {
                false
            }
        }

        fun getP2pFailureReasonString(reasonCode: Int): String {
            return when (reasonCode) {
                WifiP2pManager.ERROR -> "Internal Framework Error (Ensure Wi-Fi & Location are ON)"
                WifiP2pManager.P2P_UNSUPPORTED -> "Wi-Fi Direct Unsupported on this device"
                WifiP2pManager.BUSY -> "Framework Busy (Retry SCAN in a moment)"
                WifiP2pManager.NO_SERVICE_REQUESTS -> "No Service Requests"
                else -> "Unknown Failure Code $reasonCode"
            }
        }

        fun getP2pDeviceStatusString(status: Int): String {
            return when (status) {
                WifiP2pDevice.CONNECTED -> "CONNECTED"
                WifiP2pDevice.INVITED -> "INVITED"
                WifiP2pDevice.FAILED -> "FAILED"
                WifiP2pDevice.AVAILABLE -> "AVAILABLE"
                WifiP2pDevice.UNAVAILABLE -> "UNAVAILABLE"
                else -> "UNKNOWN ($status)"
            }
        }
    }
}
