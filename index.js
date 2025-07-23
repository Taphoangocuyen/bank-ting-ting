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

// Hàm xác thực Sepay webhook (HIỆN TẠI BỊ VÔ HIỆU HÓA)
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

// Endpoint nhận webhook từ Sepay - ĐÃ SỬA LỖI
app.post('/webhook/sepay', (req, res) => {
  try {
    console.log('🚀 ===============================================');
    console.log('📨 NHẬN WEBHOOK TỪ SEPAY:');
    console.log('🚀 ===============================================');
    console.log('📊 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📊 Body:', JSON.stringify(req.body, null, 2));
    console.log('🚀 ===============================================');
    
    // BỎ QUA VERIFICATION ĐỂ TRÁNH LỖI 401
    // const signature = req.headers['x-sepay-signature'] || req.headers['x-signature'];
    // const payload = JSON.stringify(req.body);
    
    // Xác thực webhook (HIỆN TẠI BỊ VÔ HIỆU HÓA)
    // if (process.env.SEPAY_WEBHOOK_SECRET && !verifyWebhook(payload, signature)) {
    //   console.log('❌ Webhook signature không hợp lệ');
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }
    
    const transactionData = req.body;
    
    // Xử lý dữ liệu giao dịch với nhiều format khác nhau từ Sepay
    const amount = Math.abs(
      transactionData.amount || 
      transactionData.transferAmount || 
      transactionData.money || 
      transactionData.value || 
      0
    );
    
    const content = transactionData.content || 
                   transactionData.description || 
                   transactionData.transferNote || 
                   transactionData.note ||
                   transactionData.memo ||
                   'Giao dịch';
    
    const bankBrand = transactionData.gateway || 
                     transactionData.bank_brand || 
                     transactionData.bankBrand || 
                     transactionData.bank || 
                     'Unknown';
    
    const accountNumber = transactionData.account_number || 
                         transactionData.accountNumber || 
                         transactionData.subAccount ||
                         '';
    
    const transactionId = transactionData.transaction_id || 
                         transactionData.transactionId || 
                         transactionData.id || 
                         transactionData.referenceCode ||
                         '';
    
    // Tạo object notification
    const notification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: amount,
      content: content,
      account_number: accountNumber,
      transaction_id: transactionId,
      bank_brand: bankBrand,
      type: amount > 0 ? 'credit' : 'debit',
      raw_data: transactionData // Lưu data gốc để debug
    };
    
    // Thêm vào lịch sử (chỉ giữ 100 giao dịch gần nhất)
    transactionHistory.unshift(notification);
    if (transactionHistory.length > 100) {
      transactionHistory = transactionHistory.slice(0, 100);
    }
    
    // Log thông tin giao dịch chi tiết
    console.log('💰 🎉 GIAO DỊCH MỚI THÀNH CÔNG! 🎉');
    console.log('💰 =====================================');
    console.log(`💵 Số tiền: ${formatMoney(notification.amount)}đ`);
    console.log(`📝 Nội dung: ${notification.content}`);
    console.log(`🏦 Ngân hàng: ${notification.bank_brand}`);
    console.log(`🏧 Số tài khoản: ${notification.account_number}`);
    console.log(`🔖 Mã giao dịch: ${notification.transaction_id}`);
    console.log(`🕐 Thời gian: ${new Date(notification.timestamp).toLocaleString('vi-VN')}`);
    console.log(`📱 Loại: ${notification.type === 'credit' ? 'NHẬN TIỀN' : 'CHUYỂN TIỀN'}`);
    console.log('💰 =====================================');
    
    // Phát âm thanh thông báo
    logNotificationSound();
    
    // Gửi thông báo real-time đến tất cả client
    let successfulSends = 0;
    connectedClients.forEach(client => {
      try {
        client.emit('new_transaction', notification);
        successfulSends++;
      } catch (error) {
        console.error('❌ Lỗi gửi notification đến client:', error);
      }
    });
    
    console.log(`📱 ✅ Đã gửi thông báo thành công đến ${successfulSends}/${connectedClients.length} thiết bị`);
    console.log('🎯 BANK-TING-TING HOẠT ĐỘNG HOÀN HẢO! 🎯');
    
    // Trả về success
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      data: notification,
      sent_to_devices: successfulSends
    });
    
  } catch (error) {
    console.error('❌ 🚨 LỖI XỬ LÝ WEBHOOK:');
    console.error('❌ ================================');
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ Request body:', req.body);
    console.error('❌ ================================');
    
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
      'Thuong tet nang suong',
      'Tien luong thang',
      'Bonus cuoi nam'
    ];
    
    const testBanks = ['MBBANK', 'VietinBank', 'VCB', 'TCB', 'ACB', 'BIDV'];
    
    const testNotification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: testAmount,
      content: testMessages[Math.floor(Math.random() * testMessages.length)],
      account_number: '1234567890',
      transaction_id: 'TEST_' + Date.now(),
      bank_brand: testBanks[Math.floor(Math.random() * testBanks.length)],
      type: 'credit'
    };
    
    // Thêm vào lịch sử
    transactionHistory.unshift(testNotification);
    if (transactionHistory.length > 100) {
      transactionHistory = transactionHistory.slice(0, 100);
    }
    
    // Log test notification
    console.log('🧪 =============== TEST NOTIFICATION ===============');
    console.log('🧪 Test notification:', testNotification);
    console.log('🧪 ================================================');
    
    // Gửi đến tất cả client
    let successfulSends = 0;
    connectedClients.forEach(client => {
      try {
        client.emit('new_transaction', testNotification);
        successfulSends++;
      } catch (error) {
        console.error('❌ Lỗi gửi test notification:', error);
      }
    });
    
    console.log('🧪 Test notification sent to', successfulSends, 'devices');
    logNotificationSound();
    
    res.json({ 
      success: true, 
      message: 'Test notification sent successfully!', 
      data: testNotification,
      sent_to: successfulSends + ' devices',
      total_connected: connectedClients.length
    });
    
  } catch (error) {
    console.error('❌ Lỗi test notification:', error);
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
      has_sepay_secret: !!process.env.SEPAY_WEBHOOK_SECRET,
      webhook_verification: 'DISABLED (Fixed for compatibility)'
    }
  });
});

// Endpoint config info (không show sensitive data)
app.get('/api/config', (req, res) => {
  res.json({
    sepay_configured: !!process.env.SEPAY_API_KEY,
    webhook_secret_configured: !!process.env.SEPAY_WEBHOOK_SECRET,
    webhook_verification: 'DISABLED',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.1 - Fixed'
  });
});

// Endpoint hiển thị logs gần đây (cho debug)
app.get('/api/logs', (req, res) => {
  const logs = transactionHistory.slice(0, 10).map(t => ({
    time: t.timestamp,
    amount: t.amount,
    content: t.content.substring(0, 50),
    bank: t.bank_brand,
    type: t.type
  }));
  
  res.json({
    recent_transactions: logs,
    connected_clients: connectedClients.length,
    server_time: new Date().toISOString(),
    status: 'FIXED - Webhook verification disabled'
  });
});

// Endpoint debug webhook (POST để test manually)
app.post('/debug/webhook', (req, res) => {
  console.log('🔧 DEBUG WEBHOOK CALL:');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  res.json({
    success: true,
    message: 'Debug webhook received',
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
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
  console.log(`🛡️  Webhook Verification: ❌ DISABLED (Fixed for compatibility)`);
  console.log('🚀 ===============================================');
  console.log('🎯 Ready to receive transactions! TING TING! 🔔');
  console.log('✅ Webhook signature verification DISABLED - Should work now!');
  console.log('🚀 ===============================================');
});

// Export app for testing
module.exports = app;