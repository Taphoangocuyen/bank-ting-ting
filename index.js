const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
let connectedClients = [];
let isShuttingDown = false;

// App version để cache busting
const APP_VERSION = process.env.APP_VERSION || Date.now().toString();
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Middleware - minimal
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// ===============================
// FIXED CACHE CONFIGURATION
// ===============================
if (IS_DEVELOPMENT) {
  // DEVELOPMENT: NO CACHE - để dễ development
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0, // Không cache
    etag: true, // Bật ETag để check file changes
    lastModified: true,
    setHeaders: (res, path) => {
      // Force no cache cho development
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Thêm version header
      res.setHeader('X-App-Version', APP_VERSION);
      res.setHeader('X-Cache-Mode', 'development');
      
      console.log(`📁 Serving: ${path} (no-cache)`);
    }
  }));
} else {
  // PRODUCTION: SMART CACHE - cache nhưng có cache busting
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '5m', // Cache 5 phút thay vì 1 ngày
    etag: true, // Bật ETag để auto-refresh khi file thay đổi
    lastModified: true,
    setHeaders: (res, path) => {
      // Production cache với auto-refresh capability
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 phút
      res.setHeader('X-App-Version', APP_VERSION);
      res.setHeader('X-Cache-Mode', 'production');
      
      // Cache riêng cho các loại file
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate'); // HTML: 1 phút
      } else if (path.endsWith('.js') || path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // JS/CSS: 5 phút
      }
    }
  }));
}

// ===============================
// CACHE BUSTING MIDDLEWARE
// ===============================
app.use((req, res, next) => {
  // Thêm no-cache headers cho các request động
  if (req.path.includes('/api/') || req.path.includes('/webhook/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Thêm app version vào tất cả response
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader('X-Timestamp', new Date().toISOString());
  
  next();
});

// Socket.IO - optimized
io.on('connection', (socket) => {
  if (isShuttingDown) {
    socket.disconnect(true);
    return;
  }
  
  console.log('🔗 Client:', socket.id);
  connectedClients.push(socket);
  
  // Gửi app version cho client để check compatibility
  socket.emit('app_version', { 
    version: APP_VERSION, 
    timestamp: new Date().toISOString(),
    cacheMode: IS_DEVELOPMENT ? 'development' : 'production'
  });
  
  socket.on('disconnect', () => {
    connectedClients = connectedClients.filter(c => c.id !== socket.id);
  });
  
  socket.on('error', () => {
    connectedClients = connectedClients.filter(c => c.id !== socket.id);
  });
});

// ===============================
// ROUTES - với cache headers
// ===============================
app.get('/', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  
  // Thêm cache busting cho index.html
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.setHeader('X-App-Version', APP_VERSION);
  
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cache busting endpoint - để client check version
app.get('/api/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    cacheMode: IS_DEVELOPMENT ? 'development' : 'production',
    nodeEnv: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    message: IS_DEVELOPMENT ? 
      'Development mode - files served fresh' : 
      'Production mode - smart caching enabled'
  });
});

// Force refresh endpoint
app.post('/api/force-refresh', (req, res) => {
  // Broadcast force refresh tới tất cả clients
  const refreshData = {
    reason: 'manual_refresh',
    timestamp: new Date().toISOString(),
    newVersion: Date.now().toString()
  };
  
  connectedClients.forEach(client => {
    try {
      client.emit('force_refresh', refreshData);
    } catch (e) {}
  });
  
  console.log(`🔄 Force refresh sent to ${connectedClients.length} clients`);
  res.json({ 
    success: true, 
    sent: connectedClients.length,
    ...refreshData
  });
});

app.post('/webhook/sepay', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  
  try {
    const data = req.body;
    const notification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: Math.abs(data.amount || data.transferAmount || 0),
      content: data.content || data.description || 'Giao dịch',
      account_number: data.account_number || data.accountNumber || '',
      transaction_id: data.transaction_id || data.transactionId || '',
      bank_brand: data.bank_brand || data.gateway || 'Unknown',
      type: (data.amount || 0) > 0 ? 'credit' : 'debit',
      version: APP_VERSION // Thêm version vào notification
    };
    
    // Broadcast efficiently
    const activeClients = connectedClients.filter(c => c.connected);
    activeClients.forEach(client => {
      try {
        client.emit('new_transaction', notification);
      } catch (e) {}
    });
    
    console.log(`💰 Sent to ${activeClients.length} devices`);
    res.status(200).json({ success: true, sent: activeClients.length });
    
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// FIX LỖI: Test notification với rate limiting
app.post('/test-notification', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  
  try {
    // PREVENT DUPLICATE - Check request timestamp
    const now = Date.now();
    const requestTimestamp = req.body?.timestamp || now;
    
    // Prevent duplicate requests within 2 seconds
    if (global.lastTestTime && (now - global.lastTestTime) < 2000) {
      console.log('⚠️ Duplicate test request blocked');
      return res.status(429).json({ 
        error: 'Too many requests', 
        message: 'Vui lòng đợi 2 giây trước khi test lại',
        canRetryIn: Math.ceil((2000 - (now - global.lastTestTime)) / 1000)
      });
    }
    
    global.lastTestTime = now;
    
    // SINGLE test data - không random để tránh tạo nhiều giao dịch khác nhau
    const testData = {
      id: `TEST_${requestTimestamp}`,
      timestamp: new Date().toISOString(),
      amount: 394719, // Fixed amount để dễ debug
      content: `Test từ Heroku - ${new Date().toLocaleTimeString('vi-VN')}`,
      account_number: '1234567890',
      transaction_id: `TEST_${requestTimestamp}`,
      bank_brand: 'MBBANK',
      type: 'credit',
      version: APP_VERSION // Thêm version
    };
    
    // Get active clients ONCE
    const activeClients = connectedClients.filter(c => c.connected);
    
    // Send to each client ONCE
    let sentCount = 0;
    activeClients.forEach(client => {
      try {
        client.emit('new_transaction', testData);
        sentCount++;
      } catch (e) {
        console.log('❌ Client emit error:', e.message);
      }
    });
    
    console.log(`🧪 SINGLE test sent to ${sentCount} devices - ID: ${testData.id}`);
    
    // Send response ONCE
    res.status(200).json({ 
      success: true, 
      sent: sentCount,
      testId: testData.id,
      message: 'Single test notification sent',
      data: testData
    });
    
  } catch (error) {
    console.error('❌ Test notification error:', error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// THÊM endpoint để check test status
app.get('/test-status', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  
  const now = Date.now();
  const timeSinceLastTest = global.lastTestTime ? (now - global.lastTestTime) : null;
  const canTest = !global.lastTestTime || timeSinceLastTest >= 2000;
  
  res.json({
    lastTestTime: global.lastTestTime || null,
    timeSinceLastTest: timeSinceLastTest,
    canTest: canTest,
    nextTestIn: canTest ? 0 : Math.ceil((2000 - timeSinceLastTest) / 1000),
    connectedClients: connectedClients.length,
    activeClients: connectedClients.filter(c => c.connected).length,
    serverTime: new Date().toISOString(),
    version: APP_VERSION
  });
});

// Enhanced health endpoint với cache info
app.get('/health', (req, res) => {
  const uptime = Math.floor(process.uptime());
  const memory = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
  
  res.json({ 
    status: isShuttingDown ? 'SHUTTING_DOWN' : 'OK',
    clients: connectedClients.length,
    activeClients: connectedClients.filter(c => c.connected).length,
    uptime: uptime,
    uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    memory: `${memory}MB`,
    lastTestTime: global.lastTestTime || null,
    canTest: !global.lastTestTime || (Date.now() - global.lastTestTime) >= 2000,
    version: APP_VERSION,
    cacheMode: IS_DEVELOPMENT ? 'development' : 'production',
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});

// Rate limiting info endpoint
app.get('/api/limits', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  
  res.json({
    testNotification: {
      rateLimit: '1 request per 2 seconds',
      currentStatus: global.lastTestTime ? 'Limited' : 'Available',
      nextAvailable: global.lastTestTime ? new Date(global.lastTestTime + 2000).toISOString() : 'Now'
    },
    webhook: {
      rateLimit: 'Unlimited (production endpoint)'
    },
    version: APP_VERSION,
    cacheInfo: {
      mode: IS_DEVELOPMENT ? 'development' : 'production',
      staticFiles: IS_DEVELOPMENT ? 'no-cache' : '5min cache with auto-refresh',
      html: IS_DEVELOPMENT ? 'no-cache' : '1min cache',
      api: 'always no-cache'
    }
  });
});

// Debug endpoint - chỉ cho development
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug', (req, res) => {
    res.json({
      connectedClients: connectedClients.map(c => ({
        id: c.id,
        connected: c.connected,
        transport: c.conn.transport.name
      })),
      global: {
        lastTestTime: global.lastTestTime,
        isShuttingDown: isShuttingDown
      },
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      },
      cache: {
        mode: IS_DEVELOPMENT ? 'development' : 'production',
        appVersion: APP_VERSION,
        headers: 'ETag + LastModified enabled'
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /',
      'GET /api/version',
      'POST /api/force-refresh',
      'POST /webhook/sepay', 
      'POST /test-notification',
      'GET /test-status',
      'GET /health',
      'GET /api/limits'
    ],
    version: APP_VERSION
  });
});

// ULTRA-FAST shutdown handler
const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`📴 ${signal} - Fast shutdown starting...`);
  
  // Force exit in 20 seconds (well before Heroku's 30s limit)
  const forceTimer = setTimeout(() => {
    console.log('⚡ FORCE EXIT');
    process.exit(0);
  }, 20000);
  
  // Disconnect all clients immediately với refresh message
  connectedClients.forEach(client => {
    try { 
      client.emit('server_shutdown', { 
        message: 'Server is restarting...',
        shouldRefresh: true,
        newVersion: Date.now().toString()
      });
      client.disconnect(true); 
    } catch (e) {}
  });
  connectedClients = [];
  
  // Close server immediately
  server.close(() => {
    console.log('✅ Server closed');
    clearTimeout(forceTimer);
    
    // Close Socket.IO with timeout
    const ioTimer = setTimeout(() => {
      console.log('⚡ IO timeout - force exit');
      process.exit(0);
    }, 5000);
    
    io.close((err) => {
      if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
        console.log('⚠️ Socket.IO close warning:', err.code);
      } else {
        console.log('✅ Socket.IO closed');
      }
      clearTimeout(ioTimer);
      console.log('✅ Clean shutdown complete');
      process.exit(0);
    });
  });
  
  // If server.close() doesn't trigger callback within 10s
  setTimeout(() => {
    console.log('⚡ Server close timeout - force exit');
    clearTimeout(forceTimer);
    process.exit(0);
  }, 10000);
};

// Handle all shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle errors with immediate shutdown
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught:', err.message);
  shutdown('UNCAUGHT');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled:', reason);
  shutdown('UNHANDLED');
});

// Initialize global vars
global.lastTestTime = null;

// Start server
server.listen(PORT, () => {
  console.log('🚀 =====================================');
  console.log('🏦 BANK-TING-TING v2.2 - FIXED CACHE');
  console.log(`📡 Port: ${PORT}`);
  console.log(`📱 URL: https://bank-ting-ting-771db69fc368.herokuapp.com`);
  console.log(`🔧 Cache Mode: ${IS_DEVELOPMENT ? 'Development (no-cache)' : 'Production (smart cache)'}`);
  console.log(`📦 App Version: ${APP_VERSION}`);
  console.log('🔧 Fixed: Browser cache issues');
  console.log('🔧 Fixed: Auto-refresh on file changes');
  console.log('🎯 Ready! TING TING! 🔔');
  console.log('🚀 =====================================');
});

// Keep alive
process.stdin.resume();