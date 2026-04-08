// ExePay v2 - QR Code Service
// Handles QR scanning and generation with dynamic QR detection

import jsQR from 'jsqr'
import QRCode from 'qrcode'
import type { QRPaymentData } from '../types'

export interface QRScanResult {
  data: QRPaymentData | null
  croppedQR: string | null
  location: {
    topLeftCorner: { x: number; y: number }
    topRightCorner: { x: number; y: number }
    bottomLeftCorner: { x: number; y: number }
    bottomRightCorner: { x: number; y: number }
  } | null
}

class QRService {
  // Check if QR data is UPI format
  isUPIPayment(data: string): boolean {
    return data.startsWith('upi://pay?')
  }

  // Parse UPI QR code data
  parseUPIData(data: string): QRPaymentData | null {
    if (!this.isUPIPayment(data)) return null

    try {
      const params = new URLSearchParams(data.replace('upi://pay?', ''))
      
      return {
        merchantName: params.get('pn') || 'Unknown',
        merchantId: params.get('pa') || '',
        amount: params.get('am') ? parseFloat(params.get('am')!) : null,
        currency: params.get('cu') || 'INR',
        note: params.get('tn') || undefined,
        rawData: data
      }
    } catch {
      return null
    }
  }

  // Capture current tab screenshot (Chrome Extension)
  async captureTab(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        reject(new Error('Not running in extension context'))
        return
      }

      // Add timeout for the capture
      const timeout = setTimeout(() => {
        reject(new Error('Tab capture timed out'))
      }, 5000)

      chrome.runtime.sendMessage({ action: 'captureTab' }, (response: { success: boolean; dataUrl?: string; error?: string }) => {
        clearTimeout(timeout)
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Chrome runtime error'))
          return
        }
        
        if (response?.success && response.dataUrl) {
          resolve(response.dataUrl)
        } else {
          // More user-friendly error message
          const errorMsg = response?.error || 'Failed to capture tab'
          if (errorMsg.includes('dragging') || errorMsg.includes('cannot be edited')) {
            reject(new Error('Please wait a moment and try again'))
          } else {
            reject(new Error(errorMsg))
          }
        }
      })
    })
  }

  // Scan image for QR code with location info
  async scanImageWithLocation(imageUrl: string): Promise<{
    data: string | null
    croppedImage: string | null
    location: QRScanResult['location']
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve({ data: null, croppedImage: null, location: null })
            return
          }

          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)

          if (code) {
            // Get QR location
            const location = {
              topLeftCorner: code.location.topLeftCorner,
              topRightCorner: code.location.topRightCorner,
              bottomLeftCorner: code.location.bottomLeftCorner,
              bottomRightCorner: code.location.bottomRightCorner
            }

            // Calculate bounding box with padding
            const padding = 30
            const minX = Math.max(0, Math.min(
              location.topLeftCorner.x,
              location.bottomLeftCorner.x
            ) - padding)
            const minY = Math.max(0, Math.min(
              location.topLeftCorner.y,
              location.topRightCorner.y
            ) - padding)
            const maxX = Math.min(canvas.width, Math.max(
              location.topRightCorner.x,
              location.bottomRightCorner.x
            ) + padding)
            const maxY = Math.min(canvas.height, Math.max(
              location.bottomLeftCorner.y,
              location.bottomRightCorner.y
            ) + padding)

            // Create cropped canvas
            const cropWidth = maxX - minX
            const cropHeight = maxY - minY
            const cropCanvas = document.createElement('canvas')
            cropCanvas.width = cropWidth
            cropCanvas.height = cropHeight
            const cropCtx = cropCanvas.getContext('2d')

            if (cropCtx) {
              cropCtx.drawImage(
                img,
                minX, minY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
              )
              const croppedImage = cropCanvas.toDataURL('image/png')
              resolve({ data: code.data, croppedImage, location })
            } else {
              resolve({ data: code.data, croppedImage: null, location })
            }
          } else {
            resolve({ data: null, croppedImage: null, location: null })
          }
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageUrl
    })
  }

  // Scan image for QR code (legacy)
  async scanImage(imageUrl: string): Promise<string | null> {
    const result = await this.scanImageWithLocation(imageUrl)
    return result.data
  }

  // Scan current page for payment QR with cropped preview
  async scanPageForPaymentWithPreview(): Promise<QRScanResult> {
    try {
      const screenshot = await this.captureTab()
      const { data: qrData, croppedImage, location } = await this.scanImageWithLocation(screenshot)
      
      if (qrData && this.isUPIPayment(qrData)) {
        return {
          data: this.parseUPIData(qrData),
          croppedQR: croppedImage,
          location
        }
      }
      
      return { data: null, croppedQR: null, location: null }
    } catch (error) {
      console.error('Scan error:', error)
      throw error
    }
  }

  // Scan current page for payment QR (legacy)
  async scanPageForPayment(): Promise<QRPaymentData | null> {
    const result = await this.scanPageForPaymentWithPreview()
    return result.data
  }

  // Generate QR code for receiving payment
  async generatePaymentQR(
    paymentAddress: string,
    name: string,
    amount?: number,
    note?: string
  ): Promise<string> {
    const params = new URLSearchParams({
      pa: paymentAddress,
      pn: name,
      cu: 'INR'
    })

    if (amount && amount > 0) {
      params.set('am', amount.toString())
    }
    if (note) {
      params.set('tn', note)
    }

    const upiUrl = `upi://pay?${params.toString()}`

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(upiUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#000000'
      },
      errorCorrectionLevel: 'M'
    })

    return qrDataUrl
  }

  // Generate QR code as SVG string
  async generatePaymentQRSVG(
    paymentAddress: string,
    name: string,
    amount?: number,
    note?: string
  ): Promise<string> {
    const params = new URLSearchParams({
      pa: paymentAddress,
      pn: name,
      cu: 'INR'
    })

    if (amount && amount > 0) {
      params.set('am', amount.toString())
    }
    if (note) {
      params.set('tn', note)
    }

    const upiUrl = `upi://pay?${params.toString()}`

    return await QRCode.toString(upiUrl, {
      type: 'svg',
      width: 256,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#000000'
      },
      errorCorrectionLevel: 'M'
    })
  }

  // Format currency
  formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }
}

export const qrService = new QRService()
