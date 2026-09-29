package com.polaris.field.data.remote.dto

data class LoginRequestDto(
    val employee_code: String,
    val password: String
)

data class LoginResponseDto(
    val access_token: String,
    val refresh_token: String,
    val user: UserDto
)

data class RefreshTokenRequestDto(
    val refresh_token: String
)

data class RefreshTokenResponseDto(
    val access_token: String,
    val refresh_token: String
)

data class UserDto(
    val user_id: String,
    val employee_code: String,
    val full_name: String,
    val email: String,
    val role: String?,
    val station_code: String?,
    val station_id: String?
)
