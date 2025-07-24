class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        this.wakeLock = null;
        
        // Duplicate prevention với timestamp
        this.processedTransactions = new Map(); // ID -> timestamp
        this.lastProcessedTime = 0;
        
        // Voice settings
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 0.8;
        this.voicePitch = 1.0;
        
        // Background settings
        this.backgroundAudio = null;
        this.heartbeatInterval = null;
        this.backgroundCheckInterval = null;
        this.isBackgroundMode = false;
        
        // TTS Queue for background
        this.ttsQueue = [];
        this.isSpeaking = false;
        
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
        this.setupTTSQueue();
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered');
                
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
            const transactionId = this.generateTransactionId(message.data);
            
            // Tránh duplicate với timeout check
            if (this.isDuplicateTransaction(transactionId)) {
                console.log('🚫 Duplicate SW message ignored:', transactionId);
                return;
            }
            
            this.markTransactionProcessed(transactionId);
            
            // Play sound
            this.playNotificationSound();
            
            // Queue TTS cho background
            if (this.ttsEnabled) {
                this.queueTTS(message.data);
            }
        }
    }
    
    setupTTSQueue() {
        // TTS Queue processor - hoạt động cả background
        setInterval(() => {
            this.processTTSQueue();
        }, 1000);
    }
    
    queueTTS(data) {
        if (!this.ttsEnabled) return;
        
        this.ttsQueue.push({
            data: data,
            timestamp: Date.now(),
            retries: 0
        });
        
        console.log('🗣️ TTS queued for background:', data.bank_brand);
    }
    
    processTTSQueue() {
        if (this.isSpeaking || this.ttsQueue.length === 0) return;
        
        const item = this.ttsQueue.shift();
        const now = Date.now();
        
        // Skip old items (older than 30 seconds)
        if (now - item.timestamp > 30000) {
            console.log('🗣️ TTS item expired, skipped');
            return;
        }
        
        this.isSpeaking = true;
        
        try {
            this.speakCustomNotificationForced(item.data, () => {
                this.isSpeaking = false;
            });
        } catch (error) {
            console.error('❌ TTS queue processing failed:', error);
            this.isSpeaking = false;
            
            // Retry logic
            if (item.retries < 2) {
                item.retries++;
                this.ttsQueue.unshift(item);
            }
        }
    }
    
    generateTransactionId(data) {
        return data.transaction_id || 
               data.id || 
               `${data.bank_brand}_${data.amount}_${Date.now()}`;
    }
    
    isDuplicateTransaction(transactionId, timeWindow = 5000) {
        const now = Date.now();
        
        // Check if we processed this transaction recently
        if (this.processedTransactions.has(transactionId)) {
            const lastTime = this.processedTransactions.get(transactionId);
            if (now - lastTime < timeWindow) {
                return true;
            }
        }
        
        // Global time check to prevent spam
        if (now - this.lastProcessedTime < 1000) {
            console.log('🚫 Rate limited - too fast');
            return true;
        }
        
        return false;
    }
    
    markTransactionProcessed(transactionId) {
        const now = Date.now();
        this.processedTransactions.set(transactionId, now);
        this.lastProcessedTime = now;
        
        // Cleanup old entries (keep only last 50)
        if (this.processedTransactions.size > 50) {
            const entries = Array.from(this.processedTransactions.entries());
            entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp desc
            
            this.processedTransactions.clear();
            entries.slice(0, 50).forEach(([id, time]) => {
                this.processedTransactions.set(id, time);
            });
        }
    }
    
    startBackgroundMode() {
        // Clear existing intervals
        this.clearIntervals();
        
        // Minimal heartbeat
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', { timestamp: Date.now() });
            }
        }, 45000); // 45 seconds
        
        // Background check - ONLY when hidden and no real-time connection
        this.backgroundCheckInterval = setInterval(() => {
            if (document.hidden && (!this.socket || !this.socket.connected)) {
                this.checkBackgroundNotifications();
            }
        }, 20000); // 20 seconds
        
        // Visibility change handler
        document.addEventListener('visibilitychange', () => {
            this.isBackgroundMode = document.hidden;
            
            if (document.hidden) {
                console.log('📱 App background mode activated');
                this.startSilentAudio();
            } else {
                console.log('📱 App foreground mode activated');
                this.stopSilentAudio();
            }
        });
        
        console.log('🌙 Background mode initialized');
    }
    
    clearIntervals() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.backgroundCheckInterval) {
            clearInterval(this.backgroundCheckInterval);
            this.backgroundCheckInterval = null;
        }
    }
    
    startSilentAudio() {
        if (!this.backgroundAudio) {
            this.backgroundAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
            this.backgroundAudio.loop = true;
            this.backgroundAudio.volume = 0.001; // Almost silent
        }
        
        this.backgroundAudio.play().catch(e => {
            console.log('Silent audio failed:', e.message);
        });
    }
    
    stopSilentAudio() {
        if (this.backgroundAudio) {
            this.backgroundAudio.pause();
        }
    }
    
    async checkBackgroundNotifications() {
        try {
            const response = await fetch('/api/logs');
            const data = await response.json();
            
            if (data.recent_transactions && data.recent_transactions.length > 0) {
                const latest = data.recent_transactions[0];
                const transactionTime = new Date(latest.time);
                const now = Date.now();
                const diffInSeconds = (now - transactionTime.getTime()) / 1000;
                
                // Only process very recent transactions (15 seconds)
                if (diffInSeconds < 15) {
                    const transactionId = this.generateTransactionId(latest);
                    
                    if (this.isDuplicateTransaction(transactionId)) {
                        return;
                    }
                    
                    this.markTransactionProcessed(transactionId);
                    
                    console.log('🔔 Background transaction detected:', latest);
                    
                    // Sound
                    this.playNotificationSound();
                    
                    // Queue TTS
                    const fakeData = {
                        amount: latest.amount,
                        bank_brand: latest.bank,
                        content: latest.content
                    };
                    this.queueTTS(fakeData);
                    
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
        // Cleanup existing connection
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.socket = io({
            forceNew: true,
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: 5,
            timeout: 15000
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
        
        // MAIN TRANSACTION HANDLER
        this.socket.on('new_transaction', (data) => {
            console.log('⚡ REAL-TIME TRANSACTION:', data);
            this.handleNewTransaction(data);
        });
        
        this.socket.on('heartbeat_response', () => {
            console.log('💗 Heartbeat OK');
        });
    }
    
    setupEventListeners() {
        // Remove existing listeners to prevent duplicates
        this.removeExistingListeners();
        
        // Setup new listeners
        document.getElementById('toggleSound')?.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.updateSoundButton();
        });
        
        document.getElementById('toggleTTS')?.addEventListener('click', () => {
            this.ttsEnabled = !this.ttsEnabled;
            this.updateTTSButton();
        });
        
        document.getElementById('testNotification')?.addEventListener('click', () => {
            this.sendTestNotification();
        });
        
        document.getElementById('voiceSelect')?.addEventListener('change', (e) => {
            this.selectedVoice = e.target.value;
        });
        
        document.getElementById('voiceSpeed')?.addEventListener('change', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
        });
        
        document.getElementById('voicePitch')?.addEventListener('change', (e) => {
            this.voicePitch = parseFloat(e.target.value);
        });
        
        document.getElementById('testVoice')?.addEventListener('click', () => {
            this.testVoice();
        });
    }
    
    removeExistingListeners() {
        const buttons = ['toggleSound', 'toggleTTS', 'testNotification', 'testVoice', 'voiceSelect', 'voiceSpeed', 'voicePitch'];
        buttons.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const newElement = element.cloneNode(true);
                element.parentNode?.replaceChild(newElement, element);
            }
        });
    }
    
    loadVoices() {
        if (!window.speechSynthesis) return;
        
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
        
        const existingOptions = selector.innerHTML;
        const vietnameseVoices = this.voices.filter(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam')
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
                voice.lang.includes('vi') || voice.name.toLowerCase().includes('vietnam')
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
        
        this.queueTTS(testData);
    }
    
    handleNewTransaction(data) {
        const transactionId = this.generateTransactionId(data);
        
        // Duplicate check with strict timing
        if (this.isDuplicateTransaction(transactionId)) {
            console.log('🚫 Duplicate transaction ignored:', transactionId);
            return;
        }
        
        this.markTransactionProcessed(transactionId);
        console.log('💰 Processing new transaction:', transactionId);
        
        // Add to UI
        this.addTransactionToUI(data);
        
        // Notifications
        this.playNotificationSound();
        
        if (this.ttsEnabled) {
            this.queueTTS(data);
        }
        
        this.showSystemNotification(data);
        this.showNotificationPopup(data);
        
        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    addTransactionToUI(data) {
        this.transactions.unshift(data);
        if (this.transactions.length > 50) {
            this.transactions = this.transactions.slice(0, 50);
        }
        
        if (data.type === 'credit') {
            this.totalAmount += data.amount;
        }
        
        this.updateTransactionsList();
        this.updateStats();
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
            
            // First TING
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            
            osc1.frequency.setValueAtTime(800, audioContext.currentTime);
            gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            osc1.start(audioContext.currentTime);
            osc1.stop(audioContext.currentTime + 0.2);
            
            // Second TING
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
    
    speakCustomNotificationForced(data, callback) {
        if (!window.speechSynthesis) {
            if (callback) callback();
            return;
        }
        
        try {
            // Force cancel any existing speech
            window.speechSynthesis.cancel();
            
            const bankName = this.getBankPronunciation(data.bank_brand);
            const amount = this.formatMoney(data.amount);
            const text = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
            
            console.log('🗣️ TTS (Forced):', text);
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = this.voiceSpeed;
            utterance.pitch = this.voicePitch;
            utterance.volume = 0.9;
            
            const selectedVoice = this.getSelectedVoice();
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            
            utterance.onend = () => {
                console.log('✅ TTS completed');
                if (callback) callback();
            };
            
            utterance.onerror = (event) => {
                console.error('❌ TTS error:', event.error);
                if (callback) callback();
            };
            
            // Force play - even in background
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 200);
            
        } catch (error) {
            console.error('❌ TTS failed:', error);
            if (callback) callback();
        }
    }
    
    speakCustomNotification(data) {
        this.queueTTS(data);
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
        this.clearIntervals();
        if (this.socket) this.socket.disconnect();
        if (this.wakeLock) this.wakeLock.release();
        if (this.backgroundAudio) this.backgroundAudio.pause();
        this.ttsQueue = [];
        this.processedTransactions.clear();
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