// File: public/sw.js - Service Worker cho Desktop Background

const CACHE_NAME = 'bank-ting-ting-desktop';

// Install
self.addEventListener('install', (event) => {
  console.log('🔧 SW installing...');
  self.skipWaiting();
});

// Activate  
self.addEventListener('activate', (event) => {
  console.log('✅ SW activated');
  self.clients.claim();
});

// Fetch - Basic
self.addEventListener('fetch', (event) => {
  // Pass through, no caching complexity
});

// CRITICAL: Message from main app khi có transaction
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NEW_TRANSACTION' && event.data.isBackground) {
    console.log('📨 SW received transaction for background processing:', event.data.data);
    
    const data = event.data.data;
    
    // Send back to main app for audio/TTS processing
    event.source.postMessage({
      type: 'PLAY_SOUND',
      data: data
    });
    
    // Show system notification
    self.registration.showNotification('BANK-TING-TING 🔔', {
      body: `${data.bank_brand} nhận được +${formatMoney(data.amount)}đ`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
      tag: 'bank-transaction',
      requireInteraction: false,
      silent: false,
      data: data
    });
  }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Helper
function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

console.log('🚀 Desktop-optimized SW ready!');