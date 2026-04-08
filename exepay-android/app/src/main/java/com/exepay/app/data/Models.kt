package com.exepay.app.data

import java.util.Date

data class User(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val mobile: String = "",
    val avatarUrl: String? = null,
    val fcmToken: String? = null
)

data class PaymentRequest(
    val id: String = "",
    val userId: String = "",
    val upiId: String = "",
    val name: String = "",
    val amount: Double = 0.0,
    val note: String? = null,
    val status: PaymentStatus = PaymentStatus.PENDING,
    val createdAt: Date = Date(),
    val sentAt: Date? = null,
    val openedAt: Date? = null,
    val completedAt: Date? = null,
    val failedAt: Date? = null,
    val failureReason: String? = null
) {
    fun getStatusColor(): Int {
        return when (status) {
            PaymentStatus.PENDING -> android.graphics.Color.parseColor("#FF9F0A")
            PaymentStatus.SENT -> android.graphics.Color.parseColor("#0A84FF")
            PaymentStatus.OPENED -> android.graphics.Color.parseColor("#5E5CE6")
            PaymentStatus.COMPLETED -> android.graphics.Color.parseColor("#30D158")
            PaymentStatus.FAILED -> android.graphics.Color.parseColor("#FF453A")
        }
    }
}

enum class PaymentStatus {
    PENDING,
    SENT,
    OPENED,
    COMPLETED,
    FAILED;

    companion object {
        fun fromString(value: String): PaymentStatus {
            return when (value.lowercase()) {
                "pending" -> PENDING
                "sent" -> SENT
                "opened" -> OPENED
                "completed" -> COMPLETED
                "failed" -> FAILED
                else -> PENDING
            }
        }
    }
}
