// ExePay v2 - Profile Page Component
// Premium dark design with avatar upload and enhanced UX

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { cloudinaryService } from '../services/cloudinaryService'
import '../styles/ProfilePage.css'

interface Props {
  onBack: () => void
}

const ProfilePage = ({ onBack }: Props) => {
  const { user, logout, updateAvatar, removeAvatar } = useStore()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [activeSection, setActiveSection] = useState<'info' | 'settings'>('info')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logout()
    }
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.paymentAddress)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // Silent fail
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be less than 2MB')
      return
    }

    setUploadError('')
    setIsUploading(true)

    try {
      // Compress image before upload
      const compressedFile = await cloudinaryService.compressImage(file)
      
      // Upload to Cloudinary
      const result = await cloudinaryService.uploadImage(compressedFile)
      
      if (result.success && result.url) {
        await updateAvatar(result.url)
      } else {
        setUploadError(result.error || 'Upload failed')
      }
    } catch (error) {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user.avatar) return
    
    if (window.confirm('Remove profile photo?')) {
      await removeAvatar()
    }
  }

  // Calculate member duration
  const getMemberDuration = () => {
    const created = new Date(user.createdAt)
    const now = new Date()
    const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 30) return `${days} days`
    if (days < 365) return `${Math.floor(days / 30)} months`
    return `${Math.floor(days / 365)} years`
  }

  return (
    <motion.div
      className="profile-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="profile-header-bar">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 className="page-title">Profile</h2>
        <div className="header-spacer" />
      </div>

      <div className="profile-content">
        {/* Hero Section with Avatar */}
        <motion.div 
          className="profile-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="profile-avatar-wrapper">
            <motion.button 
              className="profile-avatar"
              onClick={handleAvatarClick}
              disabled={isUploading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="avatar-img" />
              ) : (
                <span className="avatar-text">{user.name.charAt(0).toUpperCase()}</span>
              )}
              {isUploading && (
                <div className="avatar-uploading">
                  <div className="upload-spinner" />
                </div>
              )}
              <div className="avatar-overlay">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </motion.button>
            {user.avatar && (
              <button 
                className="avatar-remove-btn"
                onClick={handleRemoveAvatar}
                disabled={isUploading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
          
          <div className="profile-identity">
            <h3 className="profile-name">{user.name}</h3>
            <span className="profile-email">{user.email}</span>
            <div className="profile-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round"/>
                <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Verified User</span>
            </div>
          </div>

          <AnimatePresence>
            {uploadError && (
              <motion.div
                className="upload-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {uploadError}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
          className="profile-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="stat-item">
            <span className="stat-value">{formatCurrency(user.balance)}</span>
            <span className="stat-label">Balance</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{user.transactions.length}</span>
            <span className="stat-label">Payments</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{getMemberDuration()}</span>
            <span className="stat-label">Member</span>
          </div>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div 
          className="profile-tabs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button 
            className={`tab-btn ${activeSection === 'info' ? 'active' : ''}`}
            onClick={() => setActiveSection('info')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Info</span>
          </button>
          <button 
            className={`tab-btn ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
        </motion.div>

        {/* Content Sections */}
        <AnimatePresence mode="wait">
          {activeSection === 'info' ? (
            <motion.div 
              key="info"
              className="profile-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Mobile */}
              <div className="detail-card">
                <div className="detail-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Mobile Number</span>
                  <span className="detail-value">+91 {user.mobile}</span>
                </div>
                <div className="detail-status verified">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* UPI Address */}
              <div className="detail-card">
                <div className="detail-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">UPI Address</span>
                  <span className="detail-value mono">{user.paymentAddress}</span>
                </div>
                <button className={`copy-btn ${copySuccess ? 'success' : ''}`} onClick={copyAddress}>
                  {copySuccess ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Member Since */}
              <div className="detail-card">
                <div className="detail-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round"/>
                    <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round"/>
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Member Since</span>
                  <span className="detail-value">
                    {new Date(user.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="settings"
              className="profile-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Change PIN */}
              <button className="settings-btn">
                <div className="settings-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
                <div className="settings-content">
                  <span className="settings-title">Change PIN</span>
                  <span className="settings-desc">Update your security PIN</span>
                </div>
                <svg className="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Notifications */}
              <button className="settings-btn">
                <div className="settings-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </div>
                <div className="settings-content">
                  <span className="settings-title">Notifications</span>
                  <span className="settings-desc">Manage push notifications</span>
                </div>
                <svg className="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Linked Devices */}
              <button className="settings-btn">
                <div className="settings-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="settings-content">
                  <span className="settings-title">Linked Devices</span>
                  <span className="settings-desc">1 device connected</span>
                </div>
                <svg className="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Help */}
              <button className="settings-btn">
                <div className="settings-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="settings-content">
                  <span className="settings-title">Help & Support</span>
                  <span className="settings-desc">FAQ, contact us</span>
                </div>
                <svg className="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logout Button */}
        <motion.div 
          className="profile-actions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            className="logout-btn"
            onClick={handleLogout}
            whileTap={{ scale: 0.98 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round"/>
            </svg>
            <span>Sign out</span>
          </motion.button>
        </motion.div>

        {/* Footer */}
        <div className="profile-footer">
          <span>ExePay v2.0.0</span>
          <span className="dot">•</span>
          <span>Made with ❤️ in India</span>
        </div>
      </div>
    </motion.div>
  )
}

export default ProfilePage
