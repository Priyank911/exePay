// ExePay v2 - Receive QR Component
// Premium dark design

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { qrService } from '../services/qrService'
import '../styles/ReceiveQR.css'

interface Props {
  onBack: () => void
}

const ReceiveQR = ({ onBack }: Props) => {
  const { user } = useStore()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateQR()
  }, [])

  const generateQR = async () => {
    if (!user) return
    setIsGenerating(true)
    
    try {
      const image = await qrService.generatePaymentQR(
        user.paymentAddress,
        user.name,
        amount ? parseFloat(amount) : undefined,
        note || undefined
      )
      setQrImage(image)
    } catch (error) {
      console.error('QR generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(generateQR, 300)
    return () => clearTimeout(timeout)
  }, [amount, note])

  const handleCopy = async () => {
    if (!user) return
    
    try {
      await navigator.clipboard.writeText(user.paymentAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleShare = async () => {
    if (!user || !navigator.share) return
    
    try {
      await navigator.share({
        title: 'Pay via ExePay',
        text: `Pay ${user.name} via ExePay`,
        url: `upi://pay?pa=${user.paymentAddress}&pn=${user.name}`
      })
    } catch {
      handleCopy()
    }
  }

  if (!user) return null

  return (
    <motion.div
      className="receive-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 className="page-title">Receive Payment</h2>
      </div>

      <div className="receive-content">
        {/* QR Display */}
        <div className="qr-container">
          <div className="qr-frame">
            {isGenerating ? (
              <div className="qr-loading">
                <span className="spinner" />
              </div>
            ) : qrImage ? (
              <img src={qrImage} alt="Payment QR" className="qr-image" />
            ) : (
              <div className="qr-placeholder" />
            )}
          </div>
          <div className="qr-label">
            <span className="label-name">{user.name}</span>
            <span className="label-address">{user.paymentAddress}</span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="input-section">
          <div className="input-group">
            <label>Amount (optional)</label>
            <div className="amount-input">
              <span className="currency">₹</span>
              <input
                type="text"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setAmount(val)
                  }
                }}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Note (optional)</label>
            <input
              type="text"
              placeholder="What's this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={50}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="receive-actions">
          <motion.button
            className="action-btn-secondary"
            onClick={handleCopy}
            whileTap={{ scale: 0.98 }}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </motion.button>

          <motion.button
            className="action-btn-primary"
            onClick={handleShare}
            whileTap={{ scale: 0.98 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Share</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export default ReceiveQR
