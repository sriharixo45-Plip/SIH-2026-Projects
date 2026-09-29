package com.example.itantraui.communication

/**
 * Lightweight representation of a nearby discoverable or connected peer device.
 *
 * Designed for low memory footprint on 2 GB RAM smartphones:
 * - Simple primitive properties.
 * - No heavy metadata attached.
 */
data class PeerDevice(
    val deviceId: String,
    val deviceName: String,
    val signalStrengthRssi: Int = 0,
    val isConnected: Boolean = false
)
