# ExePay Chrome Extension

This is the Chrome extension component of ExePay. See the main [README](../README.md) in the parent folder for full project documentation.

## Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build extension
npm run build:extension
```

## Loading the Extension

1. Run `npm run build:extension`
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Project Structure

```
src/
├── components/     # React components (QRScanner, PinLock, etc.)
├── pages/          # Page components (Dashboard, AuthPage)
├── services/       # Firebase services
├── store/          # Zustand state management
├── styles/         # CSS styles
└── types/          # TypeScript types
```
