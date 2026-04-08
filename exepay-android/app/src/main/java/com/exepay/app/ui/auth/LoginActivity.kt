package com.exepay.app.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.exepay.app.R
import com.exepay.app.data.FirebaseRepository
import com.exepay.app.data.PreferencesManager
import com.exepay.app.databinding.ActivityLoginBinding
import com.exepay.app.ui.dashboard.DashboardActivity
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var prefsManager: PreferencesManager
    private val repository = FirebaseRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefsManager = PreferencesManager(this)

        setupViews()
        animateViews()
    }

    private fun setupViews() {
        binding.btnLogin.setOnClickListener {
            val email = binding.inputEmail.text.toString().trim()
            val password = binding.inputPassword.text.toString()

            if (validateInputs(email, password)) {
                performLogin(email, password)
            }
        }
    }

    private fun animateViews() {
        val views = listOf(
            binding.logoContainer,
            binding.titleText,
            binding.subtitleText,
            binding.inputLayoutEmail,
            binding.inputLayoutPassword,
            binding.btnLogin,
            binding.bottomText
        )

        views.forEachIndexed { index, view ->
            view.alpha = 0f
            view.translationY = 30f
            view.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(400)
                .setStartDelay((100 * index).toLong())
                .start()
        }
    }

    private fun validateInputs(email: String, password: String): Boolean {
        var isValid = true

        if (email.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.inputLayoutEmail.error = "Enter a valid email"
            isValid = false
        } else {
            binding.inputLayoutEmail.error = null
        }

        if (password.isEmpty() || password.length < 6) {
            binding.inputLayoutPassword.error = "Password must be at least 6 characters"
            isValid = false
        } else {
            binding.inputLayoutPassword.error = null
        }

        return isValid
    }

    private fun performLogin(email: String, password: String) {
        setLoading(true)

        lifecycleScope.launch {
            val result = repository.login(email, password)

            result.fold(
                onSuccess = { user ->
                    // Save user locally (including avatar URL)
                    prefsManager.saveUser(user.id, user.email, user.name, user.avatarUrl)
                    
                    android.util.Log.d("LoginActivity", "User logged in: ${user.name}, avatar: ${user.avatarUrl}")
                    
                    // Register FCM token
                    registerFcmToken()
                    
                    // Navigate to dashboard
                    navigateToDashboard()
                },
                onFailure = { error ->
                    setLoading(false)
                    Toast.makeText(
                        this@LoginActivity,
                        error.message ?: getString(R.string.error_login),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            )
        }
    }

    private suspend fun registerFcmToken() {
        try {
            val token = FirebaseMessaging.getInstance().token.await()
            android.util.Log.d("LoginActivity", "FCM Token: $token")
            
            val result = repository.registerFcmToken(token)
            result.fold(
                onSuccess = {
                    android.util.Log.d("LoginActivity", "FCM token registered successfully")
                    prefsManager.saveFcmToken(token)
                },
                onFailure = { error ->
                    android.util.Log.e("LoginActivity", "Failed to register FCM token", error)
                }
            )
        } catch (e: Exception) {
            android.util.Log.e("LoginActivity", "Error getting FCM token", e)
        }
    }

    private fun navigateToDashboard() {
        val intent = Intent(this, DashboardActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        overridePendingTransition(R.anim.fade_in, R.anim.fade_out)
        finish()
    }

    private fun setLoading(loading: Boolean) {
        binding.btnLogin.isEnabled = !loading
        binding.btnLogin.text = if (loading) "Signing in..." else getString(R.string.login_button)
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    }
}
