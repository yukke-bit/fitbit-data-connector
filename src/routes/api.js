const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const FitbitClient = require('../services/fitbitClient');

// 全てのAPIルートで認証を必須とする
router.use(requireAuth);

// ユーザープロフィール取得
router.get('/profile', async (req, res) => {
    try {
        const fitbitClient = new FitbitClient(req.session.accessToken);
        const profile = await fitbitClient.getUserProfile();
        
        res.json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('❌ プロフィール取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch profile',
            message: error.message
        });
    }
});

// 今日の活動データ取得
router.get('/activity/today', async (req, res) => {
    try {
        const fitbitClient = new FitbitClient(req.session.accessToken);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        const [steps, calories, distance, activeMinutes] = await Promise.all([
            fitbitClient.getActivityData('steps', today),
            fitbitClient.getActivityData('calories', today),
            fitbitClient.getActivityData('distance', today),
            fitbitClient.getActivityData('minutesVeryActive', today)
        ]);
        
        res.json({
            success: true,
            data: {
                date: today,
                steps: steps,
                calories: calories,
                distance: distance,
                activeMinutes: activeMinutes
            }
        });
    } catch (error) {
        console.error('❌ 今日の活動データ取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch today activity data',
            message: error.message
        });
    }
});

// 歩数データ取得（期間指定）
router.get('/activity/steps', async (req, res) => {
    try {
        const { period = 'today' } = req.query; // today, 7d, 30d, 3m, 6m, 1y
        const fitbitClient = new FitbitClient(req.session.accessToken);
        
        const stepsData = await fitbitClient.getActivityTimeSeries('steps', period);
        
        res.json({
            success: true,
            data: stepsData
        });
    } catch (error) {
        console.error('❌ 歩数データ取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch steps data',
            message: error.message
        });
    }
});

// 心拍数データ取得
router.get('/heartrate', async (req, res) => {
    try {
        const { date = 'today' } = req.query;
        const fitbitClient = new FitbitClient(req.session.accessToken);
        
        const heartRateData = await fitbitClient.getHeartRateData(date);
        
        res.json({
            success: true,
            data: heartRateData
        });
    } catch (error) {
        console.error('❌ 心拍数データ取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch heart rate data',
            message: error.message
        });
    }
});

// 睡眠データ取得
router.get('/sleep', async (req, res) => {
    try {
        const { date = 'today' } = req.query;
        const fitbitClient = new FitbitClient(req.session.accessToken);
        
        const sleepData = await fitbitClient.getSleepData(date);
        
        res.json({
            success: true,
            data: sleepData
        });
    } catch (error) {
        console.error('❌ 睡眠データ取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch sleep data',
            message: error.message
        });
    }
});

// 週間サマリー取得
router.get('/summary/weekly', async (req, res) => {
    try {
        const fitbitClient = new FitbitClient(req.session.accessToken);
        
        const [stepsWeek, caloriesWeek, sleepWeek] = await Promise.all([
            fitbitClient.getActivityTimeSeries('steps', '7d'),
            fitbitClient.getActivityTimeSeries('calories', '7d'),
            fitbitClient.getSleepTimeSeries('7d')
        ]);
        
        // 週間平均計算
        const weeklyAverage = {
            steps: stepsWeek.reduce((sum, day) => sum + (day.value || 0), 0) / 7,
            calories: caloriesWeek.reduce((sum, day) => sum + (day.value || 0), 0) / 7,
            sleepHours: sleepWeek.reduce((sum, day) => sum + (day.minutesAsleep || 0), 0) / (7 * 60)
        };
        
        res.json({
            success: true,
            data: {
                period: '7days',
                averages: weeklyAverage,
                details: {
                    steps: stepsWeek,
                    calories: caloriesWeek,
                    sleep: sleepWeek
                }
            }
        });
    } catch (error) {
        console.error('❌ 週間サマリー取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch weekly summary',
            message: error.message
        });
    }
});

// デバイス情報取得
router.get('/devices', async (req, res) => {
    try {
        const fitbitClient = new FitbitClient(req.session.accessToken);
        const devices = await fitbitClient.getDevices();
        
        res.json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('❌ デバイス情報取得エラー:', error.message);
        res.status(500).json({
            error: 'Failed to fetch devices',
            message: error.message
        });
    }
});

// APIステータス確認
router.get('/status', (req, res) => {
    res.json({
        success: true,
        message: 'Fitbit API connection is working',
        timestamp: new Date().toISOString(),
        userId: req.session.userId
    });
});

module.exports = router;