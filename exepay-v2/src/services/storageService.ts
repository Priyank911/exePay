// ExePay v2 - Direct Storage Service
// Handles persistent data storage directly to Chrome storage
// No memory cache - always reads/writes directly for reliability

import type { User } from '../types'
import type { PaymentRequest, RecentPayee } from './paymentService'

// Storage keys
const KEYS = {
  USER: 'exepay_user',
  PAYMENTS: 'exepay_payments',
  PAYEES: 'exepay_payees',
  LAST_UPDATED: 'exepay_last_updated'
}

// Helper to get from storage
async function getItem<T>(key: string): Promise<T | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key)
      return (result[key] as T) ?? null
    } else {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : null
    }
  } catch (error) {
    console.error(`[Storage] Get ${key} error:`, error)
    return null
  }
}

// Helper to set in storage
async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: value })
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.error(`[Storage] Set ${key} error:`, error)
  }
}

// Storage service with direct read/write
export const storageService = {
  // User
  async getUser(): Promise<User | null> {
    return getItem<User>(KEYS.USER)
  },
  
  async setUser(user: User | null): Promise<void> {
    await setItem(KEYS.USER, user)
    console.log('[Storage] User saved')
  },

  // Payments - stored as serialized array
  async getPayments(): Promise<PaymentRequest[]> {
    const data = await getItem<{ payments: PaymentRequest[], lastUpdated: number }>(KEYS.PAYMENTS)
    if (data?.payments) {
      // Convert date strings back to Date objects
      return data.payments.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt)
      }))
    }
    return []
  },
  
  async setPayments(payments: PaymentRequest[]): Promise<void> {
    // Serialize with dates as ISO strings
    const data = {
      payments: payments.map(p => ({
        ...p,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt
      })),
      lastUpdated: Date.now()
    }
    await setItem(KEYS.PAYMENTS, data)
    console.log('[Storage] Payments saved:', payments.length)
  },

  // Recent Payees
  async getPayees(): Promise<RecentPayee[]> {
    const data = await getItem<{ payees: RecentPayee[], lastUpdated: number }>(KEYS.PAYEES)
    return data?.payees || []
  },
  
  async setPayees(payees: RecentPayee[]): Promise<void> {
    await setItem(KEYS.PAYEES, { payees, lastUpdated: Date.now() })
    console.log('[Storage] Payees saved:', payees.length)
  },

  // Clear all (for logout)
  async clear(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove([KEYS.USER, KEYS.PAYMENTS, KEYS.PAYEES, KEYS.LAST_UPDATED])
      } else {
        localStorage.removeItem(KEYS.USER)
        localStorage.removeItem(KEYS.PAYMENTS)
        localStorage.removeItem(KEYS.PAYEES)
        localStorage.removeItem(KEYS.LAST_UPDATED)
      }
      console.log('[Storage] Cleared all data')
    } catch (error) {
      console.error('[Storage] Clear error:', error)
    }
  }
}
