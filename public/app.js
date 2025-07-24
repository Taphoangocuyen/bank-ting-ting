class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        this.wakeLock = null;
        
        // Simple duplicate prevention
        this.lastTransactionId = '';
        this.lastTransactionTime = 0;
        
        // Voice settings
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 0.8;
        this.voicePitch = 1.0;
        
        // Background mode
        this.isInBackground = false;
        this.backgroundInterval = null;
        
        // TTS state
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
        this.setupBackgroundMode();
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered');
                
                // Kiểm tra navigator.serviceWorker.controller trước khi listen
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        this.handleServiceWorkerMessage(event.data);
                    });
                }
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
    }
    
    handleServiceWorkerMessage(message) {
        console.log('📨 SW Message received:', message);
        
        if (message.type === 'PLAY_SOUND' && message.data) {
            // FIX 1: CHỈ CHẠY TTS KHI Ở BACKGROUND
            if (document.hidden === true) {
                console.log('🗣️ Running TTS from Service Worker (background mode)');
                
                // Play sound
                this.playNotificationSound();
                
                // TTS for background
                if (this.ttsEnabled) {
                    this.forceTTS(message.data, (success) => {
                        console.log('🗣️ Background TTS result:', success);
                    });
                }
            } else {
                console.log('🚫 SW message ignored - tab is visible (foreground mode)');
            }
        }
    }
    
    setupBackgroundMode() {
        // Simple background detection
        document.addEventListener('visibilitychange', () => {
            this.isInBackground = document.hidden;
            
            if (this.isInBackground) {
                console.log('📱 App in background - Starting background mode');
                this.startBackgroundCheck();
                this.keepAudioContextAlive();
            } else {
                console.log('📱 App in foreground - Stopping background mode');
                this.stopBackgroundCheck();
            }
        });
        
        // Keep app alive in background
        this.keepAudioContextAlive();
        
        console.log('🌙 Background mode setup complete');
    }
    
    keepAudioContextAlive() {
        // Simple approach to keep app alive
        setInterval(() => {
            if (this.isInBackground) {
                try {
                    // Create minimal audio context to keep app active
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(1, audioContext.currentTime);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.001);
                    
                    setTimeout(() => {
                        audioContext.close();
                    }, 100);
                } catch (e) {
                    // Silently fail
                }
            }
        }, 25000); // Every 25 seconds
    }
    
    startBackgroundCheck() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
        }
        
        this.backgroundInterval = setInterval(() => {
            this.checkForNewTransactions();
        }, 10000); // Every 10 seconds
    }
    
    stopBackgroundCheck() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
    }
    
    async checkForNewTransactions() {
        if (!this.isInBackground) return;
        
        try {
            const response = await fetch('/api/logs');
            const data = await response.json();
            
            if (data.recent_transactions && data.recent_transactions.length > 0) {
                const latest = data.recent_transactions[0];
                const now = Date.now();
                const transactionTime = new Date(latest.time).getTime();
                const diffInSeconds = (now - transactionTime) / 1000;
                
                // Only process very recent transactions (30 seconds)
                if (diffInSeconds < 30) {
                    const transactionId = latest.transaction_id || latest.id || `${latest.bank}_${latest.amount}_${transactionTime}`;
                    
                    // Simple duplicate check
                    if (transactionId !== this.lastTransactionId || (now - this.lastTransactionTime) > 10000) {
                        this.lastTransactionId = transactionId;
                        this.lastTransactionTime = now;
                        
                        console.log('🔔 Background transaction detected!');
                        
                        // Play sound
                        this.playNotificationSound();
                        
                        // Try TTS with multiple attempts
                        if (this.ttsEnabled) {
                            this.attemptTTS({
                                amount: latest.amount,
                                bank_brand: latest.bank,
                                content: latest.content
                            }, 0);
                        }
                        
                        // System notification
                        this.showSystemNotification({
                            amount: latest.amount,
                            bank_brand: latest.bank,
                            content: latest.content
                        });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Background check failed:', error);
        }
    }
    
    attemptTTS(data, attempt) {
        if (attempt >= 5 || this.isSpeaking) return;
        
        const delays = [0, 500, 1000, 2000, 3000];
        
        setTimeout(() => {
            this.forceTTS(data, (success) => {
                if (!success && attempt < 4) {
                    console.log(`🗣️ TTS attempt ${attempt + 1} failed, retrying...`);
                    this.attemptTTS(data, attempt + 1);
                } else if (success) {
                    console.log('🗣️ TTS success in background!');
                } else {
                    console.log('🗣️ All TTS attempts failed');
                }
            });
        }, delays[attempt]);
    }
    
    forceTTS(data, callback) {
        if (!window.speechSynthesis || this.isSpeaking) {
            callback(false);
            return;
        }
        
        try {
            this.isSpeaking = true;
            
            // Force stop any existing speech
            window.speechSynthesis.cancel();
            
            // Small delay to ensure clean state
            setTimeout(() => {
                const bankName = this.getBankPronunciation(data.bank_brand);
                const amount = this.formatMoney(data.amount);
                const text = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
                
                console.log('🗣️ Force TTS:', text);
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'vi-VN';
                utterance.rate = this.voiceSpeed;
                utterance.pitch = this.voicePitch;
                utterance.volume = 1.0; // Max volume for background
                
                const selectedVoice = this.getSelectedVoice();
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
                
                let completed = false;
                
                utterance.onend = () => {
                    this.isSpeaking = false;
                    if (!completed) {
                        completed = true;
                        callback(true);
                    }
                };
                
                utterance.onerror = (event) => {
                    this.isSpeaking = false;
                    console.error('❌ TTS error:', event.error);
                    if (!completed) {
                        completed = true;
                        callback(false);
                    }
                };
                
                // Timeout fallback
                setTimeout(() => {
                    if (!completed) {
                        this.isSpeaking = false;
                        completed = true;
                        callback(false);
                    }
                }, 10000);
                
                window.speechSynthesis.speak(utterance);
                
            }, 100);
            
        } catch (error) {
            this.isSpeaking = false;
            console.error('❌ Force TTS failed:', error);
            callback(false);
        }
    }
    
    connectSocket() {
        // Clean up existing connection
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
            console.log('✅ Connected!');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            console.log('❌ Disconnected!');
        });
        
        this.socket.on('new_transaction', (data) => {
            this.handleNewTransaction(data);
        });
    }
    
    setupEventListeners() {
        // Remove existing listeners first
        this.cleanupEventListeners();
        
        // Add new listeners
        document.getElementById('toggleSound')?.addEventListener('click', this.toggleSound.bind(this));
        document.getElementById('toggleTTS')?.addEventListener('click', this.toggleTTS.bind(this));
        document.getElementById('testNotification')?.addEventListener('click', this.sendTestNotification.bind(this));
        document.getElementById('voiceSelect')?.addEventListener('change', this.onVoiceChange.bind(this));
        document.getElementById('voiceSpeed')?.addEventListener('change', this.onSpeedChange.bind(this));
        document.getElementById('voicePitch')?.addEventListener('change', this.onPitchChange.bind(this));
        document.getElementById('testVoice')?.addEventListener('click', this.testVoice.bind(this));
    }
    
    cleanupEventListeners() {
        const buttons = ['toggleSound', 'toggleTTS', 'testNotification', 'testVoice', 'voiceSelect', 'voiceSpeed', 'voicePitch'];
        buttons.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.replaceWith(element.cloneNode(true));
            }
        });
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.updateSoundButton();
    }
    
    toggleTTS() {
        this.ttsEnabled = !this.ttsEnabled;
        this.updateTTSButton();
    }
    
    onVoiceChange(e) {
        this.selectedVoice = e.target.value;
    }
    
    onSpeedChange(e) {
        this.voiceSpeed = parseFloat(e.target.value);
    }
    
    onPitchChange(e) {
        this.voicePitch = parseFloat(e.target.value);
    }
    
    testVoice() {
        if (this.isSpeaking) return;
        
        const testData = {
            amount: 500000,
            bank_brand: 'MBBANK',
            content: 'Test giọng đọc'
        };
        
        this.forceTTS(testData, (success) => {
            console.log('Test voice result:', success);
        });
    }
    
    handleNewTransaction(data) {
        const now = Date.now();
        const transactionId = data.transaction_id || data.id || `${data.bank_brand}_${data.amount}_${now}`;
        
        // FIX 2: SIMPLE DUPLICATE CHECK
        if (transactionId === this.lastTransactionId && (now - this.lastTransactionTime) < 5000) {
            console.log('🚫 Duplicate ignored:', transactionId);
            return;
        }
        
        this.lastTransactionId = transactionId;
        this.lastTransactionTime = now;
        
        console.log('💰 New transaction:', data);
        
        // Add to UI
        this.addTransactionToUI(data);
        
        // Sound notification
        if (this.soundEnabled) {
            this.playNotificationSound();
        }
        
        // Voice notification - CHỈ KHI FOREGROUND
        if (this.ttsEnabled && !document.hidden) {
            setTimeout(() => {
                this.forceTTS(data, () => {});
            }, 300);
        }
        
        // System notification
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
        
        // Keep existing options
        const existingHTML = selector.innerHTML;
        
        // Add Vietnamese voices
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
        
        console.log('🗣️ Found', vietnameseVoices.length, 'Vietnamese voices');
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
            tag: 'bank-transaction',
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
            console.log('🧪 Sending test...');
            const response = await fetch('/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                console.log('✅ Test sent');
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
    
    destroy() {
        if (this.socket) this.socket.disconnect();
        if (this.wakeLock) this.wakeLock.release();
        if (this.backgroundInterval) clearInterval(this.backgroundInterval);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (window.bankTingTing) {
        window.bankTingTing.destroy();
    }
    
    window.bankTingTing = new BankTingTing();
});

console.log('🚀 BANK-TING-TING Fixed & Working!');