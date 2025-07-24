// Minimal Service Worker cho BANK-TING-TING
// Chỉ cache cơ bản, không background tasks nặng nề

const CACHE_NAME = 'bank-ting-ting-v3';
const CORE_FILES = [
  '/',
  '/app.js',
  '/style.css'
];

// Install - cache core files only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Background notification support - MINIMAL
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'BACKGROUND_NOTIFICATION') {
    const data = event.data.data;
    
    // Simple notification
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
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Helper function
function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

console.log('🚀 Minimal Service Worker loaded');