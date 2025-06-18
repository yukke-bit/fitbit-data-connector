const express = require('express');
const axios = require('axios');
const router = express.Router();

const FITBIT_BASE_URL = 'https://api.fitbit.com';
const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

// OAuth認証設定＆URL取得（動的設定用）
router.post('/api/auth/setup', (req, res) => {
    const { clientId, clientSecret, redirectUri } = req.body;
    
    // バリデーション
    if (!clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            message: 'Client ID, Client Secret, Redirect URIをすべて入力してください'
        });
    }
    
    // セッションに一時保存
    req.session.tempFitbitConfig = {
        clientId,
        clientSecret,
        redirectUri
    };
    
    const scope = 'activity heartrate sleep profile weight nutrition';
    const authUrl = `${FITBIT_AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope,
        expires_in: '31536000' // 1年
    });
    
    console.log('🔐 動的Fitbit認証URL生成:', authUrl);
    
    res.json({
        success: true,
        authUrl: authUrl,
        message: 'Fitbit認証URLを生成しました'
    });
});

// OAuth認証URL取得（従来の環境変数方式）
router.get('/fitbit', (req, res) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    const scope = 'activity heartrate sleep profile weight nutrition';
    
    if (!clientId || !redirectUri) {
        return res.status(500).json({
            success: false,
            error: 'Missing Fitbit configuration',
            message: 'Please set FITBIT_CLIENT_ID and FITBIT_REDIRECT_URI in environment variables'
        });
    }
    
    const authUrl = `${FITBIT_AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope,
        expires_in: '31536000' // 1年
    });
    
    console.log('🔐 Fitbit認証URL生成:', authUrl);
    
    res.json({
        success: true,
        authUrl: authUrl,
        message: 'Fitbit認証URLを生成しました'
    });
});

// OAuth認証開始（従来のリダイレクト方式も維持）
router.get('/login', (req, res) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    const scope = 'activity heartrate sleep profile weight nutrition';
    
    if (!clientId || !redirectUri) {
        return res.redirect('/login?error=config_missing');
    }
    
    const authUrl = `${FITBIT_AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope,
        expires_in: '31536000' // 1年
    });
    
    console.log('🔐 Fitbit認証URL生成:', authUrl);
    res.redirect(authUrl);
});

// OAuth コールバック処理
router.get('/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    
    if (error) {
        console.error('❌ Fitbit認証エラー:', error, error_description);
        const errorParams = new URLSearchParams({
            error: error,
            error_description: error_description || ''
        });
        return res.redirect(`/login?${errorParams}`);
    }
    
    if (!code) {
        console.error('❌ 認証コードが見つかりません');
        return res.redirect('/login?error=no_code&error_description=認証コードが見つかりません');
    }
    
    try {
        // 動的設定または環境変数から認証情報を取得
        let clientId, clientSecret, redirectUri;
        
        if (req.session.tempFitbitConfig) {
            // 動的設定を使用
            ({ clientId, clientSecret, redirectUri } = req.session.tempFitbitConfig);
            console.log('🔄 動的設定を使用してトークン取得');
        } else {
            // 環境変数を使用（従来方式）
            clientId = process.env.FITBIT_CLIENT_ID;
            clientSecret = process.env.FITBIT_CLIENT_SECRET;
            redirectUri = process.env.FITBIT_REDIRECT_URI;
            console.log('🔄 環境変数を使用してトークン取得');
            
            if (!clientId || !clientSecret || !redirectUri) {
                console.error('❌ 認証設定が見つかりません');
                return res.redirect('/setup?error=no_config&error_description=認証設定が見つかりません');
            }
        }
        
        // アクセストークンを取得
        const tokenResponse = await axios.post(FITBIT_TOKEN_URL, new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code
        }), {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const { access_token, refresh_token, user_id, expires_in } = tokenResponse.data;
        
        // セッションにトークン情報を保存
        req.session.accessToken = access_token;
        req.session.refreshToken = refresh_token;
        req.session.userId = user_id;
        req.session.tokenExpiry = new Date(Date.now() + expires_in * 1000);
        
        // 動的設定の場合は永続化（セッション管理）
        if (req.session.tempFitbitConfig) {
            req.session.fitbitConfig = req.session.tempFitbitConfig;
            delete req.session.tempFitbitConfig; // 一時設定を削除
            console.log('✅ 動的Fitbit認証成功 - ユーザーID:', user_id);
        } else {
            console.log('✅ 環境変数Fitbit認証成功 - ユーザーID:', user_id);
        }
        
        // ダッシュボードにリダイレクト
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('❌ トークン取得エラー:', error.response?.data || error.message);
        const errorMessage = error.response?.data?.errors?.[0]?.message || 'トークンの取得に失敗しました';
        res.redirect(`/setup?error=token_failed&error_description=${encodeURIComponent(errorMessage)}`);
    }
});

// ログアウト
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ セッション削除エラー:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        
        console.log('👋 ユーザーがログアウトしました');
        res.json({ message: 'Logged out successfully' });
    });
});

// 認証状態確認
router.get('/status', (req, res) => {
    const isAuthenticated = !!(req.session.accessToken && req.session.userId);
    
    res.json({
        authenticated: isAuthenticated,
        userId: req.session.userId || null,
        tokenExpiry: req.session.tokenExpiry || null
    });
});

// 認証状態確認（API用）
router.get('/api/auth/status', (req, res) => {
    const isAuthenticated = !!(req.session.accessToken && req.session.userId);
    
    res.json({
        authenticated: isAuthenticated,
        userId: req.session.userId || null,
        tokenExpiry: req.session.tokenExpiry || null
    });
});

// トークンリフレッシュ（内部使用）
async function refreshAccessToken(session) {
    if (!session.refreshToken) {
        throw new Error('No refresh token available');
    }
    
    // 動的設定または環境変数から認証情報を取得
    let clientId, clientSecret;
    
    if (session.fitbitConfig) {
        // 動的設定を使用
        ({ clientId, clientSecret } = session.fitbitConfig);
    } else {
        // 環境変数を使用（従来方式）
        clientId = process.env.FITBIT_CLIENT_ID;
        clientSecret = process.env.FITBIT_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            throw new Error('Fitbit client credentials not available');
        }
    }
    
    try {
        const response = await axios.post(FITBIT_TOKEN_URL, new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken
        }), {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const { access_token, refresh_token, expires_in } = response.data;
        
        // セッション更新
        session.accessToken = access_token;
        if (refresh_token) session.refreshToken = refresh_token;
        session.tokenExpiry = new Date(Date.now() + expires_in * 1000);
        
        console.log('🔄 アクセストークンを更新しました');
        return access_token;
        
    } catch (error) {
        console.error('❌ トークンリフレッシュエラー:', error.response?.data || error.message);
        throw error;
    }
}

// 認証ミドルウェア
function requireAuth(req, res, next) {
    if (!req.session.accessToken) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please authenticate with Fitbit first'
        });
    }
    
    // トークンの有効期限チェック
    if (req.session.tokenExpiry && new Date() > req.session.tokenExpiry) {
        console.log('⚠️ アクセストークンが期限切れです。リフレッシュを試行...');
        
        return refreshAccessToken(req.session)
            .then(() => next())
            .catch(() => {
                req.session.destroy();
                res.status(401).json({
                    error: 'Token expired',
                    message: 'Please re-authenticate with Fitbit'
                });
            });
    }
    
    next();
}

module.exports = router;
module.exports.requireAuth = requireAuth;