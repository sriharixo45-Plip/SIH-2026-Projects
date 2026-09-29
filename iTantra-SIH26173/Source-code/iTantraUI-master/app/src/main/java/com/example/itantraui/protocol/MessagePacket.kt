package com.example.itantraui.protocol

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream

/**
 * Lightweight domain model representing a text message packet in iTantra.
 *
 * Design constraints for low-end devices:
 * - Direct binary serialization using DataOutputStream/DataInputStream to avoid JSON library overhead/reflection.
 * - Minimal fields and short UTF-8 byte encodings.
 */
data class MessagePacket(
    val messageId: String,
    val senderId: String,
    val text: String,
    val language: String,
    val isEmergency: Boolean,
    val timestamp: Long = System.currentTimeMillis()
) {
    /**
     * Serializes this MessagePacket into a compact binary byte array.
     */
    fun toByteArray(): ByteArray {
        val baos = ByteArrayOutputStream()
        DataOutputStream(baos).use { out ->
            out.writeUTF(messageId)
            out.writeUTF(senderId)
            out.writeUTF(text)
            out.writeUTF(language)
            out.writeBoolean(isEmergency)
            out.writeLong(timestamp)
        }
        return baos.toByteArray()
    }

    companion object {
        /**
         * Deserializes a MessagePacket from a compact binary byte array.
         */
        fun fromByteArray(bytes: ByteArray): MessagePacket {
            DataInputStream(ByteArrayInputStream(bytes)).use { input ->
                val messageId = input.readUTF()
                val senderId = input.readUTF()
                val text = input.readUTF()
                val language = input.readUTF()
                val isEmergency = input.readBoolean()
                val timestamp = input.readLong()
                return MessagePacket(
                    messageId = messageId,
                    senderId = senderId,
                    text = text,
                    language = language,
                    isEmergency = isEmergency,
                    timestamp = timestamp
                )
            }
        }
    }
}
