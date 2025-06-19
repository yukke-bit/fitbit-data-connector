const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware設定
const corsOrigins = process.env.NODE_ENV === 'production' 
    ? [
        `https://${process.env.VERCEL_URL}`,
        /\.vercel\.app$/
      ]
    : ['http://localhost:3000'];

app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// セッション設定（Vercel対応）
app.use(session({
    secret: process.env.SESSION_SECRET || 'fitbit-prototype-secret',
    resave: true, // Vercelでは必要
    saveUninitialized: true, // Vercelでは必要
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24時間
        sameSite: 'lax' // CSRF保護
    },
    // Vercel用の設定
    name: 'fitbit.sid'
}));

// リクエストログ追加
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
});

// 静的ファイル配信
app.use(express.static(path.join(__dirname, '../public')));

// ルート設定
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// メインページ
app.get('/', (req, res) => {
    if (req.session.accessToken) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ダッシュボードページ
app.get('/dashboard', (req, res) => {
    console.log('📊 ダッシュボードアクセス');
    
    // OAuth認証後のトークンパラメータをチェック
    if (req.query.token) {
        return handleOAuthCallback(req, res);
    }
    
    // 既存のセッション認証をチェック（後方互換性）
    if (!req.session.accessToken) {
        console.log('❌ 認証が必要です');
        return res.redirect('/');
    }
    
    console.log('✅ 認証済み - ダッシュボード表示');
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// OAuth認証後のトークン処理
function handleOAuthCallback(req, res) {
    try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log('🔄 OAuth認証トークンを処理中');
        
        // セッションにも保存（後方互換性のため）
        req.session.accessToken = tokenData.accessToken;
        req.session.refreshToken = tokenData.refreshToken;
        req.session.userId = tokenData.userId;
        req.session.tokenExpiry = new Date(tokenData.expires);
        
        console.log('✅ トークンをLocalStorageに保存してダッシュボードにリダイレクト');
        
        // トークンをLocalStorageに保存するスクリプトを返す
        return res.send(generateTokenSaveHTML(req.query.token));
        
    } catch (error) {
        console.error('❌ OAuth認証トークン処理エラー:', error);
        return res.redirect('/?error=invalid_token');
    }
}

// LocalStorageにトークンを保存するHTMLを生成
function generateTokenSaveHTML(token) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Fitbit データ連携 - 認証完了</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>🎉 認証完了</h2>
        <div class="spinner"></div>
        <p>ダッシュボードに移動中...</p>
    </div>
    <script>
        try {
            localStorage.setItem('fitbit_token', '${token}');
            console.log('✅ 認証トークンをLocalStorageに保存しました');
            
            setTimeout(() => {
                window.location.replace('/dashboard.html');
            }, 1500);
        } catch (error) {
            console.error('❌ トークン保存エラー:', error);
            window.location.href = '/?error=token_save_failed';
        }
    </script>
</body>
</html>`;
}

// テストページ
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/test.html'));
});

// ヘルスチェック
app.get('/health', (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: require('../package.json').version,
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
    };
    
    if (process.env.NODE_ENV === 'development') {
        healthData.debug = {
            vercel_env: process.env.VERCEL_ENV,
            hasClientId: !!process.env.FITBIT_CLIENT_ID,
            hasClientSecret: !!process.env.FITBIT_CLIENT_SECRET
        };
    }
    
    res.json(healthData);
});

// 開発環境のみ: 環境変数確認用エンドポイント
if (process.env.NODE_ENV === 'development') {
    app.get('/debug/env', (req, res) => {
        res.json({
            timestamp: new Date().toISOString(),
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                hasClientId: !!process.env.FITBIT_CLIENT_ID,
                hasClientSecret: !!process.env.FITBIT_CLIENT_SECRET,
                hasRedirectUrl: !!process.env.FITBIT_REDIRECT_URL,
                clientIdValue: process.env.FITBIT_CLIENT_ID,
                redirectUrlValue: process.env.FITBIT_REDIRECT_URL
            },
            vercel: {
                url: process.env.VERCEL_URL,
                env: process.env.VERCEL_ENV
            }
        });
    });
}

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404ハンドリング
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Fitbit データ連携アプリが起動しました`);
    console.log(`🌐 サーバー: http://localhost:${PORT}`);
    console.log(`📊 ダッシュボード: http://localhost:${PORT}/dashboard`);
    console.log(`🏥 ヘルスチェック: http://localhost:${PORT}/health`);
    console.log(`🔧 環境: ${process.env.NODE_ENV || 'development'}`);
    
    // 環境変数の基本チェック
    const envStatus = {
        clientId: !!process.env.FITBIT_CLIENT_ID,
        clientSecret: !!process.env.FITBIT_CLIENT_SECRET,
        redirectUrl: !!process.env.FITBIT_REDIRECT_URL
    };
    
    console.log('📋 設定状況:', 
        Object.entries(envStatus).every(([, v]) => v) ? '✅ すべて設定済み' : '⚠️ 一部未設定'
    );
    
    // 開発環境でのみ詳細表示
    if (process.env.NODE_ENV === 'development') {
        console.log('🔧 開発モード - /debug/env で詳細確認可能');
    }
});