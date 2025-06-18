// メインページ用 JavaScript
class FitbitAuthApp {
    constructor() {
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkAuthStatus();
    }

    bindEvents() {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', this.handleLogin.bind(this));
        }
    }

    async checkAuthStatus() {
        const loadingEl = document.getElementById('loading');
        const authButtonsEl = document.getElementById('auth-buttons');
        const authSuccessEl = document.getElementById('auth-success');

        try {
            const response = await fetch('/auth/status');
            const data = await response.json();

            loadingEl.style.display = 'none';

            if (data.authenticated) {
                // 既に認証済みの場合
                authSuccessEl.style.display = 'block';
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                // 未認証の場合
                authButtonsEl.style.display = 'block';
            }
        } catch (error) {
            console.error('認証状態確認エラー:', error);
            loadingEl.style.display = 'none';
            authButtonsEl.style.display = 'block';
        }
    }

    handleLogin() {
        // ログインボタンを無効化
        const loginBtn = document.getElementById('login-btn');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 認証中...';

        // Fitbit認証ページにリダイレクト
        window.location.href = '/auth/login';
    }

    // URLパラメータからエラーをチェック
    checkUrlErrors() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');

        if (error) {
            let errorMessage = '';
            switch (error) {
                case 'auth_failed':
                    errorMessage = 'Fitbit認証に失敗しました。もう一度お試しください。';
                    break;
                case 'no_code':
                    errorMessage = '認証コードが取得できませんでした。';
                    break;
                case 'token_failed':
                    errorMessage = 'アクセストークンの取得に失敗しました。';
                    break;
                default:
                    errorMessage = '認証中にエラーが発生しました。';
            }

            this.showError(errorMessage);
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
            z-index: 1000;
            max-width: 400px;
        `;
        
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; margin-left: auto;">&times;</button>
            </div>
        `;

        document.body.appendChild(errorDiv);

        // 5秒後に自動で消す
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    const app = new FitbitAuthApp();
    app.checkUrlErrors();
});

// Service Worker登録（PWA対応）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}