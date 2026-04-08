// ExePay v2 - Global State Management with Zustand
import { create } from 'zustand'
import { persist, type StateStorage, createJSONStorage } from 'zustand/middleware'
import { firebaseAuthService } from '../services/firebaseAuthService'
import { paymentService, type PaymentRequest, type RecentPayee } from '../services/paymentService'
import type { User } from '../types'

// Use Firebase auth by default, set to false to use local auth
const USE_FIREBASE = true

// Import local auth service for fallback
import { authService as localAuthService } from '../services/authService'

// Select auth service based on configuration
const authService = USE_FIREBASE ? firebaseAuthService : localAuthService

// Persisted state subset
interface PersistedState {
  user: User | null
  isAuthenticated: boolean
  isUnlocked: boolean
  lastActivityTime: number
  activeView: 'home' | 'scan' | 'receive' | 'profile' | 'history' | 'contacts'
}

interface AppState extends PersistedState {
  // Non-persisted state
  isLoading: boolean
  currentPayment: PaymentRequest | null
  recentPayees: RecentPayee[]
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setActiveView: (view: AppState['activeView']) => void
  setUnlocked: (unlocked: boolean) => void
  setCurrentPayment: (payment: PaymentRequest | null) => void
  updateActivity: () => void // Update last activity timestamp
  
  // Auth Actions
  checkAuth: () => Promise<void>
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: { name: string; email: string; mobile: string; password: string; pin: string }) => Promise<{ success: boolean; error?: string; message?: string }>
  logout: () => Promise<void>
  
  // Wallet Actions (legacy - kept for compatibility)
  addMoney: (amount: number) => Promise<{ success: boolean; error?: string }>
  sendMoney: (recipientUpiId: string, recipientName: string, amount: number, note?: string) => Promise<{ success: boolean; error?: string }>
  refreshUser: () => Promise<void>
  updateAvatar: (avatarUrl: string) => Promise<{ success: boolean; error?: string }>
  removeAvatar: () => Promise<{ success: boolean; error?: string }>
  
  // Payment Actions (new bridge architecture)
  createPaymentRequest: (data: { upiId: string; name: string; amount: number; note?: string }) => Promise<{ success: boolean; paymentRequest?: PaymentRequest; error?: string }>
  loadRecentPayees: () => Promise<void>
}

// Custom storage for Chrome extensions
const chromeStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(name)
        const value = (result[name] as string) ?? null
        console.log(`[ZustandStorage] Get "${name}":`, value ? `${value.substring(0, 50)}...` : 'null')
        return value
      }
      const value = localStorage.getItem(name)
      console.log(`[ZustandStorage] LocalStorage get "${name}":`, value ? 'found' : 'null')
      return value
    } catch (e) {
      console.error(`[ZustandStorage] Get error:`, e)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      console.log(`[ZustandStorage] Set "${name}":`, value.substring(0, 100) + '...')
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [name]: value })
        console.log(`[ZustandStorage] Saved to chrome.storage`)
      } else {
        localStorage.setItem(name, value)
        console.log(`[ZustandStorage] Saved to localStorage`)
      }
    } catch (e) {
      console.error('[ZustandStorage] Set error:', e)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      console.log(`[ZustandStorage] Remove "${name}"`)
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(name)
      } else {
        localStorage.removeItem(name)
      }
    } catch {
      // Silent fail
    }
  },
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      isLoading: true,
      isAuthenticated: false,
      isUnlocked: false,
      lastActivityTime: 0,
      activeView: 'home',
      currentPayment: null,
      recentPayees: [],
      
      // Setters
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setActiveView: (activeView) => set({ activeView }),
      setUnlocked: (isUnlocked) => {
        set({ isUnlocked })
        // Update activity when unlocked
        if (isUnlocked) {
          get().updateActivity()
        }
      },
      setCurrentPayment: (currentPayment) => set({ currentPayment }),
      
      // Update last activity timestamp (call this on user interactions)
      updateActivity: () => set({ lastActivityTime: Date.now() }),
      
      // Check Authentication Status
      checkAuth: async () => {
        // First check if we already have user from persisted state
        const existingUser = get().user
        if (existingUser) {
          console.log('[Store] Using persisted user:', existingUser.email)
          
          // Always require PIN on open - no grace period
          set({ 
            isLoading: false,
            isUnlocked: false  // Always locked
          })
          
          // Refresh user data from Firebase in background (don't block)
          authService.getCurrentUser().then(freshUser => {
            if (freshUser) {
              set({ user: freshUser })
            }
          }).catch(() => {})
          
          return
        }
        
        // No persisted user, do full auth check
        set({ isLoading: true })
        try {
          console.log('[Store] Checking auth from Firebase...')
          const user = await authService.getCurrentUser()
          console.log('[Store] Auth check result:', user ? user.email : 'no user')
          
          set({ 
            user, 
            isAuthenticated: !!user, 
            isLoading: false, 
            isUnlocked: false  // Always require PIN
          })
        } catch (error) {
          console.error('[Store] Auth check error:', error)
          // Don't clear on error - keep existing state
          set({ isLoading: false })
        }
      },
      
      // Login
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const result = await authService.login(email, password)
          if (result.success && result.user) {
            set({ user: result.user, isAuthenticated: true, isLoading: false, isUnlocked: false })
            
            // Load recent payees
            if (USE_FIREBASE) {
              get().loadRecentPayees()
            }
            
            return { success: true }
          }
          set({ isLoading: false })
          return { success: false, error: result.error }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, error: 'Login failed' }
        }
      },
      
      // Register
      register: async (data) => {
        set({ isLoading: true })
        try {
          const result = await authService.register(data)
          if (result.success && result.user) {
            set({ user: result.user, isAuthenticated: true, isLoading: false, isUnlocked: true })
            return { success: true, message: result.message }
          }
          set({ isLoading: false })
          return { success: false, error: result.error }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, error: 'Registration failed' }
        }
      },
      
      // Logout
      logout: async () => {
        await authService.logout()
        set({ 
          user: null, 
          isAuthenticated: false, 
          isUnlocked: false, 
          activeView: 'home',
          currentPayment: null,
          recentPayees: []
        })
      },
      
      // Add Money (legacy - not used in new architecture)
      addMoney: async (amount) => {
        if (USE_FIREBASE) {
          return { success: false, error: 'Not supported in new architecture' }
        }
        const { user } = get()
        if (!user) return { success: false, error: 'Not authenticated' }
        
        try {
          const result = await localAuthService.addMoney(amount)
          if (result.success) {
            await get().refreshUser()
            return { success: true }
          }
          return { success: false, error: result.error }
        } catch {
          return { success: false, error: 'Failed to add money' }
        }
      },
      
      // Send Money (legacy - use createPaymentRequest in new architecture)
      sendMoney: async (recipientUpiId, recipientName, amount, note) => {
        if (USE_FIREBASE) {
          // In new architecture, this creates a payment request instead
          const result = await get().createPaymentRequest({
            upiId: recipientUpiId,
            name: recipientName,
            amount,
            note
          })
          return { success: result.success, error: result.error }
        }
        
        const { user } = get()
        if (!user) return { success: false, error: 'Not authenticated' }
        if (user.balance < amount) return { success: false, error: 'Insufficient balance' }
        
        try {
          const result = await localAuthService.sendMoney(recipientUpiId, recipientName, amount, note)
          if (result.success) {
            await get().refreshUser()
            return { success: true }
          }
          return { success: false, error: result.error }
        } catch {
          return { success: false, error: 'Transaction failed' }
        }
      },
      
      // Refresh User Data
      refreshUser: async () => {
        try {
          const user = await authService.getCurrentUser()
          if (user) {
            set({ user })
          }
        } catch {
          // Silent fail
        }
      },

      // Update Avatar
      updateAvatar: async (avatarUrl) => {
        const { user } = get()
        if (!user) return { success: false, error: 'Not authenticated' }
        
        try {
          if (USE_FIREBASE) {
            const result = await firebaseAuthService.updateProfile({ avatarUrl })
            if (result.success) {
              set({ user: result.user })
              return { success: true }
            }
            return { success: false, error: result.error }
          } else {
            const result = await localAuthService.updateAvatar(user.id, avatarUrl)
            if (result.success) {
              await get().refreshUser()
              return { success: true }
            }
            return { success: false, error: result.error }
          }
        } catch {
          return { success: false, error: 'Failed to update avatar' }
        }
      },

      // Remove Avatar
      removeAvatar: async () => {
        const { user } = get()
        if (!user) return { success: false, error: 'Not authenticated' }
        
        try {
          if (USE_FIREBASE) {
            const result = await firebaseAuthService.updateProfile({ avatarUrl: '' })
            if (result.success) {
              set({ user: result.user })
              return { success: true }
            }
            return { success: false, error: result.error }
          } else {
            const result = await localAuthService.removeAvatar(user.id)
            if (result.success) {
              await get().refreshUser()
              return { success: true }
            }
            return { success: false, error: result.error }
          }
        } catch {
          return { success: false, error: 'Failed to remove avatar' }
        }
      },
      
      // Create Payment Request (new bridge architecture)
      createPaymentRequest: async (data) => {
        if (!USE_FIREBASE) {
          return { success: false, error: 'Firebase not enabled' }
        }
        
        const { user } = get()
        if (!user) return { success: false, error: 'Not authenticated' }
        
        try {
          const result = await paymentService.createPaymentRequest(data)
          if (result.success && result.paymentRequest) {
            set({ currentPayment: result.paymentRequest })
            // Refresh recent payees
            get().loadRecentPayees()
            return { success: true, paymentRequest: result.paymentRequest }
          }
          return { success: false, error: result.error }
        } catch {
          return { success: false, error: 'Failed to create payment request' }
        }
      },
      
      // Load Recent Payees
      loadRecentPayees: async () => {
        if (!USE_FIREBASE) return
        
        try {
          const payees = await paymentService.getRecentPayees(5)
          set({ recentPayees: payees })
        } catch {
          // Silent fail
        }
      },
    }),
    {
      name: 'exepay-storage',
      storage: createJSONStorage(() => chromeStorage),
      partialize: (state): PersistedState => ({ 
        // Only persist these fields
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isUnlocked: state.isUnlocked,
        lastActivityTime: state.lastActivityTime,
        activeView: state.activeView,
      }),
    }
  )
)
