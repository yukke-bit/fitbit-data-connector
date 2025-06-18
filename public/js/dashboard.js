// ダッシュボード用 JavaScript
class FitbitDashboard {
    constructor() {
        this.chart = null;
        this.currentChartType = 'steps';
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadUserProfile();
        await this.loadTodayData();
        await this.loadHeartRateData();
        await this.loadSleepData();
        await this.loadWeeklySummary();
        await this.loadDevices();
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
    }

    async loadUserProfile() {
        try {
            const response = await fetch('/api/profile');
            const data = await response.json();

            if (data.success) {
                const profile = data.data;
                document.getElementById('user-name').textContent = profile.displayName || '名前未設定';
                
                // アバター設定
                const userAvatar = document.querySelector('.user-avatar');
                if (profile.avatar && profile.avatar !== '') {
                    userAvatar.innerHTML = `<img src="${profile.avatar}" alt="アバター" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                }
            }
        } catch (error) {
            console.error('プロフィール読み込みエラー:', error);
        }
    }

    async loadTodayData() {
        try {
            const response = await fetch('/api/activity/today');
            const data = await response.json();

            if (data.success) {
                const activity = data.data;
                
                this.updateSummaryCard('steps-value', activity.steps?.value || 0);
                this.updateSummaryCard('calories-value', activity.calories?.value || 0);
                this.updateSummaryCard('distance-value', (activity.distance?.value || 0).toFixed(2));
                this.updateSummaryCard('active-minutes-value', activity.activeMinutes?.value || 0);

                // ローディング状態解除
                document.querySelectorAll('.summary-card').forEach(card => {
                    card.classList.remove('loading');
                });
            }
        } catch (error) {
            console.error('今日のデータ読み込みエラー:', error);
            this.showError('今日の活動データの読み込みに失敗しました。');
        }
    }

    async loadHeartRateData() {
        try {
            const response = await fetch('/api/heartrate');
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
            const response = await fetch('/api/sleep');
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
            const response = await fetch('/api/summary/weekly');
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
            const response = await fetch('/api/devices');
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
                const response = await fetch('/auth/logout', {
                    method: 'POST'
                });

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    throw new Error('ログアウトに失敗しました');
                }
            } catch (error) {
                console.error('ログアウトエラー:', error);
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

    // 自動更新機能
    startAutoRefresh() {
        setInterval(async () => {
            await this.loadTodayData();
            document.getElementById('last-sync').textContent = `最終更新: ${new Date().toLocaleTimeString('ja-JP')}`;
        }, 5 * 60 * 1000); // 5分ごと
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new FitbitDashboard();
    dashboard.startAutoRefresh();
});