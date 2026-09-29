package com.example.itantraui.ui.language

import android.content.Context
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import java.util.Locale

enum class AppLanguage(val code: String, val displayName: String, val nativeName: String) {
    ENGLISH("en", "English", "English"),
    TAMIL("ta", "Tamil", "தமிழ்"),
    HINDI("hi", "Hindi", "हिन्दी"),
    MALAYALAM("ml", "Malayalam", "മലയാളം"),
    KANNADA("kn", "Kannada", "ಕನ್ನಡ"),
    TELUGU("te", "Telugu", "తెలుగు"),
    MARATHI("mr", "Marathi", "मराठी"),
    GUJARATI("gu", "Gujarati", "ગુજરાતી");

    companion object {
        fun fromCode(code: String): AppLanguage {
            return entries.find { it.code.equals(code, ignoreCase = true) } ?: ENGLISH
        }
    }
}

object AppLanguageManager {
    private const val PREFS_NAME = "itantra_settings"
    private const val KEY_APP_LANGUAGE = "app_language"

    private val _currentLanguage = mutableStateOf(AppLanguage.ENGLISH)
    val currentLanguage: State<AppLanguage> = _currentLanguage

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedCode = prefs.getString(KEY_APP_LANGUAGE, AppLanguage.ENGLISH.code) ?: AppLanguage.ENGLISH.code
        val lang = AppLanguage.fromCode(savedCode)
        _currentLanguage.value = lang
    }

    fun setAppLanguage(context: Context, language: AppLanguage) {
        _currentLanguage.value = language
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_APP_LANGUAGE, language.code).apply()
    }

    fun getLocalizedContext(context: Context, language: AppLanguage): Context {
        val locale = Locale(language.code)
        Locale.setDefault(locale)
        val config = context.resources.configuration
        config.setLocale(locale)
        return context.createConfigurationContext(config)
    }
}
