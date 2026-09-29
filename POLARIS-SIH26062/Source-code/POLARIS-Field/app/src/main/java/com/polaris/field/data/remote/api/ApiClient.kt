package com.polaris.field.data.remote.api

import com.polaris.field.auth.SessionManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class AuthInterceptor(private val sessionManager: SessionManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val token = runBlocking { sessionManager.getAccessToken() }

        val requestBuilder = originalRequest.newBuilder()
        if (!token.isNullOrBlank() && !originalRequest.headers.names().contains("Authorization")) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}

object ApiClient {
    const val DEFAULT_BASE_URL: String = com.polaris.field.BuildConfig.POLARIS_API_BASE_URL

    fun getApiService(sessionManager: SessionManager): PolarisApiService {

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            redactHeader("Authorization")
            level = if (com.polaris.field.BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(sessionManager))
            .addInterceptor(EndpointInterceptor(sessionManager))
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl("https://endpoint.invalid/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PolarisApiService::class.java)
    }
}

private class EndpointInterceptor(private val sessionManager: SessionManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val configured = runBlocking { sessionManager.getApiBaseUrl() }.toHttpUrlOrNull()
            ?: throw java.io.IOException("The configured backend URL is invalid.")
        val request = chain.request()
        val configuredPrefix = configured.encodedPath.trimEnd('/')
        val rewrittenPath = "$configuredPrefix/${request.url.encodedPath.trimStart('/')}"
        val target = request.url.newBuilder()
            .scheme(configured.scheme)
            .host(configured.host)
            .port(configured.port)
            .encodedPath(rewrittenPath)
            .build()
        return chain.proceed(request.newBuilder().url(target).build())
    }
}
