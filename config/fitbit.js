// Fitbit API設定
module.exports = {
    // OAuth設定（環境変数から取得）
    CLIENT_ID: process.env.FITBIT_CLIENT_ID,
    CLIENT_SECRET: process.env.FITBIT_CLIENT_SECRET,
    REDIRECT_URL: process.env.FITBIT_REDIRECT_URL,
    
    // API URLs
    AUTH_URL: 'https://www.fitbit.com/oauth2/authorize',
    TOKEN_URL: 'https://api.fitbit.com/oauth2/token',
    API_BASE_URL: 'https://api.fitbit.com/1/user/-',
    
    // OAuth設定
    RESPONSE_TYPE: 'code',
    SCOPE: [
        'activity',      // 活動データ
        'heartrate',     // 心拍数データ
        'sleep',         // 睡眠データ
        'profile',       // プロフィール情報
        'weight',        // 体重データ
        'nutrition'      // 栄養データ
    ].join(' '),
    
    // トークン有効期限（秒）
    TOKEN_EXPIRES_IN: 31536000, // 1年
    
    // APIレート制限
    RATE_LIMITS: {
        HOURLY: 150,     // 1時間あたりのリクエスト数
        DAILY: 1000      // 1日あたりのリクエスト数
    },
    
    // データ取得期間オプション
    TIME_PERIODS: {
        TODAY: 'today',
        WEEK: '7d',
        MONTH: '30d',
        QUARTER: '3m',
        HALF_YEAR: '6m',
        YEAR: '1y'
    },
    
    // 活動データタイプ
    ACTIVITY_TYPES: {
        STEPS: 'steps',
        CALORIES: 'calories',
        DISTANCE: 'distance',
        FLOORS: 'floors',
        ELEVATION: 'elevation',
        MINUTES_SEDENTARY: 'minutesSedentary',
        MINUTES_LIGHTLY_ACTIVE: 'minutesLightlyActive',
        MINUTES_FAIRLY_ACTIVE: 'minutesFairlyActive',
        MINUTES_VERY_ACTIVE: 'minutesVeryActive'
    },
    
    // エラーコード
    ERROR_CODES: {
        INVALID_TOKEN: 401,
        RATE_LIMIT: 429,
        INSUFFICIENT_SCOPE: 403,
        NOT_FOUND: 404,
        SERVER_ERROR: 500
    },
    
    // デバイスタイプ
    DEVICE_TYPES: {
        TRACKER: 'TRACKER',
        SCALE: 'SCALE',
        PHONE: 'PHONE'
    },
    
    // 心拍数ゾーン色
    HR_ZONE_COLORS: {
        'Out of Range': '#95a5a6',
        'Fat Burn': '#f39c12',
        'Cardio': '#e74c3c',
        'Peak': '#c0392b'
    }
};