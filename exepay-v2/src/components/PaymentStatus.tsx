// ExePay v2 - Payment Status Component
// Premium fintech design with circular progress ring

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { paymentService, type PaymentStatus as Status } from '../services/paymentService'
import '../styles/PaymentStatus.css'

interface Props {
  paymentId: string
  merchantName: string
  amount: number
  onComplete?: () => void
  onClose?: () => void
}

const PaymentStatus = ({ paymentId, merchantName, amount, onComplete, onClose }: Props) => {
  const [status, setStatus] = useState<Status>('pending')

  useEffect(() => {
    const unsubscribe = paymentService.subscribeToPaymentRequest(paymentId, (data) => {
      if (data) {
        setStatus(data.status)
        if (data.status === 'completed' && onComplete) {
          setTimeout(() => onComplete(), 2500)
        }
      }
    })
    return () => unsubscribe()
  }, [paymentId, onComplete])

  const formatAmount = (amt: number) => new Intl.NumberFormat('en-IN').format(amt)
  
  // Status config with icons
  const statusData = useMemo(() => {
    const config: Record<Status, { icon: string; label: string; sub: string; progress: number }> = {
      pending: { icon: '/icons/send-icon.png', label: 'Sending', sub: 'to your phone', progress: 0.25 },
      sent: { icon: '/icons/mobile-icon.png', label: 'Waiting', sub: 'open on phone', progress: 0.5 },
      opened: { icon: '/icons/mobile-icon.png', label: 'Confirm', sub: 'on your phone', progress: 0.75 },
      completed: { icon: '/icons/mobile-icon.png', label: 'Paid', sub: 'successfully', progress: 1 },
      failed: { icon: '/icons/mobile-icon.png', label: 'Failed', sub: 'try again', progress: 0 }
    }
    return config[status]
  }, [status])
  
  // Progress ring
  const ringSize = 80
  const strokeWidth = 3
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - statusData.progress)

  const isActive = ['pending', 'sent', 'opened'].includes(status)
  const isSuccess = status === 'completed'
  const isFailed = status === 'failed'

  return (
    <motion.div 
      className={`ps ${status}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Close */}
      {onClose && (
        <button className="ps-close" onClick={onClose}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M8 2L2 8M2 2l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Ring + Icon */}
      <div className="ps-ring-wrap">
        {isActive && <div className="ps-glow" />}
        
        <svg className="ps-ring" viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <circle 
            cx={ringSize/2} cy={ringSize/2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
          />
          <motion.circle 
            cx={ringSize/2} cy={ringSize/2} r={radius}
            fill="none" 
            stroke={isSuccess ? '#30D158' : isFailed ? '#FF453A' : 'rgba(255,255,255,0.9)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="ps-progress"
          />
        </svg>

        <motion.div 
          className="ps-icon"
          key={status}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {isSuccess ? (
            <svg viewBox="0 0 24 24" className="ps-check">
              <motion.path 
                d="M6 12.5l4 4 8-8.5" 
                fill="none" stroke="#30D158" strokeWidth="2.5" 
                strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.15 }}
              />
            </svg>
          ) : isFailed ? (
            <svg viewBox="0 0 24 24" className="ps-x">
              <path d="M7 7l10 10M17 7L7 17" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <img src={statusData.icon} alt="" className={isActive ? 'animate' : ''} />
          )}
        </motion.div>

        {isActive && (
          <>
            <span className="ps-pulse p1" />
            <span className="ps-pulse p2" />
          </>
        )}
      </div>

      {/* Amount */}
      <div className="ps-amount">
        <span className="ps-rs">₹</span>
        <span className="ps-num">{formatAmount(amount)}</span>
      </div>

      {/* Merchant */}
      <span className="ps-to">{merchantName}</span>

      {/* Status */}
      <motion.div className="ps-state" key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
        <span className={`ps-label ${status}`}>{statusData.label}</span>
        <span className="ps-sub">{statusData.sub}</span>
      </motion.div>

      {/* Progress dots */}
      <div className="ps-dots">
        {[0, 1, 2, 3].map(i => {
          const step = { pending: 0, sent: 1, opened: 2, completed: 3, failed: -1 }[status]
          return (
            <span 
              key={i} 
              className={`ps-dot ${i <= step ? 'on' : ''} ${i === step ? 'now' : ''} ${isFailed ? 'err' : ''} ${isSuccess && i <= step ? 'ok' : ''}`}
            />
          )
        })}
      </div>

      {/* Button */}
      <AnimatePresence>
        {(isSuccess || isFailed) && (
          <motion.button 
            className={`ps-btn ${isSuccess ? 'ok' : 'err'}`}
            onClick={onClose}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
          >
            {isSuccess ? 'Done' : 'Try Again'}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default PaymentStatus
