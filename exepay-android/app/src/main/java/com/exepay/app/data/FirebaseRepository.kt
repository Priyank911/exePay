package com.exepay.app.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date

class FirebaseRepository {
    
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()
    private val functions = FirebaseFunctions.getInstance()

    val currentUserId: String?
        get() = auth.currentUser?.uid

    val isLoggedIn: Boolean
        get() = auth.currentUser != null

    suspend fun login(email: String, password: String): Result<User> {
        return try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            val uid = result.user?.uid ?: throw Exception("No user ID")
            
            // Get user document from Firestore
            val userDoc = firestore.collection("users").document(uid).get().await()
            
            if (userDoc.exists()) {
                val user = User(
                    id = uid,
                    name = userDoc.getString("name") ?: "",
                    email = userDoc.getString("email") ?: email,
                    mobile = userDoc.getString("mobile") ?: "",
                    avatarUrl = userDoc.getString("avatarUrl")
                )
                Result.success(user)
            } else {
                Result.failure(Exception("User data not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun registerFcmToken(token: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid ?: throw Exception("Not logged in")
            
            firestore.collection("users").document(uid)
                .update(
                    mapOf(
                        "fcmToken" to token,
                        "fcmTokenUpdatedAt" to com.google.firebase.Timestamp.now()
                    )
                ).await()
            
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() {
        val uid = auth.currentUser?.uid
        if (uid != null) {
            // Clear FCM token
            try {
                firestore.collection("users").document(uid)
                    .update("fcmToken", null).await()
            } catch (_: Exception) {}
        }
        auth.signOut()
    }

    suspend fun getUser(): User? {
        val uid = auth.currentUser?.uid ?: return null
        return try {
            val doc = firestore.collection("users").document(uid).get().await()
            if (doc.exists()) {
                User(
                    id = uid,
                    name = doc.getString("name") ?: "",
                    email = doc.getString("email") ?: "",
                    mobile = doc.getString("mobile") ?: "",
                    avatarUrl = doc.getString("avatarUrl")
                )
            } else null
        } catch (e: Exception) {
            null
        }
    }

    fun getTodayPayments(): Flow<List<PaymentRequest>> = callbackFlow {
        val uid = auth.currentUser?.uid
        if (uid == null) {
            trySend(emptyList())
            awaitClose { }
            return@callbackFlow
        }
        
        // Simple query without date filter to avoid index issues
        // We'll filter today's payments client-side
        val listener = firestore.collection("payment_requests")
            .whereEqualTo("userId", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    android.util.Log.e("FirebaseRepo", "Error fetching payments", error)
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                
                // Get start of today
                val calendar = java.util.Calendar.getInstance().apply {
                    set(java.util.Calendar.HOUR_OF_DAY, 0)
                    set(java.util.Calendar.MINUTE, 0)
                    set(java.util.Calendar.SECOND, 0)
                    set(java.util.Calendar.MILLISECOND, 0)
                }
                val startOfDay = calendar.time
                
                val payments = snapshot?.documents?.mapNotNull { doc ->
                    try {
                        val createdAt = doc.getTimestamp("createdAt")?.toDate() ?: Date()
                        
                        // Filter to today's payments only
                        if (createdAt.before(startOfDay)) {
                            return@mapNotNull null
                        }
                        
                        PaymentRequest(
                            id = doc.id,
                            userId = doc.getString("userId") ?: "",
                            upiId = doc.getString("upiId") ?: "",
                            name = doc.getString("name") ?: "",
                            amount = doc.getDouble("amount") ?: 0.0,
                            note = doc.getString("note"),
                            status = PaymentStatus.fromString(doc.getString("status") ?: "pending"),
                            createdAt = createdAt
                        )
                    } catch (e: Exception) {
                        android.util.Log.e("FirebaseRepo", "Error parsing payment", e)
                        null
                    }
                } ?: emptyList()
                
                android.util.Log.d("FirebaseRepo", "Fetched ${payments.size} payments for today")
                trySend(payments)
            }
        
        awaitClose { listener.remove() }
    }

    fun getAllPayments(): Flow<List<PaymentRequest>> = callbackFlow {
        val uid = auth.currentUser?.uid
        if (uid == null) {
            trySend(emptyList())
            awaitClose { }
            return@callbackFlow
        }
        
        val listener = firestore.collection("payment_requests")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    android.util.Log.e("FirebaseRepo", "Error fetching all payments", error)
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                
                val payments = snapshot?.documents?.mapNotNull { doc ->
                    try {
                        PaymentRequest(
                            id = doc.id,
                            userId = doc.getString("userId") ?: "",
                            upiId = doc.getString("upiId") ?: "",
                            name = doc.getString("name") ?: "",
                            amount = doc.getDouble("amount") ?: 0.0,
                            note = doc.getString("note"),
                            status = PaymentStatus.fromString(doc.getString("status") ?: "pending"),
                            createdAt = doc.getTimestamp("createdAt")?.toDate() ?: Date()
                        )
                    } catch (e: Exception) {
                        null
                    }
                }?.sortedByDescending { it.createdAt } ?: emptyList()
                
                android.util.Log.d("FirebaseRepo", "Fetched ${payments.size} total payments")
                trySend(payments)
            }
        
        awaitClose { listener.remove() }
    }

    suspend fun updatePaymentStatus(paymentId: String, status: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
            if (uid == null) {
                android.util.Log.e("FirebaseRepo", "Cannot update status: User not logged in")
                return Result.failure(Exception("User not logged in"))
            }

            android.util.Log.d("FirebaseRepo", "Updating payment $paymentId to status: $status")

            // Build update data
            val updateData = mutableMapOf<String, Any>(
                "status" to status
            )

            // Add timestamp based on status
            when (status) {
                "opened" -> updateData["openedAt"] = com.google.firebase.Timestamp.now()
                "completed" -> updateData["completedAt"] = com.google.firebase.Timestamp.now()
                "failed" -> updateData["failedAt"] = com.google.firebase.Timestamp.now()
            }

            // Update directly in Firestore
            firestore.collection("payment_requests")
                .document(paymentId)
                .update(updateData)
                .await()

            android.util.Log.d("FirebaseRepo", "Payment status updated successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseRepo", "Failed to update payment status", e)
            Result.failure(e)
        }
    }

    // Alternative method using Cloud Function (keep as backup)
    suspend fun updatePaymentStatusViaFunction(paymentId: String, status: String): Result<Unit> {
        return try {
            val data = hashMapOf(
                "paymentId" to paymentId,
                "status" to status
            )
            
            functions.getHttpsCallable("updatePaymentStatus")
                .call(data)
                .await()
            
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseRepo", "Cloud function failed", e)
            Result.failure(e)
        }
    }
}
