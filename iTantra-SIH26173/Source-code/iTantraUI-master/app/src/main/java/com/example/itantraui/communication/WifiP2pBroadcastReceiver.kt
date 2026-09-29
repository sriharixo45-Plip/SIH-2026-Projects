package com.example.itantraui.communication

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.NetworkInfo
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager

/**
 * BroadcastReceiver for Wi-Fi Direct system events.
 *
 * Lightweight event listener triggering callbacks when peers change or connections update.
 */
class WifiP2pBroadcastReceiver(
    private val manager: WifiP2pManager?,
    private val channel: WifiP2pManager.Channel?,
    private val onPeersChanged: () -> Unit,
    private val onConnectionChanged: (NetworkInfo?) -> Unit,
    private val onStateChanged: (Boolean) -> Unit,
    private val onThisDeviceChanged: ((WifiP2pDevice?) -> Unit)? = null
) : BroadcastReceiver() {

    @SuppressLint("MissingPermission")
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                onStateChanged(state == WifiP2pManager.WIFI_P2P_STATE_ENABLED)
            }
            WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                if (manager != null && channel != null) {
                    onPeersChanged()
                }
            }
            WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                @Suppress("DEPRECATION")
                val networkInfo: NetworkInfo? = intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO)
                onConnectionChanged(networkInfo)
            }
            WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                @Suppress("DEPRECATION")
                val device: WifiP2pDevice? = intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_DEVICE)
                onThisDeviceChanged?.invoke(device)
            }
        }
    }
}
