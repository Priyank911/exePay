package com.exepay.app.ui.splash

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.view.animation.AnimationSet
import android.view.animation.TranslateAnimation
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.exepay.app.R
import com.exepay.app.data.PreferencesManager
import com.exepay.app.databinding.ActivitySplashBinding
import com.exepay.app.ui.auth.LoginActivity
import com.exepay.app.ui.dashboard.DashboardActivity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding
    private lateinit var prefsManager: PreferencesManager
    private val handler = Handler(Looper.getMainLooper())
    
    private val taglines = listOf(
        R.string.splash_tagline_1,
        R.string.splash_tagline_2
    )
    private var currentTagline = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        prefsManager = PreferencesManager(this)
        
        // Start animation sequence
        startSplashAnimation()
    }

    private fun startSplashAnimation() {
        // Initially hide elements
        binding.logoIcon.alpha = 0f
        binding.logoText.alpha = 0f
        binding.tagline.alpha = 0f

        // 1. Logo icon scales up and fades in
        handler.postDelayed({
            binding.logoIcon.animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(500)
                .setInterpolator(AccelerateDecelerateInterpolator())
                .start()
        }, 200)

        // 2. Logo text slides up and fades in
        handler.postDelayed({
            binding.logoText.translationY = 30f
            binding.logoText.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(400)
                .setInterpolator(AccelerateDecelerateInterpolator())
                .start()
        }, 500)

        // 3. First tagline fades in
        handler.postDelayed({
            showTagline(0)
        }, 900)

        // 4. Switch to second tagline
        handler.postDelayed({
            fadeOutTagline {
                showTagline(1)
            }
        }, 2000)

        // 5. Navigate to next screen
        handler.postDelayed({
            checkLoginAndNavigate()
        }, 3200)
    }

    private fun showTagline(index: Int) {
        binding.tagline.text = getString(taglines[index])
        binding.tagline.translationY = 20f
        binding.tagline.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(350)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .start()
    }

    private fun fadeOutTagline(onComplete: () -> Unit) {
        binding.tagline.animate()
            .alpha(0f)
            .translationY(-10f)
            .setDuration(250)
            .withEndAction { onComplete() }
            .start()
    }

    private fun checkLoginAndNavigate() {
        lifecycleScope.launch {
            val isLoggedIn = prefsManager.isLoggedIn.first()
            
            val intent = if (isLoggedIn) {
                Intent(this@SplashActivity, DashboardActivity::class.java)
            } else {
                Intent(this@SplashActivity, LoginActivity::class.java)
            }
            
            startActivity(intent)
            overridePendingTransition(R.anim.fade_in, R.anim.fade_out)
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}
