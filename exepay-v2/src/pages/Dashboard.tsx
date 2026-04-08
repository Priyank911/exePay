// ExePay v2 - Dashboard (Compact & Minimal)
// Clean, minimal design focused on scan functionality

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import QRScanner from '../components/QRScanner'
import ProfilePage from '../components/ProfilePage'
import PaymentStatus from '../components/PaymentStatus'
import { paymentService, type PaymentRequest, type RecentPayee } from '../services/paymentService'
import type { QRPaymentData } from '../types'
import '../styles/Dashboard.css'

// Logo Component
const Logo = () => (
  <img 
    src="/icons/logo.png" 
    alt="ExePay Logo" 
    width="28" 
    height="28" 
    style={{ borderRadius: '6px' }}
  />
)

// Dynamic greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { text: 'Good morning', emoji: '🌅' }
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '☀️' }
  if (hour >= 17 && hour < 21) return { text: 'Good evening', emoji: '🌆' }
  return { text: 'Good night', emoji: '🌙' }
}

// Calculate spending stats from payment history
const calculateSpendingStats = (payments: PaymentRequest[]) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  let todayTotal = 0
  let monthTotal = 0
  let completedCount = 0
  
  payments.forEach(payment => {
    if (payment.status === 'completed') {
      completedCount++
      const paymentDate = payment.createdAt
      
      if (paymentDate >= startOfMonth) {
        monthTotal += payment.amount
      }
      if (paymentDate >= today) {
        todayTotal += payment.amount
      }
    }
  })
  
  return {
    today: todayTotal,
    month: monthTotal,
    transactions: completedCount
  }
}

const Dashboard = () => {
  const { user, updateActivity } = useStore()
  const [activeView, setActiveView] = useState<'home' | 'scan' | 'profile'>('home')
  const [scannedData, setScannedData] = useState<QRPaymentData | null>(null)
  const [showPaymentPopup, setShowPaymentPopup] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null)
  const [showStatusView, setShowStatusView] = useState(false)
  const [spendingStats, setSpendingStats] = useState({ today: 0, month: 0, transactions: 0 })
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [recentPayees, setRecentPayees] = useState<RecentPayee[]>([])
  const [isRestoringState, setIsRestoringState] = useState(true)

  const greeting = useMemo(() => getGreeting(), [])

  // Update activity on mount and interactions
  useEffect(() => {
    updateActivity()
    
    // Update activity periodically while dashboard is open
    const interval = setInterval(() => {
      updateActivity()
    }, 10000) // Every 10 seconds
    
    return () => clearInterval(interval)
  }, [updateActivity])

  // Restore persisted state on mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(['activePayment'])
          const activePayment = result.activePayment as {
            paymentId: string
            merchantName: string
            merchantId: string
            amount: number | null
            timestamp: number
          } | undefined
          
          if (activePayment) {
            const { paymentId, merchantName, merchantId, amount, timestamp } = activePayment
            // Only restore if less than 10 minutes old
            const age = Date.now() - timestamp
            if (age < 10 * 60 * 1000 && paymentId) {
              setScannedData({
                merchantName,
                merchantId,
                amount,
                currency: 'INR',
                rawData: merchantId
              })
              setActivePaymentId(paymentId)
              setShowPaymentPopup(true)
              setShowStatusView(true)
            } else {
              // Clear stale state
              chrome.storage.local.remove(['activePayment'])
            }
          }
        }
      } catch (error) {
        console.log('Could not restore state:', error)
      } finally {
        setIsRestoringState(false)
      }
    }
    restoreState()
  }, [])

  // Persist active payment state
  const persistPaymentState = useCallback((paymentId: string, data: QRPaymentData) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        activePayment: {
          paymentId,
          merchantName: data.merchantName,
          merchantId: data.merchantId,
          amount: data.amount,
          timestamp: Date.now()
        }
      })
    }
  }, [])

  // Clear persisted state
  const clearPaymentState = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove(['activePayment'])
    }
  }, [])

  // Fetch spending data and recent payees from Firebase (always fresh)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingStats(true)
        
        // Fetch fresh data from Firebase
        const [payments, payees] = await Promise.all([
          paymentService.getRecentPaymentRequests(100),
          paymentService.getRecentPayees(5)
        ])
        
        // Update UI
        const stats = calculateSpendingStats(payments)
        setSpendingStats(stats)
        setRecentPayees(payees)
        
        console.log('[Dashboard] Data loaded from Firebase')
      } catch (error) {
        console.error('[Dashboard] Failed to fetch data:', error)
      } finally {
        setIsLoadingStats(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user])

  // Refresh stats and payees
  const refreshStats = useCallback(async () => {
    try {
      const [payments, payees] = await Promise.all([
        paymentService.getRecentPaymentRequests(100),
        paymentService.getRecentPayees(5)
      ])
      
      const stats = calculateSpendingStats(payments)
      setSpendingStats(stats)
      setRecentPayees(payees)
      
      console.log('[Dashboard] Stats refreshed')
    } catch (error) {
      console.error('Failed to refresh stats:', error)
    }
  }, [])

  const closePaymentPopup = useCallback(() => {
    setShowPaymentPopup(false)
    clearPaymentState() // Clear persisted state
    setTimeout(() => {
      setScannedData(null)
      setActivePaymentId(null)
      setShowStatusView(false)
      // Refresh stats after payment flow completes
      refreshStats()
    }, 300)
  }, [refreshStats, clearPaymentState])

  const handlePaymentComplete = useCallback(() => {
    closePaymentPopup()
  }, [closePaymentPopup])

  // Show loading while restoring state - MUST be after all hooks
  if (!user || isRestoringState) return null

  const handleQRScan = (data: QRPaymentData) => {
    setScannedData(data)
    setActiveView('home')
    setShowPaymentPopup(true)
    setActivePaymentId(null)
    setShowStatusView(false)
  }

  const handleSendToMobile = async () => {
    if (!scannedData) return
    setIsSending(true)
    
    try {
      const result = await paymentService.createPaymentRequest({
        upiId: scannedData.merchantId,
        name: scannedData.merchantName,
        amount: scannedData.amount || 0,
        note: scannedData.note
      })
      
      if (result.success && result.paymentRequest) {
        setActivePaymentId(result.paymentRequest.id)
        setShowStatusView(true)
        
        // Persist state so it survives popup close
        persistPaymentState(result.paymentRequest.id, scannedData)
        
        // Simulate status transitions for demo (in production, mobile app would update these)
        setTimeout(() => {
          paymentService.updatePaymentStatus(result.paymentRequest!.id, 'sent')
        }, 1500)
      } else {
        console.error('Failed to create payment:', result.error)
      }
    } catch (error) {
      console.error('Payment error:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Handle clicking on a recent payee
  const handlePayeeClick = (payee: RecentPayee) => {
    const qrData: QRPaymentData = {
      merchantName: payee.name,
      merchantId: payee.upiId,
      amount: null, // User will need to enter amount
      currency: 'INR',
      rawData: payee.upiId
    }
    setScannedData(qrData)
    setShowPaymentPopup(true)
    setActivePaymentId(null)
    setShowStatusView(false)
  }

  const formatAmount = (amount: number) => new Intl.NumberFormat('en-IN').format(amount)

  // Scan Page Component
  const ScanPage = () => (
    <motion.div
      className="scan-page"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.25 }}
    >
      <header className="scan-header">
        <button className="back-btn" onClick={() => setActiveView('home')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Scan QR Code</h1>
        <div className="header-spacer" />
      </header>
      <div className="scan-content">
        <QRScanner onScan={handleQRScan} onBack={() => setActiveView('home')} embedded />
      </div>
    </motion.div>
  )

  const renderView = () => {
    switch (activeView) {
      case 'scan':
        return <ScanPage />
      case 'profile':
        return <ProfilePage onBack={() => setActiveView('home')} />
      default:
        return (
          <motion.div
            className="home-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Header */}
            <header className="dash-header">
              <div className="brand">
                <Logo />
                <span className="brand-name">ExePay</span>
              </div>
              <button className="avatar-btn" onClick={() => setActiveView('profile')}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="avatar-img" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </button>
            </header>

            {/* Greeting */}
            <motion.div 
              className="greeting-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="greeting-text">{greeting.text},</span>
              <h1 className="user-name">{user.name.split(' ')[0]}</h1>
            </motion.div>

            {/* Spending Overview */}
            <motion.div 
              className="spending-overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="spending-main">
                <span className="spending-label">This Month</span>
                <div className="spending-value">
                  <span className="currency">₹</span>
                  <span className="amount">
                    {isLoadingStats ? '—' : formatAmount(spendingStats.month)}
                  </span>
                </div>
              </div>
              <div className="spending-mini">
                <div className="mini-stat">
                  <span className="mini-value">
                    {isLoadingStats ? '—' : `₹${formatAmount(spendingStats.today)}`}
                  </span>
                  <span className="mini-label">Today</span>
                </div>
                <div className="mini-divider" />
                <div className="mini-stat">
                  <span className="mini-value">
                    {isLoadingStats ? '—' : spendingStats.transactions}
                  </span>
                  <span className="mini-label">Payments</span>
                </div>
              </div>
            </motion.div>

            {/* Compact Scan Button */}
            <motion.button
              className="scan-btn-compact"
              onClick={() => setActiveView('scan')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7V5a2 2 0 012-2h2" strokeLinecap="round"/>
                <path d="M17 3h2a2 2 0 012 2v2" strokeLinecap="round"/>
                <path d="M21 17v2a2 2 0 01-2 2h-2" strokeLinecap="round"/>
                <path d="M7 21H5a2 2 0 01-2-2v-2" strokeLinecap="round"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
              </svg>
              <span>Scan & Pay</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="arrow-icon">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>

            {/* Recent Payees Section - Grid Layout */}
            {recentPayees.length > 0 && (
              <motion.div 
                className="recent-payees-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <div className="section-header">
                  <span className="section-label">Today</span>
                </div>
                <div className="payees-grid">
                  {recentPayees.slice(0, 6).map((payee, index) => (
                    <motion.button
                      key={payee.id}
                      className="payee-card"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + index * 0.03 }}
                      onClick={() => handlePayeeClick(payee)}
                    >
                      <div className="payee-icon">
                        <img src="/icons/person-icon.png" alt="" />
                      </div>
                      <span className="payee-label">{payee.name.split(' ')[0]}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Linked Device Footer */}
            <div className="footer-info">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="2" width="14" height="20" rx="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round"/>
              </svg>
              <span>Linked: +91 {user.mobile}</span>
            </div>
          </motion.div>
        )
    }
  }

  return (
    <div className="dashboard">
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>

      {/* Payment Popup Overlay */}
      <AnimatePresence>
        {showPaymentPopup && scannedData && (
          <>
            <motion.div 
              className="popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={!showStatusView ? closePaymentPopup : undefined}
            />
            <motion.div
              className="payment-popup"
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <AnimatePresence mode="wait">
                {showStatusView && activePaymentId ? (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <PaymentStatus
                      paymentId={activePaymentId}
                      merchantName={scannedData.merchantName}
                      amount={scannedData.amount || 0}
                      onComplete={handlePaymentComplete}
                      onClose={closePaymentPopup}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="payment-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Popup Header */}
                    <div className="popup-header">
                      <div className="popup-handle" />
                      <button className="popup-close" onClick={closePaymentPopup}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>

                    {/* Payment Info */}
                    <div className="popup-content">
                      <div className="payee-info">
                        <div className="payee-avatar-lg">
                          <img 
                            src="/icons/person-icon.png" 
                            alt="Merchant" 
                            className="payee-avatar-img"
                          />
                        </div>
                        <h2 className="payee-name">{scannedData.merchantName}</h2>
                        <p className="payee-upi">{scannedData.merchantId}</p>
                      </div>

                      {scannedData.amount && (
                        <div className="amount-display">
                          <span className="amount-currency">₹</span>
                          <span className="amount-value">{formatAmount(scannedData.amount)}</span>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="popup-actions">
                        <button className="send-btn-lg" onClick={handleSendToMobile} disabled={isSending}>
                          {isSending ? (
                            <span className="btn-loader" />
                          ) : (
                            <>
                              <img src="/icons/mobile-iconb.png" alt="" />
                              <span>Send to Phone</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="popup-hint">Payment will open on your mobile</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
