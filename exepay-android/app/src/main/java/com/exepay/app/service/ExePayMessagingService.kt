package com.exepay.app.service

import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.exepay.app.ExePayApp
import com.exepay.app.R
import com.exepay.app.data.FirebaseRepository
import com.exepay.app.data.PreferencesManager
import com.exepay.app.ui.dashboard.DashboardActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ExePayMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val repository = FirebaseRepository()
    private lateinit var prefsManager: PreferencesManager

    override fun onCreate() {
        super.onCreate()
        prefsManager = PreferencesManager(this)
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "New FCM token: $token")
        
        // Save token locally and to Firebase
        serviceScope.launch {
            prefsManager.saveFcmToken(token)
            
            if (repository.isLoggedIn) {
                repository.registerFcmToken(token)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Log.d(TAG, "FCM message received: ${message.data}")
        
        val data = message.data
        
        // Check if this is a payment request
        if (data["type"] == "payment_request") {
            showPaymentNotification(data)
        }
    }

    private fun showPaymentNotification(data: Map<String, String>) {
        val paymentId = data["paymentId"] ?: return
        val name = data["name"] ?: "Unknown"
        val amount = data["amount"]?.toDoubleOrNull() ?: 0.0
        val upiId = data["upiId"] ?: ""
        
        // Format amount
        val formattedAmount = "₹${String.format("%,.0f", amount)}"
        
        // Create intent to open dashboard
        val intent = Intent(this, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("paymentId", paymentId)
            putExtra("amount", amount)
            putExtra("name", name)
            putExtra("upiId", upiId)
            action = "OPEN_PAYMENT"
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            paymentId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Build notification
        val notification = NotificationCompat.Builder(this, ExePayApp.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Payment Request: $formattedAmount")
            .setContentText("Pay to $name")
            .setSubText(upiId)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(0, 250, 100, 250))
            .build()
        
        // Show notification
        try {
            NotificationManagerCompat.from(this).notify(paymentId.hashCode(), notification)
        } catch (e: SecurityException) {
            Log.e(TAG, "No notification permission", e)
        }
    }

    companion object {
        private const val TAG = "ExePayFCM"
    }
}
