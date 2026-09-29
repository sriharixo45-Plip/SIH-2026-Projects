# Phase 3 Recovery Status

## Diagnosis and recovery change

The Phase 2 record identifies the working English setup as upstream whisper.cpp with `ggml-tiny.en.bin`, mono 16 kHz PCM16 from AudioRecord, the existing Silero streaming VAD, and PCM16-to-float normalization before JNI. Phase 3 replaced the English-only model with `ggml-tiny.bin` and began passing a selected language string through JNI. The Phase 3 device record then reports `[BLANK_AUDIO]` for English. The available project does not contain Git metadata or the Phase 2 source snapshot, so a commit-level diff is unavailable. The preserved Phase 2 report and actual JNI/Kotlin source confirm that the key English configuration regression was replacing the known-working English-only model with multilingual tiny.

English now selects the checksum-verified `ggml-tiny.en.bin` and explicitly requests `en`; non-English languages continue to select `ggml-tiny.bin` and their selected language code. The provision script validates and installs both separate models. Context reuse tracks the loaded model path and reloads when switching between English and multilingual STT. AudioRecord/VAD segment sizes and Whisper model/language/sample diagnostics are logged.

Both model artifacts in the host cache were verified against the recorded upstream SHA-1 values:

- `ggml-tiny.en.bin`: `c78c86eb1a8faa21b369bcd33207cc90d64ae9df`
- `ggml-tiny.bin`: `bd577a113a864445d4c299885e0cb97d4ba92b5f`

## Physical-device validation

Device: OPPO CPH2767, serial `3C15CA000GT00000`. The rebuilt APK was installed and both models were provisioned. The UI was switched to English and microphone capture started. It remained in VAD-detecting state and displayed a 0% microphone level during observation. No human-spoken phrase was received, so the English human speech result is **NOT VALIDATED**. Offline English and Tamil speech tests were not performed. Tamil was not tested because English did not pass first. No STT or TTS language is claimed as newly validated by this recovery.

The user must speak “This is an offline English communication test.” near the connected phone to complete Test A. Then disable Wi-Fi and mobile data and repeat to complete Test B. Test C (human Tamil phrase, requiring Tamil script output) remains gated on a passing Test A.

## Checks and builds

- `adb devices`: one online Android device.
- `.\gradlew testDebugUnitTest`: PASS.
- `.\gradlew assembleDebug`: PASS.
- APK: `app/build/outputs/apk/debug/app-debug.apk`.
- Transport implementation files were not edited for this recovery. Wi-Fi Direct, TCP, MessagePacket, ProtocolFrame, GZIP, and AES-256-GCM are preserved.

## Remaining work

- Obtain actual human English transcription on the device and repeat with Wi-Fi and mobile data disabled.
- Only after English passes, test actual human Tamil speech and confirm meaningful Tamil-script transcription offline.
- If Tamil remains unreliable with multilingual Whisper, assess the gated AI4Bharat IndicConformer model/runtime against the target device before implementing it.
- Test the speech text through the existing two-device transport path and validate spoken TTS output when a peer/device is available.
- Do not claim ten-language offline STT/TTS support based on language registry entries or Android voice availability.
