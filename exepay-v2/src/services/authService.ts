// ExePay v2 - Authentication Service
// Secure client-side authentication with Chrome Storage API

import type { User, AuthResult, TransactionResult, Transaction, Contact, PinResult } from '../types'

// Max contacts to show in recent (older ones stored but hidden)
const MAX_RECENT_CONTACTS = 5

// Crypto utilities for secure hashing
const crypto = {
  // Generate secure random ID
  generateId: (prefix: string = 'id'): string => {
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${prefix}_${hex}`
  },

  // Hash password with PBKDF2 (more secure than SHA-256)
  hashPassword: async (password: string, salt?: string): Promise<{ hash: string; salt: string }> => {
    const useSalt = salt || window.crypto.getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
    
    const encoder = new TextEncoder()
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(useSalt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    )
    
    const hash = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return { hash, salt: useSalt }
  },

  // Verify password
  verifyPassword: async (password: string, storedHash: string, salt: string): Promise<boolean> => {
    const { hash } = await crypto.hashPassword(password, salt)
    return hash === storedHash
  },

  // Generate payment address
  generatePaymentAddress: (userId: string): string => {
    const random = window.crypto.getRandomValues(new Uint8Array(8))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
    return `exepay.${userId.slice(-8)}${random}@pay`
  }
}

// Storage abstraction (works in extension and web)
const storage = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(key)
        return (result[key] as T) ?? null
      }
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) as T : null
    } catch {
      return null
    }
  },

  set: async (key: string, value: unknown): Promise<void> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: value })
      } else {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.error('Storage error:', error)
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(key)
      } else {
        localStorage.removeItem(key)
      }
    } catch {
      // Silent fail
    }
  }
}

// Validation utilities
const validate = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  },

  mobile: (mobile: string): boolean => {
    // Indian mobile format: 10 digits starting with 6-9
    const regex = /^[6-9]\d{9}$/
    return regex.test(mobile)
  },

  password: (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' }
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain an uppercase letter' }
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain a lowercase letter' }
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain a number' }
    }
    return { valid: true }
  }
}

// Auth Service
class AuthService {
  private USERS_KEY = 'exepay_users'
  private SESSION_KEY = 'exepay_session'

  // Get all users
  private async getUsers(): Promise<Array<User & { passwordHash: string; salt: string }>> {
    return await storage.get(this.USERS_KEY) || []
  }

  // Save users
  private async saveUsers(users: Array<User & { passwordHash: string; salt: string }>): Promise<void> {
    await storage.set(this.USERS_KEY, users)
  }

  // Register new user (now requires PIN)
  async register(data: {
    name: string
    email: string
    mobile: string
    password: string
    pin: string
  }): Promise<AuthResult> {
    try {
      // Validate inputs
      if (!data.name.trim()) {
        return { success: false, error: 'Name is required' }
      }
      if (!validate.email(data.email)) {
        return { success: false, error: 'Invalid email format' }
      }
      if (!validate.mobile(data.mobile)) {
        return { success: false, error: 'Invalid mobile number (10 digits starting with 6-9)' }
      }
      const passwordCheck = validate.password(data.password)
      if (!passwordCheck.valid) {
        return { success: false, error: passwordCheck.error }
      }
      // Validate PIN (4-6 digits)
      if (!/^\d{4,6}$/.test(data.pin)) {
        return { success: false, error: 'PIN must be 4-6 digits' }
      }

      // Check if user exists
      const users = await this.getUsers()
      const exists = users.find(u => u.email === data.email || u.mobile === data.mobile)
      if (exists) {
        return { success: false, error: 'User already exists with this email or mobile' }
      }

      // Create user
      const userId = crypto.generateId('user')
      const { hash, salt } = await crypto.hashPassword(data.password)
      const { hash: pinHash } = await crypto.hashPassword(data.pin, salt)
      
      const newUser = {
        id: userId,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        mobile: data.mobile.trim(),
        balance: 0,
        paymentAddress: crypto.generatePaymentAddress(userId),
        transactions: [],
        contacts: [],
        createdAt: new Date().toISOString(),
        isVerified: false,
        pin: pinHash,
        pinLength: data.pin.length,
        passwordHash: hash,
        salt: salt
      }

      // Save user
      users.push(newUser)
      await this.saveUsers(users)

      // Create session (exclude sensitive data)
      const { passwordHash: _, salt: __, pin: ___, ...safeUser } = newUser
      await storage.set(this.SESSION_KEY, safeUser)

      return { success: true, user: safeUser as User }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' }
    }
  }

  // Login
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' }
      }

      const users = await this.getUsers()
      const user = users.find(u => u.email === email.toLowerCase().trim())
      
      if (!user) {
        return { success: false, error: 'Invalid email or password' }
      }

      const isValid = await crypto.verifyPassword(password, user.passwordHash, user.salt)
      if (!isValid) {
        return { success: false, error: 'Invalid email or password' }
      }

      // Ensure contacts array exists (for older accounts)
      if (!user.contacts) {
        user.contacts = []
      }

      // Create session (exclude sensitive data)
      const { passwordHash: _, salt: __, ...safeUser } = user
      await storage.set(this.SESSION_KEY, safeUser)

      return { success: true, user: safeUser }
    } catch (error) {
      return { success: false, error: 'Login failed. Please try again.' }
    }
  }

  // Logout
  async logout(): Promise<void> {
    await storage.remove(this.SESSION_KEY)
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    const session = await storage.get<User>(this.SESSION_KEY)
    if (!session) return null

    // Refresh from users list to get latest data
    const users = await this.getUsers()
    const user = users.find(u => u.id === session.id)
    if (!user) return null

    // Ensure contacts array exists
    if (!user.contacts) {
      user.contacts = []
    }

    const { passwordHash: _, salt: __, ...safeUser } = user
    await storage.set(this.SESSION_KEY, safeUser)
    return safeUser
  }

  // Add money to wallet
  async addMoney(amount: number): Promise<TransactionResult> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'Invalid amount' }
      }

      const currentUser = await this.getCurrentUser()
      if (!currentUser) {
        return { success: false, error: 'Not authenticated' }
      }

      const users = await this.getUsers()
      const userIndex = users.findIndex(u => u.id === currentUser.id)
      if (userIndex === -1) {
        return { success: false, error: 'User not found' }
      }

      const transaction: Transaction = {
        id: crypto.generateId('txn'),
        type: 'credit',
        amount,
        description: 'Added to wallet',
        timestamp: new Date().toISOString(),
        status: 'completed',
        reference: crypto.generateId('ref')
      }

      users[userIndex].balance += amount
      users[userIndex].transactions = [transaction, ...users[userIndex].transactions]
      
      await this.saveUsers(users)

      return { 
        success: true, 
        transaction, 
        balance: users[userIndex].balance 
      }
    } catch (error) {
      return { success: false, error: 'Failed to add money' }
    }
  }

  // Send money (with contact tracking)
  async sendMoney(
    recipientUpiId: string, 
    recipientName: string,
    amount: number, 
    note?: string
  ): Promise<TransactionResult> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'Invalid amount' }
      }

      const currentUser = await this.getCurrentUser()
      if (!currentUser) {
        return { success: false, error: 'Not authenticated' }
      }

      if (currentUser.balance < amount) {
        return { success: false, error: 'Insufficient balance' }
      }

      const users = await this.getUsers()
      const senderIndex = users.findIndex(u => u.id === currentUser.id)
      
      if (senderIndex === -1) {
        return { success: false, error: 'User not found' }
      }

      // Create transaction
      const transaction: Transaction = {
        id: crypto.generateId('txn'),
        type: 'debit',
        amount,
        description: note || `Payment to ${recipientName}`,
        recipientId: recipientUpiId,
        recipientName: recipientName,
        recipientUpiId: recipientUpiId,
        timestamp: new Date().toISOString(),
        status: 'completed',
        reference: crypto.generateId('ref')
      }

      // Update balance and transactions
      users[senderIndex].balance -= amount
      users[senderIndex].transactions = [transaction, ...users[senderIndex].transactions]
      
      // Update contacts
      if (!users[senderIndex].contacts) {
        users[senderIndex].contacts = []
      }
      
      const existingContactIndex = users[senderIndex].contacts.findIndex(
        c => c.upiId === recipientUpiId
      )

      if (existingContactIndex !== -1) {
        // Update existing contact
        const contact = users[senderIndex].contacts[existingContactIndex]
        contact.lastPaidAt = new Date().toISOString()
        contact.totalPaid += amount
        contact.paymentCount += 1
        // Move to front (most recent)
        users[senderIndex].contacts.splice(existingContactIndex, 1)
        users[senderIndex].contacts.unshift(contact)
      } else {
        // Add new contact
        const newContact: Contact = {
          id: crypto.generateId('contact'),
          name: recipientName,
          upiId: recipientUpiId,
          lastPaidAt: new Date().toISOString(),
          totalPaid: amount,
          paymentCount: 1
        }
        users[senderIndex].contacts.unshift(newContact)
      }
      
      await this.saveUsers(users)

      return { 
        success: true, 
        transaction, 
        balance: users[senderIndex].balance 
      }
    } catch (error) {
      return { success: false, error: 'Transaction failed' }
    }
  }

  // Get recent contacts (limited)
  getRecentContacts(user: User): Contact[] {
    if (!user.contacts) return []
    return user.contacts.slice(0, MAX_RECENT_CONTACTS)
  }

  // Get all contacts (for contacts page)
  getAllContacts(user: User): Contact[] {
    return user.contacts || []
  }

  // Update profile
  async updateProfile(updates: Partial<User>): Promise<AuthResult> {
    try {
      const currentUser = await this.getCurrentUser()
      if (!currentUser) {
        return { success: false, error: 'Not authenticated' }
      }

      const users = await this.getUsers()
      const userIndex = users.findIndex(u => u.id === currentUser.id)
      
      if (userIndex === -1) {
        return { success: false, error: 'User not found' }
      }

      // Only allow safe updates
      const safeUpdates = {
        name: updates.name?.trim(),
        avatar: updates.avatar
      }

      Object.entries(safeUpdates).forEach(([key, value]) => {
        if (value !== undefined) {
          (users[userIndex] as any)[key] = value
        }
      })

      await this.saveUsers(users)
      
      const { passwordHash: _, salt: __, pin: ___, ...safeUser } = users[userIndex]
      await storage.set(this.SESSION_KEY, safeUser)

      return { success: true, user: safeUser as User }
    } catch (error) {
      return { success: false, error: 'Failed to update profile' }
    }
  }

  // Verify PIN (for app unlock)
  async verifyPin(userId: string, pin: string): Promise<PinResult> {
    try {
      const users = await this.getUsers()
      const user = users.find(u => u.id === userId)
      
      if (!user || !user.pin) {
        return { success: false, error: 'User not found' }
      }

      const isValid = await crypto.verifyPassword(pin, user.pin, user.salt)
      if (!isValid) {
        return { success: false, error: 'Invalid PIN' }
      }

      return { success: true }
    } catch {
      return { success: false, error: 'PIN verification failed' }
    }
  }

  // Check if user has PIN set
  async hasPin(userId: string): Promise<boolean> {
    const users = await this.getUsers()
    const user = users.find(u => u.id === userId)
    return !!(user?.pin)
  }

  // Get PIN length for validation
  async getPinLength(userId: string): Promise<number> {
    const users = await this.getUsers()
    const user = users.find(u => u.id === userId)
    return user?.pinLength || 4
  }

  // Set/Update PIN
  async setPin(userId: string, newPin: string): Promise<PinResult> {
    try {
      if (!/^\d{4,6}$/.test(newPin)) {
        return { success: false, error: 'PIN must be 4-6 digits' }
      }

      const users = await this.getUsers()
      const userIndex = users.findIndex(u => u.id === userId)
      
      if (userIndex === -1) {
        return { success: false, error: 'User not found' }
      }

      const { hash } = await crypto.hashPassword(newPin, users[userIndex].salt)
      users[userIndex].pin = hash
      users[userIndex].pinLength = newPin.length
      
      await this.saveUsers(users)
      return { success: true }
    } catch {
      return { success: false, error: 'Failed to set PIN' }
    }
  }

  // Update avatar URL
  async updateAvatar(userId: string, avatarUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const users = await this.getUsers()
      const userIndex = users.findIndex(u => u.id === userId)
      
      if (userIndex === -1) {
        return { success: false, error: 'User not found' }
      }

      users[userIndex].avatar = avatarUrl
      await this.saveUsers(users)
      return { success: true }
    } catch {
      return { success: false, error: 'Failed to update avatar' }
    }
  }

  // Remove avatar
  async removeAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const users = await this.getUsers()
      const userIndex = users.findIndex(u => u.id === userId)
      
      if (userIndex === -1) {
        return { success: false, error: 'User not found' }
      }

      delete users[userIndex].avatar
      await this.saveUsers(users)
      return { success: true }
    } catch {
      return { success: false, error: 'Failed to remove avatar' }
    }
  }
}

export const authService = new AuthService()
export { validate, crypto }
