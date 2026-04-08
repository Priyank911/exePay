// ExePay v2 - Background Service Worker
// Handles tab capture and extension lifecycle

console.log('ExePay v2 background script loaded')

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ExePay installed:', details.reason)
  
  // Initialize storage
  chrome.storage.local.get(['exepay_users'], (result) => {
    if (!result.exepay_users) {
      chrome.storage.local.set({ exepay_users: [] })
    }
  })
})

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    captureVisibleTab()
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true // Keep message channel open for async response
  }
  
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(tabs => sendResponse({ success: true, tab: tabs[0] }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
})

// Capture visible tab screenshot
async function captureVisibleTab() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' })
    return dataUrl
  } catch (error) {
    throw new Error('Failed to capture tab: ' + error.message)
  }
}
