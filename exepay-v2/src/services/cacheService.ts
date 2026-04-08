// ExePay v2 - Cache Service
// Handles data persistence with optional encryption

import type { User } from '../types'
import { type PaymentRequest, type RecentPayee } from './paymentService'

// Simple XOR-based obfuscation (not true encryption, but provides basic protection)
const CACHE_KEY_PREFIX = 'exepay_cache_'
const OBFUSCATION_KEY = 'ExePay2024SecureCache'

const obfuscate = (data: string): string => {
  let result = ''
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(
      data.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    )
  }
  return btoa(result) // Base64 encode
}

const deobfuscate = (encoded: string): string => {
  try {
    const data = atob(encoded) // Base64 decode
    let result = ''
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
      )
    }
    return result
  } catch {
    return ''
  }
}

interface CacheData {
  user: User | null
  recentPayees: RecentPayee[]
  payments: PaymentRequest[]
  lastUpdated: number
}

class CacheService {
  private memoryCache: CacheData = {
    user: null,
    recentPayees: [],
    payments: [],
    lastUpdated: 0
  }
  private initialized = false
  private initPromise: Promise<void> | null = null

  // Initialize from storage on load
  async init(): Promise<void> {
    // Return existing init if already running
    if (this.initPromise) {
      return this.initPromise
    }
    
    // Return immediately if already initialized
    if (this.initialized) {
      return
    }
    
    this.initPromise = this._doInit()
    await this.initPromise
    this.initPromise = null
  }
  
  private async _doInit(): Promise<void> {
    try {
      const cached = await this.loadFromStorage()
      if (cached) {
        this.memoryCache = cached
        console.log('[Cache] Loaded from storage:', {
          user: cached.user?.email,
          paymentsCount: cached.payments.length,
          payeesCount: cached.recentPayees.length,
          lastUpdated: new Date(cached.lastUpdated).toISOString()
        })
      } else {
        console.log('[Cache] No cached data found')
      }
      this.initialized = true
    } catch (error) {
      console.error('[Cache] Init error:', error)
      this.initialized = true // Mark as initialized even on error
    }
  }

  // Get user from cache (sync - call init() first!)
  getUser(): User | null {
    return this.memoryCache.user
  }

  // Set user and persist
  async setUser(user: User | null): Promise<void> {
    this.memoryCache.user = user
    this.memoryCache.lastUpdated = Date.now()
    await this.saveToStorage()
  }

  // Get payments from cache (sync - call init() first!)
  getPayments(): PaymentRequest[] {
    return this.memoryCache.payments
  }

  // Set payments and persist
  async setPayments(payments: PaymentRequest[]): Promise<void> {
    this.memoryCache.payments = payments
    this.memoryCache.lastUpdated = Date.now()
    await this.saveToStorage()
  }

  // Get recent payees from cache (sync - call init() first!)
  getRecentPayees(): RecentPayee[] {
    return this.memoryCache.recentPayees
  }

  // Set recent payees and persist
  async setRecentPayees(payees: RecentPayee[]): Promise<void> {
    this.memoryCache.recentPayees = payees
    this.memoryCache.lastUpdated = Date.now()
    await this.saveToStorage()
  }

  // Clear all cache (for logout)
  async clear(): Promise<void> {
    this.memoryCache = {
      user: null,
      recentPayees: [],
      payments: [],
      lastUpdated: 0
    }
    this.initialized = false
    await this.removeFromStorage()
  }

  // Load from Chrome storage
  private async loadFromStorage(): Promise<CacheData | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        console.log('[Cache] Loading from chrome.storage...')
        const result = await chrome.storage.local.get(CACHE_KEY_PREFIX + 'data')
        const encoded = result[CACHE_KEY_PREFIX + 'data']
        console.log('[Cache] Raw stored data:', encoded ? `${String(encoded).substring(0, 50)}...` : 'null')
        if (encoded && typeof encoded === 'string') {
          const decoded = deobfuscate(encoded)
          const parsed = JSON.parse(decoded, (_key, value) => {
            // Convert date strings back to Date objects
            if (_key === 'createdAt' && typeof value === 'string') {
              return new Date(value)
            }
            return value
          }) as CacheData
          console.log('[Cache] Parsed cache data:', {
            hasUser: !!parsed.user,
            payments: parsed.payments?.length || 0,
            payees: parsed.recentPayees?.length || 0
          })
          return parsed
        }
      } else {
        console.log('[Cache] Loading from localStorage...')
        const encoded = localStorage.getItem(CACHE_KEY_PREFIX + 'data')
        if (encoded) {
          const decoded = deobfuscate(encoded)
          return JSON.parse(decoded, (_key, value) => {
            if (_key === 'createdAt' && typeof value === 'string') {
              return new Date(value)
            }
            return value
          })
        }
      }
      console.log('[Cache] No data found in storage')
      return null
    } catch (error) {
      console.error('[Cache] Load error:', error)
      return null
    }
  }

  // Save to Chrome storage
  private async saveToStorage(): Promise<void> {
    try {
      const data = JSON.stringify(this.memoryCache, (_key, value) => {
        // Convert Date objects to ISO strings
        if (value instanceof Date) {
          return value.toISOString()
        }
        return value
      })
      const encoded = obfuscate(data)
      
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [CACHE_KEY_PREFIX + 'data']: encoded })
        console.log('[Cache] Saved to chrome.storage')
      } else {
        localStorage.setItem(CACHE_KEY_PREFIX + 'data', encoded)
        console.log('[Cache] Saved to localStorage')
      }
    } catch (error) {
      console.error('[Cache] Save error:', error)
    }
  }

  // Remove from storage
  private async removeFromStorage(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(CACHE_KEY_PREFIX + 'data')
      } else {
        localStorage.removeItem(CACHE_KEY_PREFIX + 'data')
      }
      console.log('[Cache] Cleared')
    } catch (error) {
      console.error('[Cache] Remove error:', error)
    }
  }
}

export const cacheService = new CacheService()
