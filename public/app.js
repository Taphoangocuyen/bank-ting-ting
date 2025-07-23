class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        
        // Từ điển phát âm ngân hàng
        this.bankPronunciations = {
            'VCB': 'việt com băng',
            'Vietcombank': 'việt com băng', 
            'VIETCOMBANK': 'việt com băng',
            'TCB': 'tếch com băng',
            'Techcombank': 'tếch com băng',
            'TECHCOMBANK': 'tếch com băng',
            'MB': 'mờ bê băng',
            'MBBANK': 'mờ bê băng',
            'MBBank': 'mờ bê băng',
            'ACB': 'ACB',
            'VTB': 'việt tin băng',
            'VietinBank': 'việt tin băng',
            'VIETINBANK': 'việt tin băng',
            'VPBank': 'vê pê băng',
            'VPBANK': 'vê pê băng',
            'BIDV': 'bê i đê vê',
            'SHB': 'ét ách bê',
            'Sacombank': 'sa com băng',
            'SACOMBANK': 'sa com băng',
            'HDBank': 'ách đê băng',
            'HDBANK': 'ách đê băng',
            'TPBank': 'tê pê băng',
            'TPBANK': 'tê pê băng',
            'Eximbank': 'ếch xim băng',
            'EXIMBANK': 'ếch xim băng',
            'OCB': 'ô chê băng',
            'MSB': 'ếm ét bê',
            'SeABank': 'sí ây băng',
            'SEABANK': 'sí ây băng',
            'LienVietPostBank': 'liên việt pót băng',
            'LIENVIETPOSTBANK': 'liên việt pót băng',
            'Agribank': 'a gơ ri băng',
            'AGRIBANK': 'a gơ ri băng',
            'VIB': 'vê i băng',
            'PVcomBank': 'pê vê com băng',
            'PVCOMBANK': 'pê vê com băng'
        };
        
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
        
        // Text-to-speech với âm thanh tùy chỉnh
        if (this.ttsEnabled) {
            this.speakCustomNotification(data);
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
                    ${this.getBankDisplayName(transaction.bank_brand)} • ${transaction.account_number}
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
        // Tạo âm thanh "TING TING" đặc trưng
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Âm đầu tiên - TING
        const oscillator1 = audioContext.createOscillator();
        const gainNode1 = audioContext.createGain();
        oscillator1.connect(gainNode1);
        gainNode1.connect(audioContext.destination);
        
        oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.2);
        
        // Âm thứ hai - TING (sau 0.1 giây)
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            const gainNode2 = audioContext.createGain();
            oscillator2.connect(gainNode2);
            gainNode2.connect(audioContext.destination);
            
            oscillator2.frequency.setValueAtTime(900, audioContext.currentTime);
            gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 0.2);
        }, 100);
    }
    
    // Hàm lấy tên phát âm ngân hàng
    getBankPronunciation(bankCode) {
        const pronunciation = this.bankPronunciations[bankCode] || 
                            this.bankPronunciations[bankCode?.toUpperCase()] ||
                            bankCode?.toLowerCase().replace(/bank/gi, 'băng') || 
                            'ngân hàng';
        return pronunciation;
    }
    
    // Hàm lấy tên hiển thị ngân hàng
    getBankDisplayName(bankCode) {
        return bankCode || 'Unknown';
    }
    
    // Hàm phát âm tùy chỉnh
    speakCustomNotification(data) {
        if (!window.speechSynthesis) {
            console.log('❌ Trình duyệt không hỗ trợ text-to-speech');
            return;
        }
        
        // Tạo câu phát âm tùy chỉnh
        const bankName = this.getBankPronunciation(data.bank_brand);
        const amount = this.formatMoney(data.amount);
        
        // Câu phát âm: "Việt tin băng nhận được [số tiền] đồng, Cám ơn quý Khách"
        const customText = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
        
        console.log('🗣️ Phát âm:', customText);
        
        const utterance = new SpeechSynthesisUtterance(customText);
        
        // Cấu hình giọng nói
        utterance.lang = 'vi-VN';
        utterance.rate = 0.8;  // Chậm hơn một chút để rõ ràng
        utterance.pitch = 1.1; // Cao hơn một chút
        utterance.volume = 0.9;
        
        // Thử tìm giọng tiếng Việt
        const voices = window.speechSynthesis.getVoices();
        const vietnameseVoice = voices.find(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam') ||
            voice.name.toLowerCase().includes('vietnamese')
        );
        
        if (vietnameseVoice) {
            utterance.voice = vietnameseVoice;
            console.log('✅ Sử dụng giọng tiếng Việt:', vietnameseVoice.name);
        } else {
            console.log('⚠️ Không tìm thấy giọng tiếng Việt, sử dụng giọng mặc định');
        }
        
        // Xử lý lỗi
        utterance.onerror = (event) => {
            console.error('❌ Lỗi text-to-speech:', event.error);
        };
        
        utterance.onend = () => {
            console.log('✅ Hoàn thành phát âm');
        };
        
        // Phát âm
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
        
        const bankName = this.getBankDisplayName(data.bank_brand);
        
        const notification = new Notification('BANK-TING-TING 🔔', {
            body: `${bankName} nhận được +${this.formatMoney(data.amount)}đ\n${data.content}`,
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
        
        setTimeout(() => notification.close(), 8000);
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
        
        // Fallback: tạo audio im lặng để giữ app hoạt động
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
    
    // Load voices khi có sẵn
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
            const voices = window.speechSynthesis.getVoices();
            console.log('🗣️ Danh sách giọng nói có sẵn:', voices.map(v => `${v.name} (${v.lang})`));
        };
    }
});

// Service Worker cho PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('✅ SW registered'))
            .catch(error => console.log('❌ SW registration failed'));
    });
}