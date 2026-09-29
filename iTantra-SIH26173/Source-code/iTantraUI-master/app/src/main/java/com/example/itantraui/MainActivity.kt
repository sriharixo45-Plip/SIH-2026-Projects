package com.example.itantraui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.example.itantraui.communication.WifiP2pTransport
import com.example.itantraui.ui.language.AppLanguageManager
import com.example.itantraui.ui.theme.ITantraUITheme
import com.example.itantraui.viewmodel.CommunicationViewModel
import com.example.itantraui.viewmodel.CommunicationViewModelFactory

class MainActivity : ComponentActivity() {

    private lateinit var transport: WifiP2pTransport
    private val viewModel: CommunicationViewModel by viewModels {
        CommunicationViewModelFactory(transport)
    }

    private var pendingOnGrantedAction: (() -> Unit)? = null
    private var pendingAudioAction: (() -> Unit)? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissionsMap ->
        val allGranted = permissionsMap.all { it.value }
        Log.d(TAG, "Permissions Result: API=${Build.VERSION.SDK_INT}, required=${getRequiredPermissions().joinToString()}, allGranted = $allGranted, map = $permissionsMap")

        transport.updateSystemDiagnostics()

        if (allGranted) {
            viewModel.setErrorMessage(null)
            pendingOnGrantedAction?.invoke()
        } else {
            val missingPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                "Nearby Devices permission required for Wi-Fi Direct scanning."
            } else {
                "Location permission required for Wi-Fi Direct scanning."
            }
            Log.e(TAG, "Permissions DENIED: $missingPerm")
            viewModel.setErrorMessage(missingPerm)
        }
        pendingOnGrantedAction = null
    }

    private val audioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.setMicrophonePermissionGranted(true)
            viewModel.setErrorMessage(null)
            pendingAudioAction?.invoke()
        } else {
            viewModel.setMicrophonePermissionGranted(false)
            Log.e(TAG, "RECORD_AUDIO permission DENIED")
            viewModel.setErrorMessage("Microphone permission required")
        }
        pendingAudioAction = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        transport = WifiP2pTransport(applicationContext)
        AppLanguageManager.init(applicationContext)
        viewModel.initVoiceEngines(applicationContext)

        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
        )

        setContent {
            val uiState by viewModel.uiState.collectAsState()
            val currentAppLang by AppLanguageManager.currentLanguage
            val localizedContext = remember(currentAppLang) {
                AppLanguageManager.getLocalizedContext(this@MainActivity, currentAppLang)
            }

            CompositionLocalProvider(LocalContext provides localizedContext) {
                ITantraUITheme(darkTheme = uiState.isDarkTheme) {
                    CommunicationScreen(
                        viewModel = viewModel,
                        onRequestPermissions = { onGranted ->
                            checkAndRequestPermissions(onGranted)
                        },
                        onRequestAudioPermission = { onGranted ->
                            checkAndRequestAudioPermission(onGranted)
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::transport.isInitialized) {
            transport.updateSystemDiagnostics()
        }
    }

    override fun onPause() {
        if (::transport.isInitialized && viewModel.uiState.value.isRecordingVoice) {
            viewModel.stopAndFinalizeVoiceRecording()
        }
        super.onPause()
    }

    fun checkAndRequestPermissions(onGranted: () -> Unit) {
        val requiredPerms = getRequiredPermissions()
        val hasAll = requiredPerms.all { perm ->
            ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED
        }

        Log.d(TAG, "checkAndRequestPermissions: API=${Build.VERSION.SDK_INT}, required=${requiredPerms.joinToString()}, hasAll = $hasAll")
        transport.updateSystemDiagnostics()

        if (hasAll) {
            viewModel.setErrorMessage(null)
            onGranted()
        } else {
            pendingOnGrantedAction = onGranted
            Log.d(TAG, "Launching permission dialog for: ${requiredPerms.joinToString()}")
            permissionLauncher.launch(requiredPerms)
        }
    }

    fun checkAndRequestAudioPermission(onGranted: () -> Unit) {
        val hasAudio = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (hasAudio) {
            viewModel.setMicrophonePermissionGranted(true)
            viewModel.setErrorMessage(null)
            onGranted()
        } else {
            pendingAudioAction = onGranted
            Log.d(TAG, "Launching RECORD_AUDIO permission dialog")
            audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    companion object {
        const val TAG = "iTantra-WiFiP2P"

        fun getRequiredPermissions(): Array<String> {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES)
            } else {
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }
}
