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
        const connectBtn = document.getElementById('connect-fitbit-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', this.handleLogin.bind(this));
        }
        
        const modalClose = document.getElementById('modal-close');
        const errorOk = document.getElementById('error-ok');
        
        if (modalClose) {
            modalClose.addEventListener('click', this.closeModal.bind(this));
        }
        
        if (errorOk) {
            errorOk.addEventListener('click', this.closeModal.bind(this));
        }
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();

            if (data.authenticated) {
                // 既に認証済みの場合、ダッシュボードにリダイレクト
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.error('認証状態確認エラー:', error);
        }
    }

    handleLogin() {
        // 接続ボタンを無効化
        const connectBtn = document.getElementById('connect-fitbit-btn');
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 認証中...';
        
        // ローディングモーダル表示
        this.showLoadingModal();

        // Fitbit認証ページにリダイレクト
        setTimeout(() => {
            window.location.href = '/auth/login';
        }, 1000);
    }

    // URLパラメータからエラーをチェック
    checkUrlErrors() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
            let errorMessage = '';
            switch (error) {
                case 'access_denied':
                    errorMessage = 'Fitbit認証がキャンセルされました。';
                    break;
                case 'no_code':
                    errorMessage = '認証コードが取得できませんでした。';
                    break;
                case 'token_failed':
                    errorMessage = 'アクセストークンの取得に失敗しました。';
                    break;
                case 'config_missing':
                    errorMessage = 'Fitbit設定が見つかりません。';
                    break;
                default:
                    errorMessage = errorDescription || '認証中にエラーが発生しました。';
            }

            this.showErrorModal(errorMessage);
        }
    }

    showLoadingModal() {
        const modal = document.getElementById('loading-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    showErrorModal(message) {
        const modal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');
        
        if (modal && errorMessage) {
            errorMessage.textContent = message;
            modal.style.display = 'flex';
        }
    }
    
    closeModal() {
        const loadingModal = document.getElementById('loading-modal');
        const errorModal = document.getElementById('error-modal');
        
        if (loadingModal) loadingModal.style.display = 'none';
        if (errorModal) errorModal.style.display = 'none';
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    const app = new FitbitAuthApp();
    app.checkUrlErrors();
    
    // デバッグ: URLパラメータをコンソールに出力
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) {
        console.log('🔍 ホームページURLパラメータ:', urlParams.toString());
        for (const [key, value] of urlParams.entries()) {
            console.log(`  ${key}: ${value}`);
        }
    }
    
    // モーダルクリックイベント
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            app.closeModal();
        }
    });
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