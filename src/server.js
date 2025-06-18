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

// セッション設定
app.use(session({
    secret: process.env.SESSION_SECRET || 'fitbit-prototype-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24時間
    }
}));

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
    if (!req.session.accessToken) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// テストページ
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/test.html'));
});

// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: require('../package.json').version
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

// リクエストログ追加
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
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