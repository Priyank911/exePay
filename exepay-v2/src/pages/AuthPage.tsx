// ExePay v2 - Auth Page
// Premium dark design with dark red accent

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { validate } from '../services/firebaseAuthService'
import '../styles/AuthPage.css'

// Eye icons for password visibility
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    pin: ''
  })

  const { login, register } = useStore()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // PIN should only be digits
    if (name === 'pin' && !/^\d*$/.test(value)) return
    // Mobile should only be digits
    if (name === 'mobile' && !/^\d*$/.test(value)) return
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsLoading(true)

    try {
      if (mode === 'login') {
        const result = await login(formData.email, formData.password)
        if (!result.success) {
          setError(result.error || 'Login failed')
        }
      } else {
        // Validate registration
        if (!formData.name.trim()) {
          setError('Name is required')
          setIsLoading(false)
          return
        }
        if (!validate.email(formData.email)) {
          setError('Invalid email format')
          setIsLoading(false)
          return
        }
        if (!validate.mobile(formData.mobile)) {
          setError('Invalid mobile (10 digits starting with 6-9)')
          setIsLoading(false)
          return
        }
        const pwdCheck = validate.password(formData.password)
        if (!pwdCheck.valid) {
          setError(pwdCheck.error || 'Invalid password')
          setIsLoading(false)
          return
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }
        const pinCheck = validate.pin(formData.pin)
        if (!pinCheck.valid) {
          setError(pinCheck.error || 'PIN must be 4-6 digits')
          setIsLoading(false)
          return
        }

        const result = await register({
          name: formData.name,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password,
          pin: formData.pin
        })
        if (!result.success) {
          setError(result.error || 'Registration failed')
        } else if (result.message) {
          setSuccessMessage(result.message)
        }
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setSuccessMessage('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setFormData({
      name: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      pin: ''
    })
  }

  return (
    <div className="auth-page">
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <img src="/icons/logo.png" alt="ExePay" className="logo-img" />
          <span className="logo-text">ExePay</span>
        </div>

        {/* Title */}
        <div className="auth-header">
          <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
          <p>{mode === 'login' ? 'Sign in to continue' : 'Get started with ExePay'}</p>
        </div>

        {/* Success message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              className="auth-success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <CheckIcon />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              className="form-fields"
            >
              {mode === 'register' && (
                <div className="input-group">
                  <input
                    type="text"
                    name="name"
                    placeholder="Full name"
                    value={formData.name}
                    onChange={handleChange}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="input-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>

              {mode === 'register' && (
                <div className="input-group">
                  <div className="input-prefix">+91</div>
                  <input
                    type="tel"
                    name="mobile"
                    placeholder="Mobile number"
                    value={formData.mobile}
                    onChange={handleChange}
                    maxLength={10}
                    autoComplete="tel"
                    className="input-with-prefix"
                  />
                </div>
              )}

              <div className="input-group input-with-icon">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Password requirements hint - only in register mode */}
              {mode === 'register' && formData.password.length > 0 && (
                <div className="password-requirements">
                  <div className={`req ${formData.password.length >= 8 ? 'met' : ''}`}>
                    <span className="req-dot" />8+ chars
                  </div>
                  <div className={`req ${/[A-Z]/.test(formData.password) ? 'met' : ''}`}>
                    <span className="req-dot" />A-Z
                  </div>
                  <div className={`req ${/[a-z]/.test(formData.password) ? 'met' : ''}`}>
                    <span className="req-dot" />a-z
                  </div>
                  <div className={`req ${/[0-9]/.test(formData.password) ? 'met' : ''}`}>
                    <span className="req-dot" />0-9
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <>
                  <div className="input-group input-with-icon">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  
                  <div className="input-group pin-input-group">
                    <label className="pin-label">Set your PIN (4-6 digits)</label>
                    <div className="pin-dots-input">
                      {[...Array(6)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`pin-dot-input ${i < formData.pin.length ? 'filled' : ''} ${i >= 4 && i >= formData.pin.length ? 'optional' : ''}`}
                        />
                      ))}
                    </div>
                    <input
                      type="password"
                      name="pin"
                      value={formData.pin}
                      onChange={handleChange}
                      maxLength={6}
                      inputMode="numeric"
                      pattern="\d*"
                      className="pin-hidden-input"
                      placeholder=""
                    />
                    <span className="pin-hint">Used to unlock the app</span>
                  </div>
                  
                  {/* Important note */}
                  <div className="register-note">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>Please ensure email & mobile are correct</span>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <motion.button
            type="submit"
            className="auth-submit"
            disabled={isLoading}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <span className="btn-loader" />
            ) : (
              mode === 'login' ? 'Sign in' : 'Create account'
            )}
          </motion.button>
        </form>

        {/* Mode switch */}
        <div className="auth-switch">
          <span className="switch-text">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button type="button" className="switch-btn" onClick={switchMode}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default AuthPage
