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