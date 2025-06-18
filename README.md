# 🏃‍♂️ Fitbit データ連携プロトタイプ

Fitbit Web APIを使用してヘルスデータを取得・可視化するプロトタイプアプリケーション

## 🎯 **機能概要**

- **Fitbit OAuth認証** - 安全なアカウント連携
- **ヘルスデータ取得** - 歩数、心拍数、睡眠データなど
- **リアルタイム表示** - ダッシュボードでデータ可視化
- **履歴管理** - 日次・週次・月次データの管理

## 📊 **対応データ**

| データ種別 | 説明 | API エンドポイント |
|------------|------|-------------------|
| 🚶 歩数 | 日次歩数データ | `/activities/steps` |
| ❤️ 心拍数 | 心拍数ゾーン | `/activities/heart` |
| 😴 睡眠 | 睡眠時間・質 | `/sleep` |
| 🔥 カロリー | 消費カロリー | `/activities/calories` |
| 📏 距離 | 移動距離 | `/activities/distance` |

## 🚀 **セットアップ**

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Fitbitアプリ設定
1. [Fitbit Developer Console](https://dev.fitbit.com/apps) でアプリを登録
2. `Client ID` と `Client Secret` を取得
3. リダイレクトURIを `http://localhost:3000/auth/callback` に設定

### 3. 環境変数設定
```bash
cp .env.example .env
```

`.env` ファイルを編集：
```env
FITBIT_CLIENT_ID=your-client-id
FITBIT_CLIENT_SECRET=your-client-secret
FITBIT_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=your-session-secret
PORT=3000
```

**重要**: すべてのユーザーが同じFitbitアプリケーションを使用します。

### 4. サーバー起動
```bash
npm run dev
```

アプリケーションが `http://localhost:3000` で起動します。

## 🎯 **使用方法**

1. **アプリにアクセス** - ブラウザでアプリのURLを開く
2. **「Fitbitと連携する」ボタンをクリック** - Fitbit認証画面に自動遷移
3. **Fitbitアカウントでログイン** - 認証を許可
4. **ダッシュボードでデータ確認** - 自動的にダッシュボードに移動しデータ表示

## 🌐 **Vercelデプロイ**

### 1. Vercelアカウント設定
1. [Vercel](https://vercel.com) でアカウント作成
2. GitHubアカウントと連携

### 2. プロジェクトデプロイ
```bash
# Vercel CLIをインストール（オプション）
npm install -g vercel

# Vercelダッシュボードから直接GitHubリポジトリをインポート
# または、CLIを使用：
vercel --prod
```

### 3. 環境変数設定
Vercelダッシュボードの「Settings > Environment Variables」で以下を設定：

```env
FITBIT_CLIENT_ID=your-fitbit-client-id
FITBIT_CLIENT_SECRET=your-fitbit-client-secret
FITBIT_REDIRECT_URI=https://your-app-name.vercel.app/auth/callback
SESSION_SECRET=your-super-secret-session-key
NODE_ENV=production
```

**注意**: 環境変数の設定は必須です。

### 4. Fitbitアプリ設定更新
Fitbit Developer Consoleで：
1. リダイレクトURIに `https://your-app-name.vercel.app/auth/callback` を追加
2. 本番用ドメインを許可リストに追加

### 5. デプロイ確認
- `https://your-app-name.vercel.app` にアクセス
- Fitbit認証とデータ取得をテスト

## 📁 **プロジェクト構造**

```
fitbit-data-connector/
├── src/
│   ├── server.js           # Express サーバー
│   ├── routes/
│   │   ├── auth.js         # OAuth認証ルート
│   │   └── api.js          # Fitbit API ルート
│   ├── services/
│   │   └── fitbitClient.js # Fitbit API クライアント
│   └── utils/
│       └── helpers.js      # ユーティリティ関数
├── public/
│   ├── index.html          # メインページ
│   ├── dashboard.html      # ダッシュボード
│   ├── css/
│   │   └── style.css       # スタイルシート
│   └── js/
│       └── app.js          # フロントエンド JS
├── config/
│   └── fitbit.js           # Fitbit設定
└── docs/
    └── api.md              # API ドキュメント
```

## 🔧 **開発ガイド**

### Fitbit API の使用例
```javascript
// 今日の歩数を取得
const steps = await fitbitClient.getActivityData('steps', 'today');

// 過去7日間の心拍数データを取得
const heartRate = await fitbitClient.getHeartRateData('7d');

// 睡眠データを取得
const sleep = await fitbitClient.getSleepData('today');
```

### 新しいデータタイプの追加
1. `src/services/fitbitClient.js` にメソッド追加
2. `src/routes/api.js` にエンドポイント追加
3. `public/js/app.js` にフロントエンド処理追加

## 🔐 **セキュリティ**

- OAuth 2.0 による安全な認証
- セッション管理でトークン保護
- CORS 設定によるオリジン制限
- 環境変数による機密情報管理

## 📈 **今後の拡張予定**

- [ ] データベース連携（PostgreSQL/MongoDB）
- [ ] リアルタイム通知機能
- [ ] カスタムダッシュボード
- [ ] データエクスポート機能
- [ ] モバイルアプリ対応

## 🤝 **コントリビューション**

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 **ライセンス**

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🔗 **参考リンク**

- [Fitbit Web API Documentation](https://dev.fitbit.com/build/reference/web-api/)
- [OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [Express.js Documentation](https://expressjs.com/)