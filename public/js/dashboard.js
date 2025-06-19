// ダッシュボード用 JavaScript
class FitbitDashboard {
    constructor() {
        this.chart = null;
        this.currentChartType = 'steps';
        this.debugLogs = [];
        this.init();
    }

    // 認証トークンを取得
    getAuthToken() {
        try {
            const tokenData = localStorage.getItem('fitbit_token');
            if (!tokenData) return null;
            
            const parsed = JSON.parse(atob(tokenData));
            return parsed.accessToken;
        } catch (error) {
            console.error('トークン解析エラー:', error);
            this.clearAuthToken();
            return null;
        }
    }

    // 認証ヘッダーを作成
    getAuthHeaders() {
        const token = this.getAuthToken();
        if (!token) {
            throw new Error('認証トークンがありません');
        }
        
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // 認証トークンをクリア
    clearAuthToken() {
        localStorage.removeItem('fitbit_token');
    }

    // 認証エラー処理
    handleAuthError(error) {
        console.error('認証エラー:', error);
        this.addDebugLog('error', '認証エラー', error.message);
        
        this.clearAuthToken();
        alert('認証の有効期限が切れました。再度ログインしてください。');
        window.location.href = '/';
    }

    // 認証付きAPIリクエストを実行
    async makeAuthenticatedRequest(url, options = {}) {
        try {
            const headers = this.getAuthHeaders();
            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers }
            });
            
            if (response.status === 401) {
                throw new Error('認証が必要です');
            }
            
            return response;
        } catch (error) {
            if (error.message.includes('認証')) {
                this.handleAuthError(error);
                throw error;
            }
            throw error;
        }
    }

    async init() {
        this.bindEvents();
        this.addDebugLog('info', 'ダッシュボード初期化開始');
        
        // トークンの存在チェック
        try {
            const token = this.getAuthToken();
            if (!token) {
                this.addDebugLog('error', '認証トークンが見つかりません');
                this.handleAuthError(new Error('認証トークンがありません'));
                return;
            }
            this.addDebugLog('info', '認証トークンを確認しました');
        } catch (error) {
            this.handleAuthError(error);
            return;
        }
        
        await this.loadUserProfile();
        await this.loadTodayData();
        await this.loadHeartRateData();
        await this.loadSleepData();
        await this.loadWeeklySummary();
        await this.loadDevices();
        
        this.addDebugLog('success', 'ダッシュボード初期化完了');
    }

    bindEvents() {
        // ログアウトボタン
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // チャートタブ
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchChart(e.target.dataset.chart);
            });
        });

        // エラーモーダル
        const modal = document.getElementById('error-modal');
        const modalClose = document.getElementById('modal-close');
        const errorOk = document.getElementById('error-ok');

        modalClose?.addEventListener('click', () => this.hideErrorModal());
        errorOk?.addEventListener('click', () => this.hideErrorModal());
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.hideErrorModal();
        });

        // デバッグコントロール
        const clearDebug = document.getElementById('clear-debug');
        const copyDebug = document.getElementById('copy-debug');
        const toggleDebug = document.getElementById('toggle-debug');

        clearDebug?.addEventListener('click', () => this.clearDebugLog());
        copyDebug?.addEventListener('click', () => this.copyDebugLog());
        toggleDebug?.addEventListener('click', () => this.toggleDebugSection());
    }

    async loadUserProfile() {
        try {
            this.addDebugLog('info', 'プロフィール取得開始');
            
            const response = await this.makeAuthenticatedRequest('/api/profile');
            const data = await response.json();
            this.addDebugLog('success', 'プロフィールAPI応答', data);

            if (data.success) {
                const profile = data.data;
                document.getElementById('user-name').textContent = profile.displayName || '名前未設定';
                
                // アバター設定
                const userAvatar = document.querySelector('.user-avatar');
                if (profile.avatar && profile.avatar !== '') {
                    userAvatar.innerHTML = `<img src="${profile.avatar}" alt="アバター" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                }
                this.addDebugLog('success', 'プロフィール表示完了', { displayName: profile.displayName });
            } else {
                this.addDebugLog('error', 'プロフィール取得失敗', data);
            }
        } catch (error) {
            console.error('プロフィール読み込みエラー:', error);
            this.addDebugLog('error', 'プロフィール読み込みエラー', error.message);
        }
    }

    async loadTodayData() {
        try {
            this.addDebugLog('info', '今日の活動データ取得開始');
            
            const response = await this.makeAuthenticatedRequest('/api/activity/today');
            const data = await response.json();
            this.addDebugLog('success', '今日の活動データAPI応答', data);

            if (data.success) {
                const activity = data.data;
                
                this.addDebugLog('info', '活動データ詳細', {
                    steps: activity.steps,
                    calories: activity.calories,
                    distance: activity.distance,
                    activeMinutes: activity.activeMinutes
                });
                
                this.updateSummaryCard('steps-value', activity.steps?.value || 0);
                this.updateSummaryCard('calories-value', activity.calories?.value || 0);
                this.updateSummaryCard('distance-value', (activity.distance?.value || 0).toFixed(2));
                this.updateSummaryCard('active-minutes-value', activity.activeMinutes?.value || 0);

                // ローディング状態解除
                document.querySelectorAll('.summary-card').forEach(card => {
                    card.classList.remove('loading');
                });
                
                this.addDebugLog('success', '今日の活動データ表示完了');
            } else {
                this.addDebugLog('error', '今日の活動データ取得失敗', data);
            }
        } catch (error) {
            console.error('今日のデータ読み込みエラー:', error);
            this.addDebugLog('error', '今日のデータ読み込みエラー', error.message);
            this.showError('今日の活動データの読み込みに失敗しました。');
        }
    }

    async loadHeartRateData() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/heartrate');
            const data = await response.json();

            if (data.success && data.data) {
                const heartRate = data.data;
                
                // 安静時心拍数
                if (heartRate.restingHeartRate) {
                    document.getElementById('resting-hr-value').textContent = heartRate.restingHeartRate;
                }

                // 心拍数ゾーン
                if (heartRate.heartRateZones) {
                    this.renderHeartRateZones(heartRate.heartRateZones);
                }
            }
        } catch (error) {
            console.error('心拍数データ読み込みエラー:', error);
        }
    }

    renderHeartRateZones(zones) {
        const container = document.getElementById('heartrate-zones');
        container.innerHTML = '';

        const zoneColors = {
            'Out of Range': '#95a5a6',
            'Fat Burn': '#f39c12',
            'Cardio': '#e74c3c',
            'Peak': '#c0392b'
        };

        zones.forEach(zone => {
            const zoneEl = document.createElement('div');
            zoneEl.className = 'hr-zone';
            zoneEl.style.background = zoneColors[zone.name] || '#95a5a6';
            
            zoneEl.innerHTML = `
                <div class="zone-name">${zone.name}</div>
                <div class="zone-range">${zone.min} - ${zone.max} bpm</div>
                <div class="zone-minutes">${zone.minutes || 0} 分</div>
            `;
            
            container.appendChild(zoneEl);
        });
    }

    async loadSleepData() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/sleep');
            const data = await response.json();

            if (data.success && data.data) {
                const sleep = data.data;
                
                // 睡眠時間（分を時間に変換）
                const sleepHours = Math.floor(sleep.minutesAsleep / 60);
                const sleepMinutes = sleep.minutesAsleep % 60;
                document.getElementById('sleep-duration').textContent = `${sleepHours}h ${sleepMinutes}m`;
                
                // 睡眠効率
                document.getElementById('sleep-efficiency').textContent = `${sleep.efficiency || 0}%`;
                
                // 就寝・起床時間
                if (sleep.startTime) {
                    document.getElementById('sleep-start').textContent = this.formatTime(sleep.startTime);
                }
                if (sleep.endTime) {
                    document.getElementById('sleep-end').textContent = this.formatTime(sleep.endTime);
                }

                // ローディング状態解除
                document.querySelector('.sleep-summary').classList.remove('loading');
            }
        } catch (error) {
            console.error('睡眠データ読み込みエラー:', error);
        }
    }

    async loadWeeklySummary() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/summary/weekly');
            const data = await response.json();

            if (data.success) {
                this.weeklyData = data.data.details;
                this.renderChart('steps'); // 初期チャートは歩数
            }
        } catch (error) {
            console.error('週間サマリー読み込みエラー:', error);
        }
    }

    async loadDevices() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/devices');
            const data = await response.json();

            if (data.success) {
                this.renderDevices(data.data);
            }
        } catch (error) {
            console.error('デバイス情報読み込みエラー:', error);
        }
    }

    renderDevices(devices) {
        const container = document.getElementById('devices-container');
        container.innerHTML = '';

        if (devices.length === 0) {
            container.innerHTML = '<div class="loading-message">接続されているデバイスがありません</div>';
            return;
        }

        devices.forEach(device => {
            const deviceEl = document.createElement('div');
            deviceEl.className = 'device-card';
            
            const deviceIcon = this.getDeviceIcon(device.type);
            const lastSync = new Date(device.lastSyncTime).toLocaleString('ja-JP');
            
            deviceEl.innerHTML = `
                <div class="device-icon">
                    <i class="${deviceIcon}"></i>
                </div>
                <div class="device-info">
                    <div class="device-name">${device.deviceVersion}</div>
                    <div class="device-status">最終同期: ${lastSync}</div>
                </div>
                <div class="battery-level">
                    <div class="battery-circle" style="background: conic-gradient(#4facfe ${device.batteryLevel * 3.6}deg, #e9ecef ${device.batteryLevel * 3.6}deg)">
                        ${device.batteryLevel}%
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">バッテリー</div>
                </div>
            `;
            
            container.appendChild(deviceEl);
        });
    }

    renderChart(type) {
        const ctx = document.getElementById('trendsChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        if (!this.weeklyData || !this.weeklyData[type]) {
            return;
        }

        const data = this.weeklyData[type];
        const labels = data.map(item => {
            const date = new Date(item.dateTime || item.date);
            return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
        });
        
        let values = [];
        let label = '';
        let color = '';

        switch (type) {
            case 'steps':
                values = data.map(item => item.value || 0);
                label = '歩数';
                color = '#4facfe';
                break;
            case 'calories':
                values = data.map(item => item.value || 0);
                label = 'カロリー (kcal)';
                color = '#ff6b6b';
                break;
            case 'sleep':
                values = data.map(item => (item.minutesAsleep || 0) / 60); // 時間に変換
                label = '睡眠時間 (h)';
                color = '#6c5ce7';
                break;
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: color,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    x: {
                        grid: {
                            color: '#f0f0f0'
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                }
            }
        });
    }

    switchChart(type) {
        // タブの切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-chart="${type}"]`).classList.add('active');

        // チャートの更新
        this.currentChartType = type;
        this.renderChart(type);
    }

    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = typeof value === 'number' ? value.toLocaleString() : value;
        }
    }

    formatTime(timeString) {
        try {
            const date = new Date(timeString);
            return date.toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return '--:--';
        }
    }

    getDeviceIcon(deviceType) {
        const icons = {
            'TRACKER': 'fas fa-watch',
            'SCALE': 'fas fa-weight',
            'PHONE': 'fas fa-mobile-alt',
            'DEFAULT': 'fas fa-device-mobile'
        };
        return icons[deviceType] || icons.DEFAULT;
    }

    async handleLogout() {
        if (confirm('ログアウトしますか？')) {
            try {
                // 認証ヘッダーを取得（トークンがない場合でもログアウト処理は実行）
                let headers = {};
                try {
                    headers = this.getAuthHeaders();
                } catch (error) {
                    // トークンがない場合でもログアウト処理を続行
                    console.warn('トークンが見つかりませんが、ログアウト処理を続行します');
                }
                
                const response = await fetch('/auth/logout', {
                    method: 'POST',
                    headers: headers
                });

                // LocalStorageからトークンを削除
                localStorage.removeItem('fitbit_token');

                if (response.ok || response.status === 401) {
                    // 成功または認証エラーの場合、どちらもログインページにリダイレクト
                    window.location.href = '/';
                } else {
                    throw new Error('ログアウトに失敗しました');
                }
            } catch (error) {
                console.error('ログアウトエラー:', error);
                // エラーが発生してもLocalStorageはクリアしてリダイレクト
                localStorage.removeItem('fitbit_token');
                this.showError('ログアウトに失敗しました。');
            }
        }
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').style.display = 'block';
    }

    hideErrorModal() {
        document.getElementById('error-modal').style.display = 'none';
    }

    // デバッグ機能
    addDebugLog(type, message, data = null) {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        const logEntry = {
            timestamp,
            type,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        
        this.debugLogs.push(logEntry);
        this.updateDebugDisplay();
    }
    
    updateDebugDisplay() {
        const debugContent = document.getElementById('debug-content');
        if (!debugContent) {
            console.warn('Debug content element not found');
            return;
        }
        
        const logsHtml = this.debugLogs.map(log => {
            const dataHtml = log.data ? `\n${log.data}` : '';
            return `<div class="debug-entry">
                <div class="debug-timestamp">[${log.timestamp}]</div>
                <div class="debug-type-${log.type}">${log.message}${dataHtml}</div>
            </div>`;
        }).join('');
        
        debugContent.innerHTML = logsHtml || '<div class="debug-log">デバッグログがありません</div>';
        
        // 自動スクロール
        debugContent.scrollTop = debugContent.scrollHeight;
    }
    
    clearDebugLog() {
        this.debugLogs = [];
        this.updateDebugDisplay();
        this.addDebugLog('info', 'デバッグログがクリアされました');
    }
    
    async copyDebugLog() {
        const debugText = this.debugLogs.map(log => {
            const dataText = log.data ? `\n${log.data}` : '';
            return `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${dataText}`;
        }).join('\n\n');
        
        try {
            await navigator.clipboard.writeText(debugText);
            this.addDebugLog('success', 'デバッグログをクリップボードにコピーしました');
        } catch (error) {
            // フォールバック
            const textArea = document.createElement('textarea');
            textArea.value = debugText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.addDebugLog('success', 'デバッグログをクリップボードにコピーしました（フォールバック）');
        }
    }
    
    toggleDebugSection() {
        const debugSection = document.getElementById('debug-section');
        const toggleBtn = document.getElementById('toggle-debug');
        
        if (debugSection.classList.contains('debug-hidden')) {
            debugSection.classList.remove('debug-hidden');
            toggleBtn.textContent = '非表示';
        } else {
            debugSection.classList.add('debug-hidden');
            toggleBtn.textContent = '表示';
        }
    }

    // 自動更新機能
    startAutoRefresh() {
        setInterval(async () => {
            try {
                // トークンの存在をチェック
                const token = this.getAuthToken();
                if (!token) {
                    this.addDebugLog('warning', '自動更新: 認証トークンがありません');
                    return;
                }
                
                await this.loadTodayData();
                document.getElementById('last-sync').textContent = `最終更新: ${new Date().toLocaleTimeString('ja-JP')}`;
            } catch (error) {
                console.warn('自動更新エラー:', error);
                // 認証エラーの場合は自動更新を停止しない（ユーザーが気づいていない可能性があるため）
            }
        }, 5 * 60 * 1000); // 5分ごと
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - initializing dashboard');
    const dashboard = new FitbitDashboard();
    
    // デバッグテスト
    setTimeout(() => {
        dashboard.addDebugLog('info', 'テストログ: デバッグ機能が動作しています');
    }, 1000);
    
    dashboard.startAutoRefresh();
});