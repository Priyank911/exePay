// ExePay v2 - Cloudinary Service
// Lightweight image upload for profile photos

// ⚠️ CONFIGURE THESE VALUES
// Get these from your Cloudinary dashboard: https://cloudinary.com/console
const CLOUDINARY_CONFIG = {
  cloudName: 'dq1ywsnr4', // Replace with your cloud name
  uploadPreset: 'exepay-profile' // Create an unsigned upload preset in Settings > Upload
}

interface UploadResult {
  success: boolean
  url?: string
  publicId?: string
  error?: string
}

class CloudinaryService {
  private cloudName: string
  private uploadPreset: string

  constructor() {
    this.cloudName = CLOUDINARY_CONFIG.cloudName
    this.uploadPreset = CLOUDINARY_CONFIG.uploadPreset
  }

  // Check if Cloudinary is configured
  isConfigured(): boolean {
    return (
      this.cloudName !== 'YOUR_CLOUD_NAME' &&
      this.uploadPreset !== 'YOUR_UNSIGNED_PRESET'
    )
  }

  // Upload image to Cloudinary
  async uploadImage(file: File): Promise<UploadResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Cloudinary not configured. Please add your credentials.'
      }
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', this.uploadPreset)
      formData.append('folder', 'exepay-profiles')

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      )

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      // Return optimized URL with transformations for profile photo
      const optimizedUrl = this.getOptimizedUrl(data.public_id)

      return {
        success: true,
        url: optimizedUrl,
        publicId: data.public_id
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  // Get optimized URL for profile photo (small, circular crop)
  getOptimizedUrl(publicId: string, size: number = 200): string {
    // Cloudinary transformation: crop to square, resize, auto quality
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/c_fill,w_${size},h_${size},g_face,q_auto,f_auto/${publicId}`
  }

  // Convert file to base64 for local preview
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Compress image before upload (for large images)
  async compressImage(file: File, maxWidth: number = 400): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }))
            } else {
              resolve(file)
            }
          },
          'image/jpeg',
          0.85
        )
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }
}

export const cloudinaryService = new CloudinaryService()
