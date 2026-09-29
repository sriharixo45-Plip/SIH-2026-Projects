package com.example.itantraui.voice

import java.util.Locale

enum class SttProvider { WHISPER_CPP_MULTILINGUAL }
enum class TtsProvider { ANDROID_SYSTEM_OFFLINE }

/** One entry in the app's speech-language registry. Registry membership is not availability. */
data class LanguageConfig(
    val languageCode: String,
    val displayName: String,
    val nativeName: String,
    val locale: Locale,
    val sttLocale: Locale,
    val ttsLocale: Locale,
    val sttProvider: SttProvider = SttProvider.WHISPER_CPP_MULTILINGUAL,
    val ttsProvider: TtsProvider = TtsProvider.ANDROID_SYSTEM_OFFLINE,
    val sampleRate: Int = 16000
) {
    companion object {
        val ENGLISH = config("en", "English", "English", "US")
        val HINDI = config("hi", "Hindi", "हिन्दी")
        val BENGALI = config("bn", "Bengali", "বাংলা")
        val TAMIL = config("ta", "Tamil", "தமிழ்")
        val TELUGU = config("te", "Telugu", "తెలుగు")
        val MALAYALAM = config("ml", "Malayalam", "മലയാളം")
        val KANNADA = config("kn", "Kannada", "ಕನ್ನಡ")
        val MARATHI = config("mr", "Marathi", "मराठी")
        val GUJARATI = config("gu", "Gujarati", "ગુજરાતી")
        val ODIA = config("or", "Odia", "ଓଡ଼ିଆ")

        val SUPPORTED_LANGUAGES = listOf(
            ENGLISH, HINDI, BENGALI, TAMIL, TELUGU, MALAYALAM,
            KANNADA, MARATHI, GUJARATI, ODIA
        )
        private val BY_CODE = SUPPORTED_LANGUAGES.associateBy { it.languageCode }

        private fun config(code: String, name: String, native: String, country: String = "IN"):
            LanguageConfig {
            val locale = Locale.Builder().setLanguage(code).setRegion(country).build()
            return LanguageConfig(code, name, native, locale, locale, locale)
        }

        fun fromLanguageName(name: String): LanguageConfig =
            SUPPORTED_LANGUAGES.firstOrNull {
                it.languageCode.equals(name, true) ||
                    it.displayName.equals(name, true) ||
                    it.nativeName.equals(name, true) ||
                    it.locale.toLanguageTag().equals(name, true)
            } ?: ENGLISH

        fun fromCode(code: String): LanguageConfig? = BY_CODE[code.lowercase(Locale.ROOT)]
    }
}
