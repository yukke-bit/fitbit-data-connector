// Fitbit API設定画面用 JavaScript
class FitbitSetup {
    constructor() {
        this.init();
    }

    init() {
        this.setRedirectUri();
        this.bindEvents();
        this.loadSavedConfig();
    }

    setRedirectUri() {
        const redirectUri = `${window.location.origin}/auth/callback`;
        document.getElementById('redirect-uri').value = redirectUri;
    }

    bindEvents() {
        // フォーム送信
        const form = document.getElementById('fitbit-setup-form');
        form.addEventListener('submit', this.handleFormSubmit.bind(this));

        // エラーモーダル
        const modal = document.getElementById('error-modal');
        const modalClose = document.getElementById('modal-close');
        const errorOk = document.getElementById('error-ok');

        modalClose?.addEventListener('click', () => this.hideModal('error-modal'));
        errorOk?.addEventListener('click', () => this.hideModal('error-modal'));
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal('error-modal');
        });

        // コピーボタン（リダイレクトURI）
        const redirectInput = document.getElementById('redirect-uri');
        redirectInput.addEventListener('click', () => {
            this.copyToClipboard(redirectInput.value);
        });
    }

    loadSavedConfig() {
        // セッションストレージから設定を復元
        const savedClientId = sessionStorage.getItem('fitbit_client_id');
        if (savedClientId) {
            document.getElementById('client-id').value = savedClientId;
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const config = {
            clientId: formData.get('clientId').trim(),
            clientSecret: formData.get('clientSecret').trim(),
            redirectUri: formData.get('redirectUri').trim()
        };

        // バリデーション
        if (!this.validateConfig(config)) {
            return;
        }

        try {
            this.showLoading();
            
            // ステップ2に進む
            this.updateStepIndicator(2);
            
            // 設定をセッションに一時保存
            sessionStorage.setItem('fitbit_client_id', config.clientId);
            sessionStorage.setItem('fitbit_client_secret', config.clientSecret);
            sessionStorage.setItem('fitbit_redirect_uri', config.redirectUri);
            
            // OAuth認証URLを生成してリダイレクト
            await this.startOAuthFlow(config);
            
        } catch (error) {
            console.error('Setup error:', error);
            this.hideLoading();
            this.showError(error.message || '設定でエラーが発生しました。');
        }
    }

    validateConfig(config) {
        if (!config.clientId) {
            this.showError('Client IDを入力してください。');
            return false;
        }

        if (!config.clientSecret) {
            this.showError('Client Secretを入力してください。');
            return false;
        }

        if (!config.redirectUri) {
            this.showError('リダイレクトURIが設定されていません。');
            return false;
        }

        // Client IDのフォーマットチェック（簡易）
        if (config.clientId.length < 6) {
            this.showError('Client IDの形式が正しくありません。');
            return false;
        }

        return true;
    }

    async startOAuthFlow(config) {
        try {
            // サーバーに設定を送信してOAuth URLを取得
            const response = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'サーバーエラーが発生しました');
            }

            if (data.success && data.authUrl) {
                // OAuth認証ページにリダイレクト
                setTimeout(() => {
                    window.location.href = data.authUrl;
                }, 1000);
            } else {
                throw new Error(data.message || '認証URLの生成に失敗しました');
            }

        } catch (error) {
            throw new Error(`OAuth設定エラー: ${error.message}`);
        }
    }

    updateStepIndicator(activeStep) {
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            if (stepNumber <= activeStep) {
                step.classList.add('active');
                if (stepNumber < activeStep) {
                    step.classList.add('completed');
                }
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // コピー成功の視覚的フィードバック
            const input = document.getElementById('redirect-uri');
            const originalBg = input.style.backgroundColor;
            input.style.backgroundColor = '#d4edda';
            input.style.borderColor = '#28a745';
            
            setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '';
            }, 1000);
            
            // トーストメッセージ（簡易版）
            this.showToast('リダイレクトURIをコピーしました');
        }).catch(err => {
            console.error('コピー失敗:', err);
            // フォールバック: 選択状態にする
            input.select();
            document.execCommand('copy');
            this.showToast('リダイレクトURIを選択しました');
        });
    }

    showToast(message) {
        // 簡易トーストメッセージ
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
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

// パスワード表示/非表示切り替え
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// URLパラメータから認証エラーをチェック
function checkAuthError() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (error) {
        const setup = new FitbitSetup();
        let errorMessage = '認証に失敗しました。';
        
        switch (error) {
            case 'invalid_client':
                errorMessage = 'Client IDまたはClient Secretが正しくありません。設定を確認してください。';
                break;
            case 'access_denied':
                errorMessage = 'アクセスが拒否されました。Fitbitアカウントでの認証が必要です。';
                break;
            case 'invalid_request':
                errorMessage = '無効なリクエストです。設定を確認して再度お試しください。';
                break;
            case 'server_error':
                errorMessage = 'サーバーエラーが発生しました。しばらくしてから再度お試しください。';
                break;
            default:
                if (errorDescription) {
                    errorMessage = decodeURIComponent(errorDescription);
                }
        }
        
        setup.showError(errorMessage);
        
        // URLからエラーパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// CSS アニメーション追加
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    checkAuthError();
    new FitbitSetup();
});