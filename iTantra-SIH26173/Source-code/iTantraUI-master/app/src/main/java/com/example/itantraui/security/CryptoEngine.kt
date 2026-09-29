package com.example.itantraui.security

/**
 * Interface for payload encryption and decryption.
 */
interface CryptoEngine {
    /**
     * Encrypts plaintext bytes using a symmetric key.
     */
    fun encrypt(plainText: ByteArray, secretKeyBytes: ByteArray): ByteArray

    /**
     * Decrypts ciphertext bytes using a symmetric key.
     */
    fun decrypt(cipherText: ByteArray, secretKeyBytes: ByteArray): ByteArray
}
