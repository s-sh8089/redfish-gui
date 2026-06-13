# CLAUDE.md

## プロジェクト概要

Redfish API シミュレータ（EMU / RAS-EMU）を操作する Web GUI。  
Next.js を SPA（静的エクスポート）としてビルドし、Nginx が静的ファイル配信と Redfish プロキシを担う。

## アーキテクチャ

```
Browser
  └─ Nginx (:3008)
       ├── /api/proxy/emu/*     → http://redfish-emu:8008/
       ├── /api/proxy/ras-emu/* → http://redfish-ras-emu:8009/
       └── /*                   → 静的ファイル (out/)
```

- ブラウザは常に `/api/proxy/{type}/...` という相対 URL でリクエストする
- Nginx がパスプレフィックスを剥がしてシミュレータへ転送する
- Next.js の API Route は存在しない（`output: 'export'` のため使用不可）

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `gui/src/lib/api.ts` | ブラウザ用 HTTP クライアント。認証ヘッダー管理・401 ハンドリング・JSON パース |
| `gui/src/context/AuthContext.tsx` | 認証状態管理。Cookie への資格情報保存・復元 |
| `gui/src/context/ServerContext.tsx` | EMU / RAS-EMU の切替。API ベース URL の切替 |
| `gui/src/components/AppLayout.tsx` | サイドバー・AppBar の共通レイアウト |
| `nginx/default.conf` | 本番用 Nginx 設定 |
| `nginx/default.dev.conf` | 開発用 Nginx 設定（next dev コンテナへ転送、HMR WebSocket 対応） |

## 認証フロー

サーバーごとに認証方式が異なる。

| サーバー | 方式 | ヘッダー |
|---|---|---|
| `emu` | Basic 認証 | `Authorization: Basic {base64}` |
| `ras-emu` | Redfish Session | `X-Auth-Token: {token}` |

- ログイン成功時、資格情報を `document.cookie` に JSON 形式で保存（有効期限 8 時間）
- Cookie キー: `redfish_auth_emu` / `redfish_auth_ras-emu`
- ページリロード時は `AuthContext` の `useEffect` が Cookie を読んで自動復元する
- 401 レスポンス時は `/login` へリダイレクト（SPA 内遷移）

## 開発コマンド

```bash
# 開発（Nginx + next dev、ホットリロードあり）
docker compose -f docker-compose.dev.yml up --build

# 本番ビルド確認
docker compose up --build

# 型チェック
cd gui && yarn tsc --noEmit

# 静的ビルドのみ
cd gui && yarn build   # out/ に出力される
```

> `cd gui && yarn dev` は Nginx プロキシなしで起動するため Redfish API に接続できない。  
> UI コンポーネントの確認のみ可能。

## 環境変数

`gui/.env.local` で設定（ビルド時に静的ファイルへ埋め込まれる、表示用途のみ）。

| 変数 | 用途 | デフォルト |
|---|---|---|
| `NEXT_PUBLIC_EMU_HOST` | ログイン画面の表示用ホスト名 | `localhost` |
| `NEXT_PUBLIC_EMU_PORT` | ログイン画面の表示用ポート | `8008` |
| `NEXT_PUBLIC_RAS_EMU_HOST` | ログイン画面の表示用ホスト名 | `localhost` |
| `NEXT_PUBLIC_RAS_EMU_PORT` | ログイン画面の表示用ポート | `8009` |

> API リクエスト先（Nginx upstream）は `nginx/default.conf` にハードコードされており、  
> 環境変数では制御しない。

## Next.js 設定の制約

`next.config.js` に `output: 'export'` を設定しているため以下は使用できない。

- API Routes (`app/api/` 以下)
- `getServerSideProps` / Server Components でのデータフェッチ
- `next/image` の最適化機能（外部画像）
- `next start`（静的ファイルは Nginx が配信するため不要）

## Docker 構成

| ファイル | 用途 | Nginx 設定 |
|---|---|---|
| `docker-compose.yml` | 本番 | `nginx/default.conf`（静的ファイル配信 + プロキシ） |
| `docker-compose.dev.yml` | 開発 | `nginx/default.dev.conf`（next dev へ転送 + プロキシ） |

- 本番: `gui/Dockerfile`（マルチステージ: Node.js でビルド → nginx:alpine へコピー）
- 開発: `gui/Dockerfile.dev`（`next dev -p 3009` で起動、`gui/src/` をボリュームマウント）
- 両環境とも外部ネットワーク `redfish-net` に接続してシミュレータと通信する
