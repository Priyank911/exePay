// ExePay v2 - Payment Modal Component
// Premium dark design

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { qrService } from '../services/qrService'
import type { QRPaymentData } from '../types'
import '../styles/PaymentModal.css'

interface Props {
  data: QRPaymentData
  onClose: () => void
  onSuccess?: () => void
  onFailed?: () => void
}

type Step = 'review' | 'confirm' | 'processing' | 'success' | 'failed'

const PaymentModal = ({ data, onClose, onSuccess, onFailed }: Props) => {
  const { user, sendMoney, refreshUser } = useStore()
  const [step, setStep] = useState<Step>('review')
  const [amount, setAmount] = useState(data.amount?.toString() || '')
  const [error, setError] = useState('')

  const formatCurrency = (value: number) => qrService.formatCurrency(value)

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmount(val)
      setError('')
    }
  }

  const validatePayment = () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      setError('Enter a valid amount')
      return false
    }
    if (user && numAmount > user.balance) {
      setError('Insufficient balance')
      return false
    }
    return true
  }

  const handleContinue = () => {
    if (validatePayment()) {
      setStep('confirm')
    }
  }

  const handlePay = async () => {
    if (!validatePayment()) return

    setStep('processing')
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      const result = await sendMoney(
        data.merchantId,
        data.merchantName,
        parseFloat(amount),
        `Payment to ${data.merchantName}`
      )

      if (result.success) {
        await refreshUser()
        setStep('success')
      } else {
        setError(result.error || 'Payment failed')
        setStep('failed')
      }
    } catch {
      setError('Payment failed')
      setStep('failed')
    }
  }

  // Auto redirect after success/fail
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        onSuccess ? onSuccess() : onClose()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [step, onSuccess, onClose])

  const handleFailedAction = (action: 'retry' | 'back') => {
    if (action === 'retry') {
      setStep('review')
      setError('')
    } else {
      onFailed ? onFailed() : onClose()
    }
  }

  const numAmount = parseFloat(amount) || 0
  const balanceAfter = user ? user.balance - numAmount : 0

  return (
    <motion.div
      className="payment-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && step === 'review' && onClose()}
    >
      <motion.div
        className="payment-modal"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        {step === 'review' && (
          <div className="modal-header">
            <h3>Pay</h3>
            <button className="close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="modal-content">
          {step === 'review' && (
            <motion.div
              className="step-review"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {/* Merchant Info */}
              <div className="merchant-card">
                <div className="merchant-avatar">
                  {data.merchantName.charAt(0).toUpperCase()}
                </div>
                <div className="merchant-details">
                  <span className="merchant-name">{data.merchantName}</span>
                  <span className="merchant-id">{data.merchantId}</span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="amount-section">
                <div className={`amount-input-wrap ${error ? 'error' : ''} ${amount ? 'has-value' : ''}`}>
                  <span className="currency-symbol">₹</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0"
                    autoFocus={!data.amount}
                    readOnly={!!data.amount}
                  />
                </div>
                {error && (
                  <motion.span 
                    className="error-text"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.span>
                )}
              </div>

              {/* Balance Info */}
              <div className="balance-preview">
                <div className="balance-row">
                  <span>Balance</span>
                  <span className="balance-value">{formatCurrency(user?.balance || 0)}</span>
                </div>
                {numAmount > 0 && (
                  <motion.div 
                    className="balance-row after"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span>After</span>
                    <span className={`balance-value ${balanceAfter < 0 ? 'negative' : ''}`}>
                      {formatCurrency(Math.max(0, balanceAfter))}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <motion.button 
                  className="btn-pay"
                  onClick={handleContinue}
                  whileTap={{ scale: 0.98 }}
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div
              className="step-confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="confirm-visual">
                <div className="confirm-amount">{formatCurrency(numAmount)}</div>
                <div className="confirm-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="confirm-recipient">
                  <div className="recipient-avatar">
                    {data.merchantName.charAt(0).toUpperCase()}
                  </div>
                  <span>{data.merchantName}</span>
                </div>
              </div>

              <div className="modal-actions two-col">
                <motion.button 
                  className="btn-back" 
                  onClick={() => setStep('review')}
                  whileTap={{ scale: 0.98 }}
                >
                  Back
                </motion.button>
                <motion.button 
                  className="btn-pay" 
                  onClick={handlePay}
                  whileTap={{ scale: 0.98 }}
                >
                  Pay Now
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              className="step-processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="processing-visual">
                <div className="processing-ring">
                  <svg viewBox="0 0 50 50">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
                    <circle cx="25" cy="25" r="20" fill="none" stroke="white" strokeWidth="3" 
                      strokeDasharray="31.4 94.2" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <p className="processing-text">Processing payment...</p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              className="step-success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <div className="success-visual">
                <motion.div 
                  className="success-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 10 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              </div>
              <h4>Paid!</h4>
              <p className="success-amount">{formatCurrency(numAmount)}</p>
              <p className="success-to">to {data.merchantName}</p>
            </motion.div>
          )}

          {step === 'failed' && (
            <motion.div
              className="step-failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="failed-visual">
                <div className="failed-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <h4>Failed</h4>
              <p className="failed-reason">{error || 'Something went wrong'}</p>
              
              <div className="modal-actions two-col">
                <motion.button 
                  className="btn-back" 
                  onClick={() => handleFailedAction('back')}
                  whileTap={{ scale: 0.98 }}
                >
                  Back
                </motion.button>
                <motion.button 
                  className="btn-pay" 
                  onClick={() => handleFailedAction('retry')}
                  whileTap={{ scale: 0.98 }}
                >
                  Retry
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default PaymentModal
