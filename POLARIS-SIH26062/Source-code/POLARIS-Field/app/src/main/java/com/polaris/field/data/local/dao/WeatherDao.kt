package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.WeatherEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface WeatherDao {
    @Query("SELECT * FROM weather_events WHERE stationId = :stationId ORDER BY loggedAt DESC LIMIT 1")
    fun getLatestWeatherFlow(stationId: String): Flow<WeatherEntity?>

    @Query("SELECT * FROM weather_events ORDER BY loggedAt DESC")
    fun getAllWeatherFlow(): Flow<List<WeatherEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWeather(weather: WeatherEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWeatherList(weatherList: List<WeatherEntity>)
}






