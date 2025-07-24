class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        
        // Simple state
        this.isInBackground = false;
        this.lastTransactionId = '';
        this.lastTransactionTime = 0;
        this.isSpeaking = false;
        
        // Voice settings
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 1.1;
        this.voicePitch = 1.0;
        
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
        
        console.log('🏗️ BankTingTing constructor called');
        this.init();
    }
    
    init() {
        console.log('🚀 BankTingTing init started');
        
        try {
            this.connectSocket();
            this.setupEventListeners();
            this.loadVoices();
            this.requestNotificationPermission();
            this.setupVisibilityChange();
            this.preventSleep();
            
            console.log('✅ BankTingTing init completed successfully');
        } catch (error) {
            console.error('❌ BankTingTing init failed:', error);
        }
    }
    
    setupVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            this.isInBackground = document.hidden;
            console.log('👁️ Visibility changed. Background:', this.isInBackground);
        });
    }
    
    connectSocket() {
        console.log('🔌 Connecting socket...');
        
        try {
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
                console.log('✅ Socket connected successfully!');
            });
            
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                console.log('❌ Socket disconnected!');
            });
            
            this.socket.on('new_transaction', (data) => {
                console.log('📨 SOCKET: new_transaction event received:', data);
                this.handleNewTransaction(data);
            });
            
            console.log('✅ Socket setup completed');
        } catch (error) {
            console.error('❌ Socket setup failed:', error);
        }
    }
    
    handleNewTransaction(data) {
        console.log('💰 ===== HANDLING NEW TRANSACTION =====');
        console.log('💰 Data:', data);
        console.log('💰 Background mode:', this.isInBackground);
        console.log('💰 Sound enabled:', this.soundEnabled);
        console.log('💰 TTS enabled:', this.ttsEnabled);
        
        const now = Date.now();
        const transactionId = data.transaction_id || data.id || `${data.bank_brand}_${data.amount}_${now}`;
        
        // Simple duplicate check
        if (transactionId === this.lastTransactionId && (now - this.lastTransactionTime) < 3000) {
            console.log('🚫 DUPLICATE DETECTED - SKIPPING:', transactionId);
            return;
        }
        
        this.lastTransactionId = transactionId;
        this.lastTransactionTime = now;
        
        console.log('✅ Transaction accepted, processing...');
        
        // Add to UI
        this.addTransactionToUI(data);
        
        // Play sound
        if (this.soundEnabled) {
            console.log('🔊 Playing notification sound...');
            this.playNotificationSound();
        } else {
            console.log('🔇 Sound disabled, skipping...');
        }
        
        // TTS
        if (this.ttsEnabled) {
            console.log('🗣️ TTS enabled, attempting to speak...');
            setTimeout(() => {
                this.speakNotification(data);
            }, 500);
        } else {
            console.log('🔇 TTS disabled, skipping...');
        }
        
        // System notification
        this.showSystemNotification(data);
        this.showNotificationPopup(data);
        
        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
            console.log('📳 Vibration triggered');
        }
        
        console.log('💰 ===== TRANSACTION HANDLING COMPLETE =====');
    }
    
    speakNotification(data) {
        console.log('🗣️ ===== SPEAK NOTIFICATION CALLED =====');
        console.log('🗣️ Data:', data);
        console.log('🗣️ speechSynthesis available:', !!window.speechSynthesis);
        console.log('🗣️ Is speaking:', this.isSpeaking);
        console.log('🗣️ Background mode:', this.isInBackground);
        
        if (!window.speechSynthesis) {
            console.log('❌ speechSynthesis not available');
            return;
        }
        
        if (this.isSpeaking) {
            console.log('🚫 Already speaking, skipping...');
            return;
        }
        
        try {
            this.isSpeaking = true;
            
            // Cancel any existing speech
            window.speechSynthesis.cancel();
            console.log('🔄 Cancelled existing speech');
            
            const bankName = this.getBankPronunciation(data.bank_brand);
            const amount = this.formatMoney(data.amount);
            const text = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
            
            console.log('🗣️ Text to speak:', text);
            console.log('🗣️ Voice speed:', this.voiceSpeed);
            console.log('🗣️ Voice pitch:', this.voicePitch);
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = this.voiceSpeed;
            utterance.pitch = this.voicePitch;
            utterance.volume = 1.0;
            
            const selectedVoice = this.getSelectedVoice();
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('🗣️ Using voice:', selectedVoice.name);
            } else {
                console.log('🗣️ Using default voice');
            }
            
            utterance.onstart = () => {
                console.log('🗣️ ✅ Speech started');
            };
            
            utterance.onend = () => {
                console.log('🗣️ ✅ Speech ended successfully');
                this.isSpeaking = false;
            };
            
            utterance.onerror = (event) => {
                console.error('🗣️ ❌ Speech error:', event.error);
                this.isSpeaking = false;
            };
            
            // Timeout fallback
            setTimeout(() => {
                if (this.isSpeaking) {
                    console.log('🗣️ ⏰ Speech timeout, forcing end');
                    this.isSpeaking = false;
                    window.speechSynthesis.cancel();
                }
            }, 10000);
            
            console.log('🗣️ 🚀 Starting speech...');
            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('🗣️ ❌ Speech failed with error:', error);
            this.isSpeaking = false;
        }
        
        console.log('🗣️ ===== SPEAK NOTIFICATION END =====');
    }
    
    playNotificationSound() {
        console.log('🔊 ===== PLAYING NOTIFICATION SOUND =====');
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🔊 AudioContext created');
            
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
            
            console.log('🔊 First TING scheduled');
            
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
                
                console.log('🔊 Second TING scheduled');
            }, 100);
            
            console.log('🔊 ✅ TING TING sound completed!');
        } catch (error) {
            console.error('🔊 ❌ Sound failed:', error);
        }
        
        console.log('🔊 ===== SOUND COMPLETE =====');
    }
    
    getBankPronunciation(bankCode) {
        const pronunciation = this.bankPronunciations[bankCode] || 
                            this.bankPronunciations[bankCode?.toUpperCase()] ||
                            bankCode?.toLowerCase().replace(/bank/gi, 'băng') || 
                            'ngân hàng';
        
        console.log('🏦 Bank pronunciation:', bankCode, '→', pronunciation);
        return pronunciation;
    }
    
    setupEventListeners() {
        console.log('📝 Setting up event listeners...');
        
        try {
            // Clean previous listeners
            this.cleanupEventListeners();
            
            // Toggle sound
            const soundBtn = document.getElementById('toggleSound');
            if (soundBtn) {
                soundBtn.addEventListener('click', () => {
                    this.soundEnabled = !this.soundEnabled;
                    this.updateSoundButton();
                    console.log('🔊 Sound toggled:', this.soundEnabled);
                });
            }
            
            // Toggle TTS
            const ttsBtn = document.getElementById('toggleTTS');
            if (ttsBtn) {
                ttsBtn.addEventListener('click', () => {
                    this.ttsEnabled = !this.ttsEnabled;
                    this.updateTTSButton();
                    console.log('🗣️ TTS toggled:', this.ttsEnabled);
                });
            }
            
            // Test notification
            const testBtn = document.getElementById('testNotification');
            if (testBtn) {
                testBtn.addEventListener('click', () => {
                    console.log('🧪 Test button clicked');
                    this.sendTestNotification();
                });
            }
            
            // Voice settings
            const voiceSelect = document.getElementById('voiceSelect');
            if (voiceSelect) {
                voiceSelect.addEventListener('change', (e) => {
                    this.selectedVoice = e.target.value;
                    console.log('🎭 Voice changed:', this.selectedVoice);
                });
            }
            
            const speedSelect = document.getElementById('voiceSpeed');
            if (speedSelect) {
                speedSelect.addEventListener('change', (e) => {
                    this.voiceSpeed = parseFloat(e.target.value);
                    console.log('⚡ Speed changed:', this.voiceSpeed);
                });
            }
            
            const pitchSelect = document.getElementById('voicePitch');
            if (pitchSelect) {
                pitchSelect.addEventListener('change', (e) => {
                    this.voicePitch = parseFloat(e.target.value);
                    console.log('🎵 Pitch changed:', this.voicePitch);
                });
            }
            
            // Test voice
            const testVoiceBtn = document.getElementById('testVoice');
            if (testVoiceBtn) {
                testVoiceBtn.addEventListener('click', () => {
                    console.log('🎤 Test voice button clicked');
                    this.testVoice();
                });
            }
            
            console.log('✅ Event listeners setup completed');
        } catch (error) {
            console.error('❌ Event listeners setup failed:', error);
        }
    }
    
    cleanupEventListeners() {
        const buttons = ['toggleSound', 'toggleTTS', 'testNotification', 'testVoice', 'voiceSelect', 'voiceSpeed', 'voicePitch'];
        buttons.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const newElement = element.cloneNode(true);
                element.parentNode?.replaceChild(newElement, element);
            }
        });
    }
    
    testVoice() {
        console.log('🎤 ===== TEST VOICE CALLED =====');
        
        const testData = {
            amount: 500000,
            bank_brand: 'MBBANK',
            content: 'Test giọng đọc'
        };
        
        this.speakNotification(testData);
    }
    
    loadVoices() {
        console.log('🗣️ Loading voices...');
        
        if (!window.speechSynthesis) {
            console.log('❌ speechSynthesis not available');
            return;
        }
        
        const loadVoicesFunction = () => {
            this.voices = window.speechSynthesis.getVoices();
            console.log('🗣️ Loaded voices:', this.voices.length);
            this.populateVoiceSelector();
        };
        
        loadVoicesFunction();
        window.speechSynthesis.onvoiceschanged = loadVoicesFunction;
    }
    
    populateVoiceSelector() {
        const selector = document.getElementById('voiceSelect');
        if (!selector) return;
        
        const vietnameseVoices = this.voices.filter(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam') ||
            voice.name.toLowerCase().includes('vietnamese')
        );
        
        console.log('🇻🇳 Vietnamese voices found:', vietnameseVoices.length);
        
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
    
    addTransactionToUI(data) {
        console.log('📱 Adding transaction to UI:', data);
        
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
        console.log('🧪 ===== SENDING TEST NOTIFICATION =====');
        
        try {
            const response = await fetch('/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                console.log('✅ Test notification request sent successfully');
            } else {
                console.error('❌ Test notification request failed:', response.status);
            }
        } catch (error) {
            console.error('❌ Test notification error:', error);
        }
    }
    
    async preventSleep() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('🔒 Wake lock activated');
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
        console.log('🗑️ Destroying BankTingTing instance');
        if (this.socket) this.socket.disconnect();
        if (this.wakeLock) this.wakeLock.release();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    
    if (window.bankTingTing) {
        console.log('🗑️ Destroying existing instance');
        window.bankTingTing.destroy();
    }
    
    console.log('🚀 Creating new BankTingTing instance');
    window.bankTingTing = new BankTingTing();
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('💥 Global error:', event.error);
});

console.log('📝 BankTingTing script loaded successfully!');