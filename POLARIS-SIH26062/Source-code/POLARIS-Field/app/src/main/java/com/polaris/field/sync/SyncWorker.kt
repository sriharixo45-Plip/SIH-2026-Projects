package com.polaris.field.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.polaris.field.data.local.database.PolarisDatabase
import com.polaris.field.data.remote.api.PolarisApiService
import com.polaris.field.auth.SessionManager
import com.polaris.field.data.remote.api.ApiClient

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val sessionManager = SessionManager(applicationContext)
            val apiService = ApiClient.getApiService(sessionManager)
            val db = PolarisDatabase.getInstance(applicationContext)
            val syncManager = SyncManager(applicationContext, apiService, db, sessionManager)
            if (syncManager.processPendingOperations().isSuccess) Result.success() else Result.retry()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
