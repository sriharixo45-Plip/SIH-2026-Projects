package com.example.itantraui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.itantraui.communication.PeerDevice
import com.example.itantraui.ui.language.AppLanguage
import com.example.itantraui.ui.language.AppLanguageManager
import com.example.itantraui.ui.theme.*
import com.example.itantraui.viewmodel.CommunicationUiState
import com.example.itantraui.viewmodel.CommunicationViewModel
import com.example.itantraui.voice.LanguageConfig
import kotlinx.coroutines.launch

enum class CommState {
    IDLE,
    LISTENING,
    PROCESSING,
    TEXT_READY,
    TRANSMITTING,
    RECEIVED,
    SPEAKING
}

enum class LinkStatus { DISCOVERING, CONNECTING, CONNECTED, DISCONNECTED }

enum class NavDestination {
    COMMUNICATION,
    FIELD_UNITS,
    DIAGNOSTICS,
    SETTINGS
}

@Composable
fun CommunicationScreen(
    viewModel: CommunicationViewModel = CommunicationViewModel(),
    onRequestPermissions: ((onGranted: () -> Unit) -> Unit)? = null,
    onRequestAudioPermission: ((onGranted: () -> Unit) -> Unit)? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var currentDestination by remember { mutableStateOf(NavDestination.COMMUNICATION) }
    var showPeersDialog by remember { mutableStateOf(false) }

    val triggerScan = {
        if (onRequestPermissions != null) {
            onRequestPermissions { viewModel.startPeerDiscovery() }
        } else {
            viewModel.startPeerDiscovery()
        }
    }

    // Intercept back button when drawer is open
    if (drawerState.isOpen) {
        BackHandler {
            scope.launch { drawerState.close() }
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = true,
        drawerContent = {
            TacticalNavigationDrawerContent(
                currentDestination = currentDestination,
                onDestinationSelected = { destination ->
                    currentDestination = destination
                    scope.launch { drawerState.close() }
                }
            )
        }
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MainBackground
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .systemBarsPadding()
            ) {
                // Top Application Header with Hamburger Menu Button
                AppHeader(
                    uiState = uiState,
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    onStatusClick = { showPeersDialog = true }
                )

                // Main Content View based on Selected Navigation Destination
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    when (currentDestination) {
                        NavDestination.COMMUNICATION -> CommunicationTab(
                            uiState = uiState,
                            viewModel = viewModel,
                            onRequestAudioPermission = onRequestAudioPermission,
                            onOpenPeers = { currentDestination = NavDestination.FIELD_UNITS }
                        )
                        NavDestination.FIELD_UNITS -> FieldUnitsTab(
                            uiState = uiState,
                            viewModel = viewModel,
                            onScanClick = triggerScan
                        )
                        NavDestination.DIAGNOSTICS -> DiagnosticsTab(
                            uiState = uiState
                        )
                        NavDestination.SETTINGS -> SettingsTab(
                            uiState = uiState,
                            onThemeChange = viewModel::setDarkTheme
                        )
                    }
                }
            }
        }
    }

    // Peer Discovery Surface / Dialog
    if (showPeersDialog) {
        PeerDiscoveryDialog(
            uiState = uiState,
            viewModel = viewModel,
            onScanClick = triggerScan,
            onDismiss = { showPeersDialog = false }
        )
    }
}

// ============================================================================
// NAVIGATION DRAWER CONTENT
// ============================================================================

@Composable
private fun TacticalNavigationDrawerContent(
    currentDestination: NavDestination,
    onDestinationSelected: (NavDestination) -> Unit
) {
    ModalDrawerSheet(
        drawerContainerColor = HeaderBackground,
        drawerContentColor = PrimaryText,
        modifier = Modifier.width(300.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
        ) {
            // Drawer Header Branding
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_itantra_logo),
                    contentDescription = "iTANTRA Logo",
                    modifier = Modifier.size(60.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "iTantra",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = PrimaryBrandGreen,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Offline Neural Transceiver",
                    fontSize = 11.sp,
                    color = SecondaryText
                )
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 12.dp),
                color = BorderColor
            )

            // Drawer Navigation Items
            val destinations = listOf(
                NavDestination.COMMUNICATION to R.string.nav_communication,
                NavDestination.FIELD_UNITS to R.string.nav_field_units,
                NavDestination.DIAGNOSTICS to R.string.nav_diagnostics,
                NavDestination.SETTINGS to R.string.nav_settings
            )

            destinations.forEach { (destination, labelRes) ->
                val isSelected = currentDestination == destination
                val itemBg = if (isSelected) DeepGreenHighlight else Color.Transparent
                val itemTextColor = if (isSelected) PrimaryBrandGreen else SecondaryText
                val bulletColor = if (isSelected) PrimaryBrandGreen else MutedText

                Surface(
                    onClick = { onDestinationSelected(destination) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    shape = RoundedCornerShape(6.dp),
                    color = itemBg,
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (isSelected) PrimaryBrandGreen.copy(alpha = 0.5f) else Color.Transparent
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (destination == NavDestination.SETTINGS) "SET" else "•",
                            fontSize = 14.sp,
                            color = bulletColor
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = stringResource(id = labelRes),
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            fontFamily = FontFamily.Monospace,
                            color = itemTextColor
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = "iTANTRA Field Comm v1.0",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = MutedText,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }
    }
}

// ============================================================================
// COMPACT APPLICATION HEADER
// ============================================================================

@Composable
private fun AppHeader(
    uiState: CommunicationUiState,
    onOpenDrawer: () -> Unit,
    onStatusClick: () -> Unit
) {
    val (statusTextRes, statusColor) = when (uiState.linkStatus) {
        LinkStatus.CONNECTED -> "CONNECTED" to PrimaryBrandGreen
        LinkStatus.CONNECTING -> "CONNECTING" to Color(0xFFFFB300)
        LinkStatus.DISCOVERING -> "SEARCHING" to Color(0xFFFFB300)
        LinkStatus.DISCONNECTED -> "DISCONNECTED" to ErrorEmergencyRed
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = HeaderBackground,
        tonalElevation = 4.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: Hamburger Menu Button + Logo + Title
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = onOpenDrawer,
                    modifier = Modifier.size(48.dp)
                ) {
                    Text("☰", color = PrimaryText, fontSize = 26.sp)
                }

                Spacer(modifier = Modifier.width(4.dp))

                Image(
                    painter = painterResource(id = R.drawable.ic_itantra_logo),
                    contentDescription = "Logo",
                    modifier = Modifier.size(32.dp)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Column {
                    Text(
                        text = "iTantra",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = PrimaryBrandGreen,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "Offline Neural Transceiver",
                        fontSize = 11.sp,
                        color = SecondaryText
                    )
                }
            }

            // Right: Connection Status Badge
            Surface(
                onClick = onStatusClick,
                shape = RoundedCornerShape(6.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, statusColor.copy(alpha = 0.6f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(statusColor, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Column(Modifier.widthIn(max = 110.dp)) {
                        Text(
                            text = statusTextRes,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = statusColor
                        )
                        Text(
                            text = when (uiState.linkStatus) {
                                LinkStatus.CONNECTED -> uiState.activePeerName ?: stringResource(R.string.connected_peer)
                                LinkStatus.CONNECTING -> "Connecting to peer..."
                                LinkStatus.DISCOVERING -> stringResource(R.string.status_searching)
                                LinkStatus.DISCONNECTED -> stringResource(R.string.no_active_peer)
                            },
                            fontSize = 8.sp,
                            color = SecondaryText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

// ============================================================================
// COMMUNICATION TAB CONTENT
// ============================================================================

@Composable
private fun CommunicationTab(
    uiState: CommunicationUiState,
    viewModel: CommunicationViewModel,
    onRequestAudioPermission: ((onGranted: () -> Unit) -> Unit)? = null,
    onOpenPeers: () -> Unit
) {
    var textInput by remember { mutableStateOf("") }
    val languages = LanguageConfig.SUPPORTED_LANGUAGES

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        // Connected Peer Info Card
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(6.dp),
            color = CardSurface,
            border = BorderStroke(1.dp, BorderColor)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = uiState.activePeerName ?: stringResource(id = R.string.no_active_peer),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = PrimaryText
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val connectionColor = when (uiState.linkStatus) {
                            LinkStatus.CONNECTED -> PrimaryBrandGreen
                            LinkStatus.CONNECTING, LinkStatus.DISCOVERING -> Color(0xFFFFB300)
                            LinkStatus.DISCONNECTED -> ErrorEmergencyRed
                        }
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(
                                    connectionColor,
                                    CircleShape
                                )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = when (uiState.linkStatus) {
                                LinkStatus.CONNECTED -> "CONNECTED"
                                LinkStatus.CONNECTING -> "CONNECTING"
                                LinkStatus.DISCOVERING -> "SEARCHING"
                                LinkStatus.DISCONNECTED -> "DISCONNECTED"
                            },
                            fontSize = 10.sp,
                            color = SecondaryText
                        )
                    }
                }

                if (uiState.linkStatus == LinkStatus.CONNECTED) {
                    OutlinedButton(
                        onClick = { viewModel.disconnectPeer() },
                        border = BorderStroke(1.dp, ErrorEmergencyRed),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = stringResource(id = R.string.disconnect),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = ErrorEmergencyRed
                        )
                    }
                } else {
                    Button(
                        onClick = onOpenPeers,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBrandGreen),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = stringResource(id = R.string.connect),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = TextOnBrandGreen
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Target Communication Language Selector
        Text(
            text = stringResource(id = R.string.target_language),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = MutedText,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(languages) { language ->
                val isSelected = uiState.selectedLanguage == language.displayName
                Surface(
                    onClick = { viewModel.setLanguage(language.displayName) },
                    shape = RoundedCornerShape(4.dp),
                    color = if (isSelected) GreenGlow else CardSurface,
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (isSelected) PrimaryBrandGreen else BorderColor
                    )
                ) {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Text(
                            text = language.displayName,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) PrimaryBrandGreen else PrimaryText
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Emergency Priority Banner
        EmergencyBanner(
            isEmergencyMode = uiState.isEmergencyMode,
            onEmergencyToggle = { viewModel.setEmergencyMode(it) }
        )

        Spacer(modifier = Modifier.height(10.dp))

        // System Error Banner (if any)
        if (!uiState.errorMessage.isNullOrBlank()) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                shape = RoundedCornerShape(4.dp),
                color = Color(0x33FF3B4A),
                border = BorderStroke(1.dp, ErrorEmergencyRed)
            ) {
                Text(
                    text = uiState.errorMessage,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = ErrorEmergencyRed,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }

        // Conversation Message Stream
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            val hasMessages = uiState.draftMessage.isNotBlank() || uiState.receivedMessage.isNotBlank()

            if (!hasMessages) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(6.dp))
                        .background(CardSurface)
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = stringResource(id = R.string.no_messages_yet),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = MutedText
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = stringResource(id = R.string.empty_message_desc),
                            fontSize = 12.sp,
                            color = SecondaryText,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (uiState.draftMessage.isNotBlank()) {
                        item {
                            MessageBubble(
                                isOutgoing = true,
                                text = uiState.draftMessage,
                                language = uiState.selectedLanguage,
                                wireByteSize = uiState.wireByteSize,
                                isEmergency = uiState.isEmergencyMode,
                                isTransmitting = uiState.commState == CommState.TRANSMITTING
                            )
                        }
                    }

                    if (uiState.receivedMessage.isNotBlank()) {
                        item {
                            MessageBubble(
                                isOutgoing = false,
                                text = uiState.receivedMessage,
                                language = uiState.selectedLanguage,
                                senderName = uiState.activePeerName ?: "Field Unit 02",
                                isEmergency = uiState.isEmergencyMode
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Text Message Input Composer
        OutlinedTextField(
            value = textInput,
            onValueChange = { textInput = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = {
                Text(
                    stringResource(id = R.string.type_field_message),
                    fontSize = 13.sp,
                    color = MutedText
                )
            },
            singleLine = true,
            trailingIcon = {
                Button(
                    onClick = {
                        val msg = textInput.trim()
                        if (msg.isNotEmpty()) {
                            viewModel.processAndPrepareMessage(msg)
                            textInput = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBrandGreen),
                    shape = RoundedCornerShape(4.dp),
                    modifier = Modifier.padding(end = 4.dp)
                ) {
                    Text(
                        text = stringResource(id = R.string.send),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = TextOnBrandGreen
                    )
                }
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PrimaryBrandGreen,
                unfocusedBorderColor = BorderColor,
                focusedContainerColor = CardSurface,
                unfocusedContainerColor = CardSurface,
                focusedTextColor = PrimaryText,
                unfocusedTextColor = PrimaryText
            ),
            shape = RoundedCornerShape(6.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Hold To Talk Action Control (Push-To-Talk)
        PrimaryCommunicationButton(
            uiState = uiState,
            isEmergency = uiState.isEmergencyMode,
            onPressStart = {
                if (onRequestAudioPermission != null) {
                    onRequestAudioPermission {
                        viewModel.startVoiceRecording()
                    }
                } else {
                    viewModel.startVoiceRecording()
                }
            },
            onPressEnd = {
                viewModel.stopAndFinalizeVoiceRecording()
            }
        )

        if (uiState.yourSpeech.isNotBlank()) {
            Text("YOUR SPEECH", fontSize = 9.sp, color = SecondaryText, fontFamily = FontFamily.Monospace)
            Text(uiState.yourSpeech, fontSize = 14.sp, color = PrimaryText)
        }

        Text(
            text = when {
                uiState.speechPipelineState == com.example.itantraui.viewmodel.SpeechPipelineState.ERROR -> uiState.errorMessage ?: "Voice input unavailable"
                uiState.speechPipelineState == com.example.itantraui.viewmodel.SpeechPipelineState.LISTENING || uiState.speechPipelineState == com.example.itantraui.viewmodel.SpeechPipelineState.VAD_DETECTING -> "Listening…"
                uiState.speechPipelineState == com.example.itantraui.viewmodel.SpeechPipelineState.TRANSCRIBING -> "Processing voice…"
                uiState.speechModelState == "READY" -> "Microphone ready · tap to speak"
                uiState.speechModelState == "MISSING" -> "Voice input unavailable for ${uiState.selectedLanguage}"
                uiState.speechModelState == "ERROR" -> "Voice model could not be loaded"
                else -> "Preparing voice input…"
            },
            fontSize = 12.sp,
            color = if (uiState.speechPipelineState == com.example.itantraui.viewmodel.SpeechPipelineState.ERROR || uiState.speechModelState == "ERROR") ErrorEmergencyRed else SecondaryText
        )

        Spacer(modifier = Modifier.height(6.dp))

        // Transmission Status Indicator Line
        TransmissionStatusBar(uiState = uiState)
    }
}

// ============================================================================
// FIELD UNITS TAB CONTENT
// ============================================================================

@Composable
private fun FieldUnitsTab(
    uiState: CommunicationUiState,
    viewModel: CommunicationViewModel,
    onScanClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = stringResource(id = R.string.nearby_field_units),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = PrimaryText
                )
                Text(
                    text = "Search for nearby field units",
                    fontSize = 11.sp,
                    color = SecondaryText
                )
            }

            Button(
                onClick = onScanClick,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBrandGreen),
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = stringResource(id = R.string.scan),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = TextOnBrandGreen
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (uiState.discoveredPeers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(CardSurface)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = stringResource(id = R.string.no_nearby_units),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = MutedText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(id = R.string.no_nearby_units_desc),
                        fontSize = 12.sp,
                        color = SecondaryText,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(uiState.discoveredPeers) { peer ->
                    val isConnectedPeer = uiState.activePeerName == peer.deviceName

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(6.dp),
                        color = CardSurface,
                        border = BorderStroke(
                            1.dp,
                            if (isConnectedPeer) PrimaryBrandGreen else BorderColor
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = peer.deviceName,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = PrimaryText
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (isConnectedPeer) "Connected" else "Nearby field unit",
                                    fontSize = 11.sp,
                                    color = SecondaryText
                                )
                            }

                            if (isConnectedPeer) {
                                OutlinedButton(
                                    onClick = { viewModel.disconnectPeer() },
                                    border = BorderStroke(1.dp, ErrorEmergencyRed),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = stringResource(id = R.string.disconnect),
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = ErrorEmergencyRed
                                    )
                                }
                            } else {
                                Button(
                                    onClick = { viewModel.connectPeer(peer) },
                                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBrandGreen),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = stringResource(id = R.string.connect),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = TextOnBrandGreen
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// DIAGNOSTICS TAB CONTENT
// ============================================================================

private data class DiagItem(
    val label: String,
    val value: String,
    val valueColor: Color? = null
)

@Composable
private fun DiagnosticsTab(
    uiState: CommunicationUiState
) {
    val diag = uiState.transportDiagnostics

    val (statusLabel, statusColor) = when (uiState.linkStatus) {
        LinkStatus.CONNECTED -> "Connected" to PrimaryBrandGreen
        LinkStatus.CONNECTING -> "Connecting / Handshake pending" to Color(0xFFFFB300)
        LinkStatus.DISCOVERING -> "Searching for peers" to Color(0xFFFFB300)
        LinkStatus.DISCONNECTED -> "Disconnected" to ErrorEmergencyRed
    }

    val roleText = when (diag.isGroupOwner) {
        true -> "Group Owner (Server)"
        false -> "Client"
        null -> "Unavailable"
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = stringResource(id = R.string.technical_diagnostics),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PrimaryText
            )
            Text(
                text = "Real-time communication & hardware telemetry",
                fontSize = 11.sp,
                color = SecondaryText
            )
        }
        // Hardware & System Permissions
        item {
            DiagnosticCard(
                title = "PERMISSIONS & HARDWARE",
                items = listOf(
                    DiagItem(
                        "Nearby Wi-Fi / Location Permission",
                        if (diag.permissionsGranted) "GRANTED" else "NOT GRANTED (Tap SCAN to Grant)",
                        if (diag.permissionsGranted) PrimaryBrandGreen else ErrorEmergencyRed
                    ),
                    DiagItem(
                        "Wi-Fi Radio State",
                        if (diag.isWifiEnabled) "ON" else "OFF (Turn ON Wi-Fi)",
                        if (diag.isWifiEnabled) PrimaryBrandGreen else ErrorEmergencyRed
                    ),
                    DiagItem(
                        "Location Services State",
                        if (diag.isLocationEnabled) "ON" else "OFF (Turn ON Location)",
                        if (diag.isLocationEnabled) PrimaryBrandGreen else Color(0xFFFFB300)
                    )
                )
            )
        }

        // Voice Engine Telemetry
        val langConfig = LanguageConfig.fromLanguageName(uiState.selectedLanguage)
        item {
            DiagnosticCard(
                title = "VOICE SYSTEM TELEMETRY",
                items = listOf(
                    DiagItem("Selected Voice Language", "${langConfig.displayName} (${langConfig.nativeName})"),
                    DiagItem("STT Engine", "whisper.cpp multilingual (on-device)"),
                    DiagItem("Model File", if (langConfig.languageCode == "en") "ggml-tiny.en.bin" else "ggml-tiny.bin"),
                    DiagItem("STT Target Locale", langConfig.sttLocale.toString()),
                    DiagItem("STT Status", uiState.speechModelState),
                    DiagItem("TTS Engine", "Android System TTS"),
                    DiagItem("TTS Target Locale", langConfig.ttsLocale.toString()),
                    DiagItem("TTS Status", diag.ttsStatusText),
                    DiagItem("STT Latency", if (uiState.sttLatencyMs > 0) "${uiState.sttLatencyMs} ms" else "Idle"),
                    DiagItem("TTS Latency", if (uiState.ttsLatencyMs > 0) "${uiState.ttsLatencyMs} ms" else "Idle"),
                    DiagItem("Audio Capture Format", "16 kHz PCM Mono (RECORD_AUDIO)")
                )
            )
        }

        // Connection Diagnostics
        item {
            DiagnosticCard(
                title = "CONNECTION DIAGNOSTICS",
                items = listOf(
                    DiagItem("Status", statusLabel, statusColor),
                    DiagItem("Transport", diag.transportType),
                    DiagItem("Protocol", diag.socketProtocol),
                    DiagItem("Connection Role", roleText)
                )
            )
        }

        // Remote Device Information
        item {
            DiagnosticCard(
                title = "REMOTE DEVICE",
                items = listOf(
                    DiagItem("Device Name", if (uiState.linkStatus == LinkStatus.CONNECTED) (uiState.activePeerName ?: diag.remoteDeviceName) else "Not connected"),
                    DiagItem("Device Address (MAC)", diag.remoteDeviceMac),
                    DiagItem("Peer IP Address", diag.remoteIpAddress),
                    DiagItem("Remote Port", if (diag.remotePort > 0) diag.remotePort.toString() else "Unavailable")
                )
            )
        }

        // Local Device Information
        item {
            DiagnosticCard(
                title = "LOCAL DEVICE",
                items = listOf(
                    DiagItem("Device Name", diag.localDeviceName),
                    DiagItem("Local MAC Address", diag.localDeviceMac),
                    DiagItem("Local IP Address", diag.localIpAddress)
                )
            )
        }

        // Transport & Socket Telemetry
        item {
            DiagnosticCard(
                title = "TRANSPORT & SOCKET TELEMETRY",
                items = listOf(
                    DiagItem("TCP Connection State", diag.tcpConnectionState, if (diag.tcpConnectionState.startsWith("Connected")) PrimaryBrandGreen else null),
                    DiagItem("Handshake State", diag.handshakeState, if (diag.handshakeState == "Successful") PrimaryBrandGreen else null),
                    DiagItem("Local Server Port", diag.serverPort.toString()),
                    DiagItem("Last Transport Event", diag.lastEvent)
                )
            )
        }

        // Message Pipeline Real Counters
        item {
            DiagnosticCard(
                title = "MESSAGE PIPELINE",
                items = listOf(
                    DiagItem("Messages Sent", uiState.sentMessageCount.toString()),
                    DiagItem("Messages Received", uiState.receivedMessageCount.toString()),
                    DiagItem("Last Wire Payload Size", "${uiState.wireByteSize} bytes"),
                    DiagItem("Compressor Engine", "GZIP"),
                    DiagItem("Encryption Cipher", "AES-256-GCM")
                )
            )
        }
    }
}

@Composable
private fun DiagnosticCard(
    title: String,
    items: List<DiagItem>
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(6.dp),
        color = CardSurface,
        border = BorderStroke(1.dp, BorderColor)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = title,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = TechnicalCyan
            )
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = BorderColor
            )
            items.forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.label,
                        fontSize = 11.sp,
                        color = SecondaryText,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = item.value,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        color = item.valueColor ?: PrimaryText,
                        textAlign = TextAlign.End
                    )
                }
            }
        }
    }
}

// ============================================================================
// SETTINGS TAB CONTENT
// ============================================================================

@Composable
private fun SettingsTab(
    uiState: CommunicationUiState,
    onThemeChange: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val currentAppLang by AppLanguageManager.currentLanguage

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Surface(shape = RoundedCornerShape(12.dp), color = CardSurface, border = BorderStroke(1.dp, BorderColor)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Dark mode", fontWeight = FontWeight.SemiBold, color = PrimaryText)
                        Text("Field display theme", fontSize = 12.sp, color = SecondaryText)
                    }
                    Switch(checked = uiState.isDarkTheme, onCheckedChange = onThemeChange)
                }
            }
        }
        item {
            Text(
                text = stringResource(id = R.string.field_configuration),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PrimaryText
            )
        }

        // App UI Language Selector
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(6.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = stringResource(id = R.string.app_language),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = PrimaryBrandGreen
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(AppLanguage.entries) { appLang ->
                            val isSelected = currentAppLang == appLang
                            Surface(
                                onClick = { AppLanguageManager.setAppLanguage(context, appLang) },
                                shape = RoundedCornerShape(4.dp),
                                color = if (isSelected) DeepGreenHighlight else MainBackground,
                                border = BorderStroke(
                                    width = 1.dp,
                                    color = if (isSelected) PrimaryBrandGreen else BorderColor
                                )
                            ) {
                                Column(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = appLang.nativeName,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) PrimaryBrandGreen else PrimaryText
                                    )
                                    Text(
                                        text = appLang.displayName,
                                        fontSize = 9.sp,
                                        color = SecondaryText
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Target Communication Language Preference
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(6.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = stringResource(id = R.string.communication_preferences),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = PrimaryBrandGreen
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(id = R.string.target_language),
                        fontSize = 12.sp,
                        color = PrimaryText
                    )
                    Text(
                        text = "Current: ${uiState.selectedLanguage}",
                        fontSize = 11.sp,
                        color = SecondaryText
                    )
                }
            }
        }

        // Audio & Voice Pipeline
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(6.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = stringResource(id = R.string.audio_voice),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = PrimaryBrandGreen
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Voice input: ${when (uiState.speechModelState) { "READY" -> "Ready"; "MISSING" -> "Unavailable"; "ERROR" -> "Could not start"; else -> "Starting" }}",
                        fontSize = 11.sp,
                        color = if (uiState.speechModelState == "READY") PrimaryBrandGreen else SecondaryText
                    )
                }
            }
        }

        // About iTANTRA
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(6.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = stringResource(id = R.string.about_itantra),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = PrimaryBrandGreen
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Version: 1.0 (Field Tactical Build)", fontSize = 12.sp, color = PrimaryText)
                }
            }
        }
    }
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

@Composable
private fun EmergencyBanner(
    isEmergencyMode: Boolean,
    onEmergencyToggle: (Boolean) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(6.dp),
        color = if (isEmergencyMode) Color(0x33FF3B4A) else CardSurface,
        border = BorderStroke(
            1.dp,
            if (isEmergencyMode) ErrorEmergencyRed else BorderColor
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(
                            if (isEmergencyMode) ErrorEmergencyRed else MutedText,
                            CircleShape
                        )
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = stringResource(id = R.string.emergency_priority),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = if (isEmergencyMode) ErrorEmergencyRed else PrimaryText
                    )
                    Text(
                        text = stringResource(id = R.string.emergency_desc),
                        fontSize = 10.sp,
                        color = SecondaryText
                    )
                }
            }

            Switch(
                checked = isEmergencyMode,
                onCheckedChange = onEmergencyToggle,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = ErrorEmergencyRed,
                    checkedTrackColor = ErrorEmergencyRed.copy(alpha = 0.3f),
                    uncheckedThumbColor = MutedText,
                    uncheckedTrackColor = BorderColor
                )
            )
        }
    }
}

@Composable
private fun MessageBubble(
    isOutgoing: Boolean,
    text: String,
    language: String,
    wireByteSize: Int = 0,
    senderName: String = "",
    isEmergency: Boolean = false,
    isTransmitting: Boolean = false
) {
    val borderColor = when {
        isEmergency -> ErrorEmergencyRed
        isOutgoing -> PrimaryBrandGreen.copy(alpha = 0.5f)
        else -> TechnicalCyan.copy(alpha = 0.5f)
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isOutgoing) Alignment.End else Alignment.Start
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 320.dp),
            shape = RoundedCornerShape(6.dp),
            color = CardSurface,
            border = BorderStroke(1.dp, borderColor)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isOutgoing) stringResource(R.string.outgoing_transmission) else "${stringResource(R.string.incoming_transmission)} - $senderName",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = if (isOutgoing) PrimaryBrandGreen else TechnicalCyan
                    )

                    Text(
                        text = language.uppercase(),
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        color = MutedText
                    )
                }

                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 6.dp),
                    color = BorderColor
                )

                Text(
                    text = text,
                    fontSize = 14.sp,
                    color = PrimaryText,
                    lineHeight = 20.sp
                )

                if (isOutgoing && wireByteSize > 0) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (isTransmitting) "Transmitting..." else "$wireByteSize bytes - encrypted",
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        color = SecondaryText,
                        modifier = Modifier.align(Alignment.End)
                    )
                }
            }
        }
    }
}

@Composable
private fun PrimaryCommunicationButton(
    uiState: CommunicationUiState,
    isEmergency: Boolean,
    onPressStart: () -> Unit,
    onPressEnd: () -> Unit
) {
    val isListening = uiState.commState == CommState.LISTENING
    val isProcessing = uiState.commState == CommState.PROCESSING
    val isSpeaking = uiState.commState == CommState.SPEAKING

    val buttonBg = when {
        isEmergency -> Color(0x33FF3B4A)
        isListening -> DeepGreenHighlight
        else -> CardSurface
    }

    val borderColor = when {
        isEmergency -> ErrorEmergencyRed
        isListening -> PrimaryBrandGreen
        isProcessing -> TechnicalCyan
        isSpeaking -> PrimaryBrandGreen
        else -> BorderColor
    }

    val stateText = when (uiState.commState) {
        CommState.LISTENING -> "MICROPHONE ACTIVE · TAP TO FINISH"
        CommState.PROCESSING -> "PROCESSING MESSAGE…"
        CommState.TRANSMITTING -> "SENDING MESSAGE…"
        CommState.RECEIVED -> "MESSAGE RECEIVED"
        CommState.SPEAKING -> "PLAYING MESSAGE…"
        else -> "TAP TO SPEAK"
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { if (isListening) onPressEnd() else onPressStart() },
        shape = RoundedCornerShape(6.dp),
        color = buttonBg,
        border = BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        when {
                            isEmergency -> ErrorEmergencyRed
                            isListening -> PrimaryBrandGreen
                            isProcessing -> TechnicalCyan
                            else -> PrimaryBrandGreen
                        },
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "MIC",
                    fontSize = 16.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = stateText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = if (isEmergency) ErrorEmergencyRed else PrimaryText
                )
                Text(
            text = if (isListening) "Listening… tap to finish" else "Tap to speak",
                    fontSize = 9.sp,
                    color = SecondaryText
                )
            }
        }
    }
}

@Composable
private fun TransmissionStatusBar(uiState: CommunicationUiState) {
    val (statusMsg, statusColor) = when {
        uiState.commState == CommState.LISTENING -> "Listening…" to PrimaryBrandGreen
        uiState.commState == CommState.PROCESSING -> "Processing message…" to TechnicalCyan
        uiState.commState == CommState.TRANSMITTING -> "Sending message…" to TechnicalCyan
        uiState.commState == CommState.SPEAKING -> "Playing received message…" to PrimaryBrandGreen
        uiState.linkStatus == LinkStatus.CONNECTED -> "Connected to ${uiState.activePeerName ?: "field unit"}" to PrimaryBrandGreen
        uiState.linkStatus == LinkStatus.CONNECTING -> "Connecting…" to Color(0xFFFFB300)
        uiState.linkStatus == LinkStatus.DISCOVERING -> "Searching for field units…" to Color(0xFFFFB300)
        else -> "Not connected" to MutedText
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .background(statusColor, CircleShape)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = statusMsg.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = statusColor
        )
    }
}

// ============================================================================
// PEER DISCOVERY DIALOG
// ============================================================================

@Composable
private fun PeerDiscoveryDialog(
    uiState: CommunicationUiState,
    viewModel: CommunicationViewModel,
    onScanClick: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CardSurface,
        titleContentColor = PrimaryText,
        textContentColor = SecondaryText,
        title = {
            Text(
                stringResource(id = R.string.nearby_field_units),
                fontFamily = FontFamily.Monospace,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Discovered: ${uiState.discoveredPeers.size}",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = SecondaryText
                    )
                    TextButton(onClick = onScanClick) {
                        Text(stringResource(id = R.string.scan), fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = TechnicalCyan)
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = BorderColor)

                if (uiState.discoveredPeers.isEmpty()) {
                    Text(
                        stringResource(id = R.string.no_nearby_units_desc),
                        fontSize = 11.sp,
                        color = SecondaryText
                    )
                } else {
                    LazyColumn(modifier = Modifier.heightIn(max = 240.dp)) {
                        items(uiState.discoveredPeers) { peer ->
                            val isConnectedPeer = uiState.activePeerName == peer.deviceName

                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                shape = RoundedCornerShape(4.dp),
                                color = HeaderBackground,
                                border = BorderStroke(
                                    1.dp,
                                    if (isConnectedPeer) PrimaryBrandGreen else BorderColor
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(
                                            peer.deviceName,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            fontFamily = FontFamily.Monospace,
                                            color = PrimaryText
                                        )
                                        Text(
                                            if (isConnectedPeer) "Connected" else "Field unit",
                                            fontSize = 10.sp,
                                            color = SecondaryText
                                        )
                                    }

                                    if (isConnectedPeer) {
                                        TextButton(onClick = { viewModel.disconnectPeer() }) {
                                            Text(stringResource(id = R.string.disconnect), fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = ErrorEmergencyRed)
                                        }
                                    } else {
                                        Button(
                                            onClick = {
                                                viewModel.connectPeer(peer)
                                                onDismiss()
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBrandGreen),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(stringResource(id = R.string.connect), fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = TextOnBrandGreen)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(id = R.string.close), fontFamily = FontFamily.Monospace, color = SecondaryText)
            }
        }
    )
}

@Preview(showBackground = true)
@Composable
fun CommunicationScreenPreview() {
    ITantraUITheme {
        CommunicationScreen()
    }
}
