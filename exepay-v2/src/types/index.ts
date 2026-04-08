// ExePay v2 - Type Definitions

export interface User {
  id: string
  name: string
  email: string
  mobile: string
  balance: number
  paymentAddress: string
  avatar?: string
  transactions: Transaction[]
  contacts: Contact[]
  createdAt: string
  isVerified: boolean
  pin?: string // Hashed PIN for app lock
  pinLength?: number // Length of the PIN (4-6)
  // Firebase specific
  mobileVerified?: boolean
  emailVerified?: boolean
  fcmToken?: string
}

export interface Contact {
  id: string
  name: string
  upiId: string
  lastPaidAt: string
  totalPaid: number
  paymentCount: number
}

export interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  recipientId?: string
  recipientName?: string
  recipientUpiId?: string
  senderId?: string
  senderName?: string
  timestamp: string
  status: 'pending' | 'completed' | 'failed'
  reference?: string
}

export interface QRPaymentData {
  merchantName: string
  merchantId: string
  amount: number | null
  currency: string
  note?: string
  rawData: string
}

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
  message?: string // For success messages like "Email verification sent"
}

export interface TransactionResult {
  success: boolean
  transaction?: Transaction
  balance?: number
  error?: string
}

export interface PinResult {
  success: boolean
  error?: string
}

// Payment request types for the new bridge architecture
export type PaymentRequestStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'failed'

export interface PaymentRequestData {
  id: string
  userId: string
  upiId: string
  name: string
  amount: number
  note?: string
  status: PaymentRequestStatus
  createdAt: Date
  sentAt?: Date
  openedAt?: Date
  completedAt?: Date
  failedAt?: Date
  failureReason?: string
}

export interface RecentPayeeData {
  id: string
  userId: string
  upiId: string
  name: string
  lastPaidAt: Date
  paymentCount: number
}
