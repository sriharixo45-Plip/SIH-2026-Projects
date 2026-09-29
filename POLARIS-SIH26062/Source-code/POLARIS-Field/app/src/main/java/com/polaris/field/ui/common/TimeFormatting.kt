package com.polaris.field.ui.common

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val fieldDateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy · h:mm a", Locale.ENGLISH)

fun formatFieldDateTime(raw: String?): String {
    if (raw.isNullOrBlank()) return "Time unavailable"
    return runCatching {
        val instant = raw.toLongOrNull()?.let(Instant::ofEpochMilli) ?: Instant.parse(raw)
        fieldDateTimeFormatter.format(instant.atZone(ZoneId.systemDefault()))
    }.getOrElse { raw }
}
