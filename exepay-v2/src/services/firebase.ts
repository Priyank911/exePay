// Firebase Configuration for ExePay v2
// This file initializes Firebase services for the extension

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  type User as FirebaseUserType,
  type ConfirmationResult
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyApVXvmII6P7j20jlrh61XP4soynGfc50I",
  authDomain: "collabbubble-b4327.firebaseapp.com",
  projectId: "collabbubble-b4327",
  storageBucket: "collabbubble-b4327.firebasestorage.app",
  messagingSenderId: "1082165590144",
  appId: "1:1082165590144:web:efba6f5962714e94d38e65"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Collection references
export const COLLECTIONS = {
  USERS: 'users',
  PAYMENT_REQUESTS: 'payment_requests',
  RECENT_PAYEES: 'recent_payees'
} as const;

// Export Firebase types
export type { FirebaseUserType, ConfirmationResult };
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
};

export default app;
