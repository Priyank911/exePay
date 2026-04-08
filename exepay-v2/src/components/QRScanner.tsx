// ExePay v2 - QR Scanner Component
// Dynamic QR detection with focused crop preview

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { qrService } from '../services/qrService'
import type { QRPaymentData } from '../types'
import '../styles/QRScanner.css'

interface Props {
  onScan: (data: QRPaymentData) => void
  onBack: () => void
  embedded?: boolean // When true, renders without header (for embedded use)
}

interface DetectedQR {
  croppedImage: string
  data: QRPaymentData | null
}

const QRScanner = ({ onScan, onBack, embedded = false }: Props) => {
  const [status, setStatus] = useState<'idle' | 'previewing' | 'scanning' | 'found' | 'error'>('idle')
  const [error, setError] = useState('')
  const [livePreview, setLivePreview] = useState<string | null>(null)
  const [detectedQR, setDetectedQR] = useState<DetectedQR | null>(null)
  const [croppedQR, setCroppedQR] = useState<string | null>(null)

  // Load live preview and detect QR
  const loadLivePreview = useCallback(async () => {
    if (status === 'scanning' || status === 'found') return
    
    try {
      const screenshot = await qrService.captureTab()
      setLivePreview(screenshot)
      setError('') // Clear any previous errors
      
      // Try to detect QR in preview
      const result = await qrService.scanPageForPaymentWithPreview()
      if (result.data && result.croppedQR) {
        setDetectedQR({
          croppedImage: result.croppedQR,
          data: result.data
        })
        setStatus('previewing')
      } else {
        setDetectedQR(null)
        setStatus('previewing')
      }
    } catch (err: any) {
      // Don't show temporary errors, just log them
      const errorMessage = err?.message || 'Preview not available'
      console.log('Preview:', errorMessage)
      
      // Only set error for persistent issues, not temporary ones
      if (!errorMessage.includes('wait') && !errorMessage.includes('moment')) {
        // Keep previous preview if available
        if (!livePreview) {
          setStatus('idle')
        }
      }
    }
  }, [status, livePreview])

  useEffect(() => {
    // Small delay before first preview to let extension settle
    const initialDelay = setTimeout(() => {
      loadLivePreview()
    }, 300)
    
    // Refresh preview every 2 seconds when in preview/idle mode
    const interval = setInterval(() => {
      if (status === 'previewing' || status === 'idle') {
        loadLivePreview()
      }
    }, 2000)
    
    return () => {
      clearTimeout(initialDelay)
      clearInterval(interval)
    }
  }, [loadLivePreview, status])

  const handleScan = async (retryCount = 0) => {
    // If QR already detected, use it directly
    if (detectedQR?.data) {
      setStatus('found')
      setCroppedQR(detectedQR.croppedImage)
      setTimeout(() => onScan(detectedQR.data!), 800)
      return
    }

    setStatus('scanning')
    setError('')
    setCroppedQR(null)

    try {
      const result = await qrService.scanPageForPaymentWithPreview()
      
      if (result.data) {
        setStatus('found')
        if (result.croppedQR) {
          setCroppedQR(result.croppedQR)
        }
        setTimeout(() => onScan(result.data!), 800)
      } else {
        setStatus('error')
        setError('No UPI QR found on page')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Scan failed'
      
      // Auto-retry for temporary errors (max 2 retries)
      if (retryCount < 2 && (errorMsg.includes('wait') || errorMsg.includes('moment') || errorMsg.includes('timeout'))) {
        setTimeout(() => handleScan(retryCount + 1), 500)
        return
      }
      
      setStatus('error')
      setError(errorMsg.includes('wait') || errorMsg.includes('moment') 
        ? 'Tab not ready. Click "Try Again".' 
        : errorMsg)
    }
  }

  const onScanClick = () => handleScan(0)

  const handleRetry = () => {
    setStatus('idle')
    setError('')
    setCroppedQR(null)
    setDetectedQR(null)
    loadLivePreview()
  }

  // Embedded mode - just the scanner content without page wrapper
  if (embedded) {
    return (
      <div className="scanner-embedded">
        {/* Scanner Area */}
        <div className="scan-viewport-embed">
          {croppedQR && status === 'found' ? (
            <motion.div 
              className="cropped-qr-container"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="cropped-qr-frame success">
                <img src={croppedQR} alt="Detected QR" className="cropped-qr-img" />
                <div className="qr-glow" />
              </div>
              <motion.div 
                className="qr-detected-badge"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>QR Detected</span>
              </motion.div>
            </motion.div>
          ) : detectedQR ? (
            // Show detected QR preview with merchant info
            <motion.div 
              className="detected-qr-preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="detected-qr-card">
                <div className="detected-qr-image">
                  <img src={detectedQR.croppedImage} alt="QR Code" />
                  <div className="qr-scan-ring" />
                </div>
                <div className="detected-qr-info">
                  <span className="qr-ready-label">
                    <span className="ready-dot" />
                    Ready to Pay
                  </span>
                  <h3 className="merchant-name">{detectedQR.data?.merchantName || 'Merchant'}</h3>
                  {detectedQR.data?.amount && (
                    <p className="merchant-amount">₹{new Intl.NumberFormat('en-IN').format(detectedQR.data.amount)}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : livePreview ? (
            <motion.div 
              className="preview-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <img 
                src={livePreview} 
                alt="Page Preview" 
                className="preview-img live" 
              />
              <div className="live-preview-overlay">
                <div className="live-badge">
                  <span className="live-dot" />
                  <span>Searching for QR...</span>
                </div>
              </div>
              <div className="scan-mask previewing">
                <div className="scan-window">
                  <div className="corner-bottom" />
                  <div className="laser" />
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="idle-state-embed">
              <div className="qr-icon-lg loading">
                <div className="icon-spinner" />
              </div>
              <p>Connecting to browser...</p>
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              className="scan-error-embed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <div className="scan-actions-embed">
          {status === 'error' ? (
            <button className="scan-btn-embed retry" onClick={handleRetry}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
              </svg>
              Try Again
            </button>
          ) : (
            <button
              className={`scan-btn-embed ${detectedQR ? 'ready' : 'primary'}`}
              onClick={onScanClick}
              disabled={status === 'scanning' || status === 'found'}
            >
              {status === 'scanning' ? (
                <>
                  <span className="spinner" />
                  Processing...
                </>
              ) : status === 'found' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Done
                </>
              ) : detectedQR ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Pay Now
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                  </svg>
                  Scan Page
                </>
              )}
            </button>
          )}
        </div>

        <p className="scan-hint-embed">
          {status === 'idle' 
            ? 'Connecting to browser...' 
            : status === 'previewing' && detectedQR
            ? 'QR code found! Tap Pay Now to continue'
            : status === 'previewing'
            ? 'Navigate to payment page with QR code'
            : status === 'scanning' 
            ? 'Processing payment...'
            : status === 'error'
            ? 'Make sure QR code is visible'
            : 'Redirecting...'}
        </p>
      </div>
    )
  }

  // Full page mode (original)
  return (
    <motion.div
      className="scanner-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="scanner-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2>Scan & Pay</h2>
        <div className="header-spacer" />
      </div>

      {/* Scanner Area */}
      <div className="scanner-body">
        <div className="scan-viewport">
          {croppedQR && status === 'found' ? (
            <motion.div 
              className="cropped-qr-container"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="cropped-qr-frame success">
                <img src={croppedQR} alt="Detected QR" className="cropped-qr-img" />
                <div className="qr-glow" />
              </div>
              <motion.div 
                className="qr-detected-badge"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>QR Detected</span>
              </motion.div>
            </motion.div>
          ) : detectedQR ? (
            <motion.div 
              className="detected-qr-preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="detected-qr-card">
                <div className="detected-qr-image">
                  <img src={detectedQR.croppedImage} alt="QR Code" />
                  <div className="qr-scan-ring" />
                </div>
                <div className="detected-qr-info">
                  <span className="qr-ready-label">
                    <span className="ready-dot" />
                    Ready to Pay
                  </span>
                  <h3 className="merchant-name">{detectedQR.data?.merchantName || 'Merchant'}</h3>
                  {detectedQR.data?.amount && (
                    <p className="merchant-amount">₹{new Intl.NumberFormat('en-IN').format(detectedQR.data.amount)}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : livePreview ? (
            <motion.div 
              className="preview-wrapper"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <img 
                src={livePreview} 
                alt="Page Preview" 
                className="preview-img live" 
              />
              <div className="live-preview-overlay">
                <div className="live-badge">
                  <span className="live-dot" />
                  <span>Searching for QR...</span>
                </div>
              </div>
              <div className="scan-mask previewing">
                <div className="scan-window">
                  <div className="corner-bottom" />
                  <div className="laser" />
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="idle-state">
              <div className="qr-icon loading">
                <div className="icon-spinner" />
              </div>
              <h3>Connecting</h3>
              <p>Loading page preview...</p>
            </div>
          )}
        </div>

        {/* Status */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              className="scan-status error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="scan-actions">
          {status === 'error' ? (
            <motion.button
              className="scan-btn retry"
              onClick={handleRetry}
              whileTap={{ scale: 0.98 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
              </svg>
              Try Again
            </motion.button>
          ) : (
            <motion.button
              className={`scan-btn ${detectedQR ? 'ready' : 'primary'}`}
              onClick={onScanClick}
              disabled={status === 'scanning' || status === 'found'}
              whileTap={{ scale: 0.98 }}
            >
              {status === 'scanning' ? (
                <>
                  <span className="spinner" />
                  Processing...
                </>
              ) : status === 'found' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Opening Payment...
                </>
              ) : detectedQR ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Pay Now
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                  </svg>
                  Scan Page
                </>
              )}
            </motion.button>
          )}
        </div>

        <p className="hint">
          {status === 'idle' 
            ? 'Connecting to browser...'
            : status === 'previewing' && detectedQR
            ? 'QR code found! Tap Pay Now to proceed'
            : status === 'previewing'
            ? 'Navigate to payment page with QR code' 
            : status === 'scanning' 
            ? 'Processing payment...'
            : status === 'error'
            ? 'Make sure QR code is visible on page'
            : 'Redirecting to payment...'}
        </p>
      </div>
    </motion.div>
  )
}

export default QRScanner
