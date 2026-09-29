package com.example.itantraui.communication

/**
 * Connection lifecycle states for iTantra transport engines.
 */
enum class ConnectionState {
    DISCONNECTED,
    DISCOVERING,
    CONNECTING,
    HANDSHAKING,
    CONNECTED,
    ERROR
}
