package org.polarisos.field

import android.app.Application
import org.polarisos.field.data.FieldRepository

class PolarisFieldApp : Application(), org.polarisos.field.data.PolarisAppAccessor {
    lateinit var repository: FieldRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = FieldRepository(this)
    }

    override fun fieldRepository(): FieldRepository = repository
}
