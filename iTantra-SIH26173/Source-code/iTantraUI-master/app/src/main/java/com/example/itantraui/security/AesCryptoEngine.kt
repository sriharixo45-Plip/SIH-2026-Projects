package com.example.itantraui.security

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * AES-256-GCM Authenticated Encryption Engine using standard Java `javax.crypto`.
 *
 * Security & Efficiency Features:
 * - AES/GCM/NoPadding provides both confidentiality and tamper protection (AEAD).
 * - Cryptographically secure 12-byte random IV prepended to ciphertext payload.
 * - Zero external library dependencies, maintaining tiny APK size and minimal RAM footprint.
 */
class AesCryptoEngine : CryptoEngine {

    private val secureRandom = SecureRandom()

    override fun encrypt(plainText: ByteArray, secretKeyBytes: ByteArray): ByteArray {
        require(secretKeyBytes.size == 16 || secretKeyBytes.size == 32) {
            "AES key must be 128-bit (16 bytes) or 256-bit (32 bytes)"
        }
        val iv = ByteArray(GCM_IV_LENGTH_BYTES)
        secureRandom.nextBytes(iv)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val keySpec = SecretKeySpec(secretKeyBytes, ALGORITHM)
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)

        val cipherBytes = cipher.doFinal(plainText)

        // Result format: [12 bytes IV] + [Ciphertext + Auth Tag]
        val result = ByteArray(GCM_IV_LENGTH_BYTES + cipherBytes.size)
        System.arraycopy(iv, 0, result, 0, GCM_IV_LENGTH_BYTES)
        System.arraycopy(cipherBytes, 0, result, GCM_IV_LENGTH_BYTES, cipherBytes.size)
        return result
    }

    override fun decrypt(cipherText: ByteArray, secretKeyBytes: ByteArray): ByteArray {
        require(cipherText.size > GCM_IV_LENGTH_BYTES) {
            "Ciphertext is too short to contain a valid IV and payload"
        }
        require(secretKeyBytes.size == 16 || secretKeyBytes.size == 32) {
            "AES key must be 128-bit (16 bytes) or 256-bit (32 bytes)"
        }

        val iv = ByteArray(GCM_IV_LENGTH_BYTES)
        System.arraycopy(cipherText, 0, iv, 0, GCM_IV_LENGTH_BYTES)

        val encryptedPayloadSize = cipherText.size - GCM_IV_LENGTH_BYTES
        val encryptedPayload = ByteArray(encryptedPayloadSize)
        System.arraycopy(cipherText, GCM_IV_LENGTH_BYTES, encryptedPayload, 0, encryptedPayloadSize)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val keySpec = SecretKeySpec(secretKeyBytes, ALGORITHM)
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)

        return cipher.doFinal(encryptedPayload)
    }

    companion object {
        private const val ALGORITHM = "AES"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH_BYTES = 12
        private const val GCM_TAG_LENGTH_BITS = 128
    }
}
