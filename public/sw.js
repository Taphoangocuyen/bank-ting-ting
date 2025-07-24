// File: public/sw.js - Service Worker đơn giản cho BANK-TING-TING

const CACHE_NAME = 'bank-ting-ting-v2';
const urlsToCache = [
  '/',
  '/app.js',
  '/style.css'
];

// Install
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('📨 SW Message:', event.data);
  
  if (event.data && event.data.type === 'TRANSACTION_NOTIFICATION') {
    const data = event.data.data;
    
    // Show notification
    self.registration.showNotification('BANK-TING-TING 🔔', {
      body: `${data.bank_brand} nhận được +${formatMoney(data.amount)}đ`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>',
      tag: 'bank-transaction',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: data
    });
    
    // Send back to main app for sound/TTS
    event.source.postMessage({
      type: 'PLAY_SOUND',
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

// Helper function
function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

console.log('🚀 BANK-TING-TING Service Worker Ready!');