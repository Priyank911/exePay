package com.exepay.app.ui.dashboard

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import coil.transform.CircleCropTransformation
import com.exepay.app.R
import com.exepay.app.data.FirebaseRepository
import com.exepay.app.data.PaymentRequest
import com.exepay.app.data.PaymentStatus
import com.exepay.app.data.PreferencesManager
import com.exepay.app.databinding.ActivityDashboardBinding
import com.exepay.app.ui.auth.LoginActivity
import com.exepay.app.util.NotificationHelper
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.Calendar

class DashboardActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "DashboardActivity"
    }

    private lateinit var binding: ActivityDashboardBinding
    private lateinit var prefsManager: PreferencesManager
    private val repository = FirebaseRepository()
    private lateinit var paymentsAdapter: PaymentsAdapter
    
    // Track known payment IDs to detect new ones
    private val knownPaymentIds = mutableSetOf<String>()
    private var isFirstLoad = true
    
    // Permission launcher for Android 13+ notifications
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Log.d(TAG, "Notification permission granted")
            Toast.makeText(this, "Notifications enabled!", Toast.LENGTH_SHORT).show()
        } else {
            Log.w(TAG, "Notification permission denied")
            Toast.makeText(this, "Please enable notifications in settings to receive payment alerts", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefsManager = PreferencesManager(this)

        setupViews()
        loadUserData()
        observePayments()
        handleIntent(intent)
        
        // Request notification permission for Android 13+
        requestNotificationPermission()
    }
    
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    Log.d(TAG, "Notification permission already granted")
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    // Show explanation and then request
                    AlertDialog.Builder(this, R.style.Theme_ExePay_Dialog)
                        .setTitle("Enable Notifications")
                        .setMessage("ExePay needs notification permission to alert you about payment requests. Without this, you won't receive instant payment alerts.")
                        .setPositiveButton("Enable") { _, _ ->
                            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                        .setNegativeButton("Not Now", null)
                        .show()
                }
                else -> {
                    // Request permission directly
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleIntent(it) }
    }

    private fun handleIntent(intent: Intent) {
        if (intent.action == "OPEN_PAYMENT") {
            val paymentId = intent.getStringExtra("paymentId")
            val amount = intent.getDoubleExtra("amount", 0.0)
            val name = intent.getStringExtra("name") ?: ""
            val upiId = intent.getStringExtra("upiId") ?: ""

            if (paymentId != null && amount > 0) {
                showPaymentDialog(paymentId, name, upiId, amount)
            }
        }
    }

    private fun setupViews() {
        // Greeting
        binding.greetingText.text = getGreeting()

        // Profile click
        binding.profileImage.setOnClickListener {
            showProfileMenu()
        }

        // Setup RecyclerView
        paymentsAdapter = PaymentsAdapter { payment ->
            showPaymentDialog(payment.id, payment.name, payment.upiId, payment.amount)
        }
        
        binding.paymentsRecycler.apply {
            layoutManager = LinearLayoutManager(this@DashboardActivity)
            adapter = paymentsAdapter
        }

        // SwipeRefresh
        binding.swipeRefresh.setOnRefreshListener {
            binding.swipeRefresh.isRefreshing = false
        }
        binding.swipeRefresh.setColorSchemeResources(R.color.primary)
        binding.swipeRefresh.setProgressBackgroundColorSchemeResource(R.color.background_elevated)

        // Animate views
        animateViews()
    }

    private fun animateViews() {
        val views = listOf(
            binding.headerContainer,
            binding.sectionTitle,
            binding.paymentsRecycler
        )

        views.forEachIndexed { index, view ->
            view.alpha = 0f
            view.translationY = 20f
            view.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(350)
                .setStartDelay((80 * index).toLong())
                .start()
        }
    }

    private fun getGreeting(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 5..11 -> getString(R.string.greeting_morning)
            hour in 12..16 -> getString(R.string.greeting_afternoon)
            hour in 17..20 -> getString(R.string.greeting_evening)
            else -> getString(R.string.greeting_night)
        }
    }

    private fun loadUserData() {
        lifecycleScope.launch {
            val name = prefsManager.userName.first()
            binding.userName.text = name ?: "User"
            
            // Get first letter for avatar fallback
            val initial = (name?.firstOrNull() ?: 'U').uppercaseChar()
            binding.profileInitial.text = initial.toString()
            
            // Load profile image from Cloudinary if available
            val user = repository.getUser()
            val avatarUrl = user?.avatarUrl
            
            if (!avatarUrl.isNullOrEmpty()) {
                // Show profile photo, hide initial and background
                binding.profilePhoto.visibility = View.VISIBLE
                binding.profileInitial.visibility = View.GONE
                binding.profileBackground.visibility = View.GONE
                
                // Load with Coil
                binding.profilePhoto.load(avatarUrl) {
                    crossfade(true)
                    transformations(CircleCropTransformation())
                    placeholder(R.drawable.bg_avatar)
                    error(R.drawable.bg_avatar)
                    listener(
                        onError = { _, _ ->
                            // On error, show initial instead
                            binding.profilePhoto.visibility = View.GONE
                            binding.profileInitial.visibility = View.VISIBLE
                            binding.profileBackground.visibility = View.VISIBLE
                        },
                        onSuccess = { _, _ ->
                            // Successfully loaded, ensure background is hidden
                            binding.profileBackground.visibility = View.GONE
                        }
                    )
                }
                
                Log.d(TAG, "Loading avatar from: $avatarUrl")
            } else {
                // No avatar URL, show initial with background
                binding.profilePhoto.visibility = View.GONE
                binding.profileInitial.visibility = View.VISIBLE
                binding.profileBackground.visibility = View.VISIBLE
                Log.d(TAG, "No avatar URL, showing initial")
            }
        }
    }

    private fun observePayments() {
        lifecycleScope.launch {
            repository.getAllPayments().collect { payments ->
                Log.d(TAG, "Received ${payments.size} payments")
                
                // Detect new payments and show notifications
                if (!isFirstLoad) {
                    payments.forEach { payment ->
                        if (payment.id !in knownPaymentIds && payment.status == PaymentStatus.PENDING) {
                            Log.d(TAG, "New payment detected: ${payment.id}")
                            NotificationHelper.showPaymentNotification(this@DashboardActivity, payment)
                        }
                    }
                }
                
                // Update known IDs
                knownPaymentIds.clear()
                knownPaymentIds.addAll(payments.map { it.id })
                isFirstLoad = false
                
                updatePaymentsList(payments)
            }
        }
    }

    private fun updatePaymentsList(payments: List<PaymentRequest>) {
        Log.d(TAG, "Updating list with ${payments.size} payments")
        if (payments.isEmpty()) {
            binding.emptyState.visibility = View.VISIBLE
            binding.paymentsRecycler.visibility = View.GONE
        } else {
            binding.emptyState.visibility = View.GONE
            binding.paymentsRecycler.visibility = View.VISIBLE
            paymentsAdapter.submitList(payments)
        }
    }

    private fun showPaymentDialog(paymentId: String, name: String, upiId: String, amount: Double) {
        val formattedAmount = "₹${String.format("%,.0f", amount)}"
        
        AlertDialog.Builder(this, R.style.Theme_ExePay_Dialog)
            .setTitle("Pay $formattedAmount")
            .setMessage("to $name\n$upiId")
            .setPositiveButton("Pay Now") { _, _ ->
                openUpiApp(upiId, name, amount, paymentId)
            }
            .setNegativeButton("Later", null)
            .setNeutralButton("Mark Done") { _, _ ->
                markPaymentComplete(paymentId)
            }
            .show()
    }

    private fun openUpiApp(upiId: String, name: String, amount: Double, paymentId: String) {
        // Update status to opened
        lifecycleScope.launch {
            repository.updatePaymentStatus(paymentId, "opened")
        }
        
        // Cancel notification for this payment
        NotificationHelper.cancelNotification(this, paymentId)

        // Build UPI intent
        val uri = Uri.parse("upi://pay?pa=$upiId&pn=${Uri.encode(name)}&am=$amount&cu=INR")
        val intent = Intent(Intent.ACTION_VIEW, uri)

        try {
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, R.string.error_no_upi, Toast.LENGTH_LONG).show()
        }
    }

    private fun markPaymentComplete(paymentId: String) {
        Toast.makeText(this, "Updating...", Toast.LENGTH_SHORT).show()
        
        // Cancel notification
        NotificationHelper.cancelNotification(this, paymentId)
        
        lifecycleScope.launch {
            Log.d(TAG, "Marking payment complete: $paymentId")
            
            val result = repository.updatePaymentStatus(paymentId, "completed")
            result.fold(
                onSuccess = {
                    Log.d(TAG, "Payment marked complete successfully")
                    Toast.makeText(this@DashboardActivity, "✓ Payment marked complete!", Toast.LENGTH_SHORT).show()
                },
                onFailure = { error ->
                    Log.e(TAG, "Failed to update status: ${error.message}", error)
                    Toast.makeText(
                        this@DashboardActivity, 
                        "Failed: ${error.message ?: "Unknown error"}", 
                        Toast.LENGTH_LONG
                    ).show()
                }
            )
        }
    }

    private fun showProfileMenu() {
        AlertDialog.Builder(this, R.style.Theme_ExePay_Dialog)
            .setTitle(R.string.profile)
            .setItems(arrayOf("Logout")) { _, which ->
                when (which) {
                    0 -> performLogout()
                }
            }
            .show()
    }

    private fun performLogout() {
        lifecycleScope.launch {
            repository.logout()
            prefsManager.clearUser()
            
            val intent = Intent(this@DashboardActivity, LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }
}
