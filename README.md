# Booklog to Obsidian Extension

ブクログの本棚データをObsidian Vaultに同期するChrome拡張機能。

ブラウザのログイン済みセッションを利用してブクログからCSVを取得し、[Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) プラグイン経由でMarkdownファイルを作成・更新する。

## 必要なもの

- Chrome
- Obsidian + [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) プラグイン
- ブクログのアカウント（ブラウザでログイン済み）

## セットアップ

### Obsidian側

1. Local REST APIプラグインをインストール・有効化
2. プラグイン設定で「Enable Non-encrypted (HTTP) Server」を有効にする
3. API Keyをコピーしておく

### Chrome拡張

1. このリポジトリをクローン
2. `chrome://extensions` を開き、デベロッパーモードをON
3. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選択

### 設定

1. ツールバーの拡張アイコンをクリックしてPopupを開く
2. 以下を入力して「Save Settings」をクリック
   - **Obsidian API Key**: プラグイン設定画面でコピーしたキー
   - **Protocol**: HTTP（推奨）
   - **Port**: 27123（HTTPのデフォルト）
   - **Books directory**: Vault内の保存先パス（例: `Books/Booklog`）

## 使い方

1. ブクログにChromeでログインしておく
2. Obsidianを起動しておく
3. 拡張のPopupで「Sync Now」をクリック
4. 進捗がPopupに表示され、完了すると `N created, N updated, N unchanged` と表示される

## 同期の仕組み

- ブクログのCSVエクスポート機能からデータを取得
- 各書籍をYAML frontmatter付きのMarkdownファイルとして保存
- ファイル名: `{著者}『{タイトル}』（{出版社}、{出版年}）.md`
- 既存ファイルはfrontmatterの差分がある場合のみ更新、本文（body）は保持
- ファイルインデックスをキャッシュし、2回目以降のsyncを高速化

### frontmatter

```yaml
---
item_id: '1234567890'
title: 本のタイトル
author: 著者名
isbn13: '9784000000001'
publisher: 出版社
publish_year: '2020'
status: 読み終わった
rating: 5
---
```

## 開発

```bash
npm install
npm test              # テスト実行
npm run test:watch    # ウォッチモード
```

ビルドステップなし。vanilla JS（ES Modules）で、Chromeが直接読み込む。
