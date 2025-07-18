// ユーティリティ関数
const crypto = require('crypto');

class FitbitHelpers {
    
    // 安全なランダム文字列生成
    static generateRandomString(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    // 日付フォーマット（YYYY-MM-DD）
    static formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }
    
    // 時刻フォーマット（HH:MM）
    static formatTime(dateTime) {
        try {
            const date = new Date(dateTime);
            return date.toTimeString().slice(0, 5);
        } catch (error) {
            return '--:--';
        }
    }
    
    // 分を時間:分形式に変換
    static minutesToHoursMinutes(minutes) {
        if (!minutes || minutes < 0) return '0h 0m';
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    
    // 距離をフォーマット（km）
    static formatDistance(distance) {
        if (!distance) return '0.0';
        return parseFloat(distance).toFixed(2);
    }
    
    // カロリーをフォーマット
    static formatCalories(calories) {
        if (!calories) return '0';
        return Math.round(calories).toLocaleString();
    }
    
    // 歩数をフォーマット
    static formatSteps(steps) {
        if (!steps) return '0';
        return parseInt(steps).toLocaleString();
    }
    
    // 期間に応じた日付配列を生成
    static generateDateRange(period) {
        const dates = [];
        let numDays;
        
        switch (period) {
            case '7d': numDays = 7; break;
            case '30d': numDays = 30; break;
            case '3m': numDays = 90; break;
            case '6m': numDays = 180; break;
            case '1y': numDays = 365; break;
            default: numDays = 7;
        }
        
        for (let i = numDays - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(this.formatDate(date));
        }
        
        return dates;
    }
    
    // BMI計算
    static calculateBMI(weight, height) {
        if (!weight || !height) return null;
        
        // height は cm で受け取る想定
        const heightM = height / 100;
        const bmi = weight / (heightM * heightM);
        return Math.round(bmi * 10) / 10;
    }
    
    // BMIカテゴリ判定
    static getBMICategory(bmi) {
        if (!bmi) return 'データなし';
        
        if (bmi < 18.5) return '低体重';
        if (bmi < 25) return '普通体重';
        if (bmi < 30) return '肥満(1度)';
        return '肥満(2度以上)';
    }
    
    // 睡眠効率の評価
    static getSleepEfficiencyCategory(efficiency) {
        if (!efficiency) return 'データなし';
        
        if (efficiency >= 90) return '非常に良い';
        if (efficiency >= 85) return '良い';
        if (efficiency >= 80) return 'まあまあ';
        return '改善が必要';
    }
    
    // 心拍数ゾーンの判定
    static getHeartRateZone(hr, zones) {
        if (!hr || !zones) return 'データなし';
        
        for (const zone of zones) {
            if (hr >= zone.min && hr <= zone.max) {
                return zone.name;
            }
        }
        return 'Out of Range';
    }
    
    // エラーメッセージの日本語化
    static getErrorMessage(error) {
        const errorMessages = {
            401: '認証が無効です。再ログインしてください。',
            403: 'このデータにアクセスする権限がありません。',
            404: 'データが見つかりません。',
            429: 'API使用制限に達しました。しばらく待ってから再試行してください。',
            500: 'サーバーエラーが発生しました。',
            'NETWORK_ERROR': 'ネットワークエラーが発生しました。',
            'TIMEOUT': 'リクエストがタイムアウトしました。',
            'INVALID_DATA': '無効なデータが返されました。'
        };
        
        const status = error.response?.status;
        return errorMessages[status] || errorMessages[error.code] || 'エラーが発生しました。';
    }
    
    // データの妥当性チェック
    static validateActivityData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // 必須フィールドのチェック
        const requiredFields = ['dateTime', 'value'];
        return requiredFields.every(field => data.hasOwnProperty(field));
    }
    
    // セッションデータの暗号化
    static encryptSessionData(data, secret) {
        try {
            // 安全な暗号化方式を使用
            const algorithm = 'aes-256-gcm';
            const iv = crypto.randomBytes(16);
            const key = crypto.scryptSync(secret, 'salt', 32);
            
            const cipher = crypto.createCipher(algorithm, key);
            cipher.setAAD(Buffer.from('fitbit-session', 'utf8'));
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                iv: iv.toString('hex'),
                encrypted: encrypted,
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('Session encryption error:', error);
            return null;
        }
    }
    
    // セッションデータの復号化
    static decryptSessionData(encryptedData, secret) {
        try {
            if (!encryptedData || typeof encryptedData !== 'object') {
                return null;
            }
            
            const algorithm = 'aes-256-gcm';
            const key = crypto.scryptSync(secret, 'salt', 32);
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');
            
            const decipher = crypto.createDecipher(algorithm, key);
            decipher.setAAD(Buffer.from('fitbit-session', 'utf8'));
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Session decryption error:', error);
            return null;
        }
    }
    
    // API レスポンスの正規化
    static normalizeApiResponse(response, dataType) {
        try {
            switch (dataType) {
                case 'activity':
                    return {
                        date: response.dateTime,
                        value: parseInt(response.value) || 0
                    };
                    
                case 'heartrate':
                    return {
                        date: response.dateTime,
                        restingHeartRate: response.value?.restingHeartRate,
                        zones: response.value?.heartRateZones || []
                    };
                    
                case 'sleep':
                    return {
                        date: response.dateOfSleep,
                        duration: response.duration,
                        minutesAsleep: response.minutesAsleep,
                        efficiency: response.efficiency
                    };
                    
                default:
                    return response;
            }
        } catch (error) {
            console.error('Response normalization error:', error);
            return null;
        }
    }
    
    // 目標達成率の計算
    static calculateGoalProgress(current, goal) {
        if (!goal || goal <= 0) return 0;
        const progress = (current / goal) * 100;
        return Math.min(Math.round(progress), 100);
    }
    
    // デバイスバッテリーレベルの評価
    static getBatteryStatus(level) {
        if (level >= 80) return { status: 'high', color: '#28a745' };
        if (level >= 30) return { status: 'medium', color: '#ffc107' };
        return { status: 'low', color: '#dc3545' };
    }
    
    // 統計計算ヘルパー
    static calculateStats(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return { avg: 0, min: 0, max: 0, total: 0 };
        }
        
        const values = data.map(item => item.value || 0);
        const total = values.reduce((sum, val) => sum + val, 0);
        const avg = total / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return {
            avg: Math.round(avg),
            min,
            max,
            total: Math.round(total)
        };
    }
}

module.exports = FitbitHelpers;