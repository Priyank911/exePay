package com.exepay.app.util

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.exepay.app.ExePayApp
import com.exepay.app.R
import com.exepay.app.data.PaymentRequest
import com.exepay.app.ui.dashboard.DashboardActivity

/**
 * Helper class for showing local notifications when new payments arrive.
 * This works without Firebase Cloud Functions - completely free!
 */
object NotificationHelper {
    
    private const val TAG = "NotificationHelper"
    
    /**
     * Shows a notification for a new payment request
     */
    fun showPaymentNotification(context: Context, payment: PaymentRequest) {
        // Check permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                android.util.Log.w(TAG, "Notification permission not granted")
                return
            }
        }
        
        // Format amount
        val formattedAmount = "₹${String.format("%,.0f", payment.amount)}"
        
        // Create intent to open dashboard with payment details
        val intent = Intent(context, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("paymentId", payment.id)
            putExtra("amount", payment.amount)
            putExtra("name", payment.name)
            putExtra("upiId", payment.upiId)
            action = "OPEN_PAYMENT"
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context,
            payment.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Build notification
        val notification = NotificationCompat.Builder(context, ExePayApp.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Payment Request: $formattedAmount")
            .setContentText("Pay to ${payment.name}")
            .setSubText(payment.upiId)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(0, 250, 100, 250))
            .setDefaults(NotificationCompat.DEFAULT_SOUND)
            .build()
        
        // Show notification
        try {
            NotificationManagerCompat.from(context).notify(payment.id.hashCode(), notification)
            android.util.Log.d(TAG, "Notification shown for payment: ${payment.id}")
        } catch (e: SecurityException) {
            android.util.Log.e(TAG, "No notification permission", e)
        }
    }
    
    /**
     * Cancels a notification for a specific payment
     */
    fun cancelNotification(context: Context, paymentId: String) {
        NotificationManagerCompat.from(context).cancel(paymentId.hashCode())
    }
    
    /**
     * Cancels all notifications
     */
    fun cancelAllNotifications(context: Context) {
        NotificationManagerCompat.from(context).cancelAll()
    }
}
