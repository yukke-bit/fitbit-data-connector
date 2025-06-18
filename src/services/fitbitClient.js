const axios = require('axios');

class FitbitClient {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseURL = 'https://api.fitbit.com/1/user/-';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
    }

    // ユーザープロフィール取得
    async getUserProfile() {
        try {
            const response = await this.client.get('/profile.json');
            const user = response.data.user;
            
            return {
                displayName: user.displayName,
                fullName: user.fullName,
                gender: user.gender,
                age: user.age,
                height: user.height,
                weight: user.weight,
                timezone: user.timezone,
                memberSince: user.memberSince,
                avatar: user.avatar
            };
        } catch (error) {
            this.handleError('getUserProfile', error);
        }
    }

    // 活動データ取得（単日）
    async getActivityData(activityType, date = 'today') {
        try {
            const response = await this.client.get(`/activities/${activityType}/date/${date}.json`);
            
            // レスポンス構造は activityType によって異なる
            const data = response.data[`activities-${activityType}`];
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            this.handleError('getActivityData', error);
        }
    }

    // 活動データ時系列取得
    async getActivityTimeSeries(activityType, period) {
        try {
            const response = await this.client.get(`/activities/${activityType}/date/today/${period}.json`);
            return response.data[`activities-${activityType}`] || [];
        } catch (error) {
            this.handleError('getActivityTimeSeries', error);
        }
    }

    // 心拍数データ取得
    async getHeartRateData(date = 'today') {
        try {
            const response = await this.client.get(`/activities/heart/date/${date}.json`);
            const heartData = response.data['activities-heart'];
            
            if (heartData && heartData.length > 0) {
                const dayData = heartData[0];
                return {
                    date: dayData.dateTime,
                    restingHeartRate: dayData.value.restingHeartRate,
                    heartRateZones: dayData.value.heartRateZones,
                    customHeartRateZones: dayData.value.customHeartRateZones
                };
            }
            
            return null;
        } catch (error) {
            this.handleError('getHeartRateData', error);
        }
    }

    // 睡眠データ取得
    async getSleepData(date = 'today') {
        try {
            const response = await this.client.get(`/sleep/date/${date}.json`);
            const sleepData = response.data.sleep;
            
            if (sleepData && sleepData.length > 0) {
                const sleep = sleepData[0]; // 最新の睡眠データ
                
                return {
                    date: sleep.dateOfSleep,
                    startTime: sleep.startTime,
                    endTime: sleep.endTime,
                    duration: sleep.duration,
                    minutesAsleep: sleep.minutesAsleep,
                    minutesAwake: sleep.minutesAwake,
                    minutesToFallAsleep: sleep.minutesToFallAsleep,
                    timeInBed: sleep.timeInBed,
                    efficiency: sleep.efficiency,
                    levels: sleep.levels
                };
            }
            
            return null;
        } catch (error) {
            this.handleError('getSleepData', error);
        }
    }

    // 睡眠データ時系列取得
    async getSleepTimeSeries(period) {
        try {
            // Fitbit APIは睡眠の時系列APIがないため、個別に取得
            const days = this.getDaysArray(period);
            const sleepPromises = days.map(date => this.getSleepData(date));
            const sleepData = await Promise.all(sleepPromises);
            
            return sleepData.filter(data => data !== null);
        } catch (error) {
            this.handleError('getSleepTimeSeries', error);
        }
    }

    // デバイス情報取得
    async getDevices() {
        try {
            const response = await this.client.get('/devices.json');
            return response.data.map(device => ({
                id: device.id,
                deviceVersion: device.deviceVersion,
                type: device.type,
                batteryLevel: device.batteryLevel,
                lastSyncTime: device.lastSyncTime
            }));
        } catch (error) {
            this.handleError('getDevices', error);
        }
    }

    // 友達情報取得
    async getFriends() {
        try {
            const response = await this.client.get('/friends.json');
            return response.data.friends || [];
        } catch (error) {
            this.handleError('getFriends', error);
        }
    }

    // 水分摂取データ取得
    async getWaterData(date = 'today') {
        try {
            const response = await this.client.get(`/foods/log/water/date/${date}.json`);
            return response.data.water || [];
        } catch (error) {
            this.handleError('getWaterData', error);
        }
    }

    // 体重データ取得
    async getWeightData(period = '1m') {
        try {
            const response = await this.client.get(`/body/log/weight/date/today/${period}.json`);
            return response.data['body-weight'] || [];
        } catch (error) {
            this.handleError('getWeightData', error);
        }
    }

    // ユーティリティ: 期間から日付配列を生成
    getDaysArray(period) {
        const days = [];
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
            days.push(date.toISOString().split('T')[0]);
        }
        
        return days;
    }

    // エラーハンドリング
    handleError(method, error) {
        const errorInfo = {
            method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        };
        
        console.error(`❌ FitbitClient.${method} エラー:`, errorInfo);
        
        // Fitbit APIの特定エラーに対する処理
        if (error.response?.status === 401) {
            throw new Error('Fitbit access token expired or invalid');
        } else if (error.response?.status === 429) {
            throw new Error('Fitbit API rate limit exceeded');
        } else if (error.response?.status === 403) {
            throw new Error('Insufficient permissions for this Fitbit data');
        }
        
        throw new Error(`Fitbit API error: ${error.message}`);
    }
}

module.exports = FitbitClient;