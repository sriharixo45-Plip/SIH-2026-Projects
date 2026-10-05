package org.polarisos.field.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisErrorBanner
import org.polarisos.field.ui.components.PolarisIcons
import org.polarisos.field.ui.components.PolarisPrimaryButton
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun LoginScreen(
    repository: FieldRepository,
    busy: Boolean,
    message: String,
    isOnline: Boolean,
    onLogin: (String, String, String) -> Unit
) {
    var endpoint by remember { mutableStateOf(repository.session.endpoint) }
    var identity by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var showEndpointConfig by remember { mutableStateOf(endpoint.isBlank()) }
    val focusManager = LocalFocusManager.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.Navy950)
            .imePadding()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Polar Expedition Header Banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(PolarisColors.Navy900)
                .padding(top = 48.dp, bottom = 32.dp, start = 24.dp, end = 24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(PolarisColors.Navy800)
                        .border(2.dp, PolarisColors.PolarBlueLight, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    PolarisIcons.PolarisStar(size = 38.dp, color = PolarisColors.PolarBlueLight)
                }

                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "POLARIS-OS",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
                Text(
                    text = "ARCTIC FIELD OPERATIONS",
                    color = PolarisColors.PolarCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.5.sp
                )

                Spacer(modifier = Modifier.height(10.dp))
                // Network Status Indicator Badge
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(PolarisDimens.radiusPill))
                        .background(PolarisColors.Navy800)
                        .border(1.dp, PolarisColors.Navy600, RoundedCornerShape(PolarisDimens.radiusPill))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(if (isOnline) PolarisColors.StatusNominal else PolarisColors.StatusOffline)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isOnline) "FIELD TERMINAL ONLINE" else "OFFLINE MODE ACTIVE",
                        color = if (isOnline) PolarisColors.StatusNominal else PolarisColors.TextFaint,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        // Login Card Surface
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(PolarisDimens.radiusLg),
            colors = CardDefaults.cardColors(containerColor = PolarisColors.PolarSurface),
            elevation = CardDefaults.cardElevation(defaultElevation = PolarisDimens.elevationCard)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Operator Authentication",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextPrimary
                )
                Text(
                    text = "Authenticate once to synchronize station database. Operational records remain available offline after local sync.",
                    fontSize = 12.sp,
                    color = PolarisColors.TextMuted,
                    lineHeight = 17.sp
                )

                HorizontalDivider(color = PolarisColors.LineSubtle)

                // Server Endpoint Configuration Row / Input
                if (showEndpointConfig) {
                    PolarisTextField(
                        value = endpoint,
                        onValueChange = { endpoint = it },
                        label = "HQ Backend Server URL",
                        placeholder = "https://host:port/",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
                        leadingIcon = {
                            Text("🌐", fontSize = 14.sp)
                        }
                    )
                    Text(
                        text = "Accepts HTTP for local trusted base-station LAN; HTTPS required for satellite/WAN.",
                        fontSize = 11.sp,
                        color = PolarisColors.TextFaint
                    )
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(PolarisDimens.radiusSm))
                            .background(PolarisColors.PolarSurfaceAlt)
                            .border(1.dp, PolarisColors.LineLight, RoundedCornerShape(PolarisDimens.radiusSm))
                            .clickable { showEndpointConfig = true }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "BACKEND SERVER",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = PolarisColors.TextMuted,
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = endpoint.ifBlank { "No server configured" },
                                fontSize = 12.sp,
                                color = PolarisColors.TextPrimary,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 1
                            )
                        }
                        Text(
                            text = "EDIT",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = PolarisColors.PolarBlue
                        )
                    }
                }

                // Identity (Email or Employee Code)
                PolarisTextField(
                    value = identity,
                    onValueChange = { identity = it },
                    label = "Email or Employee ID",
                    placeholder = "e.g. operator@polaris.aq or EMP-042",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    leadingIcon = {
                        PolarisIcons.PersonnelBadge(size = 18.dp, color = PolarisColors.TextMuted)
                    }
                )

                // Password Input with Show/Hide Toggle
                PolarisTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Operational Password",
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        focusManager.clearFocus()
                        if (endpoint.isNotBlank() && identity.isNotBlank() && password.isNotBlank()) {
                            onLogin(endpoint, identity, password)
                        }
                    }),
                    leadingIcon = {
                        Text("🔒", fontSize = 14.sp)
                    },
                    trailingIcon = {
                        TextButton(onClick = { showPassword = !showPassword }) {
                            Text(
                                text = if (showPassword) "HIDE" else "SHOW",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = PolarisColors.PolarBlue
                            )
                        }
                    }
                )

                // Error Banner Feedback
                if (message.isNotBlank()) {
                    PolarisErrorBanner(message = message)
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Action Button
                PolarisPrimaryButton(
                    text = if (busy) "Authenticating & Synchronizing…" else "Sign In & Synchronize",
                    onClick = {
                        focusManager.clearFocus()
                        onLogin(endpoint, identity, password)
                    },
                    enabled = !busy && endpoint.isNotBlank() && identity.isNotBlank() && password.isNotBlank(),
                    loading = busy
                )

                Text(
                    text = "Device ID: ${repository.session.deviceId.take(8).uppercase()} • Room Encrypted",
                    fontSize = 10.sp,
                    color = PolarisColors.TextFaint,
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
