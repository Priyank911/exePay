import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const publicDir = path.resolve(rootDir, 'public')

console.log('Preparing ExePay v2 extension...')

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

// Copy manifest.json
const manifestSrc = path.resolve(publicDir, 'manifest.json')
const manifestDest = path.resolve(distDir, 'manifest.json')
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest)
  console.log('✓ Copied manifest.json')
}

// Copy background.js
const bgSrc = path.resolve(publicDir, 'background.js')
const bgDest = path.resolve(distDir, 'background.js')
if (fs.existsSync(bgSrc)) {
  fs.copyFileSync(bgSrc, bgDest)
  console.log('✓ Copied background.js')
}

// Copy icons directory
const iconsSrcDir = path.resolve(publicDir, 'icons')
const iconsDestDir = path.resolve(distDir, 'icons')

if (!fs.existsSync(iconsDestDir)) {
  fs.mkdirSync(iconsDestDir, { recursive: true })
}

const iconFiles = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png']
iconFiles.forEach(iconFile => {
  const src = path.resolve(iconsSrcDir, iconFile)
  const dest = path.resolve(iconsDestDir, iconFile)
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log(`✓ Copied ${iconFile}`)
  } else {
    console.warn(`⚠ Icon not found: ${iconFile}`)
  }
})

console.log('')
console.log('Extension prepared successfully!')
console.log(`Load from: ${distDir}`)
