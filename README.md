# Hướng Dẫn Tạo Hệ Thống Thông Báo Giao Dịch BANK-TING-TING

## 🏗️ KIẾN TRÚC HỆ THỐNG

```
[Giao Dịch Ngân Hàng] 
    ↓
[Sepay Webhook] 
    ↓
[Heroku Server (Node.js + Express)]
    ↓
[WebSocket Real-time]
    ↓
[Mobile Web App (PWA)]
    ↓
[Text-to-Speech + Background Notifications]
```

## 📋 YÊU CẦU TRƯỚC KHI BẮt ĐẦU

- Tài khoản GitHub
- Tài khoản Heroku (miễn phí)
- Tài khoản Sepay và API Key
- Thiết bị mobile có WiFi

## 🚀 BƯỚC 1: TẠO DỰ ÁN TRÊN GITHUB

### 1.1 Tạo Repository mới
```bash
# Tạo thư mục dự án
mkdir bank-ting-ting
cd bank-ting-ting

# Khởi tạo Git
git init
git remote add origin https://github.com/[username]/bank-ting-ting.git
```

### 1.2 Cấu trúc thư mục
```
bank-ting-ting/
├── index.js          ← DI CHUYỂN TỪ server/index.js
├── package.json      ← ĐÃ ĐÚNG VỊ TRÍ
├── Procfile          ← ĐÃ ĐÚNG VỊ TRÍ  
├── .env              ← ĐÃ ĐÚNG VỊ TRÍ
├── .env.example      ← DI CHUYỂN TỪ server/
├── .gitignore        ← ĐÃ ĐÚNG VỊ TRÍ
├── README.md         ← ĐÃ ĐÚNG VỊ TRÍ
└── public/           ← GIỮ NGUYÊN
    ├── app.js
    ├── index.html
    ├── manifest.json
    └── style.css
```

## 🔧 BƯỚC 2: TẠO BACKEND SERVER (NODE.JS)

### 2.1 File `server/package.json`
```json
{
  "name": "bank-ting-ting-server",
  "version": "1.0.0",
  "description": "Hệ thống thông báo giao dịch real-time",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "body-parser": "^1.20.2",
    "crypto": "^1.0.1"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### 2.2 File `server/index.js`
```javascript
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
```

### 2.3 File `server/.env.example`
```env
# Cấu hình Sepay
SEPAY_API_KEY=your_sepay_api_key_here
SEPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Cấu hình Server
PORT=3000
NODE_ENV=production

# Cấu hình thông báo
NOTIFICATION_SOUND_ENABLED=true
TTS_LANGUAGE=vi-VN
```

## 📱 BƯỚC 3: TẠO MOBILE WEB APP (PWA)

### 3.1 File `public/index.html`
```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BANK-TING-TING 🔔</title>
    <meta name="theme-color" content="#2196F3">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="BANK-TING-TING">
    
    <link rel="manifest" href="manifest.json">
    <link rel="stylesheet" href="style.css">
    <link rel="icon" type="image/png" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>">
</head>
<body>
    <div class="app-container">
        <header class="header">
            <h1>🏦 BANK-TING-TING</h1>
            <div class="status-indicator" id="connectionStatus">
                <span class="status-dot offline"></span>
                <span>Đang kết nối...</span>
            </div>
        </header>

        <div class="controls">
            <button id="toggleSound" class="btn btn-primary">🔊 Bật âm thanh</button>
            <button id="testNotification" class="btn btn-secondary">🧪 Test thông báo</button>
            <button id="toggleTTS" class="btn btn-primary">🗣️ Bật đọc giọng nói</button>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" id="totalTransactions">0</div>
                <div class="stat-label">Tổng giao dịch</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="totalAmount">0₫</div>
                <div class="stat-label">Tổng tiền</div>
            </div>
        </div>

        <div class="transactions-container">
            <h2>📊 Giao dịch gần đây</h2>
            <div id="transactionsList" class="transactions-list">
                <div class="no-transactions">
                    Chưa có giao dịch nào...
                </div>
            </div>
        </div>
    </div>

    <div id="notificationPopup" class="notification-popup hidden">
        <div class="notification-content">
            <div class="notification-icon">💰</div>
            <div class="notification-details">
                <div class="notification-amount"></div>
                <div class="notification-desc"></div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

### 3.2 File `public/style.css`
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.app-container {
    max-width: 428px;
    margin: 0 auto;
    background: white;
    min-height: 100vh;
    box-shadow: 0 0 20px rgba(0,0,0,0.1);
}

.header {
    background: #2196F3;
    color: white;
    padding: 20px;
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header h1 {
    font-size: 24px;
    margin-bottom: 10px;
}

.status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
}

.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

.status-dot.online {
    background: #4CAF50;
}

.status-dot.offline {
    background: #f44336;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

.controls {
    padding: 20px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.btn {
    flex: 1;
    min-width: 120px;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-primary {
    background: #2196F3;
    color: white;
}

.btn-secondary {
    background: #FF9800;
    color: white;
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.stats {
    display: flex;
    gap: 15px;
    padding: 0 20px 20px;
}

.stat-card {
    flex: 1;
    background: #f5f5f5;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
}

.stat-value {
    font-size: 20px;
    font-weight: bold;
    color: #2196F3;
    margin-bottom: 5px;
}

.stat-label {
    font-size: 12px;
    color: #666;
}

.transactions-container {
    padding: 20px;
}

.transactions-container h2 {
    margin-bottom: 15px;
    font-size: 18px;
}

.transactions-list {
    max-height: 400px;
    overflow-y: auto;
}

.transaction-item {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 10px;
    animation: slideIn 0.5s ease-out;
}

.transaction-item.credit {
    border-left: 4px solid #4CAF50;
}

.transaction-item.debit {
    border-left: 4px solid #f44336;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.transaction-amount {
    font-size: 18px;
    font-weight: bold;
}

.transaction-amount.credit {
    color: #4CAF50;
}

.transaction-amount.debit {
    color: #f44336;
}

.transaction-time {
    font-size: 12px;
    color: #666;
}

.transaction-content {
    font-size: 14px;
    color: #333;
    margin-bottom: 5px;
}

.transaction-details {
    font-size: 12px;
    color: #666;
}

.no-transactions {
    text-align: center;
    color: #666;
    padding: 40px 20px;
    font-style: italic;
}

/* Notification Popup */
.notification-popup {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 300px;
    width: 90%;
    transition: all 0.3s ease;
}

.notification-popup.hidden {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
    pointer-events: none;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 15px;
}

.notification-icon {
    font-size: 30px;
}

.notification-amount {
    font-size: 18px;
    font-weight: bold;
    color: #4CAF50;
}

.notification-desc {
    font-size: 14px;
    color: #666;
    margin-top: 5px;
}

/* Responsive */
@media (max-width: 480px) {
    .controls {
        flex-direction: column;
    }
    
    .btn {
        min-width: 100%;
    }
    
    .stats {
        flex-direction: column;
    }
}

/* PWA Styles */
@media (display-mode: standalone) {
    .header {
        padding-top: 40px; /* Account for status bar */
    }
}
```

### 3.3 File `public/app.js`
```javascript
class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        
        this.init();
    }
    
    init() {
        this.connectSocket();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.preventSleep();
    }
    
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            console.log('✅ Kết nối thành công!');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            console.log('❌ Mất kết nối!');
        });
        
        this.socket.on('new_transaction', (data) => {
            this.handleNewTransaction(data);
        });
    }
    
    setupEventListeners() {
        // Toggle sound
        document.getElementById('toggleSound').addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.updateSoundButton();
        });
        
        // Toggle TTS
        document.getElementById('toggleTTS').addEventListener('click', () => {
            this.ttsEnabled = !this.ttsEnabled;
            this.updateTTSButton();
        });
        
        // Test notification
        document.getElementById('testNotification').addEventListener('click', () => {
            this.sendTestNotification();
        });
        
        // Prevent app from sleeping
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App chuyển sang background');
            } else {
                console.log('📱 App trở lại foreground');
            }
        });
    }
    
    handleNewTransaction(data) {
        console.log('🔔 Giao dịch mới:', data);
        
        // Add to transactions list
        this.transactions.unshift(data);
        if (this.transactions.length > 50) {
            this.transactions = this.transactions.slice(0, 50);
        }
        
        // Update stats
        if (data.type === 'credit') {
            this.totalAmount += data.amount;
        }
        
        // Update UI
        this.updateTransactionsList();
        this.updateStats();
        
        // Show popup notification
        this.showNotificationPopup(data);
        
        // Play sound
        if (this.soundEnabled) {
            this.playNotificationSound();
        }
        
        // Text-to-speech
        if (this.ttsEnabled) {
            this.speakNotification(data);
        }
        
        // Show system notification
        this.showSystemNotification(data);
        
        // Vibrate (if supported)
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('connectionStatus');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span:last-child');
        
        if (isConnected) {
            dot.className = 'status-dot online';
            text.textContent = 'Đã kết nối';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Mất kết nối';
        }
    }
    
    updateTransactionsList() {
        const container = document.getElementById('transactionsList');
        
        if (this.transactions.length === 0) {
            container.innerHTML = '<div class="no-transactions">Chưa có giao dịch nào...</div>';
            return;
        }
        
        container.innerHTML = this.transactions.map(transaction => `
            <div class="transaction-item ${transaction.type}">
                <div class="transaction-header">
                    <div class="transaction-amount ${transaction.type}">
                        ${transaction.type === 'credit' ? '+' : '-'}${this.formatMoney(transaction.amount)}
                    </div>
                    <div class="transaction-time">
                        ${this.formatTime(transaction.timestamp)}
                    </div>
                </div>
                <div class="transaction-content">
                    ${transaction.content}
                </div>
                <div class="transaction-details">
                    ${transaction.bank_brand} • ${transaction.account_number}
                </div>
            </div>
        `).join('');
    }
    
    updateStats() {
        document.getElementById('totalTransactions').textContent = this.transactions.length;
        document.getElementById('totalAmount').textContent = this.formatMoney(this.totalAmount);
    }
    
    showNotificationPopup(data) {
        const popup = document.getElementById('notificationPopup');
        const amount = popup.querySelector('.notification-amount');
        const desc = popup.querySelector('.notification-desc');
        
        amount.textContent = `+${this.formatMoney(data.amount)}`;
        desc.textContent = data.content;
        
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 4000);
    }
    
    playNotificationSound() {
        // Tạo âm thanh thông báo
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }
    
    speakNotification(data) {
        if (!window.speechSynthesis) return;
        
        const text = `Nhận được ${this.formatMoney(data.amount)} đồng. ${data.content}`;
        const utterance = new SpeechSynthesisUtterance(text);
        
        utterance.lang = 'vi-VN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        window.speechSynthesis.speak(utterance);
    }
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }
    
    showSystemNotification(data) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        
        const notification = new Notification('BANK-TING-TING 🔔', {
            body: `+${this.formatMoney(data.amount)} - ${data.content}`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>',
            tag: 'bank-transaction',
            requireInteraction: false,
            silent: false
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 5000);
    }
    
    updateSoundButton() {
        const btn = document.getElementById('toggleSound');
        btn.textContent = this.soundEnabled ? '🔊 Tắt âm thanh' : '🔇 Bật âm thanh';
        btn.className = this.soundEnabled ? 'btn btn-primary' : 'btn btn-secondary';
    }
    
    updateTTSButton() {
        const btn = document.getElementById('toggleTTS');
        btn.textContent = this.ttsEnabled ? '🗣️ Tắt giọng nói' : '🔇 Bật giọng nói';
        btn.className = this.ttsEnabled ? 'btn btn-primary' : 'btn btn-secondary';
    }
    
    async sendTestNotification() {
        try {
            const response = await fetch('/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                console.log('✅ Đã gửi test notification');
            }
        } catch (error) {
            console.error('❌ Lỗi gửi test notification:', error);
        }
    }
    
    preventSleep() {
        // Giữ màn hình sáng bằng cách request wake lock
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').then(wakeLock => {
                console.log('🔒 Screen wake lock active');
                
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        navigator.wakeLock.request('screen');
                    }
                });
            }).catch(err => {
                console.log('❌ Wake lock error:', err);
            });
        }
        
        // Fallback: tạo audio im lặng
        setInterval(() => {
            if (document.hidden) {
                const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
                audio.play().catch(() => {});
            }
        }, 30000);
    }
    
    formatMoney(amount) {
        return new Intl.NumberFormat('vi-VN').format(amount);
    }
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Khởi tạo ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    window.bankTingTing = new BankTingTing();
});

// Service Worker cho PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('✅ SW registered'))
            .catch(error => console.log('❌ SW registration failed'));
    });
}
```

### 3.4 File `public/manifest.json`
```json
{
  "name": "BANK-TING-TING",
  "short_name": "BankTing",
  "description": "Hệ thống thông báo giao dịch ngân hàng real-time",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#2196F3",
  "theme_color": "#2196F3",
  "orientation": "portrait-primary",
  "categories": ["finance", "productivity"],
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>",
      "sizes": "192x192",
      "type": "image/svg+xml"
    },
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>",
      "sizes": "512x512",
      "type": "image/svg+xml"
    }
  ]
}
```

## 🚀 BƯỚC 4: DEPLOY LÊN HEROKU

### 4.1 File `Procfile`
```
web: node server/index.js
```

### 4.2 File `.gitignore`
```
node_modules/
.env
.DS_Store
logs/
*.log
```

### 4.3 Các bước deploy
```bash
# 1. Commit code lên GitHub
git add .
git commit -m "Initial commit - BANK-TING-TING system"
git push origin main

# 2. Tạo app Heroku
heroku create bank-ting-ting-[your-name]

# 3. Set environment variables
heroku config:set SEPAY_API_KEY=your_sepay_api_key
heroku config:set SEPAY_WEBHOOK_SECRET=your_webhook_secret
heroku config:set NODE_ENV=production

# 4. Deploy
git push heroku main

# 5. Kiểm tra logs
heroku logs --tail
```

## 🔧 BƯỚC 5: CẤU HÌNH SEPAY WEBHOOK

### 5.1 Truy cập Sepay Dashboard
1. Đăng nhập vào tài khoản Sepay
2. Vào mục "Webhook Settings"
3. Thêm URL webhook: `https://your-app-name.herokuapp.com/webhook/sepay`
4. Chọn events muốn nhận thông báo

### 5.2 Test webhook
```bash
# Test bằng curl
curl -X POST https://your-app-name.herokuapp.com/test-notification
```

## 📱 BƯỚC 6: SỬ DỤNG TRÊN MOBILE

### 6.1 Trên iOS (Safari)
1. Mở Safari và truy cập URL app
2. Nhấn nút "Share" (chia sẻ)
3. Chọn "Add to Home Screen"
4. Đặt tên và nhấn "Add"

### 6.2 Trên Android (Chrome)
1. Mở Chrome và truy cập URL app
2. Nhấn menu (3 chấm)
3. Chọn "Add to Home screen"
4. Xác nhận thêm shortcut

### 6.3 Cấu hình thông báo
1. Cho phép notifications khi được hỏi
2. Bật âm thanh và text-to-speech
3. Giữ app mở ở background để nhận thông báo

## 🔍 TROUBLESHOOTING

### Vấn đề thường gặp:
1. **Không nhận được webhook**: Kiểm tra URL và secret key
2. **App bị sleep**: Sử dụng wake lock và audio im lặng
3. **Notifications không hoạt động**: Kiểm tra permissions
4. **TTS không có tiếng Việt**: Cài đặt voice pack trên thiết bị

### Logs và monitoring:
```bash
# Xem logs Heroku
heroku logs --tail --app your-app-name

# Health check
curl https://your-app-name.herokuapp.com/health
```

## 🎯 TÍNH NĂNG NÂNG CAO

### Có thể thêm:
- Database để lưu lịch sử giao dịch
- Dashboard thống kê chi tiết
- Múi giờ tùy chỉnh
- Filter giao dịch theo số tiền
- Backup dữ liệu
- Multi-user support
- Push notifications qua Firebase

## 📋 CHECKLIST HOÀN THÀNH

- [ ] ✅ Tạo GitHub repository
- [ ] ✅ Setup Node.js server với Socket.IO
- [ ] ✅ Tạo mobile-responsive web app
- [ ] ✅ Implement real-time notifications
- [ ] ✅ Thêm text-to-speech
- [ ] ✅ Cấu hình PWA
- [ ] ✅ Deploy lên Heroku
- [ ] ✅ Cấu hình Sepay webhook
- [ ] ✅ Test trên iOS và Android
- [ ] ✅ Cấu hình .env variables

Hệ thống BANK-TING-TING của bạn đã sẵn sàng hoạt động 24/7! 🎉