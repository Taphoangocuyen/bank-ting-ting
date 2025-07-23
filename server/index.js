const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
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
app.use(express.static('public'));

// Biến lưu trữ kết nối
let connectedClients = [];

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Thiết bị kết nối:', socket.id);
  connectedClients.push(socket);
  
  socket.on('disconnect', () => {
    console.log('Thiết bị ngắt kết nối:', socket.id);
    connectedClients = connectedClients.filter(client => client.id !== socket.id);
  });
});

// Hàm xác thực Sepay webhook
function verifyWebhook(payload, signature) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${hash}` === signature;
}

// Endpoint nhận webhook từ Sepay
app.post('/webhook/sepay', (req, res) => {
  try {
    const signature = req.headers['x-sepay-signature'];
    const payload = JSON.stringify(req.body);
    
    // Xác thực webhook (tùy chọn)
    if (process.env.SEPAY_WEBHOOK_SECRET && !verifyWebhook(payload, signature)) {
      return res.status(401).send('Unauthorized');
    }
    
    const transactionData = req.body;
    
    // Xử lý dữ liệu giao dịch
    const notification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      amount: transactionData.amount || 0,
      content: transactionData.content || '',
      account_number: transactionData.account_number || '',
      transaction_id: transactionData.transaction_id || '',
      bank_brand: transactionData.bank_brand || '',
      type: transactionData.amount > 0 ? 'credit' : 'debit'
    };
    
    // Gửi thông báo real-time đến tất cả client
    connectedClients.forEach(client => {
      client.emit('new_transaction', notification);
    });
    
    console.log('Giao dịch mới:', notification);
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Lỗi xử lý webhook:', error);
    res.status(500).send('Server Error');
  }
});

// Endpoint test thông báo
app.post('/test-notification', (req, res) => {
  const testNotification = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    amount: 500000,
    content: 'Test notification - Nhan tien test',
    account_number: '1234567890',
    transaction_id: 'TEST_' + Date.now(),
    bank_brand: 'VCB',
    type: 'credit'
  };
  
  connectedClients.forEach(client => {
    client.emit('new_transaction', testNotification);
  });
  
  res.json({ success: true, message: 'Test notification sent' });
});

// Endpoint health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connected_clients: connectedClients.length
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên port ${PORT}`);
  console.log(`📱 Web App: http://localhost:${PORT}`);
});