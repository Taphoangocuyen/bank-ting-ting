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
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Thêm config để tránh timeout
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Biến lưu trữ kết nối và trạng thái
let connectedClients = [];
let isShuttingDown = false;

// Socket.IO connection
io.on('connection', (socket) => {
  if (isShuttingDown) {
    socket.disconnect(true);
    return;
  }
  
  console.log('🔗 Thiết bị kết nối:', socket.id);
  connectedClients.push(socket);
  
  socket.on('disconnect', () => {
    console.log('❌ Thiết bị ngắt kết nối:', socket.id);
    connectedClients = connectedClients.filter(client => client.id !== socket.id);
  });
  
  // Cleanup khi có lỗi
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
    connectedClients = connectedClients.filter(client => client.id !== socket.id);
  });
});

// Root route
app.get('/', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).send('Service Unavailable - Shutting Down');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint nhận webhook từ Sepay
app.post('/webhook/sepay', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).send('Service Unavailable');
  }
  
  try {
    const transactionData = req.body;
    console.log('📨 Webhook received:', transactionData);
    
    // Xử lý dữ liệu giao dịch
    const notification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: Math.abs(transactionData.amount || transactionData.transferAmount || 0),
      content: transactionData.content || transactionData.description || 'Giao dịch',
      account_number: transactionData.account_number || transactionData.accountNumber || '',
      transaction_id: transactionData.transaction_id || transactionData.transactionId || '',
      bank_brand: transactionData.bank_brand || transactionData.gateway || 'Unknown',
      type: (transactionData.amount || 0) > 0 ? 'credit' : 'debit'
    };
    
    // Gửi thông báo real-time đến tất cả client (với error handling)
    let successCount = 0;
    connectedClients.forEach(client => {
      try {
        if (client.connected) {
          client.emit('new_transaction', notification);
          successCount++;
        }
      } catch (error) {
        console.error('❌ Error sending to client:', error);
      }
    });
    
    console.log(`💰 Giao dịch mới gửi đến ${successCount}/${connectedClients.length} thiết bị`);
    res.status(200).json({ success: true, sent_to: successCount });
    
  } catch (error) {
    console.error('❌ Lỗi xử lý webhook:', error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// Endpoint test thông báo
app.post('/test-notification', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).send('Service Unavailable');
  }
  
  try {
    const testNotification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: Math.floor(Math.random() * 1000000) + 100000,
      content: 'Test notification - Nhận tiền test từ Heroku',
      account_number: '1234567890',
      transaction_id: 'TEST_' + Date.now(),
      bank_brand: ['VCB', 'TCB', 'MBBANK', 'ACB'][Math.floor(Math.random() * 4)],
      type: 'credit'
    };
    
    let successCount = 0;
    connectedClients.forEach(client => {
      try {
        if (client.connected) {
          client.emit('new_transaction', testNotification);
          successCount++;
        }
      } catch (error) {
        console.error('❌ Error sending test:', error);
      }
    });
    
    console.log(`🧪 Test notification gửi đến ${successCount} thiết bị`);
    res.json({ 
      success: true, 
      message: 'Test notification sent successfully!',
      data: testNotification,
      sent_to: successCount
    });
    
  } catch (error) {
    console.error('❌ Lỗi test notification:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

// Endpoint health check
app.get('/health', (req, res) => {
  res.json({ 
    status: isShuttingDown ? 'SHUTTING_DOWN' : 'OK', 
    timestamp: new Date().toISOString(),
    connected_clients: connectedClients.length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.2-fixed'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Express Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// FIXED: Proper graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`📴 ${signal} received, shutting down gracefully...`);
  isShuttingDown = true;
  
  // Set timeout to force exit if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    console.log('⚡ Force exit - graceful shutdown timeout');
    process.exit(1);
  }, 25000); // 25 seconds, less than Heroku's 30s timeout
  
  // Close new connections
  server.close((err) => {
    if (err) {
      console.error('❌ Error closing server:', err);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
    
    console.log('✅ HTTP server closed');
    
    // Close Socket.IO
    io.close((err) => {
      if (err) {
        console.error('❌ Error closing Socket.IO:', err);
      } else {
        console.log('✅ Socket.IO closed');
      }
      
      // Clear all timers/intervals
      clearTimeout(forceExitTimer);
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
  });
  
  // Disconnect all clients immediately
  connectedClients.forEach(client => {
    try {
      client.disconnect(true);
    } catch (error) {
      // Ignore errors during shutdown
    }
  });
  connectedClients = [];
};

// Handle shutdown signals from Heroku
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 ===============================================');
  console.log('🏦 BANK-TING-TING Server Started Successfully!');
  console.log('🚀 ===============================================');
  console.log(`📡 Port: ${PORT}`);
  console.log(`📱 URL: https://bank-ting-ting-771db69fc368.herokuapp.com`);
  console.log(`💚 Health: /health`);
  console.log(`🧪 Test: POST /test-notification`);
  console.log(`📊 Webhook: POST /webhook/sepay`);
  console.log('🚀 ===============================================');
  console.log('🎯 Ready for transactions! TING TING! 🔔');
  console.log('🚀 ===============================================');
});

// Keep process alive (but allow shutdown)
process.stdin.resume();