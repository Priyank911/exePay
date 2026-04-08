package com.exepay.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "exepay_prefs")

class PreferencesManager(private val context: Context) {

    private val USER_ID = stringPreferencesKey("user_id")
    private val USER_EMAIL = stringPreferencesKey("user_email")
    private val USER_NAME = stringPreferencesKey("user_name")
    private val USER_AVATAR = stringPreferencesKey("user_avatar")
    private val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
    private val FCM_TOKEN = stringPreferencesKey("fcm_token")

    val isLoggedIn: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[IS_LOGGED_IN] ?: false
    }

    val userId: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_ID]
    }

    val userName: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_NAME]
    }

    val userEmail: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_EMAIL]
    }

    val userAvatar: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_AVATAR]
    }

    suspend fun saveUser(userId: String, email: String, name: String, avatarUrl: String? = null) {
        context.dataStore.edit { prefs ->
            prefs[USER_ID] = userId
            prefs[USER_EMAIL] = email
            prefs[USER_NAME] = name
            if (avatarUrl != null) {
                prefs[USER_AVATAR] = avatarUrl
            }
            prefs[IS_LOGGED_IN] = true
        }
    }

    suspend fun saveAvatar(avatarUrl: String) {
        context.dataStore.edit { prefs ->
            prefs[USER_AVATAR] = avatarUrl
        }
    }

    suspend fun saveFcmToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[FCM_TOKEN] = token
        }
    }

    suspend fun clearUser() {
        context.dataStore.edit { prefs ->
            prefs.remove(USER_ID)
            prefs.remove(USER_EMAIL)
            prefs.remove(USER_NAME)
            prefs.remove(USER_AVATAR)
            prefs[IS_LOGGED_IN] = false
        }
    }
}
