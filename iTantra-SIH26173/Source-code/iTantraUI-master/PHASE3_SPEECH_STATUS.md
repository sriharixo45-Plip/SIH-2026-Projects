# iTantra Phase 3 speech expansion status

## Implemented speech architecture

- `LanguageConfig` is the single registry for English and the nine requested Indic languages. Each entry carries its BCP-47 language code, display/native names, locale, and STT/TTS provider identifiers.
- One reusable upstream whisper.cpp Android context handles speech recognition. The Android/Kotlin/JNI boundary now passes the selected language code into `whisper_full`; it no longer hardcodes English. Each capture is decoded with the language selected when capture began. The context is created lazily and inference is serialized on a background dispatcher.
- The existing Silero ONNX VAD and 16 kHz `AudioRecord` path are reused. The existing Android `TextToSpeech` engine chooses only voices whose Android `Voice.isNetworkConnectionRequired` is false. It reports per-language local voice availability from the installed engine.
- The language row now displays per-language STT/TTS status. A provisioned model is shown as **NOT VERIFIED** in the app until this build has reliable language-specific evidence; local system voices are shown as available only when Android reports an offline voice.
- Speech remains text at the existing message boundary. The language display name is stored in the existing `MessagePacket`; the existing GZIP, AES-GCM, `ProtocolFrame`, Wi-Fi Direct, and TCP code was not changed.

## Runtime/model

- STT runtime: upstream whisper.cpp Android JNI, with the small native change to accept the selected language code.
- Model: official `ggml-tiny.bin` multilingual Whisper model, about 75 MiB, unquantized F16 weights. The official whisper.cpp registry marks models without `.en` as multilingual; the bundled whisper.cpp language table includes `en`, `hi`, `bn`, `ta`, `te`, `ml`, `kn`, `mr`, `gu`, and `pa`.
- The model is outside the APK at `/sdcard/Android/data/com.example.itantraui/files/models/ggml-tiny.bin`. Host cache: `%LOCALAPPDATA%\iTantra\models\ggml-tiny.bin`. `tools/provision_whisper_model.ps1` verifies upstream SHA-1 `bd577a113a864445d4c299885e0cb97d4ba92b5f` before provisioning. The app verifies the checksum before loading. Inference does not make network calls.
- One model is reused for all languages; language switching changes the decode code, not the model/context. VAD/STT work is off the UI thread. No additional runtime was added.
- IndicConformer was assessed as an alternative, but its official current multilingual checkpoint is a gated 600M-parameter model with non-trivial ONNX/pre/post-processing requirements. No verified Android-ready, freely provisionable runtime package for all nine requested languages was available in the project. The integrated tiny Whisper model was selected as the practical offline fallback, but its device transcription tests below are not good enough to claim Indic language support.

## Physical device and offline test results

Device: OPPO CPH2213, Android 13, arm64. One physical device was attached. Wi-Fi and mobile data were disabled during Hindi, Tamil, and Telugu microphone/VAD/Whisper attempts, then restored. The app loaded the model and invoked whisper.cpp offline. Tests used the app's local Android TTS speaker-test phrases played through the physical speaker and captured by the phone microphone; they were not human-spoken phrases.

| Language | STT | TTS voice | Offline inference | Physical speech result | End-to-end |
|---|---|---|---|---|---|
| English | FAIL | AVAILABLE locally | PASS (model ran offline) | `[BLANK_AUDIO]` during this build's speaker-loopback regression; earlier Phase 2 tiny.en result does not validate the replaced model | NOT TESTED |
| Hindi | FAIL | AVAILABLE locally | PASS (model ran offline) | `speaker by nature, speaker kaktada hai.`; inaccurate and romanized | NOT TESTED |
| Bengali | NOT TESTED | AVAILABLE locally | NOT TESTED | NOT TESTED | NOT TESTED |
| Tamil | FAIL | AVAILABLE locally | PASS (model ran offline) | `காண்டியாகச் செய்வில்லை.`; Tamil script but not a reliable match to the test phrase | NOT TESTED |
| Telugu | FAIL | AVAILABLE locally | PASS (model ran offline) | Returned Tamil-script text for a Telugu-selected test | NOT TESTED |
| Malayalam | NOT TESTED | AVAILABLE locally | NOT TESTED | NOT TESTED | NOT TESTED |
| Kannada | NOT TESTED | AVAILABLE locally | NOT TESTED | NOT TESTED | NOT TESTED |
| Marathi | NOT TESTED | AVAILABLE locally | NOT TESTED | NOT TESTED | NOT TESTED |
| Gujarati | NOT TESTED | AVAILABLE locally | NOT TESTED | NOT TESTED | NOT TESTED |
| Punjabi | NOT TESTED | AVAILABLE locally | NOT TESTED | NOT TESTED | NOT TESTED |

Android reported a local, non-network-required TTS voice for each of the ten language codes on this phone. Hindi, Tamil, and Telugu speaker-test output was acoustically captured during their microphone runs; the other language voice availability is the Android engine's local-voice report and was not separately auditioned. Another device may have a different voice inventory.

The selected-language packet reached the existing message preparation/transport call, which rejected sending because there was no connected peer. A second phone was not available, so transport receive, Unicode delivery to another device, receiver TTS, and two-device end-to-end speech are **NOT TESTED**. The unit test added for this phase does verify all eight Indic scripts survive MessagePacket, GZIP, AES-GCM, and ProtocolFrame encode/decode unchanged.

## Build

- `.\gradlew testDebugUnitTest`: PASS.
- `.\gradlew assembleDebug`: PASS.
- APK: `app/build/outputs/apk/debug/app-debug.apk` (arm64-v8a prototype build).
- APK model payload: none; the Whisper model stays in app-specific external storage.

## Regression and remaining work

- Wi-Fi Direct/TCP, connection state, MessagePacket, ProtocolFrame, compression, and AES-GCM source were preserved.
- English regression against the multilingual model: failed to return speech text in the device speaker-loopback attempt. The existing Phase 2 English result was with `tiny.en`, so it is not evidence for the new model.
- Phase 3 is **not complete**. Replace or improve the Indic STT backend, validate each language with human speech and Unicode script output offline, repeat English against the new model, and test all TTS voices. Then use two physical devices to verify same-language encrypted send/receive/TTS. No Phase 4 work was started.

## References

- [whisper.cpp model registry](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md)
- [whisper.cpp Android example](https://github.com/ggml-org/whisper.cpp/tree/master/examples/whisper.android)
- [whisper.cpp language table](https://github.com/ggml-org/whisper.cpp/blob/master/src/whisper.cpp)
- [AI4Bharat IndicConformer multilingual model card](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual)
- [Android TextToSpeech Voice API](https://developer.android.com/reference/android/speech/tts/Voice)
