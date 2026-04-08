// Icon generation script for ExePay v2
// Run: node scripts/generate-icons.js

import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const iconsDir = path.resolve(__dirname, '..', 'public', 'icons')

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

const sizes = [16, 32, 48, 128]

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  // Background - pure black
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)
  
  // Border radius effect
  const radius = size * 0.2
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, radius * 2)
  ctx.fill()
  
  // Draw rounded rectangle border
  const padding = size * 0.1
  const borderWidth = Math.max(1, size * 0.04)
  
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = borderWidth
  ctx.beginPath()
  ctx.roundRect(padding, padding, size - padding * 2, size - padding * 2, radius * 0.8)
  ctx.stroke()
  
  // Draw "E" letter
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.5}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('E', size / 2, size / 2)
  
  return canvas.toBuffer('image/png')
}

sizes.forEach(size => {
  const buffer = generateIcon(size)
  const filename = `icon${size}.png`
  fs.writeFileSync(path.join(iconsDir, filename), buffer)
  console.log(`Generated ${filename}`)
})

console.log('All icons generated!')
