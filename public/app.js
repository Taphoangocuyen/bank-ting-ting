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
        
        // LocalStorage settings - 7 DAYS STORAGE
        this.storageKey = 'bankTingTing_transactions_7days';
        this.weekStorageKey = 'bankTingTing_current_week';
        this.storageRetentionDays = 7; // LƯU 7 NGÀY
        
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
        console.log(`💾 Storage: ${this.storageRetentionDays} ngày`);
        
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
        
        console.log('✅ Ultra-lightweight BANK-TING-TING loaded with 7-Day Storage!');
    }
    
    // ===============================
    // 7-DAYS STORAGE HELPER METHODS
    // ===============================
    
    /**
     * Lấy tuần hiện tại (format: YYYY-WW)
     */
    getCurrentWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const pastDaysOfYear = (now - startOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    }
    
    /**
     * Kiểm tra giao dịch có trong 7 ngày qua không
     */
    isWithin7Days(timestamp) {
        const transactionDate = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - transactionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= this.storageRetentionDays;
    }
    
    /**
     * Lọc giao dịch trong 7 ngày
     */
    filterLast7DaysTransactions(transactions) {
        if (!Array.isArray(transactions)) return [];
        
        return transactions.filter(transaction => {
            if (!transaction.timestamp) return false;
            return this.isWithin7Days(transaction.timestamp);
        });
    }
    
    /**
     * Lấy ngày bắt đầu và kết thúc của 7 ngày
     */
    get7DaysRange() {
        const now = new Date();
        const endDate = new Date(now);
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - this.storageRetentionDays + 1);
        
        return {
            start: startDate.toLocaleDateString('vi-VN'),
            end: endDate.toLocaleDateString('vi-VN'),
            startISO: startDate.toISOString(),
            endISO: endDate.toISOString()
        };
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
            this.showConfirmDialog('Xóa lịch sử', 'Bạn có chắc muốn xóa tất cả lịch sử giao dịch 7 ngày qua?', () => {
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
    // 7-DAYS LOCALSTORAGE METHODS
    // ===============================
    
    /**
     * Lưu giao dịch vào LocalStorage - 7 NGÀY
     */
    saveTransactionsToStorage() {
        try {
            const currentWeek = this.getCurrentWeek();
            const range = this.get7DaysRange();
            
            // Lọc chỉ lấy giao dịch trong 7 ngày gần nhất
            const validTransactions = this.filterLast7DaysTransactions(this.transactions);
            
            const dataToStore = {
                week: currentWeek,
                dateRange: range,
                retentionDays: this.storageRetentionDays,
                transactions: validTransactions,
                totalAmount: this.totalAmount,
                lastUpdate: new Date().toISOString(),
                version: '7days'
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(dataToStore));
            localStorage.setItem(this.weekStorageKey, currentWeek);
            
            console.log(`💾 Đã lưu ${validTransactions.length} giao dịch (7 ngày) vào storage`);
        } catch (error) {
            console.error('❌ Lỗi lưu storage:', error);
        }
    }
    
    /**
     * Tải giao dịch từ LocalStorage - 7 NGÀY
     */
    loadStoredTransactions() {
        try {
            const currentWeek = this.getCurrentWeek();
            const storedData = localStorage.getItem(this.storageKey);
            
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // Kiểm tra dữ liệu hợp lệ và version
                if (parsedData.version === '7days' && Array.isArray(parsedData.transactions)) {
                    // Lọc lại giao dịch để đảm bảo chỉ lấy trong 7 ngày
                    const validTransactions = this.filterLast7DaysTransactions(parsedData.transactions);
                    
                    if (validTransactions.length > 0) {
                        this.transactions = validTransactions;
                        
                        // Tính lại tổng tiền từ giao dịch hợp lệ
                        this.totalAmount = validTransactions
                            .filter(t => t.type === 'credit')
                            .reduce((sum, t) => sum + (t.amount || 0), 0);
                        
                        console.log(`📂 Đã tải ${validTransactions.length} giao dịch (7 ngày) từ storage`);
                        
                        // Cập nhật UI
                        setTimeout(() => {
                            this.updateTransactionsList();
                            this.updateStats();
                        }, 100);
                        
                        return true;
                    }
                }
            }
            
            // Nếu không có dữ liệu hợp lệ, xóa dữ liệu cũ
            this.clearOldTransactions();
            
        } catch (error) {
            console.error('❌ Lỗi tải storage:', error);
            this.clearOldTransactions();
        }
        
        return false;
    }
    
    /**
     * Xóa giao dịch cũ (hơn 7 ngày)
     */
    clearOldTransactions() {
        try {
            // Xóa storage key cũ (1 ngày) nếu có
            localStorage.removeItem('bankTingTing_transactions');
            localStorage.removeItem('bankTingTing_today');
            
            console.log('🗑️ Đã xóa giao dịch cũ (7 ngày cleanup)');
        } catch (error) {
            console.error('❌ Lỗi xóa storage:', error);
        }
    }
    
    /**
     * Lấy thống kê từ storage - 7 NGÀY
     */
    getStorageStats() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                const validTransactions = this.filterLast7DaysTransactions(parsedData.transactions || []);
                
                return {
                    transactions: validTransactions.length,
                    totalAmount: validTransactions
                        .filter(t => t.type === 'credit')
                        .reduce((sum, t) => sum + (t.amount || 0), 0),
                    lastUpdate: parsedData.lastUpdate,
                    dateRange: parsedData.dateRange,
                    retentionDays: this.storageRetentionDays
                };
            }
        } catch (error) {
            console.error('❌ Lỗi đọc thống kê:', error);
        }
        
        return { 
            transactions: 0, 
            totalAmount: 0, 
            lastUpdate: null,
            dateRange: this.get7DaysRange(),
            retentionDays: this.storageRetentionDays
        };
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
     * Auto-save định kỳ (mỗi 30 giây) + cleanup
     */
    startAutoSave() {
        setInterval(() => {
            if (this.transactions.length > 0) {
                // Cleanup giao dịch cũ trước khi save
                this.transactions = this.filterLast7DaysTransactions(this.transactions);
                
                // Recalculate total từ giao dịch hợp lệ
                this.totalAmount = this.transactions
                    .filter(t => t.type === 'credit')
                    .reduce((sum, t) => sum + (t.amount || 0), 0);
                
                this.saveTransactionsToStorage();
                console.log('💾 Auto-save completed (7-day cleanup)');
            }
        }, 30000); // 30 giây
    }
    
    /**
     * Hiển thị thông tin storage trong console - 7 NGÀY
     */
    logStorageInfo() {
        const stats = this.getStorageStats();
        const range = this.get7DaysRange();
        
        console.log('📊 Storage Info (7 Days):', {
            transactions: stats.transactions,
            totalAmount: this.formatMoney(stats.totalAmount),
            dateRange: `${range.start} - ${range.end}`,
            retentionDays: stats.retentionDays,
            lastUpdate: stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString('vi-VN') : 'Chưa có',
            storageSize: this.getStorageSize()
        });
    }
    
    // ===============================
    // UI METHODS FOR 7-DAY STORAGE
    // ===============================
    
    /**
     * Hiển thị modal thông tin storage - 7 NGÀY
     */
    showStorageModal() {
        const modal = document.getElementById('storageModal');
        if (!modal) return;
        
        const stats = this.getStorageStats();
        const range = this.get7DaysRange();
        
        const storageDate = document.getElementById('storageDate');
        const storageCount = document.getElementById('storageCount');
        const storageMoney = document.getElementById('storageMoney');
        const storageSize = document.getElementById('storageSize');
        const lastUpdate = document.getElementById('lastUpdate');
        
        if (storageDate) storageDate.textContent = `${range.start} - ${range.end} (7 ngày)`;
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
     * Xóa tất cả lịch sử giao dịch - 7 NGÀY
     */
    clearAllHistory() {
        try {
            // Xóa localStorage 7 ngày
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.weekStorageKey);
            
            // Xóa cả storage cũ (1 ngày) để cleanup
            localStorage.removeItem('bankTingTing_transactions');
            localStorage.removeItem('bankTingTing_today');
            
            // Reset dữ liệu trong app
            this.transactions = [];
            this.totalAmount = 0;
            
            // Cập nhật UI
            this.updateTransactionsList();
            this.updateStats();
            
            this.showToast('✅ Đã xóa tất cả lịch sử giao dịch (7 ngày)', 'success');
            console.log('🗑️ Đã xóa tất cả lịch sử (7 ngày)');
            
        } catch (error) {
            console.error('❌ Lỗi xóa lịch sử:', error);
            this.showToast('❌ Lỗi khi xóa lịch sử', 'error');
        }
    }
    
    /**
     * Xuất dữ liệu giao dịch - 7 NGÀY
     */
    exportTransactionData() {
        try {
            if (this.transactions.length === 0) {
                this.showToast('⚠️ Chưa có giao dịch nào để xuất', 'info');
                return;
            }
            
            const range = this.get7DaysRange();
            const validTransactions = this.filterLast7DaysTransactions(this.transactions);
            
            const exportData = {
                exportDate: new Date().toISOString(),
                dateRange: `${range.start} - ${range.end}`,
                retentionDays: this.storageRetentionDays,
                totalTransactions: validTransactions.length,
                totalAmount: this.totalAmount,
                transactions: validTransactions.map(t => ({
                    time: new Date(t.timestamp).toLocaleString('vi-VN'),
                    amount: t.amount,
                    type: t.type,
                    content: t.content,
                    bank: t.bank_brand,
                    account: t.account_number,
                    daysAgo: Math.ceil((new Date() - new Date(t.timestamp)) / (1000 * 60 * 60 * 24))
                }))
            };
            
            // Tạo file JSON
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Tạo link download
            const link = document.createElement('a');
            link.href = url;
            link.download = `bank-ting-ting-7days-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Cleanup
            URL.revokeObjectURL(url);
            
            this.showToast(`📤 Đã xuất ${validTransactions.length} giao dịch (7 ngày)`, 'success');
            console.log('📤 Đã xuất dữ liệu 7 ngày:', exportData);
            
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
    // TRANSACTION HANDLING - 7 DAYS
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
            // Add transaction với timestamp hiện tại
            const transactionWithTimestamp = {
                ...data,
                timestamp: data.timestamp || new Date().toISOString()
            };
            
            this.transactions.unshift(transactionWithTimestamp);
            
            // Giới hạn số lượng giao dịch lưu trữ (tối đa 350 giao dịch trong 7 ngày ~ 50/ngày)
            if (this.transactions.length > 350) {
                this.transactions = this.transactions.slice(0, 350);
            }
            
            // Cleanup giao dịch cũ hơn 7 ngày
            this.transactions = this.filterLast7DaysTransactions(this.transactions);
            
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
        
        // Chỉ hiển thị giao dịch trong 7 ngày
        const validTransactions = this.filterLast7DaysTransactions(this.transactions);
        
        if (validTransactions.length === 0) {
            container.innerHTML = '<div class="no-transactions">Chưa có giao dịch nào trong 7 ngày qua...</div>';
            return;
        }
        
        // Ultra-efficient DOM update với thông tin ngày
        const html = validTransactions.map(transaction => {
            const daysAgo = Math.ceil((new Date() - new Date(transaction.timestamp)) / (1000 * 60 * 60 * 24));
            const dayLabel = daysAgo === 0 ? 'Hôm nay' : 
                            daysAgo === 1 ? 'Hôm qua' : 
                            `${daysAgo} ngày trước`;
            
            return `<div class="transaction-item ${transaction.type}">
                <div class="transaction-header">
                    <div class="transaction-amount ${transaction.type}">
                        ${transaction.type === 'credit' ? '+' : '-'}${this.formatMoney(transaction.amount)}
                    </div>
                    <div class="transaction-time">
                        ${this.formatTime(transaction.timestamp)} • ${dayLabel}
                    </div>
                </div>
                <div class="transaction-content">
                    ${transaction.content}
                </div>
                <div class="transaction-details">
                    ${transaction.bank_brand} • ${transaction.account_number}
                </div>
            </div>`;
        }).join('');
        
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
        
        // Chỉ đếm giao dịch trong 7 ngày
        const validTransactions = this.filterLast7DaysTransactions(this.transactions);
        const validAmount = validTransactions
            .filter(t => t.type === 'credit')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        if (this.statElements.total) {
            this.statElements.total.textContent = validTransactions.length;
        }
        if (this.statElements.amount) {
            this.statElements.amount.textContent = this.formatMoney(validAmount);
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
    // DEBUG METHODS - 7 DAYS
    // ===============================
    
    /**
     * Method để test localStorage (chỉ dùng khi debug) - 7 NGÀY
     */
    testLocalStorage() {
        console.log('🧪 Testing localStorage (7 Days)...');
        
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
        
        // Test 2: Tạo fake data để test 7 ngày
        const now = new Date();
        const fakeTransactions = [
            {
                id: Date.now(),
                timestamp: new Date().toISOString(), // Hôm nay
                amount: 100000,
                content: 'Test transaction hôm nay',
                account_number: '1234567890',
                transaction_id: 'TEST_TODAY',
                bank_brand: 'VCB',
                type: 'credit'
            },
            {
                id: Date.now() + 1,
                timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 ngày trước
                amount: 200000,
                content: 'Test transaction 2 ngày trước',
                account_number: '0987654321',
                transaction_id: 'TEST_2DAYS',
                bank_brand: 'TCB',
                type: 'credit'
            },
            {
                id: Date.now() + 2,
                timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 ngày trước
                amount: 300000,
                content: 'Test transaction 6 ngày trước',
                account_number: '1122334455',
                transaction_id: 'TEST_6DAYS',
                bank_brand: 'MBBANK',
                type: 'credit'
            },
            {
                id: Date.now() + 3,
                timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 ngày trước (sẽ bị lọc)
                amount: 400000,
                content: 'Test transaction 10 ngày trước (cũ)',
                account_number: '5566778899',
                transaction_id: 'TEST_10DAYS_OLD',
                bank_brand: 'BIDV',
                type: 'credit'
            }
        ];
        
        // Test 3: Lưu fake data
        this.transactions = fakeTransactions;
        this.totalAmount = 600000; // Tổng của 3 giao dịch hợp lệ
        this.saveTransactionsToStorage();
        
        // Test 4: Clear và load lại
        this.transactions = [];
        this.totalAmount = 0;
        const loaded = this.loadStoredTransactions();
        
        // Test 5: Kiểm tra kết quả
        const validTransactions = this.filterLast7DaysTransactions(this.transactions);
        
        if (loaded && validTransactions.length === 3) { // Chỉ 3 giao dịch trong 7 ngày
            console.log('✅ Save/Load localStorage (7 ngày) thành công');
            console.log(`📊 Loaded ${validTransactions.length}/4 giao dịch (1 cũ bị lọc)`);
            
            // Test date filtering
            validTransactions.forEach(t => {
                const daysAgo = Math.ceil((new Date() - new Date(t.timestamp)) / (1000 * 60 * 60 * 24));
                console.log(`  - ${t.content}: ${daysAgo} ngày trước`);
            });
            
            this.updateTransactionsList();
            this.updateStats();
            return true;
        } else {
            console.log('❌ Save/Load localStorage (7 ngày) thất bại');
            console.log(`❌ Expected 3 transactions, got ${validTransactions.length}`);
            return false;
        }
    }
    
    /**
     * Debug localStorage size và nội dung - 7 NGÀY
     */
    debugLocalStorage() {
        console.log('🔍 Debug localStorage (7 Days):');
        
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
            
            // Debug data của app 7 ngày
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                const validTransactions = this.filterLast7DaysTransactions(parsed.transactions || []);
                
                console.log('📱 App data (7 Days):', {
                    version: parsed.version,
                    dateRange: parsed.dateRange,
                    retentionDays: parsed.retentionDays,
                    totalTransactions: parsed.transactions?.length || 0,
                    validTransactions: validTransactions.length,
                    totalAmount: parsed.totalAmount,
                    lastUpdate: parsed.lastUpdate
                });
                
                // Phân tích theo ngày
                if (validTransactions.length > 0) {
                    console.log('📈 Phân tích theo ngày:');
                    for (let i = 0; i < 7; i++) {
                        const date = new Date();
                        date.setDate(date.getDate() - i);
                        const dayTransactions = validTransactions.filter(t => {
                            const tDate = new Date(t.timestamp);
                            return tDate.toDateString() === date.toDateString();
                        });
                        
                        const dayLabel = i === 0 ? 'Hôm nay' : i === 1 ? 'Hôm qua' : `${i} ngày trước`;
                        console.log(`  ${dayLabel}: ${dayTransactions.length} giao dịch`);
                    }
                }
            } else {
                console.log('📱 No 7-day data found');
            }
            
        } catch (error) {
            console.error('❌ Debug localStorage error:', error);
        }
    }
    
    /**
     * Reset hoàn toàn localStorage (emergency) - 7 NGÀY
     */
    emergencyReset() {
        console.log('🚨 Emergency reset localStorage (7 Days)...');
        
        try {
            // Backup data trước khi reset
            const backup = {
                timestamp: new Date().toISOString(),
                data: {
                    sevenDays: localStorage.getItem(this.storageKey),
                    oneDay: localStorage.getItem('bankTingTing_transactions'), // Legacy
                    allStorage: JSON.stringify(localStorage)
                }
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
            
            console.log('✅ Emergency reset completed (7 Days)');
            this.showToast('🚨 Đã reset hoàn toàn dữ liệu (7 ngày)', 'info');
            
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

// DEBUG COMMANDS - DESKTOP SAFE VERSION - 7 DAYS
window.debugBankTing = {
    // Kiểm tra status
    status: () => {
        const app = window.bankTingTing;
        const ready = !!app;
        
        console.log('🔍 App Status (7 Days):', {
            ready: ready,
            bankTingTing: ready ? '✅ Initialized' : '❌ Not ready',
            isConnected: ready ? (app.isConnected || false) : 'Unknown',
            transactions: ready ? (app.transactions?.length || 0) : 'Unknown',
            validTransactions: ready ? app.filterLast7DaysTransactions(app.transactions || []).length : 'Unknown',
            retentionDays: ready ? app.storageRetentionDays : 'Unknown',
            platform: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
            domReady: document.readyState,
            timestamp: new Date().toLocaleTimeString('vi-VN')
        });
        
        if (ready) {
            const range = app.get7DaysRange();
            console.log('📅 Date Range:', `${range.start} - ${range.end}`);
        }
        
        if (!ready) {
            console.warn('⚠️ App chưa sẵn sàng. Thử lại sau 2-3 giây hoặc refresh trang.');
        }
        
        return ready;
    },
    
    // Force init
    init: () => {
        console.log('🔄 Force initialize app...');
        
        if (window.bankTingTing) {
            console.log('✅ App đã được khởi tạo');
            return true;
        }
        
        try {
            if (typeof BankTingTing !== 'undefined') {
                window.bankTingTing = new BankTingTing();
                console.log('✅ Force init thành công!');
                return true;
            } else {
                console.error('❌ Class BankTingTing không tồn tại');
                return false;
            }
        } catch (error) {
            console.error('❌ Force init thất bại:', error);
            return false;
        }
    },
    
    // Test localStorage - 7 Days
    test: () => {
        if (!window.debugBankTing.status()) {
            console.warn('⚠️ App chưa sẵn sàng. Đợi và thử lại...');
            
            // Auto retry sau 2 giây
            setTimeout(() => {
                if (window.bankTingTing) {
                    console.log('🔄 Retry test localStorage (7 Days)...');
                    return window.bankTingTing.testLocalStorage();
                } else {
                    console.error('❌ App vẫn chưa sẵn sàng sau 2 giây');
                }
            }, 2000);
            return false;
        }
        
        return window.bankTingTing.testLocalStorage();
    },
    
    // Debug info với safety - 7 Days
    debug: () => {
        if (!window.debugBankTing.status()) {
            console.warn('⚠️ App chưa sẵn sàng');
            return false;
        }
        return window.bankTingTing.debugLocalStorage();
    },
    
    // Reset với safety - 7 Days
    reset: () => {
        if (!window.debugBankTing.status()) {
            console.warn('⚠️ App chưa sẵn sàng');
            return false;
        }
        
        if (confirm('🚨 Bạn có chắc muốn reset hoàn toàn dữ liệu 7 ngày?')) {
            return window.bankTingTing.emergencyReset();
        }
        return false;
    },
    
    // Storage info với safety - 7 Days
    info: () => {
        if (!window.debugBankTing.status()) {
            console.warn('⚠️ App chưa sẵn sàng');
            return false;
        }
        return window.bankTingTing.logStorageInfo();
    },
    
    // Clear history với safety - 7 Days
    clear: () => {
        if (!window.debugBankTing.status()) {
            console.warn('⚠️ App chưa sẵn sàng');
            return false;
        }
        
        if (confirm('🗑️ Bạn có chắc muốn xóa lịch sử 7 ngày?')) {
            return window.bankTingTing.clearAllHistory();
        }
        return false;
    },
    
    // NEW: Analyze 7-day data
    analyze: () => {
        if (!window.debugBankTing.status()) {
            console.warn('⚠️ App chưa sẵn sàng');
            return false;
        }
        
        const app = window.bankTingTing;
        const validTransactions = app.filterLast7DaysTransactions(app.transactions || []);
        
        console.log('📊 7-Day Analysis:');
        console.log(`📈 Total: ${validTransactions.length} giao dịch`);
        
        // Group by day
        const byDay = {};
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            byDay[dateStr] = validTransactions.filter(t => 
                new Date(t.timestamp).toDateString() === dateStr
            );
        }
        
        Object.entries(byDay).forEach(([date, transactions]) => {
            const dayName = new Date(date).toLocaleDateString('vi-VN');
            const amount = transactions
                .filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + t.amount, 0);
            console.log(`  ${dayName}: ${transactions.length} giao dịch, ${app.formatMoney(amount)}đ`);
        });
        
        return true;
    },
    
    // Reload page
    reload: () => {
        console.log('🔄 Reloading page...');
        window.location.reload();
    }
};

// ENHANCED INITIALIZATION với nhiều fallback
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    
    // Cleanup existing
    if (window.bankTingTing) {
        try {
            window.bankTingTing.destroy();
        } catch (e) {}
        window.bankTingTing = null;
    }
    
    // Multiple initialization attempts
    const initAttempts = [100, 500, 1000, 2000]; // ms delays
    let currentAttempt = 0;
    
    const tryInit = () => {
        try {
            console.log(`🔄 Init attempt ${currentAttempt + 1}/${initAttempts.length}`);
            
            if (typeof BankTingTing === 'undefined') {
                throw new Error('BankTingTing class not loaded');
            }
            
            window.bankTingTing = new BankTingTing();
            console.log('✅ BANK-TING-TING khởi tạo thành công!');
            
            // Test debug commands sau khi khởi tạo
            setTimeout(() => {
                console.log('🧪 Testing debug commands...');
                window.debugBankTing.status();
                console.log('🎉 All systems ready!');
            }, 500);
            
            return true;
            
        } catch (error) {
            console.warn(`⚠️ Init attempt ${currentAttempt + 1} failed:`, error.message);
            
            currentAttempt++;
            if (currentAttempt < initAttempts.length) {
                setTimeout(tryInit, initAttempts[currentAttempt]);
            } else {
                console.error('❌ Tất cả attempts thất bại. Sử dụng window.debugBankTing.init() để thử thủ công');
            }
            
            return false;
        }
    };
    
    // Start first attempt
    setTimeout(tryInit, initAttempts[0]);
});

// SERVICE WORKER - Safe check without variable redeclaration
const checkMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (checkMobileDevice() && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Mobile SW registered'))
            .catch(err => console.log('❌ SW failed:', err));
    });
} else {
    console.log('💻 Desktop mode - No Service Worker needed');
}

// Enhanced cleanup
window.addEventListener('beforeunload', () => {
    if (window.bankTingTing) {
        try {
            window.bankTingTing.destroy();
        } catch (e) {
            console.log('⚠️ Cleanup warning:', e.message);
        }
    }
});

// Final safety check
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!window.bankTingTing) {
            console.warn('🚨 BANK-TING-TING chưa được khởi tạo sau page load');
            console.log('💡 Chạy: window.debugBankTing.init() để khởi tạo thủ công');
            console.log('💡 Hoặc: window.debugBankTing.reload() để refresh');
        } else {
            console.log('🎉 BANK-TING-TING đã sẵn sàng!');
        }
    }, 3000);
});

// Enhanced help - 7 Days
console.log('🛠️ DESKTOP-SAFE Debug Commands (7 Days):');
console.log('- window.debugBankTing.status() ← Kiểm tra trạng thái');
console.log('- window.debugBankTing.init() ← Force khởi tạo');  
console.log('- window.debugBankTing.reload() ← Reload page');
console.log('- window.debugBankTing.test() ← Test localStorage (7 ngày)');
console.log('- window.debugBankTing.info() ← Storage info (7 ngày)');
console.log('- window.debugBankTing.debug() ← Debug localStorage (7 ngày)');
console.log('- window.debugBankTing.analyze() ← Phân tích 7 ngày');
console.log('- window.debugBankTing.clear() ← Clear history (7 ngày)');
console.log('- window.debugBankTing.reset() ← Emergency reset (7 ngày)');

console.log(`🚀 BANK-TING-TING loaded for ${checkMobileDevice() ? 'Mobile' : 'Desktop'} with 7-Day Storage!`);