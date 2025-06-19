const express = require('express');
const axios = require('axios');
const router = express.Router();

const FITBIT_BASE_URL = 'https://api.fitbit.com';
const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

// OAuth認証開始（環境変数方式）
router.get('/login', (req, res) => {
    try {
        console.log('🔍 認証開始リクエスト受信');
        
        const clientId = process.env.FITBIT_CLIENT_ID;
        const redirectUri = process.env.FITBIT_REDIRECT_URL;
        const scope = 'profile activity sleep'; // 問題のあるスコープを段階的に除外
        
        console.log('📋 全環境変数確認:');
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || '未設定'}`);
        console.log(`   FITBIT_CLIENT_ID: ${clientId ? '設定済み (' + clientId + ')' : '❌未設定'}`);
        console.log(`   FITBIT_CLIENT_SECRET: ${process.env.FITBIT_CLIENT_SECRET ? '設定済み' : '❌未設定'}`);
        console.log(`   FITBIT_REDIRECT_URL: ${redirectUri || '❌未設定'}`);
        
        if (!clientId || !redirectUri) {
            console.log('❌ 必須環境変数が不足しています');
            console.log('🔄 エラーページにリダイレクト');
            
            // JSONレスポンスではなく、HTMLエラーページにリダイレクト
            return res.redirect('/?error=config_missing&error_description=Fitbit環境変数が設定されていません');
        }
        
        const authUrl = `${FITBIT_AUTH_URL}?` + new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scope
            // expires_inパラメータを削除（Fitbit OAuth仕様に含まれない）
        });
        
        console.log('✅ Fitbit認証URL生成成功:', authUrl);
        console.log('🚀 Fitbitにリダイレクト実行');
        res.redirect(authUrl);
        
    } catch (error) {
        console.error('💥 認証開始処理でエラー発生:', error);
        console.error('💥 エラースタック:', error.stack);
        
        // JSONレスポンスではなく、HTMLエラーページにリダイレクト
        return res.redirect(`/?error=server_error&error_description=${encodeURIComponent('認証処理中にエラーが発生しました: ' + error.message)}`);
    }
});

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
    console.log('🔐 認証ミドルウェア実行');
    
    let accessToken = null;
    let tokenSource = '';
    
    // 1. Authorization ヘッダーからBearerトークンをチェック（優先）
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7); // "Bearer " を除去
        tokenSource = 'Bearer Token';
        console.log('✅ Bearer トークンを検出:', accessToken.substring(0, 20) + '...');
    }
    // 2. セッションからトークンをチェック（後方互換性）
    else if (req.session.accessToken) {
        accessToken = req.session.accessToken;
        tokenSource = 'Session';
        console.log('✅ セッショントークンを検出:', accessToken.substring(0, 20) + '...');
    }
    
    console.log('📋 認証詳細:', {
        tokenSource: tokenSource,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken ? accessToken.length : 0,
        accessTokenPreview: accessToken ? accessToken.substring(0, 20) + '...' : 'なし',
        sessionID: req.sessionID,
        userId: req.session.userId,
        tokenExpiry: req.session.tokenExpiry,
        sessionKeys: Object.keys(req.session)
    });
    
    if (!accessToken) {
        console.log('❌ アクセストークンが見つかりません');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please authenticate with Fitbit first'
        });
    }
    
    // リクエストオブジェクトにトークンを保存（後続の処理で使用）
    req.accessToken = accessToken;
    req.tokenSource = tokenSource;
    
    // セッションベースの場合のみ有効期限チェック
    if (tokenSource === 'Session' && req.session.tokenExpiry && new Date() > req.session.tokenExpiry) {
        console.log('⚠️ アクセストークンが期限切れです。リフレッシュを試行...');
        
        return refreshAccessToken(req.session)
            .then(() => {
                req.accessToken = req.session.accessToken;
                next();
            })
            .catch(() => {
                req.session.destroy();
                res.status(401).json({
                    error: 'Token expired',
                    message: 'Please re-authenticate with Fitbit'
                });
            });
    }
    
    console.log('✅ 認証成功 - トークンソース:', tokenSource);
    next();
}

module.exports = router;
module.exports.requireAuth = requireAuth;