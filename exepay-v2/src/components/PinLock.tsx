// ExePay v2 - PIN Lock Screen
// Modern design with centered layout

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { firebaseAuthService } from '../services/firebaseAuthService'
import '../styles/PinLock.css'

interface PinLockProps {
  userId: string
  onUnlock: () => void
}

const PinLock = ({ userId, onUnlock }: PinLockProps) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [shake, setShake] = useState(false)
  const [pinLength, setPinLength] = useState(6) // Default, will be fetched

  // Fetch actual PIN length on mount
  useEffect(() => {
    firebaseAuthService.getPinLength(userId).then(length => {
      setPinLength(length)
    })
  }, [userId])

  const handleKeyPress = useCallback((digit: string) => {
    if (pin.length >= pinLength || isVerifying) return
    setError('')
    setPin(prev => prev + digit)
  }, [pin, pinLength, isVerifying])

  const handleDelete = useCallback(() => {
    if (isVerifying) return
    setPin(prev => prev.slice(0, -1))
    setError('')
  }, [isVerifying])

  const verifyPin = useCallback(async () => {
    setIsVerifying(true)
    const result = await firebaseAuthService.verifyPin(userId, pin)
    
    if (result.success) {
      setTimeout(() => onUnlock(), 150)
    } else {
      setShake(true)
      setError('Wrong PIN')
      setPin('')
      setTimeout(() => setShake(false), 500)
    }
    setIsVerifying(false)
  }, [pin, userId, onUnlock])

  // Only verify when full PIN length is entered
  useEffect(() => {
    if (pin.length === pinLength) {
      const timer = setTimeout(verifyPin, 100)
      return () => clearTimeout(timer)
    }
  }, [pin, pinLength, verifyPin])

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key)
      } else if (e.key === 'Backspace') {
        handleDelete()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress, handleDelete])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="pin-lock">
      {/* Logo */}
      <motion.div 
        className="pin-logo"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="pin-logo-icon">
          <img src="/icons/logo.png" alt="ExePay" />
        </div>
        <span>ExePay</span>
      </motion.div>

      {/* PIN Dots */}
      <motion.div 
        className={`pin-dots ${shake ? 'shake' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[...Array(pinLength)].map((_, i) => (
          <motion.div
            key={i}
            className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
            animate={i < pin.length ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.12 }}
          />
        ))}
      </motion.div>

      {/* Hint / Error */}
      <motion.div 
        className="pin-message"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <AnimatePresence mode="wait">
          {error ? (
            <motion.span
              key="error"
              className="pin-error"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              {error}
            </motion.span>
          ) : (
            <motion.span
              key="hint"
              className="pin-hint"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Enter your PIN to unlock
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Keypad */}
      <motion.div 
        className="pin-keypad"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {keys.map((key, i) => (
          <motion.button
            key={i}
            className={`pin-key ${key === 'del' ? 'del-key' : ''} ${key === '' ? 'empty-key' : ''}`}
            onClick={() => {
              if (key === 'del') handleDelete()
              else if (key) handleKeyPress(key)
            }}
            disabled={key === '' || isVerifying}
            whileTap={key ? { scale: 0.92, backgroundColor: 'rgba(220, 38, 38, 0.15)' } : {}}
          >
            {key === 'del' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              key
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}

export default PinLock
