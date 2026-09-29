# Phase 2: English offline speech status (historical)

> This records the Phase 2 validation using `ggml-tiny.en.bin`. Phase 3 replaced that runtime model with multilingual `ggml-tiny.bin` and changed the Whisper JNI language selection. See [PHASE3_SPEECH_STATUS.md](PHASE3_SPEECH_STATUS.md) for current behavior and test results. The Phase 2 English device result does not count as validation of the Phase 3 model.

## Implemented

- **Capture:** Android `AudioRecord`, mono 16 kHz PCM16; capture and VAD inference run on an IO coroutine.
- **VAD:** Silero VAD ONNX, pinned from `snakers4/silero-vad` commit `5cd7945676eb32225748052e2e6a0580e4686a08`. The 2,327,524-byte `silero_vad.onnx` model is packaged in `app/src/main/assets/models`. ONNX Runtime Android 1.28.0 runs on CPU with one intra/inter-op thread. The adapter retains the model's 64-sample context and 2×1×128 recurrent state between 512-sample windows; speech threshold is 0.5 and segments close after 800 ms of silence, with a 20-second cap.
- **STT:** Upstream whisper.cpp Android library/JNI, pinned at commit `d09f61a708f3487afa956ff578e60eae5e7a233c`, with the English-only `ggml-tiny.en.bin` model. It accepts the captured PCM16 samples, normalizes to float, and returns actual English transcript text. Inference and model initialization run off the main thread; the Whisper context is reused.
- **Provisioning:** The 77,704,715-byte Whisper model stays out of the APK and is copied to app-specific external storage. Run `tools/provision_whisper_model.ps1` on a host with internet and one connected device. The script downloads the upstream `tiny.en` artifact and checks its published SHA-1 (`c78c86eb1a8faa21b369bcd33207cc90d64ae9df`) before `adb push`. The app verifies the checksum again before loading. After provisioning, inference does not use the network.
- **TTS:** Existing `OfflineTtsEngine`/Android `TextToSpeech` wrapper; the phone reported a local English voice. No duplicate TTS implementation was added.
- **Messaging:** Actual transcript text is displayed as **Your Speech** and passed to the existing `processAndPrepareMessage` path with language English. It uses the existing `MessagePacket`, GZIP, AES-GCM, `ProtocolFrame`, and configured `Transport`. Incoming decoded text continues to update the received-message UI and use the existing TTS engine.
- **States/UI:** Existing screen shows the current speech pipeline state and transcription. No major redesign was made.

## Device and model test results

- Device: OPPO CPH2213, `arm64-v8a`; one physical device detected.
- Silero ONNX was loaded on the device. A local 16 kHz speech fixture also produced a 0.99996 peak speech probability in ONNX Runtime.
- On-device microphone capture ran with VAD. For the repeatable speech input, the app's local English TTS speaker-test phrase was played through the physical speaker and captured acoustically through the microphone; Whisper produced actual text, including **“The speaker is working.”** A separate live human-spoken phrase was not tested.
- Repeated transcription with Wi-Fi off and mobile data disabled; the same phrase was recognized. Mobile data was restored afterward. The model/runtime perform inference locally.
- The existing Wi-Fi Direct transport reported no connected peer, so it did not send the transcription to another device. Only one device was attached; the receiving phone path and two-device TTS were not physically tested.
- Physical TTS speaker output is supported by the on-device speaker-to-microphone loopback producing the recognized spoken phrase. The receiver's `MessagePacket → TtsEngine` code path was not exercised over a real connection.

## Build

- `.\gradlew testDebugUnitTest`: PASS
- `.\gradlew assembleDebug`: PASS
- APK: `app/build/outputs/apk/debug/app-debug.apk` (built for the connected arm64 prototype device)

## Remaining Phase 2 verification

Only a second physical Android device and a connected Wi-Fi Direct peer are missing to verify actual encrypted delivery, receive/decode, received-text UI, and receiver TTS end to end. No Phase 3 language models are included.

Upstream references: [whisper.cpp Android example](https://github.com/ggml-org/whisper.cpp/tree/master/examples/whisper.android), [official Whisper model registry](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md), [Silero VAD model](https://github.com/snakers4/silero-vad/tree/5cd7945676eb32225748052e2e6a0580e4686a08/src/silero_vad/data), [ONNX Runtime Android](https://onnxruntime.ai/docs/build/android.html).
