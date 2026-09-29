package com.polaris.field

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.polaris.field.navigation.PolarisNavGraph
import com.polaris.field.ui.MainViewModel
import com.polaris.field.ui.theme.POLARISFieldTheme
import com.polaris.field.sync.SyncScheduler

class MainActivity : ComponentActivity() {
    private val mainViewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SyncScheduler.schedulePeriodic(this)
        SyncScheduler.requestNow(this)
        setContent {
            val isDarkMode by mainViewModel.isDarkModeFlow.collectAsState(initial = true)
            POLARISFieldTheme(darkTheme = isDarkMode) {
                PolarisNavGraph(viewModel = mainViewModel)
            }
        }
    }
}
