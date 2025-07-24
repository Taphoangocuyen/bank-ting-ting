class BankTingTing {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.backgroundMode = true;
        this.transactions = [];
        this.totalAmount = 0;
        this.wakeLock = null;
        
        // Voice settings
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 0.8;
        this.voicePitch = 1.0;
        
        // Background settings
        this.backgroundAudio = null;
        this.heartbeatInterval = null;
        
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
            'ACB': 'á châu băng',
            'VTB': 'việt tin băng',
            'VietinBank': 'việt tin băng',
            'VIETINBANK': 'việt tin băng',
            'VPBank': 'vê pê băng',
            'VPBANK': 'vê pê băng',
            'BIDV': 'bê i đê vê',
            'SHB': 'SHB băng',
            'Sacombank': 'sa com băng',
            'SACOMBANK': 'sa com băng',
            'HDBank': 'hắc đê băng',
            'HDBANK': 'hắc đê băng',
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
            'Agribank': 'a gờ ri băng',
            'AGRIBANK': 'a gờ ri băng',
            'VIB': 'vê ai bê băng',
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
                console.log('✅ Service Worker registered:', registration);
                
                // Listen for messages from Service Worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
                // Setup background sync
                if ('sync' in window.ServiceWorkerRegistration.prototype) {
                    await registration.sync.register('background-check');
                    console.log('✅ Background sync registered');
                }
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
    }
    
    handleServiceWorkerMessage(message) {
        console.log('📨 Message from Service Worker:', message);
        
        if (message.type === 'PLAY_SOUND' && message.data) {
            // Phát âm thanh ngay cả khi app ở background
            this.playNotificationSound();
            
            if (this.ttsEnabled) {
                this.speakCustomNotification(message.data);
            }
        }
    }
    
    startBackgroundMode() {
        // Tạo audio im lặng để giữ app hoạt động
        this.createSilentAudio();
        
        // Heartbeat để giữ connection
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', { timestamp: Date.now() });
                console.log('💓 Heartbeat sent');
            }
        }, 25000); // Mỗi 25 giây
        
        // Background notification check
        setInterval(() => {
            if (document.hidden) {
                this.checkBackgroundNotifications();
            }
        }, 10000); // Mỗi 10 giây khi ở background
        
        console.log('🌙 Background mode started');
    }
    
    createSilentAudio() {
        // Tạo audio im lặng để prevent sleep
        this.backgroundAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = 0.01; // Rất nhỏ nhưng không phải 0
        
        // Play khi app vào background
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App vào background - Bắt đầu chế độ im lặng');
                this.backgroundAudio.play().catch(e => console.log('Silent audio failed:', e));
            } else {
                console.log('📱 App trở lại foreground - Dừng chế độ im lặng');
                this.backgroundAudio.pause();
            }
        });
    }
    
    async checkBackgroundNotifications() {
        try {
            const response = await fetch('/api/logs');
            const data = await response.json();
            
            // Kiểm tra giao dịch mới trong 30 giây gần đây
            if (data.recent_transactions && data.recent_transactions.length > 0) {
                const latest = data.recent_transactions[0];
                const now = new Date();
                const transactionTime = new Date(latest.time);
                const diffInSeconds = (now - transactionTime) / 1000;
                
                if (diffInSeconds < 30) {
                    console.log('🔔 Phát hiện giao dịch mới ở background!');
                    
                    // Phát âm thanh và giọng nói ngay cả khi ở background
                    this.playNotificationSound();
                    
                    if (this.ttsEnabled) {
                        const fakeData = {
                            amount: latest.amount,
                            bank_brand: latest.bank,
                            content: latest.content
                        };
                        this.speakCustomNotification(fakeData);
                    }
                    
                    // Show system notification
                    if (Notification.permission === 'granted') {
                        new Notification('BANK-TING-TING 🔔', {
                            body: `${latest.bank} nhận được +${this.formatMoney(latest.amount)}đ`,
                            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>',
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
        
        // Heartbeat response
        this.socket.on('heartbeat_response', (data) => {
            console.log('💗 Heartbeat response:', data);
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
        
        // Voice settings
        document.getElementById('voiceSelect').addEventListener('change', (e) => {
            this.selectedVoice = e.target.value;
            console.log('🎭 Đã chọn giọng:', this.selectedVoice);
        });
        
        document.getElementById('voiceSpeed').addEventListener('change', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
            console.log('⚡ Tốc độ đọc:', this.voiceSpeed);
        });
        
        document.getElementById('voicePitch').addEventListener('change', (e) => {
            this.voicePitch = parseFloat(e.target.value);
            console.log('🎵 Cao độ giọng:', this.voicePitch);
        });
        
        // Test voice
        document.getElementById('testVoice').addEventListener('click', () => {
            this.testVoice();
        });
        
        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App chuyển sang background - Chế độ background bật');
            } else {
                console.log('📱 App trở lại foreground - Chế độ normal');
            }
        });
        
        // Before unload - giữ connection
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.emit('keep_alive');
            }
        });
    }
    
    loadVoices() {
        if (!window.speechSynthesis) {
            console.log('❌ Trình duyệt không hỗ trợ text-to-speech');
            return;
        }
        
        const loadVoicesFunction = () => {
            this.voices = window.speechSynthesis.getVoices();
            this.populateVoiceSelector();
            console.log('🗣️ Đã tải', this.voices.length, 'giọng nói');
        };
        
        loadVoicesFunction();
        window.speechSynthesis.onvoiceschanged = loadVoicesFunction;
    }
    
    populateVoiceSelector() {
        const selector = document.getElementById('voiceSelect');
        
        // Clear existing options except default ones
        const defaultOptions = selector.querySelectorAll('option[value="auto"], option[value="default"]');
        selector.innerHTML = '';
        defaultOptions.forEach(option => selector.appendChild(option));
        
        // Find Vietnamese voices
        const vietnameseVoices = this.voices.filter(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam') ||
            voice.name.toLowerCase().includes('vietnamese') ||
            voice.name.toLowerCase().includes('vi-vn')
        );
        
        // Add Vietnamese voices
        vietnameseVoices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `🇻🇳 ${voice.name} (${voice.lang})`;
            selector.appendChild(option);
        });
        
        // Add other quality voices
        const otherGoodVoices = this.voices.filter(voice => 
            !voice.lang.includes('vi') && (
                voice.lang.includes('en') || 
                voice.name.toLowerCase().includes('google') ||
                voice.name.toLowerCase().includes('apple') ||
                voice.name.toLowerCase().includes('microsoft')
            )
        );
        
        if (otherGoodVoices.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '────── Giọng khác ──────';
            selector.appendChild(separator);
            
            otherGoodVoices.slice(0, 10).forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `🌐 ${voice.name} (${voice.lang})`;
                selector.appendChild(option);
            });
        }
        
        console.log('🗣️ Tìm thấy', vietnameseVoices.length, 'giọng tiếng Việt');
    }
    
    getSelectedVoice() {
        if (this.selectedVoice === 'auto') {
            const vietnameseVoices = this.voices.filter(voice => 
                voice.lang.includes('vi') || 
                voice.name.toLowerCase().includes('vietnam') ||
                voice.name.toLowerCase().includes('vietnamese')
            );
            
            if (vietnameseVoices.length > 0) {
                const premiumVoice = vietnameseVoices.find(voice => 
                    voice.name.toLowerCase().includes('google') ||
                    voice.name.toLowerCase().includes('apple') ||
                    voice.name.toLowerCase().includes('microsoft')
                );
                
                return premiumVoice || vietnameseVoices[0];
            }
            
            return null;
        } else if (this.selectedVoice === 'default') {
            return null;
        } else {
            return this.voices.find(voice => voice.name === this.selectedVoice);
        }
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
        
        // Play sound (hoạt động cả background)
        if (this.soundEnabled) {
            this.playNotificationSound();
        }
        
        // Text-to-speech (hoạt động cả background)
        if (this.ttsEnabled) {
            setTimeout(() => {
                this.speakCustomNotification(data);
            }, 500); // Delay nhỏ để tránh conflict với sound
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
            text.textContent = 'Đã kết nối (Background OK)';
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
        try {
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
            
            console.log('🔊 TING TING played!');
        } catch (error) {
            console.error('❌ Sound play failed:', error);
        }
    }
    
    getBankPronunciation(bankCode) {
        const pronunciation = this.bankPronunciations[bankCode] || 
                            this.bankPronunciations[bankCode?.toUpperCase()] ||
                            bankCode?.toLowerCase().replace(/bank/gi, 'băng') || 
                            'ngân hàng';
        return pronunciation;
    }
    
    getBankDisplayName(bankCode) {
        return bankCode || 'Unknown';
    }
    
    speakCustomNotification(data) {
        if (!window.speechSynthesis) {
            console.log('❌ Trình duyệt không hỗ trợ text-to-speech');
            return;
        }
        
        try {
            // Cancel any previous speech
            window.speechSynthesis.cancel();
            
            const bankName = this.getBankPronunciation(data.bank_brand);
            const amount = this.formatMoney(data.amount);
            
            const customText = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
            
            console.log('🗣️ Phát âm (Background OK):', customText);
            
            const utterance = new SpeechSynthesisUtterance(customText);
            
            utterance.lang = 'vi-VN';
            utterance.rate = this.voiceSpeed;
            utterance.pitch = this.voicePitch;
            utterance.volume = 0.9;
            
            const selectedVoice = this.getSelectedVoice();
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('✅ Sử dụng giọng:', selectedVoice.name);
            }
            
            utterance.onerror = (event) => {
                console.error('❌ Lỗi text-to-speech:', event.error);
            };
            
            utterance.onend = () => {
                console.log('✅ Hoàn thành phát âm');
            };
            
            // Force play even in background
            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('❌ Speech synthesis failed:', error);
        }
    }
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('🔔 Notification permission:', permission);
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
    
    async preventSleep() {
        // Screen Wake Lock API
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('🔒 Screen wake lock active');
                
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible' && this.wakeLock.released) {
                        this.wakeLock = await navigator.wakeLock.request('screen');
                        console.log('🔒 Screen wake lock re-activated');
                    }
                });
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('🔓 Screen wake lock released');
                });
                
            } catch (err) {
                console.log('❌ Wake lock error:', err);
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
}

// Khởi tạo ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    window.bankTingTing = new BankTingTing();
});

console.log('🚀 BANK-TING-TING với Background Support loaded!');