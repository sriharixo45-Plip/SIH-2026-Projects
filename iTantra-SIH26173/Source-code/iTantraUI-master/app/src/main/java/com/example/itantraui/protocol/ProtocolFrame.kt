package com.example.itantraui.protocol

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Compact Wire Frame for iTantra network payload transmission.
 *
 * Binary Frame Format (10-byte header + payload):
 * - Byte 0: Magic Header (0x54 = 'T')
 * - Byte 1: Protocol Version (0x01)
 * - Byte 2: Flags Bitmask (Bit 0: IsEmergency, Bit 1: IsCompressed, Bit 2: IsEncrypted)
 * - Bytes 3-6: Payload Length (Int - 4 bytes)
 * - Bytes 7-9: Reserved/Checksum space (3 bytes)
 * - Bytes 10..N: Payload Bytes
 *
 * Optimized for low-end devices:
 * - Total fixed header overhead is only 10 bytes.
 * - Zero JSON string parsing or reflection overhead.
 */
data class ProtocolFrame(
    val isEmergency: Boolean,
    val isCompressed: Boolean,
    val isEncrypted: Boolean,
    val payload: ByteArray
) {
    fun toWireBytes(): ByteArray {
        val headerSize = 10
        val buffer = ByteBuffer.allocate(headerSize + payload.size).order(ByteOrder.BIG_ENDIAN)

        buffer.put(MAGIC_BYTE)
        buffer.put(PROTOCOL_VERSION)

        var flags = 0
        if (isEmergency) flags = flags or FLAG_EMERGENCY
        if (isCompressed) flags = flags or FLAG_COMPRESSED
        if (isEncrypted) flags = flags or FLAG_ENCRYPTED
        buffer.put(flags.toByte())

        buffer.putInt(payload.size)
        // 3 bytes reserved
        buffer.put(0.toByte())
        buffer.put(0.toByte())
        buffer.put(0.toByte())

        buffer.put(payload)
        return buffer.array()
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as ProtocolFrame

        if (isEmergency != other.isEmergency) return false
        if (isCompressed != other.isCompressed) return false
        if (isEncrypted != other.isEncrypted) return false
        if (!payload.contentEquals(other.payload)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = isEmergency.hashCode()
        result = 31 * result + isCompressed.hashCode()
        result = 31 * result + isEncrypted.hashCode()
        result = 31 * result + payload.contentHashCode()
        return result
    }

    companion object {
        private const val MAGIC_BYTE: Byte = 0x54 // 'T' for Tantra
        private const val PROTOCOL_VERSION: Byte = 0x01

        private const val FLAG_EMERGENCY = 0x01
        private const val FLAG_COMPRESSED = 0x02
        private const val FLAG_ENCRYPTED = 0x04

        fun fromWireBytes(bytes: ByteArray): ProtocolFrame {
            require(bytes.size >= 10) { "Invalid frame: byte array shorter than header length (10 bytes)" }
            val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)

            val magic = buffer.get()
            require(magic == MAGIC_BYTE) { "Invalid frame magic header: 0x${Integer.toHexString(magic.toInt() and 0xFF)}" }

            val version = buffer.get()
            require(version == PROTOCOL_VERSION) { "Unsupported protocol version: $version" }

            val flags = buffer.get().toInt()
            val isEmergency = (flags and FLAG_EMERGENCY) != 0
            val isCompressed = (flags and FLAG_COMPRESSED) != 0
            val isEncrypted = (flags and FLAG_ENCRYPTED) != 0

            val payloadSize = buffer.int
            require(payloadSize >= 0 && payloadSize <= bytes.size - 10) { "Invalid payload length in header: $payloadSize" }

            // Skip 3 reserved bytes
            buffer.get()
            buffer.get()
            buffer.get()

            val payload = ByteArray(payloadSize)
            buffer.get(payload)

            return ProtocolFrame(
                isEmergency = isEmergency,
                isCompressed = isCompressed,
                isEncrypted = isEncrypted,
                payload = payload
            )
        }
    }
}
