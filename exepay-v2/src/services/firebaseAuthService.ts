// ExePay v2 - Firebase Auth Service
// Handles user authentication with Firebase

import { 
  auth, 
  db, 
  COLLECTIONS,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  type ConfirmationResult
} from './firebase';

import type { User, AuthResult, PinResult } from '../types';

// Crypto utilities for secure hashing (PIN stored locally)
const crypto = {
  // Generate secure random ID
  generateId: (prefix: string = 'id'): string => {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
  },

  // Hash PIN with PBKDF2
  hashPin: async (pin: string, salt?: string): Promise<{ hash: string; salt: string }> => {
    const useSalt = salt || window.crypto.getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(useSalt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const hash = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return { hash, salt: useSalt };
  },

  // Verify PIN
  verifyPin: async (pin: string, storedHash: string, salt: string): Promise<boolean> => {
    const { hash } = await crypto.hashPin(pin, salt);
    return hash === storedHash;
  }
};

// Storage abstraction for PIN (local only - never sent to server)
const storage = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(key);
        console.log(`[Storage] Get "${key}":`, result[key] ? 'found' : 'not found');
        return (result[key] as T) ?? null;
      }
      const item = localStorage.getItem(key);
      console.log(`[Storage] LocalStorage get "${key}":`, item ? 'found' : 'not found');
      return item ? JSON.parse(item) as T : null;
    } catch (error) {
      console.error(`[Storage] Error getting "${key}":`, error);
      return null;
    }
  },

  set: async (key: string, value: unknown): Promise<void> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: value });
        console.log(`[Storage] Saved "${key}" to chrome.storage`);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`[Storage] Saved "${key}" to localStorage`);
      }
    } catch (error) {
      console.error('[Storage] Error:', error);
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(key);
        console.log(`[Storage] Removed "${key}" from chrome.storage`);
      } else {
        localStorage.removeItem(key);
        console.log(`[Storage] Removed "${key}" from localStorage`);
      }
    } catch {
      // Silent fail
    }
  }
};

// Validation utilities
const validate = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  mobile: (mobile: string): boolean => {
    // Indian mobile format: 10 digits starting with 6-9
    const regex = /^[6-9]\d{9}$/;
    return regex.test(mobile);
  },

  password: (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain an uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain a lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain a number' };
    }
    return { valid: true };
  },

  pin: (pin: string): { valid: boolean; error?: string } => {
    if (!/^\d{4,6}$/.test(pin)) {
      return { valid: false, error: 'PIN must be 4-6 digits' };
    }
    return { valid: true };
  }
};

// Firebase User type from Firestore
interface FirestoreUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  mobileVerified: boolean;
  emailVerified: boolean;
  avatarUrl?: string;
  fcmToken?: string;
  createdAt: any;
  updatedAt: any;
}

// Local PIN storage type
interface LocalPinData {
  pinHash: string;
  pinSalt: string;
  pinLength: number;
}

// Firebase Auth Service
class FirebaseAuthService {
  private SESSION_KEY = 'exepay_firebase_session';
  private PIN_KEY = 'exepay_pin_data';

  // Initialize auth state listener
  init(onAuthChange: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await this.getUserFromFirestore(firebaseUser.uid);
        onAuthChange(user);
      } else {
        onAuthChange(null);
      }
    });
  }

  // Get user from Firestore
  private async getUserFromFirestore(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (!userDoc.exists()) return null;
      
      const data = userDoc.data() as FirestoreUser;
      
      // Convert to User type
      const user: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        balance: 0, // No balance in new system
        paymentAddress: '', // Not used in new system
        transactions: [], // Will be separate collection
        contacts: [], // Will be separate collection
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        isVerified: data.emailVerified && data.mobileVerified,
        avatar: data.avatarUrl,
        mobileVerified: data.mobileVerified,
        emailVerified: data.emailVerified
      };

      // Store session locally
      await storage.set(this.SESSION_KEY, user);
      
      return user;
    } catch (error) {
      console.error('Error getting user from Firestore:', error);
      return null;
    }
  }

  // Register new user
  async register(data: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    pin: string;
  }): Promise<AuthResult> {
    try {
      // Validate inputs
      if (!data.name.trim()) {
        return { success: false, error: 'Name is required' };
      }
      if (!validate.email(data.email)) {
        return { success: false, error: 'Invalid email format' };
      }
      if (!validate.mobile(data.mobile)) {
        return { success: false, error: 'Invalid mobile number (10 digits starting with 6-9)' };
      }
      const passwordCheck = validate.password(data.password);
      if (!passwordCheck.valid) {
        return { success: false, error: passwordCheck.error };
      }
      const pinCheck = validate.pin(data.pin);
      if (!pinCheck.valid) {
        return { success: false, error: pinCheck.error };
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email.toLowerCase().trim(),
        data.password
      );

      const firebaseUser = userCredential.user;

      // Send email verification
      await sendEmailVerification(firebaseUser);

      // Create user document in Firestore
      const userData: FirestoreUser = {
        id: firebaseUser.uid,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        mobile: data.mobile.trim(),
        mobileVerified: false,
        emailVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), userData);

      // Store PIN locally (never sent to server)
      const { hash: pinHash, salt: pinSalt } = await crypto.hashPin(data.pin);
      const pinData: LocalPinData = {
        pinHash,
        pinSalt,
        pinLength: data.pin.length
      };
      await storage.set(`${this.PIN_KEY}_${firebaseUser.uid}`, pinData);

      // Convert to User type
      const user: User = {
        id: firebaseUser.uid,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        mobile: data.mobile.trim(),
        balance: 0,
        paymentAddress: '',
        transactions: [],
        contacts: [],
        createdAt: new Date().toISOString(),
        isVerified: false,
        mobileVerified: false,
        emailVerified: false
      };

      await storage.set(this.SESSION_KEY, user);

      return {
        success: true, 
        user,
        message: 'Account created successfully!'
      };
    } catch (error: any) {
      // Handle Firebase errors with user-friendly messages
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'This email is already registered. Please login instead.' };
      }
      if (error.code === 'auth/weak-password') {
        return { success: false, error: 'Password is too weak. Please use a stronger password.' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email format.' };
      }
      if (error.code === 'auth/network-request-failed') {
        return { success: false, error: 'Network error. Please check your connection.' };
      }
      if (error.code === 'auth/operation-not-allowed') {
        return { success: false, error: 'Registration is currently disabled.' };
      }
      
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  // Login
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );

      const user = await this.getUserFromFirestore(userCredential.user.uid);
      
      if (!user) {
        return { success: false, error: 'User data not found' };
      }

      return { success: true, user };
    } catch (error: any) {
      // Handle Firebase errors with user-friendly messages
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        return { success: false, error: 'Invalid email or password' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email format' };
      }
      if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many login attempts. Please wait a few minutes.' };
      }
      if (error.code === 'auth/user-disabled') {
        return { success: false, error: 'This account has been disabled.' };
      }
      if (error.code === 'auth/network-request-failed') {
        return { success: false, error: 'Network error. Please check your connection.' };
      }
      if (error.code === 'auth/invalid-credential') {
        return { success: false, error: 'Invalid email or password' };
      }
      
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await signOut(auth);
      await storage.remove(this.SESSION_KEY);
    } catch {
      // Silent fail on logout
    }
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    // Check local session first (Chrome storage is persistent)
    const session = await storage.get<User>(this.SESSION_KEY);
    if (session) {
      console.log('[Auth] Found session in storage:', session.email);
      return session;
    }
    
    // If no session in storage, wait for Firebase auth to initialize
    // This is important for Chrome extensions where auth state takes time to restore
    const firebaseUser = await new Promise<import('firebase/auth').User | null>((resolve) => {
      // First check current state
      if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
      }
      
      // Otherwise wait for auth state to be determined
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
    });
    
    if (firebaseUser) {
      console.log('[Auth] Found Firebase user, fetching from Firestore:', firebaseUser.email);
      const user = await this.getUserFromFirestore(firebaseUser.uid);
      return user;
    }
    
    console.log('[Auth] No user found');
    return null;
  }

  // Verify PIN
  async verifyPin(userId: string, pin: string): Promise<PinResult> {
    try {
      const pinData = await storage.get<LocalPinData>(`${this.PIN_KEY}_${userId}`);
      
      if (!pinData) {
        return { success: false, error: 'PIN not set' };
      }

      const isValid = await crypto.verifyPin(pin, pinData.pinHash, pinData.pinSalt);
      if (!isValid) {
        return { success: false, error: 'Invalid PIN' };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'PIN verification failed' };
    }
  }

  // Check if user has PIN set
  async hasPin(userId: string): Promise<boolean> {
    const pinData = await storage.get<LocalPinData>(`${this.PIN_KEY}_${userId}`);
    return !!pinData;
  }

  // Get PIN length
  async getPinLength(userId: string): Promise<number> {
    const pinData = await storage.get<LocalPinData>(`${this.PIN_KEY}_${userId}`);
    return pinData?.pinLength || 4;
  }

  // Set/Update PIN
  async setPin(userId: string, newPin: string): Promise<PinResult> {
    try {
      const pinCheck = validate.pin(newPin);
      if (!pinCheck.valid) {
        return { success: false, error: pinCheck.error };
      }

      const { hash: pinHash, salt: pinSalt } = await crypto.hashPin(newPin);
      const pinData: LocalPinData = {
        pinHash,
        pinSalt,
        pinLength: newPin.length
      };
      
      await storage.set(`${this.PIN_KEY}_${userId}`, pinData);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to set PIN' };
    }
  }

  // Update profile
  async updateProfile(updates: { name?: string; avatarUrl?: string }): Promise<AuthResult> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return { success: false, error: 'Not authenticated' };
      }

      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (updates.name) {
        updateData.name = updates.name.trim();
      }
      if (updates.avatarUrl !== undefined) {
        updateData.avatarUrl = updates.avatarUrl;
      }

      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), updateData);
      
      const user = await this.getUserFromFirestore(firebaseUser.uid);
      
      return { success: true, user: user! };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  }

  // Update FCM token (for push notifications)
  async updateFcmToken(token: string): Promise<void> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
        fcmToken: token,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Update FCM token error:', error);
    }
  }

  // Resend verification email
  async resendVerificationEmail(): Promise<{ success: boolean; error?: string }> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return { success: false, error: 'Not authenticated' };
      }

      await sendEmailVerification(firebaseUser);
      return { success: true };
    } catch (error: any) {
      if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Please wait before requesting another email' };
      }
      return { success: false, error: 'Failed to send verification email' };
    }
  }

  // Check email verification status
  async checkEmailVerification(): Promise<boolean> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return false;
    
    await firebaseUser.reload();
    
    if (firebaseUser.emailVerified) {
      // Update Firestore
      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
        emailVerified: true,
        updatedAt: serverTimestamp()
      });
    }
    
    return firebaseUser.emailVerified;
  }

  // Phone verification - Store confirmation result
  private phoneConfirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  // Initialize reCAPTCHA verifier (invisible)
  initRecaptcha(containerId: string): void {
    try {
      // Clear existing verifier
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
      }

      this.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
        }
      });
    } catch (error) {
      console.error('reCAPTCHA init error:', error);
    }
  }

  // Send OTP to phone number
  async sendPhoneOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return { success: false, error: 'Not authenticated' };
      }

      // Format phone number with country code
      const formattedNumber = phoneNumber.startsWith('+') 
        ? phoneNumber 
        : `+91${phoneNumber.replace(/\D/g, '')}`;

      if (!this.recaptchaVerifier) {
        return { success: false, error: 'reCAPTCHA not initialized. Please refresh the page.' };
      }

      // Send OTP
      this.phoneConfirmationResult = await signInWithPhoneNumber(
        auth, 
        formattedNumber, 
        this.recaptchaVerifier
      );

      return { success: true };
    } catch (error: any) {
      console.error('Send OTP error:', error);
      
      // Reset reCAPTCHA on error
      if (this.recaptchaVerifier) {
        try {
          this.recaptchaVerifier.clear();
          this.recaptchaVerifier = null;
        } catch {}
      }

      if (error.code === 'auth/invalid-phone-number') {
        return { success: false, error: 'Invalid phone number format' };
      }
      if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many attempts. Please try again later.' };
      }
      if (error.code === 'auth/quota-exceeded') {
        return { success: false, error: 'SMS quota exceeded. Please try again tomorrow.' };
      }
      return { success: false, error: 'Failed to send OTP. Please try again.' };
    }
  }

  // Verify OTP and link phone to account
  async verifyPhoneOTP(otp: string): Promise<{ success: boolean; error?: string }> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!this.phoneConfirmationResult) {
        return { success: false, error: 'No OTP request found. Please request a new OTP.' };
      }

      // Verify OTP and get credential
      const credential = PhoneAuthProvider.credential(
        this.phoneConfirmationResult.verificationId,
        otp
      );

      // Link phone number to existing account
      await linkWithCredential(firebaseUser, credential);

      // Update Firestore
      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
        mobileVerified: true,
        updatedAt: serverTimestamp()
      });

      // Clear confirmation result
      this.phoneConfirmationResult = null;

      return { success: true };
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      
      if (error.code === 'auth/invalid-verification-code') {
        return { success: false, error: 'Invalid OTP. Please check and try again.' };
      }
      if (error.code === 'auth/code-expired') {
        return { success: false, error: 'OTP expired. Please request a new one.' };
      }
      if (error.code === 'auth/credential-already-in-use') {
        return { success: false, error: 'This phone number is already linked to another account.' };
      }
      return { success: false, error: 'Verification failed. Please try again.' };
    }
  }

  // Check if phone is verified
  async checkMobileVerification(): Promise<boolean> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return false;
    
    // Check Firestore for mobile verification status
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
    if (userDoc.exists()) {
      return userDoc.data()?.mobileVerified || false;
    }
    
    return false;
  }

  // Clear reCAPTCHA
  clearRecaptcha(): void {
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch {}
      this.recaptchaVerifier = null;
    }
    this.phoneConfirmationResult = null;
  }
}

export const firebaseAuthService = new FirebaseAuthService();
export { validate, crypto };
