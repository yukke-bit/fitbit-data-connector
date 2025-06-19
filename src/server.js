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
    console.log('📊 ダッシュボードアクセス - デバッグバージョン 20250619-2');
    console.log('🔥 Vercelログテスト: この行が見えれば正常にログ出力されています');
    console.log('🔍 ダッシュボード セッション詳細確認:', {
        sessionID: req.sessionID,
        hasAccessToken: !!req.session.accessToken,
        accessTokenLength: req.session.accessToken ? req.session.accessToken.length : 0,
        accessTokenPreview: req.session.accessToken ? req.session.accessToken.substring(0, 20) + '...' : 'なし',
        userId: req.session.userId,
        tokenExpiry: req.session.tokenExpiry,
        sessionKeys: Object.keys(req.session),
        hasTokenParam: !!req.query.token,
        sessionData: JSON.stringify(req.session)
    });
    
    // URLパラメータからトークンをチェック（Vercel対応）
    if (req.query.token) {
        try {
            const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
            console.log('🔄 URLパラメータからトークン復元');
            
            // セッションに保存を再試行
            req.session.accessToken = tokenData.accessToken;
            req.session.refreshToken = tokenData.refreshToken;
            req.session.userId = tokenData.userId;
            req.session.tokenExpiry = new Date(tokenData.expires);
            
            console.log('✅ トークン復元完了 - LocalStorageに保存してダッシュボード表示');
            
            // LocalStorageにトークンを保存するスクリプトを含むHTMLを返す
            return res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Fitbit データ連携 - ダッシュボード</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <div style="text-align: center; padding: 50px;">
        <h2>🔄 認証完了 - ダッシュボードに移動中...</h2>
        <p>お待ちください...</p>
    </div>
    <script>
        // トークンをLocalStorageに保存
        localStorage.setItem('fitbit_token', '${req.query.token}');
        console.log('✅ トークンをLocalStorageに保存しました');
        
        // ダッシュボードページにリダイレクト
        setTimeout(() => {
            window.location.replace('/dashboard.html');
        }, 1000);
    </script>
</body>
</html>
            `);
        } catch (error) {
            console.error('❌ トークン復元エラー:', error);
        }
    }
    
    // セッションベースの認証チェック（後方互換性のため）
    if (!req.session.accessToken) {
        console.log('❌ アクセストークンなし - ホームにリダイレクト');
        return res.redirect('/');
    }
    
    console.log('✅ 認証済み - ダッシュボード表示');
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// テストページ
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/test.html'));
});

// ヘルスチェック
app.get('/health', (req, res) => {
    console.log('🏥 ヘルスチェック実行 - サーバーサイドログテスト');
    console.log('🔍 Node環境:', process.env.NODE_ENV);
    console.log('🔍 Vercel環境:', process.env.VERCEL_ENV);
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: require('../package.json').version,
        environment: process.env.NODE_ENV || 'development',
        vercel_env: process.env.VERCEL_ENV,
        message: 'サーバーサイド処理が正常に動作しています'
    });
});

// 環境変数確認用エンドポイント
app.get('/debug/env', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'undefined',
            hasClientId: !!process.env.FITBIT_CLIENT_ID,
            hasClientSecret: !!process.env.FITBIT_CLIENT_SECRET,
            hasRedirectUrl: !!process.env.FITBIT_REDIRECT_URL,
            clientIdValue: process.env.FITBIT_CLIENT_ID || 'undefined',
            redirectUrlValue: process.env.FITBIT_REDIRECT_URL || 'undefined'
        },
        vercel: {
            url: process.env.VERCEL_URL || 'undefined',
            env: process.env.VERCEL_ENV || 'undefined'
        }
    });
});

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
    console.log(`🏃‍♂️ Fitbit データ連携プロトタイプが起動しました`);
    console.log(`🌐 サーバー: http://localhost:${PORT}`);
    console.log(`📊 ダッシュボード: http://localhost:${PORT}/dashboard`);
    console.log(`🔧 テストページ: http://localhost:${PORT}/test`);
    console.log(`🔧 環境: ${process.env.NODE_ENV || 'development'}`);
    
    // 環境変数デバッグ
    console.log('📋 環境変数確認:');
    console.log(`   FITBIT_CLIENT_ID: ${process.env.FITBIT_CLIENT_ID ? '設定済み' : '未設定'}`);
    console.log(`   FITBIT_CLIENT_SECRET: ${process.env.FITBIT_CLIENT_SECRET ? '設定済み' : '未設定'}`);
    console.log(`   FITBIT_REDIRECT_URL: ${process.env.FITBIT_REDIRECT_URL || '未設定'}`);
    
    // ファイル存在確認
    console.log('📁 ファイル確認:');
    const fs = require('fs');
    const publicPath = path.join(__dirname, '../public');
    console.log(`   public ディレクトリ: ${fs.existsSync(publicPath) ? '存在' : '不存在'}`);
    console.log(`   index.html: ${fs.existsSync(path.join(publicPath, 'index.html')) ? '存在' : '不存在'}`);
    console.log(`   dashboard.html: ${fs.existsSync(path.join(publicPath, 'dashboard.html')) ? '存在' : '不存在'}`);
    console.log(`   test.html: ${fs.existsSync(path.join(publicPath, 'test.html')) ? '存在' : '不存在'}`);
});