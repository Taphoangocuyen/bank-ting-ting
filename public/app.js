class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.transactions = [];
        this.totalAmount = 0;
        this.lastTransactionId = '';
        this.lastNotificationTime = 0;
        
        // Voice settings
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 1.2; // Mặc định "Nhanh"
        this.voicePitch = 1.0;
        
        // Background mode với minimal overhead
        this.isBackground = false;
        this.backgroundCheckInterval = null;
        
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
        this.setupBackgroundMode();
        this.setDefaultSettings();
        
        console.log('✅ Optimized BANK-TING-TING loaded!');
    }
    
    setDefaultSettings() {
        // Set default voice speed to "Nhanh"
        const speedSelect = document.getElementById('voiceSpeed');
        if (speedSelect) {
            speedSelect.value = '1.2';
        }
        
        // Set default pitch to "Bình thường"
        const pitchSelect = document.getElementById('voicePitch');
        if (pitchSelect) {
            pitchSelect.value = '1.0';
        }
        
        // Update button states
        this.updateSoundButton();
        this.updateTTSButton();
    }
    
    connectSocket() {
        // Tối ưu WebSocket connection - NO POLLING
        this.socket = io({
            transports: ['websocket'], // Chỉ WebSocket, không polling
            upgrade: false,
            rememberUpgrade: false,
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: 3, // Giảm attempts
            timeout: 5000, // Giảm timeout
            forceNew: false // Tái sử dụng connection
        });
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            console.log('✅ WebSocket connected (optimized)');
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            console.log('❌ WebSocket disconnected:', reason);
        });
        
        // MAIN transaction handler
        this.socket.on('new_transaction', (data) => {
            this.handleNewTransaction(data);
        });
        
        // NO heartbeat to reduce overhead
    }
    
    setupEventListeners() {
        // Clean setup để tránh memory leaks
        this.removeExistingListeners();
        
        // Event listeners với null checks
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        };
        
        addListener('toggleSound', 'click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.updateSoundButton();
        });
        
        addListener('toggleTTS', 'click', () => {
            this.ttsEnabled = !this.ttsEnabled;
            this.updateTTSButton();
        });
        
        addListener('testNotification', 'click', () => {
            this.sendTestNotification();
        });
        
        addListener('voiceSelect', 'change', (e) => {
            this.selectedVoice = e.target.value;
            console.log('🎭 Voice selected:', this.selectedVoice);
        });
        
        addListener('voiceSpeed', 'change', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
            console.log('⚡ Voice speed changed:', this.voiceSpeed);
        });
        
        addListener('voicePitch', 'change', (e) => {
            this.voicePitch = parseFloat(e.target.value);
            console.log('🎵 Voice pitch changed:', this.voicePitch);
        });
        
        addListener('testVoice', 'click', () => {
            this.testVoice();
        });
    }
    
    removeExistingListeners() {
        const buttons = ['toggleSound', 'toggleTTS', 'testNotification', 'testVoice'];
        buttons.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const newElement = element.cloneNode(true);
                element.parentNode?.replaceChild(newElement, element);
            }
        });
    }
    
    setupBackgroundMode() {
        // Lightweight background mode
        document.addEventListener('visibilitychange', () => {
            this.isBackground = document.hidden;
            
            if (this.isBackground) {
                console.log('📱 Background mode ON');
                this.startBackgroundCheck();
            } else {
                console.log('📱 Foreground mode ON');
                this.stopBackgroundCheck();
            }
        });
    }
    
    startBackgroundCheck() {
        // Clear existing interval
        if (this.backgroundCheckInterval) {
            clearInterval(this.backgroundCheckInterval);
        }
        
        // CHỈ check khi thật sự cần thiết (real-time connection lost)
        this.backgroundCheckInterval = setInterval(() => {
            if (this.isBackground && !this.isConnected) {
                this.checkBackgroundNotifications();
            }
        }, 30000); // 30 giây thay vì 10 giây
    }
    
    stopBackgroundCheck() {
        if (this.backgroundCheckInterval) {
            clearInterval(this.backgroundCheckInterval);
            this.backgroundCheckInterval = null;
        }
    }
    
    async checkBackgroundNotifications() {
        try {
            const response = await fetch('/api/logs', {
                signal: AbortSignal.timeout(3000) // Timeout 3 giây
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.recent_transactions && data.recent_transactions.length > 0) {
                const latest = data.recent_transactions[0];
                const transactionTime = new Date(latest.time);
                const now = Date.now();
                const diffInSeconds = (now - transactionTime.getTime()) / 1000;
                
                // CHỈ process transaction trong 20 giây gần đây
                if (diffInSeconds < 20) {
                    const transactionId = latest.transaction_id || latest.id || latest.time;
                    
                    // Duplicate check
                    if (transactionId === this.lastTransactionId) return;
                    
                    this.lastTransactionId = transactionId;
                    
                    console.log('🔔 Background transaction:', latest);
                    
                    // Sound & TTS
                    this.playNotificationSound();
                    
                    if (this.ttsEnabled) {
                        const fakeData = {
                            amount: latest.amount,
                            bank_brand: latest.bank,
                            content: latest.content
                        };
                        this.speakCustomNotification(fakeData);
                    }
                    
                    // System notification với Service Worker support
                    if (Notification.permission === 'granted') {
                        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                            // Gửi đến Service Worker cho background notification
                            navigator.serviceWorker.controller.postMessage({
                                type: 'BACKGROUND_NOTIFICATION',
                                data: {
                                    amount: latest.amount,
                                    bank_brand: latest.bank,
                                    content: latest.content
                                }
                            });
                        } else {
                            // Fallback notification
                            new Notification('BANK-TING-TING 🔔', {
                                body: `${latest.bank} nhận được +${this.formatMoney(latest.amount)}đ`,
                                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
                                tag: 'bank-transaction',
                                requireInteraction: false,
                                silent: false
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Background check failed:', error);
        }
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
        
        // Ensure default options exist
        if (!selector.querySelector('option[value="auto"]')) {
            const autoOption = document.createElement('option');
            autoOption.value = 'auto';
            autoOption.textContent = '🔄 Tự động (Giọng Việt tốt nhất)';
            autoOption.selected = true;
            selector.appendChild(autoOption);
            
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = '🤖 Giọng mặc định hệ thống';
            selector.appendChild(defaultOption);
        }
        
        // Add Vietnamese voices
        const vietnameseVoices = this.voices.filter(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam')
        );
        
        vietnameseVoices.forEach(voice => {
            // Check if already exists
            if (!selector.querySelector(`option[value="${voice.name}"]`)) {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `🇻🇳 ${voice.name}`;
                selector.appendChild(option);
            }
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
        
        this.speakCustomNotification(testData);
    }
    
    handleNewTransaction(data) {
        const now = Date.now();
        const transactionId = data.transaction_id || data.id || `${data.bank_brand}_${data.amount}_${now}`;
        
        // Simple duplicate check với timeout
        if (transactionId === this.lastTransactionId && (now - this.lastNotificationTime) < 2000) {
            console.log('🚫 Duplicate ignored:', transactionId);
            return;
        }
        
        this.lastTransactionId = transactionId;
        this.lastNotificationTime = now;
        
        console.log('💰 Real-time transaction:', data);
        
        // Add to UI (limit memory)
        this.addTransactionToUI(data);
        
        // Notifications
        this.playNotificationSound();
        
        if (this.ttsEnabled) {
            setTimeout(() => {
                this.speakCustomNotification(data);
            }, 200); // Giảm delay
        }
        
        this.showNotificationPopup(data);
        this.showSystemNotification(data);
        
        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    addTransactionToUI(data) {
        this.transactions.unshift(data);
        
        // Giới hạn memory - chỉ giữ 15 transactions
        if (this.transactions.length > 15) {
            this.transactions = this.transactions.slice(0, 15);
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
        
        // Optimized DOM manipulation
        const fragment = document.createDocumentFragment();
        
        this.transactions.forEach(transaction => {
            const item = document.createElement('div');
            item.className = `transaction-item ${transaction.type}`;
            item.innerHTML = `
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
            `;
            fragment.appendChild(item);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
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
            // Optimized audio context creation
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Single TING sound để giảm overhead
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.frequency.setValueAtTime(850, audioContext.currentTime);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.3);
            
            console.log('🔊 TING!');
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
        if (!window.speechSynthesis || !this.ttsEnabled) return;
        
        try {
            // Cancel previous để tránh overlap
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
            
            utterance.onend = () => {
                console.log('✅ TTS completed');
            };
            
            utterance.onerror = (event) => {
                console.error('❌ TTS error:', event.error);
            };
            
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
        
        // Service Worker notification if available (better for background)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'BACKGROUND_NOTIFICATION',
                data: data
            });
        } else {
            // Fallback direct notification
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
            
            setTimeout(() => notification.close(), 5000);
        }
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
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                console.log('✅ Test notification sent');
            }
        } catch (error) {
            console.error('❌ Test failed:', error);
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
        console.log('🗑️ Cleaning up...');
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        if (this.backgroundCheckInterval) {
            clearInterval(this.backgroundCheckInterval);
            this.backgroundCheckInterval = null;
        }
        
        console.log('✅ Cleanup completed');
    }
}

// Optimized initialization
document.addEventListener('DOMContentLoaded', () => {
    // Cleanup existing instance
    if (window.bankTingTing) {
        window.bankTingTing.destroy();
        window.bankTingTing = null;
    }
    
    // Small delay để đảm bảo DOM ready
    setTimeout(() => {
        window.bankTingTing = new BankTingTing();
    }, 100);
});

// Minimal Service Worker registration for background support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('✅ Minimal SW registered');
                
                // Background notification support
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data.type === 'BACKGROUND_SOUND' && window.bankTingTing) {
                        window.bankTingTing.playNotificationSound();
                        
                        if (window.bankTingTing.ttsEnabled && event.data.data) {
                            window.bankTingTing.speakCustomNotification(event.data.data);
                        }
                    }
                });
            })
            .catch(err => console.log('❌ SW registration failed:', err));
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.bankTingTing) {
        window.bankTingTing.destroy();
    }
});

console.log('🚀 Optimized BANK-TING-TING script loaded!');