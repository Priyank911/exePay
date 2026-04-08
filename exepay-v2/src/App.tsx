import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/useStore'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import PinLock from './components/PinLock'
import PinSetup from './components/PinSetup'
import { firebaseAuthService } from './services/firebaseAuthService'
import './App.css'

// ExePay Logo Component
const Logo = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="4" width="40" height="40" rx="12" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M16 18h16M16 24h12M16 30h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="34" cy="30" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
  </svg>
)

function App() {
  const { user, isLoading, isUnlocked, checkAuth, setUnlocked } = useStore()
  const [needsPinSetup, setNeedsPinSetup] = useState(false)
  const [checkingPin, setCheckingPin] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Check if user has PIN set
  useEffect(() => {
    const checkPinStatus = async () => {
      if (user) {
        setCheckingPin(true)
        const hasPin = await firebaseAuthService.hasPin(user.id)
        setNeedsPinSetup(!hasPin)
        setCheckingPin(false)
      } else {
        setCheckingPin(false)
        setNeedsPinSetup(false)
      }
    }
    checkPinStatus()
  }, [user])

  if (isLoading || checkingPin) {
    return (
      <div className="app-loading">
        <motion.div 
          className="loading-logo"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Logo />
        </motion.div>
        <div className="loading-spinner" />
        <motion.span 
          className="loading-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          ExePay
        </motion.span>
      </div>
    )
  }

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: '100%' }}
          >
            <AuthPage />
          </motion.div>
        ) : needsPinSetup ? (
          <motion.div
            key="pin-setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: '100%' }}
          >
            <PinSetup 
              userId={user.id} 
              onComplete={() => {
                setNeedsPinSetup(false)
                setUnlocked(true)
              }} 
            />
          </motion.div>
        ) : !isUnlocked ? (
          <motion.div
            key="pin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: '100%' }}
          >
            <PinLock userId={user.id} onUnlock={() => setUnlocked(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: '100%' }}
          >
            <Dashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
