// メイン画面用 JavaScript
class FitbitConnector {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Fitbit連携ボタン
        const connectBtn = document.getElementById('connect-fitbit-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', this.handleFitbitConnect.bind(this));
        }

        // エラーモーダル
        const modal = document.getElementById('error-modal');
        const modalClose = document.getElementById('modal-close');
        const errorOk = document.getElementById('error-ok');

        modalClose?.addEventListener('click', () => this.hideModal('error-modal'));
        errorOk?.addEventListener('click', () => this.hideModal('error-modal'));
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal('error-modal');
        });
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            
            if (data.authenticated) {
                // 既に認証済みの場合はダッシュボードにリダイレクト
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.log('認証状態チェック:', error);
            // エラーは無視（未認証状態と同じ扱い）
        }
    }

    async handleFitbitConnect() {
        try {
            this.showLoading();
            
            // 環境変数で設定されたFitbit認証を開始
            window.location.href = '/auth/login';
            
        } catch (error) {
            console.error('Fitbit連携エラー:', error);
            this.hideLoading();
            this.showError(error.message || 'Fitbit連携でエラーが発生しました。');
        }
    }

    showLoading() {
        document.getElementById('loading-modal').style.display = 'block';
        document.body.classList.add('modal-open');
    }

    hideLoading() {
        document.getElementById('loading-modal').style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').style.display = 'block';
        document.body.classList.add('modal-open');
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

// URLパラメータから認証エラーをチェック
function checkAuthError() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (error) {
        const connector = new FitbitConnector();
        let errorMessage = '認証に失敗しました。';
        
        switch (error) {
            case 'access_denied':
                errorMessage = 'アクセスが拒否されました。Fitbitアカウントでの認証が必要です。';
                break;
            case 'invalid_request':
                errorMessage = '無効なリクエストです。再度お試しください。';
                break;
            case 'server_error':
                errorMessage = 'サーバーエラーが発生しました。しばらくしてから再度お試しください。';
                break;
            case 'config_missing':
                errorMessage = 'Fitbit設定が見つかりません。管理者にお問い合わせください。';
                break;
            default:
                if (errorDescription) {
                    errorMessage = decodeURIComponent(errorDescription);
                }
        }
        
        connector.showError(errorMessage);
        
        // URLからエラーパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    checkAuthError();
    new FitbitConnector();
});