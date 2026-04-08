// ExePay - Firebase Cloud Functions
// Handles payment request notifications via FCM

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Types
interface PaymentRequest {
  id: string;
  userId: string;
  upiId: string;
  name: string;
  amount: number;
  note?: string;
  status: 'pending' | 'sent' | 'opened' | 'completed' | 'failed';
  createdAt: admin.firestore.Timestamp;
  sentAt?: admin.firestore.Timestamp;
  openedAt?: admin.firestore.Timestamp;
  completedAt?: admin.firestore.Timestamp;
  failedAt?: admin.firestore.Timestamp;
  failureReason?: string;
}

interface UserDocument {
  id: string;
  email: string;
  mobile: string;
  name: string;
  fcmToken?: string;
  createdAt: admin.firestore.Timestamp;
}

/**
 * Triggered when a new payment request is created in Firestore
 * Sends FCM push notification to user's mobile device
 */
export const onPaymentRequestCreated = functions.firestore
  .document('payment_requests/{paymentId}')
  .onCreate(async (snapshot, context) => {
    const paymentId = context.params.paymentId;
    const payment = snapshot.data() as PaymentRequest;
    
    functions.logger.info('New payment request created:', paymentId, payment);

    try {
      // Get user's FCM token
      const userDoc = await db.collection('users').doc(payment.userId).get();
      
      if (!userDoc.exists) {
        functions.logger.error('User not found:', payment.userId);
        return;
      }

      const user = userDoc.data() as UserDocument;
      
      if (!user.fcmToken) {
        functions.logger.warn('User has no FCM token:', payment.userId);
        // Update status to show notification couldn't be sent
        await snapshot.ref.update({
          status: 'failed',
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: 'No mobile device registered'
        });
        return;
      }

      // Prepare FCM message
      const message: admin.messaging.Message = {
        token: user.fcmToken,
        notification: {
          title: `Payment Request: ₹${payment.amount.toLocaleString('en-IN')}`,
          body: `Pay to ${payment.name} (${payment.upiId})`
        },
        data: {
          paymentId: payment.id,
          upiId: payment.upiId,
          name: payment.name,
          amount: payment.amount.toString(),
          note: payment.note || '',
          type: 'payment_request'
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'payment_requests',
            priority: 'max',
            defaultSound: true,
            defaultVibrateTimings: true,
            clickAction: 'OPEN_PAYMENT'
          }
        }
      };

      // Send FCM notification
      const response = await messaging.send(message);
      functions.logger.info('FCM notification sent:', response);

      // Update payment status to 'sent'
      await snapshot.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info('Payment request status updated to sent');
    } catch (error) {
      functions.logger.error('Error sending notification:', error);
      
      // Update status to failed
      await snapshot.ref.update({
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        failureReason: 'Failed to send notification'
      });
    }
  });

/**
 * HTTP endpoint to update payment request status
 * Called by Android app when payment is opened or completed
 */
export const updatePaymentStatus = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { paymentId, status, failureReason } = data;

  // Validate inputs
  if (!paymentId || typeof paymentId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Payment ID is required');
  }

  const validStatuses = ['opened', 'completed', 'failed'];
  if (!status || !validStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid status');
  }

  try {
    const paymentRef = db.collection('payment_requests').doc(paymentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment request not found');
    }

    const payment = paymentDoc.data() as PaymentRequest;

    // Verify user owns this payment
    if (payment.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to update this payment');
    }

    // Build update object
    const updateData: Record<string, any> = { status };

    switch (status) {
      case 'opened':
        updateData.openedAt = admin.firestore.FieldValue.serverTimestamp();
        break;
      case 'completed':
        updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
        break;
      case 'failed':
        updateData.failedAt = admin.firestore.FieldValue.serverTimestamp();
        updateData.failureReason = failureReason || 'Unknown error';
        break;
    }

    await paymentRef.update(updateData);

    functions.logger.info('Payment status updated:', paymentId, status);

    return { success: true, status };
  } catch (error) {
    functions.logger.error('Error updating payment status:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to update payment status');
  }
});

/**
 * HTTP endpoint to register/update FCM token
 * Called by Android app on login and token refresh
 */
export const registerFcmToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { fcmToken } = data;

  if (!fcmToken || typeof fcmToken !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
  }

  try {
    const userRef = db.collection('users').doc(context.auth.uid);
    
    await userRef.update({
      fcmToken,
      fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    functions.logger.info('FCM token registered for user:', context.auth.uid);

    return { success: true };
  } catch (error) {
    functions.logger.error('Error registering FCM token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to register FCM token');
  }
});

/**
 * HTTP endpoint to get payment history
 * Returns recent payment requests for the authenticated user
 */
export const getPaymentHistory = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { limit: limitCount = 20 } = data;

  try {
    const paymentsQuery = db
      .collection('payment_requests')
      .where('userId', '==', context.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limitCount, 50));

    const snapshot = await paymentsQuery.get();

    const payments = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        sentAt: data.sentAt?.toDate().toISOString(),
        openedAt: data.openedAt?.toDate().toISOString(),
        completedAt: data.completedAt?.toDate().toISOString(),
        failedAt: data.failedAt?.toDate().toISOString()
      };
    });

    return { success: true, payments };
  } catch (error) {
    functions.logger.error('Error getting payment history:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get payment history');
  }
});

/**
 * HTTP endpoint to cancel a pending payment
 */
export const cancelPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { paymentId } = data;

  if (!paymentId || typeof paymentId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Payment ID is required');
  }

  try {
    const paymentRef = db.collection('payment_requests').doc(paymentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment request not found');
    }

    const payment = paymentDoc.data() as PaymentRequest;

    if (payment.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    // Only allow canceling pending or sent payments
    if (!['pending', 'sent'].includes(payment.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot cancel this payment');
    }

    await paymentRef.update({
      status: 'failed',
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      failureReason: 'Cancelled by user'
    });

    return { success: true };
  } catch (error) {
    functions.logger.error('Error canceling payment:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to cancel payment');
  }
});

/**
 * Cleanup old payment requests (scheduled daily)
 * Removes payment requests older than 30 days
 */
export const cleanupOldPayments = functions.pubsub
  .schedule('0 3 * * *') // Run at 3 AM daily
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const oldPaymentsQuery = db
        .collection('payment_requests')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .limit(500);

      const snapshot = await oldPaymentsQuery.get();

      if (snapshot.empty) {
        functions.logger.info('No old payments to clean up');
        return null;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      functions.logger.info(`Cleaned up ${snapshot.size} old payment requests`);

      return null;
    } catch (error) {
      functions.logger.error('Error cleaning up old payments:', error);
      return null;
    }
  });
