// File: public/sw.js - Service Worker cho background notifications

const CACHE_NAME = 'bank-ting-ting-v1';
const urlsToCache = [
  '/',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch events
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-check') {
    event.waitUntil(checkForTransactions());
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('📨 Push notification received:', event.data);
  
  if (event.data) {
    const data = event.data.json();
    
    const notificationTitle = 'BANK-TING-TING 🔔';
    const notificationOptions = {
      body: `${data.bank_brand} nhận được +${formatMoney(data.amount)}đ\n${data.content}`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'Xem chi tiết',
          icon: '/view-icon.png'
        },
        {
          action: 'close',
          title: 'Đóng',
          icon: '/close-icon.png'
        }
      ],
      data: data
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
        .then(() => {
          // Phát âm thanh background
          return playBackgroundSound(data);
        })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Mở app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background transaction check
async function checkForTransactions() {
  try {
    const response = await fetch('/api/logs');
    const data = await response.json();
    
    console.log('🔍 Background check completed:', data);
    
    // Nếu có giao dịch mới, gửi notification
    if (data.recent_transactions && data.recent_transactions.length > 0) {
      const latestTransaction = data.recent_transactions[0];
      
      // Check if this is a new transaction (within last 30 seconds)
      const now = new Date();
      const transactionTime = new Date(latestTransaction.time);
      const diffInSeconds = (now - transactionTime) / 1000;
      
      if (diffInSeconds < 30) {
        await self.registration.showNotification('BANK-TING-TING 🔔', {
          body: `${latestTransaction.bank} nhận được +${formatMoney(latestTransaction.amount)}đ`,
          icon: '/icon-192x192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true
        });
      }
    }
  } catch (error) {
    console.error('❌ Background check failed:', error);
  }
}

// Background sound function
async function playBackgroundSound(data) {
  try {
    // Gửi message đến main app để phát âm thanh
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      client.postMessage({
        type: 'PLAY_SOUND',
        data: data
      });
    });
    
    console.log('🔊 Background sound request sent to', clients.length, 'clients');
  } catch (error) {
    console.error('❌ Background sound failed:', error);
  }
}

// Helper function
function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

// Keep Service Worker alive
setInterval(() => {
  console.log('💓 Service Worker heartbeat');
}, 30000);

console.log('🚀 BANK-TING-TING Service Worker loaded successfully!');