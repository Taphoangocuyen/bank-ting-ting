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
        
        // LocalStorage settings
        this.storageKey = 'bankTingTing_transactions';
        this.todayStorageKey = 'bankTingTing_today';
        
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
        
        // Load dữ liệu cũ khi khởi tạo
        this.loadStoredTransactions();
        
        this.init();
    }
    
    init() {
        console.log(`🚀 Platform: ${this.isDesktop ? 'Desktop' : 'Mobile'}`);
        
        this.connectSocket();
        this.setupEventListeners();
        this.setDefaultSettings();
        
        // Bắt đầu auto-save
        this.startAutoSave();
        
        // Hiển thị thông tin storage khi load
        setTimeout(() => {
            this.logStorageInfo();
        }, 1000);
        
        // Conditional features based on platform
        if (this.isMobile) {
            this.requestNotificationPermission();
            this.loadVoices();
        } else {
            // Desktop: minimal features
            console.log('💻 Desktop mode - minimal features');
        }
        
        console.log('✅ Ultra-lightweight BANK-TING-TING loaded with Storage!');
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
        
        // Storage controls
        addListener('clearHistory', 'click', () => {
            this.showConfirmDialog('Xóa lịch sử', 'Bạn có chắc muốn xóa tất cả lịch sử giao dịch hôm nay?', () => {
                this.clearAllHistory();
            });
        }, 300);
        
        addListener('exportData', 'click', () => {
            this.exportTransactionData();
        }, 500);
        
        addListener('storageInfo', 'click', () => {
            this.showStorageModal();
        }, 300);
        
        addListener('closeModal', 'click', () => {
            this.hideStorageModal();
        });
        
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
        
        // Click outside modal to close
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('storageModal');
            if (e.target === modal) {
                this.hideStorageModal();
            }
        });
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
    
    // ===============================
    // LOCALSTORAGE METHODS
    // ===============================
    
    /**
     * Lưu giao dịch vào LocalStorage
     */
    saveTransactionsToStorage() {
        try {
            const today = new Date().toDateString();
            const dataToStore = {
                date: today,
                transactions: this.transactions,
                totalAmount: this.totalAmount,
                lastUpdate: new Date().toISOString()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(dataToStore));
            localStorage.setItem(this.todayStorageKey, today);
            
            console.log(`💾 Đã lưu ${this.transactions.length} giao dịch vào storage`);
        } catch (error) {
            console.error('❌ Lỗi lưu storage:', error);
        }
    }
    
    /**
     * Tải giao dịch từ LocalStorage
     */
    loadStoredTransactions() {
        try {
            const today = new Date().toDateString();
            const storedDate = localStorage.getItem(this.todayStorageKey);
            
            // Chỉ load nếu là cùng ngày
            if (storedDate === today) {
                const storedData = localStorage.getItem(this.storageKey);
                
                if (storedData) {
                    const parsedData = JSON.parse(storedData);
                    
                    // Kiểm tra dữ liệu hợp lệ
                    if (parsedData.date === today && Array.isArray(parsedData.transactions)) {
                        this.transactions = parsedData.transactions;
                        this.totalAmount = parsedData.totalAmount || 0;
                        
                        console.log(`📂 Đã tải ${this.transactions.length} giao dịch từ storage`);
                        
                        // Cập nhật UI
                        setTimeout(() => {
                            this.updateTransactionsList();
                            this.updateStats();
                        }, 100);
                        
                        return true;
                    }
                }
            } else {
                // Nếu khác ngày, xóa dữ liệu cũ
                this.clearOldTransactions();
            }
        } catch (error) {
            console.error('❌ Lỗi tải storage:', error);
            this.clearOldTransactions();
        }
        
        return false;
    }
    
    /**
     * Xóa giao dịch cũ (khác ngày)
     */
    clearOldTransactions() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.todayStorageKey);
            console.log('🗑️ Đã xóa giao dịch cũ');
        } catch (error) {
            console.error('❌ Lỗi xóa storage:', error);
        }
    }
    
    /**
     * Lấy thống kê từ storage
     */
    getStorageStats() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                return {
                    transactions: parsedData.transactions?.length || 0,
                    totalAmount: parsedData.totalAmount || 0,
                    lastUpdate: parsedData.lastUpdate
                };
            }
        } catch (error) {
            console.error('❌ Lỗi đọc thống kê:', error);
        }
        
        return { transactions: 0, totalAmount: 0, lastUpdate: null };
    }
    
    /**
     * Tính kích thước storage (KB)
     */
    getStorageSize() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? `${(data.length / 1024).toFixed(2)} KB` : '0 KB';
        } catch (error) {
            return 'Unknown';
        }
    }
    
    /**
     * Auto-save định kỳ (mỗi 30 giây)
     */
    startAutoSave() {
        setInterval(() => {
            if (this.transactions.length > 0) {
                this.saveTransactionsToStorage();
                console.log('💾 Auto-save completed');
            }
        }, 30000); // 30 giây
    }
    
    /**
     * Hiển thị thông tin storage trong console
     */
    logStorageInfo() {
        const stats = this.getStorageStats();
        console.log('📊 Storage Info:', {
            transactions: stats.transactions,
            totalAmount: this.formatMoney(stats.totalAmount),
            lastUpdate: stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString('vi-VN') : 'Chưa có',
            storageSize: this.getStorageSize()
        });
    }
    
    // ===============================
    // UI METHODS FOR STORAGE
    // ===============================
    
    /**
     * Hiển thị modal thông tin storage
     */
    showStorageModal() {
        const modal = document.getElementById('storageModal');
        if (!modal) return;
        
        // Cập nhật thông tin
        const stats = this.getStorageStats();
        const today = new Date().toLocaleDateString('vi-VN');
        
        const storageDate = document.getElementById('storageDate');
        const storageCount = document.getElementById('storageCount');
        const storageMoney = document.getElementById('storageMoney');
        const storageSize = document.getElementById('storageSize');
        const lastUpdate = document.getElementById('lastUpdate');
        
        if (storageDate) storageDate.textContent = today;
        if (storageCount) storageCount.textContent = stats.transactions;
        if (storageMoney) storageMoney.textContent = this.formatMoney(stats.totalAmount);
        if (storageSize) storageSize.textContent = this.getStorageSize();
        if (lastUpdate) lastUpdate.textContent = stats.lastUpdate ? 
            new Date(stats.lastUpdate).toLocaleString('vi-VN') : 'Chưa có dữ liệu';
        
        modal.classList.remove('hidden');
    }
    
    /**
     * Ẩn modal thông tin storage
     */
    hideStorageModal() {
        const modal = document.getElementById('storageModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    /**
     * Xóa tất cả lịch sử giao dịch
     */
    clearAllHistory() {
        try {
            // Xóa localStorage
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.todayStorageKey);
            
            // Reset dữ liệu trong app
            this.transactions = [];
            this.totalAmount = 0;
            
            // Cập nhật UI
            this.updateTransactionsList();
            this.updateStats();
            
            this.showToast('✅ Đã xóa tất cả lịch sử giao dịch', 'success');
            console.log('🗑️ Đã xóa tất cả lịch sử');
            
        } catch (error) {
            console.error('❌ Lỗi xóa lịch sử:', error);
            this.showToast('❌ Lỗi khi xóa lịch sử', 'error');
        }
    }
    
    /**
     * Xuất dữ liệu giao dịch
     */
    exportTransactionData() {
        try {
            if (this.transactions.length === 0) {
                this.showToast('⚠️ Chưa có giao dịch nào để xuất', 'info');
                return;
            }
            
            const today = new Date().toLocaleDateString('vi-VN');
            const exportData = {
                exportDate: new Date().toISOString(),
                date: today,
                totalTransactions: this.transactions.length,
                totalAmount: this.totalAmount,
                transactions: this.transactions.map(t => ({
                    time: new Date(t.timestamp).toLocaleString('vi-VN'),
                    amount: t.amount,
                    type: t.type,
                    content: t.content,
                    bank: t.bank_brand,
                    account: t.account_number
                }))
            };
            
            // Tạo file JSON
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Tạo link download
            const link = document.createElement('a');
            link.href = url;
            link.download = `bank-ting-ting-${today.replace(/\//g, '-')}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Cleanup
            URL.revokeObjectURL(url);
            
            this.showToast(`📤 Đã xuất ${this.transactions.length} giao dịch`, 'success');
            console.log('📤 Đã xuất dữ liệu:', exportData);
            
        } catch (error) {
            console.error('❌ Lỗi xuất dữ liệu:', error);
            this.showToast('❌ Lỗi khi xuất dữ liệu', 'error');
        }
    }
    
    /**
     * Hiển thị dialog xác nhận
     */
    showConfirmDialog(title, message, onConfirm) {
        if (confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
    }
    
    /**
     * Hiển thị toast notification
     */
    showToast(message, type = 'info') {
        // Xóa toast cũ nếu có
        const oldToast = document.querySelector('.toast');
        if (oldToast) {
            oldToast.remove();
        }
        
        // Tạo toast mới
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Auto hide sau 3 giây
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }
    
    // ===============================
    // VOICE METHODS
    // ===============================
    
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
    
    // ===============================
    // TRANSACTION HANDLING
    // ===============================
    
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
        
        // Lưu vào storage sau khi cập nhật
        setTimeout(() => {
            this.saveTransactionsToStorage();
        }, 100);
        
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
            
            // Giới hạn số lượng giao dịch lưu trữ (tối đa 50 giao dịch trong ngày)
            if (this.transactions.length > 50) {
                this.transactions = this.transactions.slice(0, 50);
            }
            
            if (data.type === 'credit') {
                this.totalAmount += data.amount;
            }
            
            // Update UI in single pass
            this.updateTransactionsList();
            this.updateStats();
        });
    }
    
    // ===============================
    // UI UPDATE METHODS
    // ===============================
    
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
    
    // ===============================
    // NOTIFICATION METHODS
    // ===============================
    
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
    
    // ===============================
    // UTILITY METHODS
    // ===============================
    
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
    
    // ===============================
    // DEBUG METHODS
    // ===============================
    
    /**
     * Method để test localStorage (chỉ dùng khi debug)
     */
    testLocalStorage() {
        console.log('🧪 Testing localStorage...');
        
        // Test 1: Kiểm tra localStorage có hoạt động không
        try {
            localStorage.setItem('test', 'hello');
            const result = localStorage.getItem('test');
            localStorage.removeItem('test');
            
            if (result === 'hello') {
                console.log('✅ localStorage hoạt động bình thường');
            } else {
                console.log('❌ localStorage có vấn đề');
                return false;
            }
        } catch (error) {
            console.error('❌ localStorage không khả dụng:', error);
            return false;
        }
        
        // Test 2: Tạo fake data để test
        const fakeTransactions = [
            {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                amount: 100000,
                content: 'Test transaction 1',
                account_number: '1234567890',
                transaction_id: 'TEST_1',
                bank_brand: 'VCB',
                type: 'credit'
            },
            {
                id: Date.now() + 1,
                timestamp: new Date().toISOString(),
                amount: 200000,
                content: 'Test transaction 2',
                account_number: '0987654321',
                transaction_id: 'TEST_2',
                bank_brand: 'TCB',
                type: 'credit'
            }
        ];
        
        // Test 3: Lưu fake data
        this.transactions = fakeTransactions;
        this.totalAmount = 300000;
        this.saveTransactionsToStorage();
        
        // Test 4: Clear và load lại
        this.transactions = [];
        this.totalAmount = 0;
        const loaded = this.loadStoredTransactions();
        
        if (loaded && this.transactions.length === 2) {
            console.log('✅ Save/Load localStorage thành công');
            this.updateTransactionsList();
            this.updateStats();
            return true;
        } else {
            console.log('❌ Save/Load localStorage thất bại');
            return false;
        }
    }
    
    /**
     * Debug localStorage size và nội dung
     */
    debugLocalStorage() {
        console.log('🔍 Debug localStorage:');
        
        try {
            // Tính tổng size của localStorage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                    console.log(`Key: ${key}, Size: ${localStorage[key].length} chars`);
                }
            }
            
            console.log(`📊 Total localStorage size: ${(totalSize / 1024).toFixed(2)} KB`);
            
            // Debug data của app
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                console.log('📱 App data:', {
                    date: parsed.date,
                    transactions: parsed.transactions?.length,
                    totalAmount: parsed.totalAmount,
                    lastUpdate: parsed.lastUpdate
                });
            } else {
                console.log('📱 No app data found');
            }
            
        } catch (error) {
            console.error('❌ Debug localStorage error:', error);
        }
    }
    
    /**
     * Reset hoàn toàn localStorage (emergency)
     */
    emergencyReset() {
        console.log('🚨 Emergency reset localStorage...');
        
        try {
            // Backup data trước khi reset
            const backup = {
                timestamp: new Date().toISOString(),
                data: JSON.stringify(localStorage)
            };
            
            console.log('💾 Backup created:', backup);
            
            // Clear localStorage
            localStorage.clear();
            
            // Reset app state
            this.transactions = [];
            this.totalAmount = 0;
            this.lastTransactionId = '';
            
            // Update UI
            this.updateTransactionsList();
            this.updateStats();
            
            console.log('✅ Emergency reset completed');
            this.showToast('🚨 Đã reset hoàn toàn dữ liệu', 'info');
            
            return backup;
            
        } catch (error) {
            console.error('❌ Emergency reset failed:', error);
            return null;
        }
    }
    
    destroy() {
        console.log('🗑️ Destroying instance...');
        
        // Lưu lần cuối trước khi destroy
        this.saveTransactionsToStorage();
        
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

// Debug commands - thêm vào window để có thể gọi từ console
window.debugBankTing = {
    test: () => window.bankTingTing?.testLocalStorage(),
    debug: () => window.bankTingTing?.debugLocalStorage(),
    reset: () => window.bankTingTing?.emergencyReset(),
    info: () => window.bankTingTing?.logStorageInfo(),
    clear: () => window.bankTingTing?.clearAllHistory()
};

console.log('🛠️ Debug commands available:');
console.log('- window.debugBankTing.test() - Test localStorage');
console.log('- window.debugBankTing.debug() - Debug info');
console.log('- window.debugBankTing.reset() - Emergency reset');
console.log('- window.debugBankTing.info() - Storage info');
console.log('- window.debugBankTing.clear() - Clear history');

console.log(`🚀 Ultra-lightweight BANK-TING-TING loaded for ${isMobile ? 'Mobile' : 'Desktop'} with LocalStorage support!`);