// ExePay v2 - PIN Setup Screen
// For users who need to set up their PIN (new or reinstalled extension)

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { firebaseAuthService } from '../services/firebaseAuthService'
import '../styles/PinLock.css'

interface PinSetupProps {
  userId: string
  onComplete: () => void
}

const PinSetup = ({ userId, onComplete }: PinSetupProps) => {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage] = useState<'create' | 'confirm'>('create')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [shake, setShake] = useState(false)

  const PIN_LENGTH = 4 // Default PIN length

  const handleKeyPress = useCallback((digit: string) => {
    if (isProcessing) return
    setError('')

    if (stage === 'create') {
      if (pin.length >= PIN_LENGTH) return
      const newPin = pin + digit
      setPin(newPin)
      
      // Auto-advance to confirm stage
      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => setStage('confirm'), 200)
      }
    } else {
      if (confirmPin.length >= PIN_LENGTH) return
      const newConfirm = confirmPin + digit
      setConfirmPin(newConfirm)
      
      // Auto-verify when confirm is complete
      if (newConfirm.length === PIN_LENGTH) {
        setTimeout(() => verifyAndSave(newConfirm), 100)
      }
    }
  }, [pin, confirmPin, stage, isProcessing])

  const handleDelete = useCallback(() => {
    if (isProcessing) return
    setError('')
    if (stage === 'create') {
      setPin(prev => prev.slice(0, -1))
    } else {
      setConfirmPin(prev => prev.slice(0, -1))
    }
  }, [stage, isProcessing])

  const verifyAndSave = async (confirm: string) => {
    if (confirm !== pin) {
      setShake(true)
      setError('PINs do not match')
      setConfirmPin('')
      setTimeout(() => setShake(false), 500)
      return
    }

    setIsProcessing(true)
    const result = await firebaseAuthService.setPin(userId, pin)
    
    if (result.success) {
      onComplete()
    } else {
      setShake(true)
      setError(result.error || 'Failed to set PIN')
      setPin('')
      setConfirmPin('')
      setStage('create')
      setTimeout(() => setShake(false), 500)
    }
    setIsProcessing(false)
  }

  const handleBack = () => {
    if (stage === 'confirm') {
      setStage('create')
      setConfirmPin('')
      setError('')
    }
  }

  const currentPin = stage === 'create' ? pin : confirmPin
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

      {/* Title */}
      <motion.div 
        className="pin-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}
      >
        {stage === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
      </motion.div>

      {/* PIN Dots */}
      <motion.div 
        className={`pin-dots ${shake ? 'shake' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[...Array(PIN_LENGTH)].map((_, i) => (
          <motion.div
            key={i}
            className={`pin-dot ${i < currentPin.length ? 'filled' : ''}`}
            animate={i < currentPin.length ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.12 }}
          />
        ))}
      </motion.div>

      {/* Message */}
      <motion.div 
        className="pin-message"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {error ? (
          <span className="pin-error">{error}</span>
        ) : (
          <span className="pin-hint">
            {stage === 'create' 
              ? 'Enter a 4-digit PIN to secure your wallet' 
              : 'Enter your PIN again to confirm'}
          </span>
        )}
      </motion.div>

      {/* Back button for confirm stage */}
      {stage === 'confirm' && (
        <motion.button
          className="pin-back-btn"
          onClick={handleBack}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            marginBottom: '12px',
            fontSize: '13px'
          }}
        >
          ← Change PIN
        </motion.button>
      )}

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
            disabled={key === '' || isProcessing}
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

export default PinSetup
