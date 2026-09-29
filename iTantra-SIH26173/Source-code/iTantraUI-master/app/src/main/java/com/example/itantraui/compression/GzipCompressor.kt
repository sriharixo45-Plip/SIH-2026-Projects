package com.example.itantraui.compression

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * Lightweight GZIP compressor using Android/Java standard libraries (`java.util.zip`).
 *
 * Optimized for low memory footprints:
 * - Uses small 512-byte stream buffers to avoid spikes in heap memory.
 * - Releases stream resources immediately after use.
 */
class GzipCompressor : Compressor {

    override fun compress(data: ByteArray): ByteArray {
        if (data.isEmpty()) return data
        val baos = ByteArrayOutputStream(data.size)
        GZIPOutputStream(baos, STREAM_BUFFER_SIZE).use { gzipOut ->
            gzipOut.write(data)
            gzipOut.finish()
        }
        return baos.toByteArray()
    }

    override fun decompress(compressedData: ByteArray): ByteArray {
        if (compressedData.isEmpty()) return compressedData
        val bais = ByteArrayInputStream(compressedData)
        val baos = ByteArrayOutputStream()
        GZIPInputStream(bais, STREAM_BUFFER_SIZE).use { gzipIn ->
            val buffer = ByteArray(STREAM_BUFFER_SIZE)
            var bytesRead: Int
            while (gzipIn.read(buffer).also { bytesRead = it } != -1) {
                baos.write(buffer, 0, bytesRead)
            }
        }
        return baos.toByteArray()
    }

    companion object {
        private const val STREAM_BUFFER_SIZE = 512
    }
}
