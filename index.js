const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Biến lưu trữ kết nối và dữ liệu
let connectedClients = [];
let transactionHistory = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔗 Thiết bị kết nối:', socket.id);
  connectedClients.push(socket);
  
  // Gửi lịch sử giao dịch cho client mới kết nối
  if (transactionHistory.length > 0) {
    socket.emit('transaction_history', transactionHistory.slice(-10));
  }
  
  socket.on('disconnect', () => {
    console.log('❌ Thiết bị ngắt kết nối:', socket.id);
    connectedClients = connectedClients.filter(client => client.id !== socket.id);
  });
  
  // Handle client requesting transaction history
  socket.on('get_history', () => {
    socket.emit('transaction_history', transactionHistory.slice(-50));
  });
});

// Hàm xác thực Sepay webhook (nếu có secret)
function verifyWebhook(payload, signature) {
  if (!process.env.SEPAY_WEBHOOK_SECRET) {
    return true; // Bỏ qua xác thực nếu không có secret
  }
  
  try {
    const secret = process.env.SEPAY_WEBHOOK_SECRET;
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `sha256=${hash}` === signature;
  } catch (error) {
    console.error('Lỗi xác thực webhook:', error);
    return false;
  }
}

// Hàm format số tiền
function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

// Hàm tạo âm thanh thông báo (log cho debug)
function logNotificationSound() {
  console.log('🔔 TING TING! - Phát âm thanh thông báo');
}

// Route chính - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint nhận webhook từ Sepay
app.post('/webhook/sepay', (req, res) => {
  try {
    console.log('📨 Nhận webhook từ Sepay:', req.body);
    
    const signature = req.headers['x-sepay-signature'] || req.headers['x-signature'];
    const payload = JSON.stringify(req.body);
    
    // Xác thực webhook (chỉ khi có secret)
    if (process.env.SEPAY_WEBHOOK_SECRET && !verifyWebhook(payload, signature)) {
      console.log('❌ Webhook signature không hợp lệ');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const transactionData = req.body;
    
    // Xử lý dữ liệu giao dịch
    const notification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: Math.abs(transactionData.amount || transactionData.transferAmount || 0),
      content: transactionData.content || transactionData.description || transactionData.transferNote || 'Giao dịch',
      account_number: transactionData.account_number || transactionData.accountNumber || '',
      transaction_id: transactionData.transaction_id || transactionData.transactionId || transactionData.id || '',
      bank_brand: transactionData.bank_brand || transactionData.bankBrand || transactionData.bank || 'Unknown',
      type: (transactionData.amount || transactionData.transferAmount || 0) >= 0 ? 'credit' : 'debit',
      raw_data: transactionData // Lưu data gốc để debug
    };
    
    // Thêm vào lịch sử (chỉ giữ 100 giao dịch gần nhất)
    transactionHistory.unshift(notification);
    if (transactionHistory.length > 100) {
      transactionHistory = transactionHistory.slice(0, 100);
    }
    
    // Log thông tin giao dịch
    console.log('💰 Giao dịch mới:');
    console.log(`   💵 Số tiền: ${formatMoney(notification.amount)}đ`);
    console.log(`   📝 Nội dung: ${notification.content}`);
    console.log(`   🏦 Ngân hàng: ${notification.bank_brand}`);
    console.log(`   🕐 Thời gian: ${new Date(notification.timestamp).toLocaleString('vi-VN')}`);
    
    // Phát âm thanh thông báo
    logNotificationSound();
    
    // Gửi thông báo real-time đến tất cả client
    connectedClients.forEach(client => {
      try {
        client.emit('new_transaction', notification);
      } catch (error) {
        console.error('Lỗi gửi notification đến client:', error);
      }
    });
    
    console.log(`📱 Đã gửi thông báo đến ${connectedClients.length} thiết bị`);
    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    
  } catch (error) {
    console.error('❌ Lỗi xử lý webhook:', error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// Endpoint test thông báo
app.post('/test-notification', (req, res) => {
  try {
    const testAmount = Math.floor(Math.random() * 1000000) + 100000; // Random từ 100k-1.1M
    const testMessages = [
      'Test notification - Nhan tien test',
      'Chuyen khoan tu ban be',
      'Thanh toan don hang',
      'Hoan tien mua sam',
      'Thuong tet nang suong'
    ];
    
    const testNotification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: testAmount,
      content: testMessages[Math.floor(Math.random() * testMessages.length)],
      account_number: '1234567890',
      transaction_id: 'TEST_' + Date.now(),
      bank_brand: ['VCB', 'TCB', 'ACB', 'MB', 'VTB'][Math.floor(Math.random() * 5)],
      type: 'credit'
    };
    
    // Thêm vào lịch sử
    transactionHistory.unshift(testNotification);
    if (transactionHistory.length > 100) {
      transactionHistory = transactionHistory.slice(0, 100);
    }
    
    // Gửi đến tất cả client
    connectedClients.forEach(client => {
      try {
        client.emit('new_transaction', testNotification);
      } catch (error) {
        console.error('Lỗi gửi test notification:', error);
      }
    });
    
    console.log('🧪 Test notification sent:', testNotification);
    logNotificationSound();
    
    res.json({ 
      success: true, 
      message: 'Test notification sent', 
      data: testNotification,
      sent_to: connectedClients.length + ' devices'
    });
    
  } catch (error) {
    console.error('Lỗi test notification:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

// Endpoint lấy lịch sử giao dịch
app.get('/api/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({
    success: true,
    transactions: transactionHistory.slice(0, limit),
    total: transactionHistory.length
  });
});

// Endpoint xóa lịch sử giao dịch
app.delete('/api/transactions', (req, res) => {
  transactionHistory = [];
  res.json({ success: true, message: 'Transaction history cleared' });
});

// Endpoint health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'BANK-TING-TING',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connected_clients: connectedClients.length,
    total_transactions: transactionHistory.length,
    memory_usage: process.memoryUsage(),
    environment: {
      node_version: process.version,
      platform: process.platform,
      port: PORT,
      has_sepay_secret: !!process.env.SEPAY_WEBHOOK_SECRET
    }
  });
});

// Endpoint config info (không show sensitive data)
app.get('/api/config', (req, res) => {
  res.json({
    sepay_configured: !!process.env.SEPAY_API_KEY,
    webhook_secret_configured: !!process.env.SEPAY_WEBHOOK_SECRET,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Endpoint hiển thị logs gần đây (cho debug)
app.get('/api/logs', (req, res) => {
  const logs = transactionHistory.slice(0, 10).map(t => ({
    time: t.timestamp,
    amount: t.amount,
    content: t.content.substring(0, 50),
    bank: t.bank_brand
  }));
  
  res.json({
    recent_transactions: logs,
    connected_clients: connectedClients.length,
    server_time: new Date().toISOString()
  });
});

// Handle 404 - serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 ===============================================');
  console.log('🏦 BANK-TING-TING Server Started Successfully!');
  console.log('🚀 ===============================================');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📱 Web App: http://localhost:${PORT}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test Endpoint: POST http://localhost:${PORT}/test-notification`);
  console.log(`📊 Sepay Webhook: POST http://localhost:${PORT}/webhook/sepay`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Sepay API: ${process.env.SEPAY_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🔐 Webhook Secret: ${process.env.SEPAY_WEBHOOK_SECRET ? '✅ Configured' : '❌ Not configured'}`);
  console.log('🚀 ===============================================');
  console.log('🎯 Ready to receive transactions! TING TING! 🔔');
});

// Export app for testing
module.exports = app;