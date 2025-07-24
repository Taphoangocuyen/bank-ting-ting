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

// Middleware - minimal
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: false
}));

// Socket.IO - optimized
io.on('connection', (socket) => {
  if (isShuttingDown) {
    socket.disconnect(true);
    return;
  }
  
  console.log('🔗 Client:', socket.id);
  connectedClients.push(socket);
  
  socket.on('disconnect', () => {
    connectedClients = connectedClients.filter(c => c.id !== socket.id);
  });
  
  socket.on('error', () => {
    connectedClients = connectedClients.filter(c => c.id !== socket.id);
  });
});

// Routes - streamlined
app.get('/', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
      type: (data.amount || 0) > 0 ? 'credit' : 'debit'
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

app.post('/test-notification', (req, res) => {
  if (isShuttingDown) return res.status(503).end();
  
  const testData = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    amount: Math.floor(Math.random() * 500000) + 100000,
    content: 'Test từ Heroku - ' + new Date().toLocaleTimeString('vi-VN'),
    account_number: '1234567890',
    transaction_id: 'TEST_' + Date.now(),
    bank_brand: ['VCB', 'TCB', 'MBBANK'][Math.floor(Math.random() * 3)],
    type: 'credit'
  };
  
  const activeClients = connectedClients.filter(c => c.connected);
  activeClients.forEach(client => {
    try {
      client.emit('new_transaction', testData);
    } catch (e) {}
  });
  
  console.log(`🧪 Test sent to ${activeClients.length} devices`);
  res.json({ success: true, data: testData, sent: activeClients.length });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: isShuttingDown ? 'SHUTTING_DOWN' : 'OK',
    clients: connectedClients.length,
    uptime: Math.floor(process.uptime()),
    memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
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
  
  // Disconnect all clients immediately
  connectedClients.forEach(client => {
    try { client.disconnect(true); } catch (e) {}
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
    
    io.close(() => {
      console.log('✅ Socket.IO closed');
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

// Start server
server.listen(PORT, () => {
  console.log('🚀 =====================================');
  console.log('🏦 BANK-TING-TING v2.0 - ULTRA OPTIMIZED');
  console.log(`📡 Port: ${PORT}`);
  console.log(`📱 URL: https://bank-ting-ting-771db69fc368.herokuapp.com`);
  console.log('🎯 Ready! TING TING! 🔔');
  console.log('🚀 =====================================');
});

// Keep alive
process.stdin.resume();