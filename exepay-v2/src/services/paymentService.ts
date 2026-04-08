// ExePay v2 - Payment Service
// Handles payment requests and real-time status updates

import { 
  db, 
  auth,
  COLLECTIONS,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from './firebase';
import { query, where, orderBy, limit, getDocs } from 'firebase/firestore';

// Payment request status
export type PaymentStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'failed';

// Payment request interface
export interface PaymentRequest {
  id: string;
  userId: string;
  upiId: string;
  name: string;
  amount: number;
  note?: string;
  status: PaymentStatus;
  createdAt: Date;
  sentAt?: Date;
  openedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
}

// Firestore payment request type
interface FirestorePaymentRequest {
  id: string;
  userId: string;
  upiId: string;
  name: string;
  amount: number;
  note?: string;
  status: PaymentStatus;
  createdAt: any;
  sentAt?: any;
  openedAt?: any;
  completedAt?: any;
  failedAt?: any;
  failureReason?: string;
}

// Recent payee interface
export interface RecentPayee {
  id: string;
  userId: string;
  upiId: string;
  name: string;
  lastPaidAt: Date;
  paymentCount: number;
}

// Convert Firestore timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

// Generate unique ID
const generateId = (): string => {
  const array = new Uint8Array(12);
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Payment Service
class PaymentService {
  // Create a new payment request
  async createPaymentRequest(data: {
    upiId: string;
    name: string;
    amount: number;
    note?: string;
  }): Promise<{ success: boolean; paymentRequest?: PaymentRequest; error?: string }> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Validate inputs
      if (!data.upiId || !data.upiId.includes('@')) {
        return { success: false, error: 'Invalid UPI ID' };
      }
      if (!data.name.trim()) {
        return { success: false, error: 'Recipient name is required' };
      }
      if (!data.amount || data.amount <= 0) {
        return { success: false, error: 'Invalid amount' };
      }
      if (data.amount > 100000) {
        return { success: false, error: 'Amount exceeds limit (₹1,00,000)' };
      }

      const paymentId = `pay_${generateId()}`;
      
      // Build payment data - only include note if it has a value
      const paymentData: FirestorePaymentRequest = {
        id: paymentId,
        userId: user.uid,
        upiId: data.upiId.toLowerCase().trim(),
        name: data.name.trim(),
        amount: data.amount,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      // Only add note field if it exists and is not empty
      if (data.note && data.note.trim()) {
        paymentData.note = data.note.trim();
      }

      // Save to Firestore
      await setDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, paymentId), paymentData);

      // Update recent payees
      await this.updateRecentPayee(user.uid, data.upiId, data.name);

      const paymentRequest: PaymentRequest = {
        ...paymentData,
        createdAt: new Date()
      };

      return { success: true, paymentRequest };
    } catch (error) {
      console.error('Create payment request error:', error);
      return { success: false, error: 'Failed to create payment request' };
    }
  }

  // Update recent payee
  private async updateRecentPayee(userId: string, upiId: string, name: string): Promise<void> {
    try {
      const payeeId = `${userId}_${upiId.replace(/[@.]/g, '_')}`;
      const payeeRef = doc(db, COLLECTIONS.RECENT_PAYEES, payeeId);
      const payeeDoc = await getDoc(payeeRef);

      if (payeeDoc.exists()) {
        await updateDoc(payeeRef, {
          lastPaidAt: serverTimestamp(),
          paymentCount: (payeeDoc.data().paymentCount || 0) + 1
        });
      } else {
        await setDoc(payeeRef, {
          id: payeeId,
          userId,
          upiId: upiId.toLowerCase().trim(),
          name: name.trim(),
          lastPaidAt: serverTimestamp(),
          paymentCount: 1
        });
      }
    } catch (error) {
      console.error('Update recent payee error:', error);
    }
  }

  // Subscribe to payment request status updates
  subscribeToPaymentRequest(
    paymentId: string, 
    callback: (request: PaymentRequest | null) => void
  ): () => void {
    const paymentRef = doc(db, COLLECTIONS.PAYMENT_REQUESTS, paymentId);
    
    return onSnapshot(paymentRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const data = snapshot.data() as FirestorePaymentRequest;
      const request: PaymentRequest = {
        ...data,
        createdAt: toDate(data.createdAt),
        sentAt: data.sentAt ? toDate(data.sentAt) : undefined,
        openedAt: data.openedAt ? toDate(data.openedAt) : undefined,
        completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
        failedAt: data.failedAt ? toDate(data.failedAt) : undefined
      };

      callback(request);
    }, (error) => {
      console.error('Payment subscription error:', error);
      callback(null);
    });
  }

  // Get recent payment requests
  async getRecentPaymentRequests(limitCount: number = 10): Promise<PaymentRequest[]> {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      // Try with ordering first (requires index)
      try {
        const q = query(
          collection(db, COLLECTIONS.PAYMENT_REQUESTS),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => {
          const data = doc.data() as FirestorePaymentRequest;
          return {
            ...data,
            createdAt: toDate(data.createdAt),
            sentAt: data.sentAt ? toDate(data.sentAt) : undefined,
            openedAt: data.openedAt ? toDate(data.openedAt) : undefined,
            completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
            failedAt: data.failedAt ? toDate(data.failedAt) : undefined
          };
        });
      } catch (indexError: any) {
        // If index not ready, fall back to unordered query
        if (indexError?.code === 'failed-precondition') {
          // Silent fallback - index will be ready after deployment
          const q = query(
            collection(db, COLLECTIONS.PAYMENT_REQUESTS),
            where('userId', '==', user.uid),
            limit(limitCount)
          );
          const snapshot = await getDocs(q);
          
          const payments = snapshot.docs.map(doc => {
            const data = doc.data() as FirestorePaymentRequest;
            return {
              ...data,
              createdAt: toDate(data.createdAt),
              sentAt: data.sentAt ? toDate(data.sentAt) : undefined,
              openedAt: data.openedAt ? toDate(data.openedAt) : undefined,
              completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
              failedAt: data.failedAt ? toDate(data.failedAt) : undefined
            };
          });
          
          // Sort client-side
          return payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        throw indexError;
      }
    } catch (error) {
      console.error('Get recent payments error:', error);
      return [];
    }
  }

  // Get recent payees
  async getRecentPayees(limitCount: number = 5): Promise<RecentPayee[]> {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      // Try with ordering first (requires index)
      try {
        const q = query(
          collection(db, COLLECTIONS.RECENT_PAYEES),
          where('userId', '==', user.uid),
          orderBy('lastPaidAt', 'desc'),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id,
            userId: data.userId,
            upiId: data.upiId,
            name: data.name,
            lastPaidAt: toDate(data.lastPaidAt),
            paymentCount: data.paymentCount || 1
          };
        });
      } catch (indexError: any) {
        // If index not ready, fall back to unordered query
        if (indexError?.code === 'failed-precondition') {
          // Silent fallback - index will be ready after deployment
          const q = query(
            collection(db, COLLECTIONS.RECENT_PAYEES),
            where('userId', '==', user.uid),
            limit(limitCount)
          );
          const snapshot = await getDocs(q);
          
          const payees = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: data.id,
              userId: data.userId,
              upiId: data.upiId,
              name: data.name,
              lastPaidAt: toDate(data.lastPaidAt),
              paymentCount: data.paymentCount || 1
            };
          });
          
          // Sort client-side
          return payees.sort((a, b) => b.lastPaidAt.getTime() - a.lastPaidAt.getTime());
        }
        throw indexError;
      }
    } catch (error) {
      console.error('Get recent payees error:', error);
      return [];
    }
  }

  // Update payment status (called by Cloud Function or manually)
  async updatePaymentStatus(
    paymentId: string, 
    status: PaymentStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const paymentRef = doc(db, COLLECTIONS.PAYMENT_REQUESTS, paymentId);
      const paymentDoc = await getDoc(paymentRef);

      if (!paymentDoc.exists()) {
        return { success: false, error: 'Payment request not found' };
      }

      const data = paymentDoc.data();
      if (data.userId !== user.uid) {
        return { success: false, error: 'Unauthorized' };
      }

      const updateData: any = { status };

      switch (status) {
        case 'sent':
          updateData.sentAt = serverTimestamp();
          break;
        case 'opened':
          updateData.openedAt = serverTimestamp();
          break;
        case 'completed':
          updateData.completedAt = serverTimestamp();
          break;
        case 'failed':
          updateData.failedAt = serverTimestamp();
          updateData.failureReason = reason;
          break;
      }

      await updateDoc(paymentRef, updateData);
      return { success: true };
    } catch (error) {
      console.error('Update payment status error:', error);
      return { success: false, error: 'Failed to update status' };
    }
  }

  // Cancel payment request
  async cancelPaymentRequest(paymentId: string): Promise<{ success: boolean; error?: string }> {
    return this.updatePaymentStatus(paymentId, 'failed', 'Cancelled by user');
  }
}

export const paymentService = new PaymentService();
