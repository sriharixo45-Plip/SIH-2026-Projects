package com.example.itantraui.compression

/**
 * Interface for lightweight data compression and decompression.
 */
interface Compressor {
    /**
     * Compresses raw bytes.
     */
    fun compress(data: ByteArray): ByteArray

    /**
     * Decompresses compressed bytes.
     */
    fun decompress(compressedData: ByteArray): ByteArray
}
