const express = require('express');
const axios = require('axios');
const router = express.Router();

const FITBIT_BASE_URL = 'https://api.fitbit.com';
const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

// OAuth認証開始
router.get('/login', (req, res) => {
    try {
        console.log('🔑 OAuth認証開始');
        
        const { clientId, redirectUri, isConfigValid } = validateFitbitConfig();
        
        if (!isConfigValid) {
            console.log('❌ Fitbit設定が不正です');
            return res.redirect('/?error=config_missing&error_description=Fitbit設定が不完全です');
        }
        
        const authUrl = buildFitbitAuthUrl(clientId, redirectUri);
        console.log('✅ 認証URLを生成してリダイレクト');
        
        res.redirect(authUrl);
        
    } catch (error) {
        console.error('❌ OAuth認証開始エラー:', error.message);
        return res.redirect(`/?error=server_error&error_description=${encodeURIComponent('認証処理中にエラーが発生しました')}`);
    }
});

// Fitbit設定を検証
function validateFitbitConfig() {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URL;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    
    const isConfigValid = !!(clientId && redirectUri && clientSecret);
    
    if (process.env.NODE_ENV === 'development') {
        console.log('📋 Fitbit設定確認:', {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            hasRedirectUri: !!redirectUri,
            redirectUri: redirectUri
        });
    }
    
    return { clientId, redirectUri, clientSecret, isConfigValid };
}

// Fitbit認証URLを構築
function buildFitbitAuthUrl(clientId, redirectUri) {
    const scope = 'profile activity heartrate sleep'; // 必要なスコープ
    
    return `${FITBIT_AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope
    });
}

// OAuth コールバック処理
router.get('/callback', async (req, res) => {
    console.log('🔄 OAuth コールバック処理開始');
    console.log('📥 クエリパラメータ:', req.query);
    
    const { code, error, error_description } = req.query;
    
    if (error) {
        console.error('❌ Fitbit認証エラー:', error, error_description);
        const errorParams = new URLSearchParams({
            error: error,
            error_description: error_description || ''
        });
        return res.redirect(`/?${errorParams}`);
    }
    
    if (!code) {
        console.error('❌ 認証コードが見つかりません');
        console.log('🔍 受信したクエリ:', JSON.stringify(req.query, null, 2));
        return res.redirect('/?error=no_code&error_description=認証コードが見つかりません');
    }
    
    console.log('✅ 認証コード受信:', code.substring(0, 20) + '...');
    
    try {
        // 環境変数から認証情報を取得
        const clientId = process.env.FITBIT_CLIENT_ID;
        const clientSecret = process.env.FITBIT_CLIENT_SECRET;
        const redirectUri = process.env.FITBIT_REDIRECT_URL;
        
        console.log('🔍 環境変数確認:', {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            hasRedirectUri: !!redirectUri,
            redirectUri: redirectUri
        });
        
        if (!clientId || !clientSecret || !redirectUri) {
            console.error('❌ 認証設定が見つかりません');
            return res.redirect('/?error=no_config&error_description=認証設定が見つかりません');
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
        
        console.log('✅ Fitbit認証成功 - ユーザーID:', user_id);
        console.log('💾 セッション保存:', {
            sessionID: req.sessionID,
            hasAccessToken: !!req.session.accessToken,
            userId: req.session.userId
        });
        
        // Vercelでセッションが機能しない場合の代替策
        // トークンをURLパラメータとして一時的に渡す（開発用）
        const tempToken = Buffer.from(JSON.stringify({
            accessToken: access_token,
            refreshToken: refresh_token,
            userId: user_id,
            expires: Date.now() + expires_in * 1000
        })).toString('base64');
        
        console.log('🔄 トークンをURLパラメータで渡してダッシュボードにリダイレクト');
        res.redirect(`/dashboard?token=${tempToken}`);
        
    } catch (error) {
        console.error('❌ トークン取得エラー:', error.response?.data || error.message);
        const errorMessage = error.response?.data?.errors?.[0]?.message || 'トークンの取得に失敗しました';
        res.redirect(`/?error=token_failed&error_description=${encodeURIComponent(errorMessage)}`);
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


// トークンリフレッシュ（内部使用）
async function refreshAccessToken(session) {
    if (!session.refreshToken) {
        throw new Error('No refresh token available');
    }
    
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        throw new Error('Fitbit client credentials not available');
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
    const { accessToken, tokenSource } = extractAuthToken(req);
    
    if (!accessToken) {
        console.log('❌ 認証トークンが見つかりません');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please authenticate with Fitbit first'
        });
    }
    
    // リクエストオブジェクトにトークン情報を保存
    req.accessToken = accessToken;
    req.tokenSource = tokenSource;
    
    // セッションベースの場合のみ有効期限チェック
    if (shouldRefreshToken(req, tokenSource)) {
        return handleTokenRefresh(req, res, next);
    }
    
    console.log(`✅ 認証成功 (${tokenSource})`);
    next();
}

// 認証トークンを抽出
function extractAuthToken(req) {
    // 1. Authorization ヘッダーからBearerトークンをチェック（優先）
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log('🔐 Bearer Token認証');
        return { accessToken: token, tokenSource: 'Bearer Token' };
    }
    
    // 2. セッションからトークンをチェック（後方互換性）
    if (req.session.accessToken) {
        console.log('🔐 Session認証');
        return { accessToken: req.session.accessToken, tokenSource: 'Session' };
    }
    
    return { accessToken: null, tokenSource: null };
}

// トークンリフレッシュが必要かチェック
function shouldRefreshToken(req, tokenSource) {
    return tokenSource === 'Session' && 
           req.session.tokenExpiry && 
           new Date() > req.session.tokenExpiry;
}

// トークンリフレッシュ処理
function handleTokenRefresh(req, res, next) {
    console.log('⚠️ トークン期限切れ - リフレッシュを試行');
    
    return refreshAccessToken(req.session)
        .then(() => {
            req.accessToken = req.session.accessToken;
            console.log('✅ トークンリフレッシュ成功');
            next();
        })
        .catch((error) => {
            console.error('❌ トークンリフレッシュ失敗:', error.message);
            req.session.destroy();
            res.status(401).json({
                error: 'Token expired',
                message: 'Please re-authenticate with Fitbit'
            });
        });
}

module.exports = router;
module.exports.requireAuth = requireAuth;