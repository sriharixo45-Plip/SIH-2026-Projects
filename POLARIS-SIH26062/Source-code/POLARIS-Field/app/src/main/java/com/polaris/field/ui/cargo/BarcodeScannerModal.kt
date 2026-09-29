package com.polaris.field.ui.cargo

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.polaris.field.scanner.BarcodeAnalyzer
import com.polaris.field.ui.theme.EnterpriseSurface
import com.polaris.field.ui.theme.PolarBlueAccent
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@Composable
fun BarcodeScannerModal(
    onDismiss: () -> Unit,
    onBarcodeScanned: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasCameraPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var permissionDenied by remember { mutableStateOf(false) }
    var scannedCode by remember { mutableStateOf<String?>(null) }
    var cameraError by remember { mutableStateOf<String?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    val cameraProviderState = rememberUpdatedState(cameraProvider)
    val scanCallbackState = rememberUpdatedState(onBarcodeScanned)
    val executor = remember { Executors.newSingleThreadExecutor() }
    val disposed = remember { AtomicBoolean(false) }
    val analyzer = remember {
        BarcodeAnalyzer { value ->
            scannedCode = value
            cameraProviderState.value?.unbindAll()
            scanCallbackState.value(value)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        permissionDenied = !granted
        cameraError = null
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    DisposableEffect(lifecycleOwner, context) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                hasCameraPermission = granted
                if (granted) permissionDenied = false
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    DisposableEffect(analyzer, executor) {
        onDispose {
            disposed.set(true)
            cameraProviderState.value?.unbindAll()
            analyzer.close()
            executor.shutdown()
        }
    }

    val activity = context as? Activity
    val openSettings = permissionDenied && activity != null &&
            !activity.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("CLOSE SCANNER", fontWeight = FontWeight.Bold, color = PolarBlueAccent)
            }
        },
        title = {
            Text("SCAN CARGO QR / BARCODE", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().height(320.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                when {
                    !hasCameraPermission -> {
                        Text(
                            "Camera access is required to scan cargo QR codes and barcodes.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(12.dp))
                        if (openSettings) {
                            Text("Camera permission is disabled. Enable it in Android app settings to continue.")
                            Spacer(Modifier.height(8.dp))
                            Button(onClick = {
                                context.startActivity(
                                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                        data = Uri.fromParts("package", context.packageName, null)
                                    }
                                )
                            }) { Text("OPEN APP SETTINGS") }
                        } else {
                            if (permissionDenied) {
                                Text("Allow camera access to show the live scanner preview.")
                                Spacer(Modifier.height(8.dp))
                            }
                            Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                                Text(if (permissionDenied) "RETRY PERMISSION" else "ALLOW CAMERA")
                            }
                        }
                    }
                    else -> {
                        scannedCode?.let { value ->
                            Text(
                                text = "Scanned: $value",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = PolarBlueAccent,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }
                        cameraError?.let { error ->
                            Text(error, color = MaterialTheme.colorScheme.error)
                        } ?: AndroidView(
                            factory = { ctx ->
                                val previewView = PreviewView(ctx).apply {
                                    scaleType = PreviewView.ScaleType.FILL_CENTER
                                }
                                val providerFuture = ProcessCameraProvider.getInstance(ctx)
                                providerFuture.addListener({
                                    if (disposed.get()) return@addListener
                                    try {
                                        val provider = providerFuture.get()
                                        cameraProvider = provider
                                        val preview = Preview.Builder().build().also {
                                            it.setSurfaceProvider(previewView.surfaceProvider)
                                        }
                                        val imageAnalysis = ImageAnalysis.Builder()
                                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                            .build()
                                            .also { it.setAnalyzer(executor, analyzer) }

                                        provider.unbindAll()
                                        provider.bindToLifecycle(
                                            lifecycleOwner,
                                            CameraSelector.DEFAULT_BACK_CAMERA,
                                            preview,
                                            imageAnalysis
                                        )
                                    } catch (error: Exception) {
                                        cameraError = "Unable to start the camera: ${error.localizedMessage ?: error.javaClass.simpleName}"
                                    }
                                }, ContextCompat.getMainExecutor(ctx))
                                previewView
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        },
        containerColor = EnterpriseSurface
    )
}
