class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        this.wakeLock = null;
        this.processedTransactions = new Set(); // Tránh duplicate
        
        // Voice settings
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 0.8;
        this.voicePitch = 1.0;
        
        // Background settings
        this.backgroundAudio = null;
        this.heartbeatInterval = null;
        this.backgroundCheckInterval = null;
        this.lastNotificationTime = 0;
        
        // Từ điển phát âm ngân hàng
        this.bankPronunciations = {
            'VCB': 'việt com băng',
            'Vietcombank': 'việt com băng', 
            'VIETCOMBANK': 'việt com băng',
            'TCB': 'tê chê băng',
            'Techcombank': 'tếch com băng',
            'TECHCOMBANK': 'tếch com băng',
            'MB': 'mờ bê băng',
            'MBBANK': 'mờ bê băng',
            'MBBank': 'mờ bê băng',
            'ACB': 'á chê băng',
            'VTB': 'việt tín băng',
            'VietinBank': 'việt tín băng',
            'VIETINBANK': 'việt tín băng',
            'VPBank': 'vê pê băng',
            'VPBANK': 'vê pê băng',
            'BIDV': 'bê i đê vê',
            'SHB': 'ét ách bê',
            'Sacombank': 'sá com băng',
            'SACOMBANK': 'sá com băng',
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
        this.loadVoices();
        this.requestNotificationPermission();
        this.setupServiceWorker();
        this.preventSleep();
        this.startBackgroundMode();
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered');
                
                // Listen for messages from Service Worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
    }
    
    handleServiceWorkerMessage(message) {
        if (message.type === 'PLAY_SOUND' && message.data) {
            // Tránh duplicate notifications
            const transactionId = message.data.transaction_id || message.data.id;
            if (transactionId && this.processedTransactions.has(transactionId)) {
                return;
            }
            
            if (transactionId) {
                this.processedTransactions.add(transactionId);
            }
            
            this.playNotificationSound();
            
            if (this.ttsEnabled) {
                setTimeout(() => {
                    this.speakCustomNotification(message.data);
                }, 300);
            }
        }
    }
    
    startBackgroundMode() {
        // Clear existing intervals để tránh duplicate
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.backgroundCheckInterval) {
            clearInterval(this.backgroundCheckInterval);
        }
        
        // Heartbeat interval - CHỈ KHI CẦN
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', { timestamp: Date.now() });
            }
        }, 30000); // 30 giây thay vì 25 giây
        
        // Background check - CHỈ KHI Ở BACKGROUND
        this.backgroundCheckInterval = setInterval(() => {
            if (document.hidden && this.isConnected) {
                this.checkBackgroundNotifications();
            }
        }, 15000); // 15 giây thay vì 10 giây để giảm spam
        
        console.log('🌙 Background mode started');
    }
    
    async checkBackgroundNotifications() {
        try {
            const now = Date.now();
            
            // Tránh check quá thường xuyên
            if (now - this.lastNotificationTime < 10000) {
                return;
            }
            
            const response = await fetch('/api/logs');
            const data = await response.json();
            
            if (data.recent_transactions && data.recent_transactions.length > 0) {
                const latest = data.recent_transactions[0];
                const transactionTime = new Date(latest.time);
                const diffInSeconds = (now - transactionTime.getTime()) / 1000;
                
                // CHỈ XỬ LÝ GIAO DỊCH MỚI (trong 20 giây)
                if (diffInSeconds < 20) {
                    const transactionId = latest.transaction_id || latest.id || latest.time;
                    
                    // Tránh duplicate
                    if (this.processedTransactions.has(transactionId)) {
                        return;
                    }
                    
                    this.processedTransactions.add(transactionId);
                    this.lastNotificationTime = now;
                    
                    console.log('🔔 Background notification:', latest);
                    
                    // Phát âm thanh
                    this.playNotificationSound();
                    
                    // Text-to-speech
                    if (this.ttsEnabled) {
                        setTimeout(() => {
                            const fakeData = {
                                amount: latest.amount,
                                bank_brand: latest.bank,
                                content: latest.content
                            };
                            this.speakCustomNotification(fakeData);
                        }, 500);
                    }
                    
                    // System notification
                    if (Notification.permission === 'granted') {
                        new Notification('BANK-TING-TING 🔔', {
                            body: `${latest.bank} nhận được +${this.formatMoney(latest.amount)}đ`,
                            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
                            tag: 'bank-transaction-' + transactionId,
                            requireInteraction: false,
                            silent: false
                        });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Background check failed:', error);
        }
    }
    
    connectSocket() {
        // Tránh multiple connections
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.socket = io({
            forceNew: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 10000
        });
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            console.log('✅ Real-time connection established!');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            console.log('❌ Connection lost, attempting to reconnect...');
        });
        
        // REAL-TIME TRANSACTION HANDLER
        this.socket.on('new_transaction', (data) => {
            console.log('⚡ REAL-TIME TRANSACTION RECEIVED:', data);
            this.handleNewTransaction(data);
        });
        
        this.socket.on('heartbeat_response', (data) => {
            console.log('💗 Heartbeat OK');
        });
    }
    
    setupEventListeners() {
        // Tránh duplicate listeners
        const removeExistingListeners = () => {
            const buttons = ['toggleSound', 'toggleTTS', 'testNotification', 'testVoice'];
            buttons.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.replaceWith(element.cloneNode(true));
                }
            });
        };
        
        removeExistingListeners();
        
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
        
        // Voice settings
        document.getElementById('voiceSelect').addEventListener('change', (e) => {
            this.selectedVoice = e.target.value;
            console.log('🎭 Selected voice:', this.selectedVoice);
        });
        
        document.getElementById('voiceSpeed').addEventListener('change', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
        });
        
        document.getElementById('voicePitch').addEventListener('change', (e) => {
            this.voicePitch = parseFloat(e.target.value);
        });
        
        // Test voice
        document.getElementById('testVoice').addEventListener('click', () => {
            this.testVoice();
        });
        
        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App went to background');
            } else {
                console.log('📱 App returned to foreground');
            }
        });
    }
    
    loadVoices() {
        if (!window.speechSynthesis) {
            return;
        }
        
        const loadVoicesFunction = () => {
            this.voices = window.speechSynthesis.getVoices();
            this.populateVoiceSelector();
        };
        
        loadVoicesFunction();
        window.speechSynthesis.onvoiceschanged = loadVoicesFunction;
    }
    
    populateVoiceSelector() {
        const selector = document.getElementById('voiceSelect');
        if (!selector) return;
        
        // Keep default options
        const existingOptions = selector.innerHTML;
        const vietnameseVoices = this.voices.filter(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam') ||
            voice.name.toLowerCase().includes('vietnamese')
        );
        
        vietnameseVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `🇻🇳 ${voice.name}`;
            selector.appendChild(option);
        });
    }
    
    getSelectedVoice() {
        if (this.selectedVoice === 'auto') {
            const vietnameseVoices = this.voices.filter(voice => 
                voice.lang.includes('vi') || 
                voice.name.toLowerCase().includes('vietnam')
            );
            return vietnameseVoices[0] || null;
        }
        
        return this.voices.find(voice => voice.name === this.selectedVoice) || null;
    }
    
    testVoice() {
        const testData = {
            amount: 500000,
            bank_brand: 'MBBANK',
            content: 'Test giọng đọc'
        };
        
        this.speakCustomNotification(testData);
    }
    
    handleNewTransaction(data) {
        // Tránh duplicate processing
        const transactionId = data.transaction_id || data.id || data.timestamp;
        if (this.processedTransactions.has(transactionId)) {
            return;
        }
        
        this.processedTransactions.add(transactionId);
        console.log('💰 Processing new transaction:', data);
        
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
        
        // Text-to-speech với delay để tránh conflict
        if (this.ttsEnabled) {
            setTimeout(() => {
                this.speakCustomNotification(data);
            }, 500);
        }
        
        // Show system notification
        this.showSystemNotification(data);
        
        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;
        
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span:last-child');
        
        if (isConnected) {
            dot.className = 'status-dot online';
            text.textContent = 'Kết nối real-time ✅';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Đang kết nối lại...';
        }
    }
    
    updateTransactionsList() {
        const container = document.getElementById('transactionsList');
        if (!container) return;
        
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
        const totalEl = document.getElementById('totalTransactions');
        const amountEl = document.getElementById('totalAmount');
        
        if (totalEl) totalEl.textContent = this.transactions.length;
        if (amountEl) amountEl.textContent = this.formatMoney(this.totalAmount);
    }
    
    showNotificationPopup(data) {
        const popup = document.getElementById('notificationPopup');
        if (!popup) return;
        
        const amount = popup.querySelector('.notification-amount');
        const desc = popup.querySelector('.notification-desc');
        
        if (amount) amount.textContent = `+${this.formatMoney(data.amount)}`;
        if (desc) desc.textContent = data.content;
        
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 4000);
    }
    
    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // TING 1
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            
            osc1.frequency.setValueAtTime(800, audioContext.currentTime);
            gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            osc1.start(audioContext.currentTime);
            osc1.stop(audioContext.currentTime + 0.2);
            
            // TING 2
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.frequency.setValueAtTime(900, audioContext.currentTime);
                gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                osc2.start(audioContext.currentTime);
                osc2.stop(audioContext.currentTime + 0.2);
            }, 100);
            
            console.log('🔊 TING TING!');
        } catch (error) {
            console.error('❌ Sound failed:', error);
        }
    }
    
    getBankPronunciation(bankCode) {
        return this.bankPronunciations[bankCode] || 
               this.bankPronunciations[bankCode?.toUpperCase()] ||
               bankCode?.toLowerCase().replace(/bank/gi, 'băng') || 
               'ngân hàng';
    }
    
    speakCustomNotification(data) {
        if (!window.speechSynthesis) return;
        
        try {
            // Cancel previous speech
            window.speechSynthesis.cancel();
            
            const bankName = this.getBankPronunciation(data.bank_brand);
            const amount = this.formatMoney(data.amount);
            const text = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
            
            console.log('🗣️ Speaking:', text);
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = this.voiceSpeed;
            utterance.pitch = this.voicePitch;
            utterance.volume = 0.9;
            
            const selectedVoice = this.getSelectedVoice();
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            
            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('❌ TTS failed:', error);
        }
    }
    
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('🔔 Notification permission:', permission);
        }
    }
    
    showSystemNotification(data) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        
        const notification = new Notification('BANK-TING-TING 🔔', {
            body: `${data.bank_brand} nhận được +${this.formatMoney(data.amount)}đ`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
            tag: 'bank-transaction-' + (data.transaction_id || Date.now()),
            requireInteraction: false,
            silent: false
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 6000);
    }
    
    updateSoundButton() {
        const btn = document.getElementById('toggleSound');
        if (btn) {
            btn.textContent = this.soundEnabled ? '🔊 Tắt âm thanh' : '🔇 Bật âm thanh';
            btn.className = this.soundEnabled ? 'btn btn-primary' : 'btn btn-secondary';
        }
    }
    
    updateTTSButton() {
        const btn = document.getElementById('toggleTTS');
        if (btn) {
            btn.textContent = this.ttsEnabled ? '🗣️ Tắt giọng nói' : '🔇 Bật giọng nói';
            btn.className = this.ttsEnabled ? 'btn btn-primary' : 'btn btn-secondary';
        }
    }
    
    async sendTestNotification() {
        try {
            console.log('🧪 Sending test notification...');
            const response = await fetch('/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                console.log('✅ Test notification sent');
            }
        } catch (error) {
            console.error('❌ Test failed:', error);
        }
    }
    
    async preventSleep() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('🔒 Wake lock active');
                
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible' && this.wakeLock?.released) {
                        this.wakeLock = await navigator.wakeLock.request('screen');
                    }
                });
                
            } catch (err) {
                console.log('❌ Wake lock failed:', err);
            }
        }
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
    
    // Cleanup function
    destroy() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.backgroundCheckInterval) clearInterval(this.backgroundCheckInterval);
        if (this.socket) this.socket.disconnect();
        if (this.wakeLock) this.wakeLock.release();
    }
}

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    // Cleanup existing instance
    if (window.bankTingTing) {
        window.bankTingTing.destroy();
    }
    
    window.bankTingTing = new BankTingTing();
});

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Service Worker registered'))
            .catch(err => console.log('❌ Service Worker failed:', err));
    });
}

console.log('🚀 BANK-TING-TING Real-time System Loaded!');