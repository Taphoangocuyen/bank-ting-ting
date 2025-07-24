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
        
        // Platform detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isDesktop = !this.isMobile;
        
        // Voice settings - lazy load
        this.voices = [];
        this.selectedVoice = 'auto';
        this.voiceSpeed = 1.2;
        this.voicePitch = 1.0;
        
        // Từ điển phát âm ngân hàng - compact version
        this.bankPronunciations = {
            'VCB': 'việt com băng', 'VIETCOMBANK': 'việt com băng',
            'TCB': 'tếch com băng', 'TECHCOMBANK': 'tếch com băng',
            'MB': 'mờ bê băng', 'MBBANK': 'mờ bê băng',
            'ACB': 'ACB băng', 'VTB': 'việt tin băng', 'VIETINBANK': 'việt tin băng',
            'VPBANK': 'vê pê băng', 'BIDV': 'bê ai đi vê', 'SHB': 'SHB băng',
            'SACOMBANK': 'sa com băng', 'HDBANK': 'hắc đê băng',
            'TPBANK': 'tê pê băng', 'EXIMBANK': 'ếch xim băng',
            'OCB': 'ô chê băng', 'MSB': 'ếm ét bê', 'SEABANK': 'sí ây băng',
            'AGRIBANK': 'a gơ ri băng', 'VIB': 'vê i băng'
        };
        
        this.init();
    }
    
    init() {
        console.log(`🚀 Platform: ${this.isDesktop ? 'Desktop' : 'Mobile'}`);
        
        this.connectSocket();
        this.setupEventListeners();
        this.setDefaultSettings();
        
        // Conditional features based on platform
        if (this.isMobile) {
            this.requestNotificationPermission();
            this.loadVoices();
        } else {
            // Desktop: minimal features
            console.log('💻 Desktop mode - minimal features');
        }
        
        console.log('✅ Ultra-lightweight BANK-TING-TING loaded!');
    }
    
    connectSocket() {
        // Ultra-minimal WebSocket for desktop
        const socketConfig = this.isDesktop ? {
            transports: ['websocket'],
            upgrade: false,
            rememberUpgrade: false,
            reconnection: true,
            reconnectionDelay: 5000, // Longer delay for desktop
            reconnectionAttempts: 2, // Less aggressive reconnection
            timeout: 3000, // Shorter timeout
            autoConnect: true,
            forceNew: false
        } : {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: 3,
            timeout: 5000
        };
        
        this.socket = io(socketConfig);
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            console.log('✅ Socket connected (ultra-light)');
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            console.log('❌ Socket disconnected:', reason);
        });
        
        this.socket.on('new_transaction', (data) => {
            this.handleNewTransaction(data);
        });
    }
    
    setupEventListeners() {
        // Throttled event listeners to reduce CPU
        const throttle = (func, limit) => {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        };
        
        // Essential listeners only
        const addListener = (id, event, handler, throttleMs = 0) => {
            const element = document.getElementById(id);
            if (element) {
                const finalHandler = throttleMs > 0 ? throttle(handler, throttleMs) : handler;
                element.addEventListener(event, finalHandler, { passive: true });
            }
        };
        
        addListener('toggleSound', 'click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.updateSoundButton();
        }, 300);
        
        addListener('toggleTTS', 'click', () => {
            this.ttsEnabled = !this.ttsEnabled;
            this.updateTTSButton();
        }, 300);
        
        addListener('testNotification', 'click', () => {
            this.sendTestNotification();
        }, 1000);
        
        // Voice settings - lazy load on first interaction
        addListener('voiceSelect', 'focus', () => {
            this.lazyLoadVoices();
        });
        
        addListener('voiceSelect', 'change', (e) => {
            this.selectedVoice = e.target.value;
        }, 200);
        
        addListener('voiceSpeed', 'change', (e) => {
            this.voiceSpeed = parseFloat(e.target.value);
        }, 200);
        
        addListener('voicePitch', 'change', (e) => {
            this.voicePitch = parseFloat(e.target.value);
        }, 200);
        
        addListener('testVoice', 'click', () => {
            this.testVoice();
        }, 500);
    }
    
    setDefaultSettings() {
        // Set defaults without triggering events
        requestAnimationFrame(() => {
            const speedSelect = document.getElementById('voiceSpeed');
            if (speedSelect && speedSelect.value !== '1.2') {
                speedSelect.value = '1.2';
            }
            
            const pitchSelect = document.getElementById('voicePitch');
            if (pitchSelect && pitchSelect.value !== '1.0') {
                pitchSelect.value = '1.0';
            }
            
            this.updateSoundButton();
            this.updateTTSButton();
        });
    }
    
    lazyLoadVoices() {
        if (this.voices.length > 0) return; // Already loaded
        
        if (!window.speechSynthesis) return;
        
        console.log('🗣️ Lazy loading voices...');
        
        const loadVoices = () => {
            this.voices = window.speechSynthesis.getVoices();
            this.populateVoiceSelector();
        };
        
        loadVoices();
        if (this.voices.length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
                loadVoices();
                window.speechSynthesis.onvoiceschanged = null; // Remove listener after use
            };
        }
    }
    
    populateVoiceSelector() {
        const selector = document.getElementById('voiceSelect');
        if (!selector) return;
        
        // Only add Vietnamese voices
        const vietnameseVoices = this.voices.filter(voice => 
            voice.lang.includes('vi') || 
            voice.name.toLowerCase().includes('vietnam')
        );
        
        // Use DocumentFragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();
        
        vietnameseVoices.forEach(voice => {
            if (!selector.querySelector(`option[value="${voice.name}"]`)) {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `🇻🇳 ${voice.name}`;
                fragment.appendChild(option);
            }
        });
        
        selector.appendChild(fragment);
        console.log(`🗣️ Added ${vietnameseVoices.length} Vietnamese voices`);
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
        
        // Ultra-simple duplicate check
        if (transactionId === this.lastTransactionId && (now - this.lastNotificationTime) < 1500) {
            return; // No console.log to reduce overhead
        }
        
        this.lastTransactionId = transactionId;
        this.lastNotificationTime = now;
        
        console.log('💰 Transaction:', transactionId);
        
        // Batch UI updates
        this.batchUIUpdate(data);
        
        // Notifications
        this.playNotificationSound();
        
        if (this.ttsEnabled) {
            // Small delay to prevent audio conflict
            setTimeout(() => this.speakCustomNotification(data), 150);
        }
        
        // Desktop: simple notification, Mobile: full features
        if (this.isDesktop) {
            this.showSimpleNotification(data);
        } else {
            this.showNotificationPopup(data);
            this.showSystemNotification(data);
            
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }
    }
    
    batchUIUpdate(data) {
        // Batch all UI updates in single RAF
        requestAnimationFrame(() => {
            // Add transaction
            this.transactions.unshift(data);
            if (this.transactions.length > 10) { // Even smaller limit for desktop
                this.transactions = this.transactions.slice(0, 10);
            }
            
            if (data.type === 'credit') {
                this.totalAmount += data.amount;
            }
            
            // Update UI in single pass
            this.updateTransactionsList();
            this.updateStats();
        });
    }
    
    updateConnectionStatus(isConnected) {
        // Micro-optimization: cache elements
        if (!this.statusElements) {
            const statusElement = document.getElementById('connectionStatus');
            this.statusElements = statusElement ? {
                dot: statusElement.querySelector('.status-dot'),
                text: statusElement.querySelector('span:last-child')
            } : null;
        }
        
        if (!this.statusElements) return;
        
        const { dot, text } = this.statusElements;
        
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
        
        // Ultra-efficient DOM update
        const html = this.transactions.map(transaction => 
            `<div class="transaction-item ${transaction.type}">
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
            </div>`
        ).join('');
        
        container.innerHTML = html;
    }
    
    updateStats() {
        // Cache elements
        if (!this.statElements) {
            this.statElements = {
                total: document.getElementById('totalTransactions'),
                amount: document.getElementById('totalAmount')
            };
        }
        
        if (this.statElements.total) {
            this.statElements.total.textContent = this.transactions.length;
        }
        if (this.statElements.amount) {
            this.statElements.amount.textContent = this.formatMoney(this.totalAmount);
        }
    }
    
    showSimpleNotification(data) {
        // Desktop: minimal popup only
        const popup = document.getElementById('notificationPopup');
        if (!popup) return;
        
        const amount = popup.querySelector('.notification-amount');
        const desc = popup.querySelector('.notification-desc');
        
        if (amount) amount.textContent = `+${this.formatMoney(data.amount)}`;
        if (desc) desc.textContent = data.content;
        
        popup.classList.remove('hidden');
        
        // Auto-hide
        setTimeout(() => popup.classList.add('hidden'), 3000);
    }
    
    showNotificationPopup(data) {
        const popup = document.getElementById('notificationPopup');
        if (!popup) return;
        
        const amount = popup.querySelector('.notification-amount');
        const desc = popup.querySelector('.notification-desc');
        
        if (amount) amount.textContent = `+${this.formatMoney(data.amount)}`;
        if (desc) desc.textContent = data.content;
        
        popup.classList.remove('hidden');
        setTimeout(() => popup.classList.add('hidden'), 4000);
    }
    
    playNotificationSound() {
        try {
            // Single optimized TING sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.frequency.setValueAtTime(850, audioContext.currentTime);
            gain.gain.setValueAtTime(0.25, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
            
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.25);
            
            // Cleanup immediately
            setTimeout(() => {
                osc.disconnect();
                gain.disconnect();
            }, 300);
            
        } catch (error) {
            console.error('❌ Sound failed:', error);
        }
    }
    
    getBankPronunciation(bankCode) {
        return this.bankPronunciations[bankCode?.toUpperCase()] || 
               bankCode?.toLowerCase().replace(/bank/gi, 'băng') || 
               'ngân hàng';
    }
    
    speakCustomNotification(data) {
        if (!window.speechSynthesis || !this.ttsEnabled) return;
        
        try {
            window.speechSynthesis.cancel();
            
            const bankName = this.getBankPronunciation(data.bank_brand);
            const amount = this.formatMoney(data.amount);
            const text = `${bankName} nhận được ${amount} đồng. Cám ơn quý Khách.`;
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = this.voiceSpeed;
            utterance.pitch = this.voicePitch;
            utterance.volume = 0.9;
            
            const selectedVoice = this.getSelectedVoice();
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            
            utterance.onend = () => console.log('✅ TTS done');
            utterance.onerror = (event) => console.error('❌ TTS error:', event.error);
            
            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('❌ TTS failed:', error);
        }
    }
    
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
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
        
        setTimeout(() => notification.close(), 4000);
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
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch('/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            
            if (response.ok) {
                console.log('✅ Test sent');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('❌ Test failed:', error);
            }
        }
    }
    
    formatMoney(amount) {
        // Cache formatter for performance
        if (!this.moneyFormatter) {
            this.moneyFormatter = new Intl.NumberFormat('vi-VN');
        }
        return this.moneyFormatter.format(amount);
    }
    
    formatTime(timestamp) {
        // Cache formatter for performance
        if (!this.timeFormatter) {
            this.timeFormatter = new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        return this.timeFormatter.format(new Date(timestamp));
    }
    
    destroy() {
        console.log('🗑️ Destroying instance...');
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Clear cached elements
        this.statusElements = null;
        this.statElements = null;
        this.moneyFormatter = null;
        this.timeFormatter = null;
        
        console.log('✅ Destroyed');
    }
}

// Ultra-lightweight initialization
document.addEventListener('DOMContentLoaded', () => {
    // Cleanup
    if (window.bankTingTing) {
        window.bankTingTing.destroy();
        window.bankTingTing = null;
    }
    
    // Delayed initialization to reduce initial page load impact
    setTimeout(() => {
        window.bankTingTing = new BankTingTing();
    }, 50);
});

// NO Service Worker registration for desktop
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile && 'serviceWorker' in navigator) {
    // Only register SW on mobile
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Mobile SW registered'))
            .catch(err => console.log('❌ SW failed:', err));
    });
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (window.bankTingTing) {
        window.bankTingTing.destroy();
    }
});

console.log(`🚀 Ultra-lightweight BANK-TING-TING loaded for ${isMobile ? 'Mobile' : 'Desktop'}!`);