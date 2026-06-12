# GUI実装計画

## 概要

`gui/` ディレクトリに Next.js 14 + MUI v5 + TypeScript で Redfish API を操作する管理画面を構築する。

## 技術スタック

- Next.js 14 (App Router)
- MUI (Material-UI) v5
- TypeScript
- Docker (開発用コンテナ)

## ディレクトリ構成

```
gui/
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.ts            # API Proxy Rewrites 設定
└── src/
    ├── app/
    │   ├── layout.tsx         # ルートレイアウト（ThemeRegistry 適用）
    │   ├── page.tsx           # / → /systems リダイレクト
    │   ├── systems/page.tsx   # Systems 画面
    │   ├── chassis/page.tsx   # Chassis 画面
    │   └── managers/page.tsx  # Managers 画面
    ├── components/
    │   ├── AppLayout.tsx      # サイドナビ + AppBar
    │   └── ThemeRegistry.tsx  # MUI ThemeProvider (Client Component)
    └── lib/
        └── api.ts             # fetch ラッパー (apiGet / apiPatch / apiPost)
```

## API プロキシ

Next.js の `rewrites` を使い、ブラウザからの `/redfish/*` リクエストを
Docker コンテナ内の `http://redfish-emu:8008/redfish/*` に転送する。
これにより CORS エラーを回避。

環境変数: `API_INTERNAL_URL`（デフォルト: `http://localhost:8008`）

## 画面構成

### Systems (`/systems`)

| タブ | 機能 |
|------|------|
| Overview | システム基本情報、電源操作(Reset)、Boot 設定 PATCH |
| Processors | プロセッサ一覧テーブル |
| Memory | メモリモジュール一覧テーブル |
| Storage | ストレージ + ドライブ詳細テーブル |

### Chassis (`/chassis`)

| タブ | 機能 |
|------|------|
| Overview | シャーシ情報、電源操作(Reset) |
| Thermal | 温度センサー一覧、ファン一覧 |
| Power | 電力消費、電源ユニット一覧 |
| Sensors | センサー一覧 |

### Managers (`/managers`)

| タブ | 機能 |
|------|------|
| Overview | BMC 情報、BMC リセット |
| Network Protocol | HTTP/HTTPS/SSH/IPMI/NTP の設定表示 |
| Virtual Media | 仮想メディア一覧、Insert/Eject 操作 |
| Ethernet Interfaces | NIC 一覧 |

## Docker 設定

docker-compose.yml に `gui` サービスを追加:
- ポート: 3000:3000
- ソースマウント: `./gui:/app`、`/app/node_modules` は除外
- 依存: redfish-emu
