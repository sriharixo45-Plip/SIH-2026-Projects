package com.example.itantraui

import com.example.itantraui.compression.GzipCompressor
import com.example.itantraui.protocol.MessagePacket
import com.example.itantraui.protocol.ProtocolFrame
import com.example.itantraui.security.AesCryptoEngine
import com.example.itantraui.voice.LanguageConfig
import org.junit.Assert.*
import org.junit.Test

class PipelineUnitTest {

    @Test
    fun requiredSpeechLanguageRegistryUsesWhisperLanguageCodes() {
        val expected = listOf("hi", "gu", "mr", "kn", "ml", "ta", "te", "or", "bn", "en")

        assertEquals(expected.toSet(), LanguageConfig.SUPPORTED_LANGUAGES.map { it.languageCode }.toSet())
        assertEquals(expected.size, LanguageConfig.SUPPORTED_LANGUAGES.size)
        expected.forEach { code ->
            assertEquals(code, LanguageConfig.fromCode(code)?.languageCode)
        }
        assertEquals("Odia", LanguageConfig.fromCode("or")?.displayName)
        assertNull(LanguageConfig.fromCode("pa"))
    }

    @Test
    fun testMessagePacketSerialization() {
        val packet = MessagePacket(
            messageId = "msg_001",
            senderId = "unit_alpha",
            text = "Need medical assistance at sector 4.",
            language = "English",
            isEmergency = true
        )

        val bytes = packet.toByteArray()
        val restored = MessagePacket.fromByteArray(bytes)

        assertEquals(packet.messageId, restored.messageId)
        assertEquals(packet.senderId, restored.senderId)
        assertEquals(packet.text, restored.text)
        assertEquals(packet.language, restored.language)
        assertEquals(packet.isEmergency, restored.isEmergency)
    }

    @Test
    fun testGzipCompression() {
        val compressor = GzipCompressor()
        val originalText = "Need medical assistance at sector 4. Emergency response requested immediately."
        val originalBytes = originalText.toByteArray(Charsets.UTF_8)

        val compressed = compressor.compress(originalBytes)
        val decompressed = compressor.decompress(compressed)

        assertArrayEquals(originalBytes, decompressed)
        assertEquals(originalText, String(decompressed, Charsets.UTF_8))
    }

    @Test
    fun testAesEncryptionDecryption() {
        val crypto = AesCryptoEngine()
        val key = ByteArray(32) { 0x42.toByte() } // 256-bit test key
        val plainTextBytes = "Secret iTantra payload".toByteArray(Charsets.UTF_8)

        val encrypted = crypto.encrypt(plainTextBytes, key)
        assertFalse(plainTextBytes.contentEquals(encrypted))

        val decrypted = crypto.decrypt(encrypted, key)
        assertArrayEquals(plainTextBytes, decrypted)
    }

    @Test
    fun testEndToEndProtocolPipeline() {
        val compressor = GzipCompressor()
        val crypto = AesCryptoEngine()
        val key = ByteArray(32) { 0x01.toByte() }

        // 1. Create original packet
        val packet = MessagePacket(
            messageId = "test_123",
            senderId = "Field_Unit_02",
            text = "Namaste! Field operational status green.",
            language = "Hindi",
            isEmergency = false
        )

        // 2. Serialize -> Compress -> Encrypt
        val packetBytes = packet.toByteArray()
        val compressedBytes = compressor.compress(packetBytes)
        val encryptedBytes = crypto.encrypt(compressedBytes, key)

        // 3. Wrap into binary Wire Frame
        val frame = ProtocolFrame(
            isEmergency = packet.isEmergency,
            isCompressed = true,
            isEncrypted = true,
            payload = encryptedBytes
        )

        val wireBytes = frame.toWireBytes()

        // 4. Unpack Wire Frame -> Decrypt -> Decompress -> Deserialize
        val restoredFrame = ProtocolFrame.fromWireBytes(wireBytes)
        assertEquals(frame.isEmergency, restoredFrame.isEmergency)
        assertEquals(frame.isCompressed, restoredFrame.isCompressed)
        assertEquals(frame.isEncrypted, restoredFrame.isEncrypted)

        val decryptedBytes = crypto.decrypt(restoredFrame.payload, key)
        val decompressedBytes = compressor.decompress(decryptedBytes)
        val restoredPacket = MessagePacket.fromByteArray(decompressedBytes)

        assertEquals(packet.messageId, restoredPacket.messageId)
        assertEquals(packet.senderId, restoredPacket.senderId)
        assertEquals(packet.text, restoredPacket.text)
        assertEquals(packet.language, restoredPacket.language)
        assertEquals(packet.isEmergency, restoredPacket.isEmergency)
    }

    @Test
    fun testAllTargetScriptsSurvivePacketCompressionEncryptionAndFrameRoundTrip() {
        val scripts = listOf(
            "नमस्ते, संदेश सुरक्षित है।",       // Hindi / Marathi
            "বাংলা বার্তা অক্ষত আছে।",          // Bengali
            "தமிழ் செய்தி சரியாக உள்ளது।",      // Tamil
            "తెలుగు సందేశం సరిగ్గా ఉంది।",      // Telugu
            "മലയാളം സന്ദേശം ശരിയാണ്।",         // Malayalam
            "ಕನ್ನಡ ಸಂದೇಶ ಸರಿಯಾಗಿದೆ।",           // Kannada
            "ગુજરાતી સંદેશો બરાબર છે।",         // Gujarati
            "ਪੰਜਾਬੀ ਸੁਨੇਹਾ ਠੀਕ ਹੈ।"             // Punjabi
        )
        val compressor = GzipCompressor()
        val crypto = AesCryptoEngine()
        val key = ByteArray(32) { 0x33.toByte() }

        scripts.forEachIndexed { index, text ->
            val packet = MessagePacket("unicode_$index", "test", text, "indic", false)
            val compressed = compressor.compress(packet.toByteArray())
            val encrypted = crypto.encrypt(compressed, key)
            val wire = ProtocolFrame(false, true, true, encrypted).toWireBytes()
            val receivedFrame = ProtocolFrame.fromWireBytes(wire)
            val restored = MessagePacket.fromByteArray(
                compressor.decompress(crypto.decrypt(receivedFrame.payload, key))
            )
            assertEquals(text, restored.text)
        }
    }
}
