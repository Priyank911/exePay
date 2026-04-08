// ExePay v2 - Verification Page
// Shows email and mobile verification status - redirects to web for OTP

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { firebaseAuthService } from '../services/firebaseAuthService'
import '../styles/VerificationPage.css'

// Icons
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

interface VerificationPageProps {
  onComplete: () => void
  onSkip?: () => void
}

// Web verification URL - update this when deployed
const WEB_VERIFY_URL = 'http://localhost:3000/'

const VerificationPage = ({ onComplete, onSkip }: VerificationPageProps) => {
  const { user, refreshUser } = useStore()
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified || false)
  const [mobileVerified, setMobileVerified] = useState(user?.mobileVerified || false)
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [message, setMessage] = useState('')

  // Check email verification status
  const checkEmailVerification = useCallback(async () => {
    setIsCheckingEmail(true)
    try {
      const verified = await firebaseAuthService.checkEmailVerification()
      setEmailVerified(verified)
      if (verified) {
        await refreshUser()
        setMessage('Email verified!')
      }
    } catch (error) {
      console.error('Check email error:', error)
    } finally {
      setIsCheckingEmail(false)
    }
  }, [refreshUser])

  // Check mobile verification status
  const checkMobileVerification = useCallback(async () => {
    try {
      const verified = await firebaseAuthService.checkMobileVerification()
      setMobileVerified(verified)
      if (verified) {
        await refreshUser()
      }
    } catch (error) {
      console.error('Check mobile error:', error)
    }
  }, [refreshUser])

  // Auto-check verification status every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!emailVerified) {
        checkEmailVerification()
      }
      if (!mobileVerified) {
        checkMobileVerification()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [emailVerified, mobileVerified, checkEmailVerification, checkMobileVerification])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return

    const timer = setTimeout(() => {
      setResendCooldown(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Resend verification email
  const handleResendEmail = async () => {
    if (resendCooldown > 0) return

    setIsResendingEmail(true)
    setMessage('')

    try {
      const result = await firebaseAuthService.resendVerificationEmail()
      if (result.success) {
        setMessage('Verification email sent!')
        setResendCooldown(60)
      } else {
        setMessage(result.error || 'Failed to send email')
      }
    } catch (error) {
      setMessage('Failed to send email')
    } finally {
      setIsResendingEmail(false)
    }
  }

  // Open web verification page for phone OTP
  const openWebVerification = () => {
    // Use Chrome extension API if available, otherwise use window.open
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: WEB_VERIFY_URL })
    } else {
      window.open(WEB_VERIFY_URL, '_blank')
    }
  }

  // Check if all required verifications are complete
  const canProceed = emailVerified // For MVP, only email is required

  return (
    <div className="verification-page">
      <motion.div
        className="verification-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="verification-header">
          <h1>Verify your account</h1>
          <p>Complete verification to start using ExePay</p>
        </div>

        {/* Verification Items */}
        <div className="verification-items">
          {/* Email Verification */}
          <motion.div 
            className={`verification-item ${emailVerified ? 'verified' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="item-icon">
              {emailVerified ? (
                <div className="icon-check">
                  <CheckIcon />
                </div>
              ) : (
                <div className="icon-pending">
                  <MailIcon />
                </div>
              )}
            </div>
            <div className="item-content">
              <div className="item-title">
                Email
                {emailVerified && <span className="verified-badge">Verified</span>}
              </div>
              <div className="item-email">{user?.email}</div>
              {!emailVerified && (
                <div className="item-hint">Check your inbox for verification link</div>
              )}
            </div>
            {!emailVerified && (
              <div className="item-actions">
                <button 
                  className="action-btn refresh-btn"
                  onClick={checkEmailVerification}
                  disabled={isCheckingEmail}
                  title="Check status"
                >
                  <motion.span
                    animate={isCheckingEmail ? { rotate: 360 } : {}}
                    transition={{ duration: 1, repeat: isCheckingEmail ? Infinity : 0, ease: 'linear' }}
                  >
                    <RefreshIcon />
                  </motion.span>
                </button>
              </div>
            )}
          </motion.div>

          {/* Mobile Verification */}
          <motion.div 
            className={`verification-item ${mobileVerified ? 'verified' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="item-icon">
              {mobileVerified ? (
                <div className="icon-check">
                  <CheckIcon />
                </div>
              ) : (
                <div className="icon-pending">
                  <PhoneIcon />
                </div>
              )}
            </div>
            <div className="item-content">
              <div className="item-title">
                Mobile
                {mobileVerified ? (
                  <span className="verified-badge">Verified</span>
                ) : (
                  <span className="optional-badge">Optional</span>
                )}
              </div>
              <div className="item-email">+91 {user?.mobile}</div>
              {!mobileVerified && (
                <div className="item-hint">Verify via OTP in browser</div>
              )}
            </div>
            {!mobileVerified && (
              <div className="item-actions">
                <button 
                  className="action-btn verify-phone-btn"
                  onClick={openWebVerification}
                  title="Open verification page"
                >
                  <ExternalLinkIcon />
                  <span>Verify</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Message */}
        {message && (
          <motion.div 
            className={`verification-message ${message.includes('sent') || message.includes('verified') ? 'success' : 'error'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {message}
          </motion.div>
        )}

        {/* Resend Email Button */}
        {!emailVerified && (
          <motion.button
            className="resend-btn"
            onClick={handleResendEmail}
            disabled={isResendingEmail || resendCooldown > 0}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isResendingEmail ? (
              <span className="btn-loader" />
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              'Resend verification email'
            )}
          </motion.button>
        )}

        {/* Continue Button */}
        <motion.button
          className={`continue-btn ${canProceed ? 'enabled' : 'disabled'}`}
          onClick={canProceed ? onComplete : undefined}
          disabled={!canProceed}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileTap={canProceed ? { scale: 0.98 } : {}}
        >
          {canProceed ? (mobileVerified ? 'Continue to Dashboard' : 'Continue (Phone Optional)') : 'Verify email to continue'}
        </motion.button>

        {/* Skip for now (development only) */}
        {onSkip && (
          <button className="skip-btn" onClick={onSkip}>
            Skip for now
          </button>
        )}
      </motion.div>
    </div>
  )
}

export default VerificationPage
