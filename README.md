# Redfish GUI

Redfish API シミュレータを操作するための Web GUI です。  
2 つのシミュレータ（**redfish-emu** / **redfish-ras-emu**）を画面右上のトグルで切り替えて操作できます。

## 対応シミュレータ

| シミュレータ | ポート | リポジトリ |
|---|---|---|
| redfish-emu | 8008 | https://github.com/s-sh8089/redfish-emu |
| redfish-ras-emu | 8009 | https://github.com/s-sh8089/redfish-ras-emu |

## 技術スタック

- **Next.js 14** (App Router, SPA 静的エクスポート)
- **Material UI (MUI) v5**
- **TypeScript**
- **Nginx** (静的ファイル配信 + Redfish プロキシ)

## アーキテクチャ

```
Browser
  └─ Nginx (:3008)
       ├── /api/proxy/emu/*     → http://redfish-emu:8008/
       ├── /api/proxy/ras-emu/* → http://redfish-ras-emu:8009/
       └── /*                   → 静的ファイル (next build 出力)
```

`next build` で `out/` に静的ファイルを生成し、Nginx が配信します。  
Redfish シミュレータへのリクエストは Nginx がプロキシします。

## セットアップ

### 環境変数の設定

```bash
cp gui/.env.example gui/.env.local
# 必要に応じて HOST / PORT を編集
```

```env
NEXT_PUBLIC_EMU_HOST=localhost
NEXT_PUBLIC_EMU_PORT=8008

NEXT_PUBLIC_RAS_EMU_HOST=localhost
NEXT_PUBLIC_RAS_EMU_PORT=8009
```

> `.env.local` が存在しない場合は上記のデフォルト値が使われます。  
> `NEXT_PUBLIC_*` の値はビルド時に静的ファイルへ埋め込まれます（表示用途のみ）。

---

### 共有 Docker ネットワークの作成（初回のみ）

GUI とシミュレータを同一ネットワークで接続するために外部ネットワークを作成します。

```bash
docker network create redfish-net
```

各シミュレータの `docker-compose.yml` に `redfish-net` を追加してください。

```yaml
services:
  redfish-emu:
    networks:
      - redfish-net

networks:
  redfish-net:
    external: true
```

Docker ネットワーク経由で接続する場合は `gui/.env.local` のホスト名をサービス名に変更します。

```env
NEXT_PUBLIC_EMU_HOST=redfish-emu
NEXT_PUBLIC_RAS_EMU_HOST=redfish-ras-emu
```

---

## 起動方法

### 本番（静的ビルド + Nginx）

```bash
docker compose up --build
```

- GUI: http://localhost:3008

### 開発（Nginx + next dev、ホットリロードあり）

```bash
docker compose -f docker-compose.dev.yml up --build
```

- GUI: http://localhost:3008（Nginx 経由）
- `gui/src/` の変更は即座に反映されます

> **注意:** `yarn dev` を Docker なしで単独起動した場合、Nginx プロキシが存在しないため  
> Redfish API への接続は機能しません。UI コンポーネントの確認のみ可能です。

---

## 認証

ログイン後の資格情報はブラウザの Cookie に保存され、**8 時間**有効です。  
リロード後も再ログイン不要です。

| サーバー | 認証方式 | デフォルト資格情報 |
|---|---|---|
| redfish-emu | Basic 認証 | `admin` / `password` |
| redfish-ras-emu | Redfish Session 認証 (X-Auth-Token) | `admin` / `redfish` |

---

## 画面一覧

### 共通 UI

| 要素 | 内容 |
|---|---|
| AppBar (上部) | 画面タイトル、サーバー切替トグル（BMC / RAS） |
| サイドバー | 選択中のサーバーに対応したナビゲーションメニュー |

---

## redfish-emu (port 8008)

### ダッシュボード (`/`)

- BMC（Manager）の一覧をカード表示
- 電源状態・ステータス・ファームウェアバージョンを一覧確認

### Systems (`/systems`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | システム情報（メーカー、モデル、シリアル番号、BIOS バージョン等） | 電源操作 (8 種)、Boot 設定変更 (PATCH) |
| Processors | CPU 一覧（アーキテクチャ、コア数、スレッド数等） | — |
| Memory | メモリモジュール一覧（容量、速度、シリアル番号等） | — |
| Storage | ストレージコントローラーとドライブ一覧 | — |
| BIOS | BIOS Attributes の表示 | 属性値を変更して保存 (PATCH) |
| SecureBoot | SecureBoot の現在状態 | 有効 / 無効の切替 (PATCH) |
| Log Services | EventLog・SEL のエントリ一覧 | ログクリア (POST) |

### Chassis (`/chassis`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | シャーシ情報、電源状態 | 電源操作 (On / ForceOff / PowerCycle) |
| Thermal | 温度センサー・ファン一覧 | — |
| Power | 電力消費・電源ユニット・電圧一覧 | — |
| Sensors | センサー一覧（値、単位、タイプ） | — |

### Managers (`/managers`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | BMC 情報（メーカー、モデル、FW バージョン、日時等） | BMC リセット (GracefulRestart / ForceRestart) |
| Network Protocol | HTTP / HTTPS / SSH / IPMI / NTP の状態・ポート | — |
| Virtual Media | 仮想メディア一覧（接続状態、イメージ URL） | メディア挿入 (POST) / 排出 (POST) |
| Ethernet | NIC 一覧（MAC アドレス、IPv4/IPv6、DNS） | — |

### Accounts (`/accounts`)

| タブ | 内容 | 操作 |
|---|---|---|
| Accounts | アカウント一覧（ユーザー名、ロール、有効/無効状態） | 新規作成 (POST)、編集 (PATCH)、削除 (DELETE) |
| Roles | ロール一覧（権限一覧） | — |

### Sessions (`/sessions`)

- アクティブセッション一覧（ユーザー名・セッション ID）
- 新規セッション作成 (POST) → X-Auth-Token を画面表示
- セッション削除 (DELETE)

### Events (`/events`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | EventService の設定情報 | テストイベント送信 (POST) |
| Subscriptions | Webhook サブスクリプション一覧 | 新規作成 (POST)、削除 (DELETE) |

### Update (`/update`)

- ファームウェアインベントリ一覧（バージョン・Updateable フラグ）
- SimpleUpdate 実行 (POST)：Image URI とターゲットを指定

---

## redfish-ras-emu (port 8009)

### ダッシュボード (`/`)

- Manager の一覧をカード表示

### Power Equipment (`/power-equipment`)

RackPDU と UPS をタブで切り替えて操作します。

#### RackPDU タブ

| サブタブ | 内容 | 操作 |
|---|---|---|
| Overview | PDU 基本情報（メーカー、モデル、定格） | Health 変更 (PATCH) |
| Outlets | コンセント一覧（電源状態、電圧、電流、電力） | ON / OFF (PATCH)、アクション (POST) |
| Sensors | センサー一覧（計測値、単位、閾値） | センサー値の書き換え (PATCH) |
| Mains | 主回路情報（電圧、電流、電力、電力量） | — |
| Branches | ブランチ回路情報 | — |
| Metrics | PDU 全体の電力・電力量 | — |

#### UPS タブ

| サブタブ | 内容 | 操作 |
|---|---|---|
| Overview | UPS 基本情報（定格、バッテリ充電率、バックアップ推定時間） | LineInputStatus 変更 (PATCH) |
| Outlets | UPS 出力コンセント一覧 | ON / OFF (PATCH)、アクション (POST) |
| Sensors | センサー一覧 | センサー値の書き換え (PATCH) |
| Mains | 入力回路情報 | — |
| Metrics | 入出力電力、バッテリ情報 | — |

### Chassis (`/ras-chassis`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | ラックシャーシ情報 | Health 変更 (PATCH) |
| Sensors | センサー一覧（温度、湿度、電力等） | センサー値の書き換え (PATCH) |
| Power | 消費電力・電力容量 | — |
| Thermal | 温度・湿度の一覧 | — |

### Managers (`/ras-managers`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | Manager 基本情報（FW バージョン、UUID、ホスト名） | — |
| Network Protocol | HTTP / HTTPS / SNMP / SSH の状態・ポート | — |
| Ethernet | NIC の IP アドレス・MAC アドレス | — |

### Events (`/ras-events`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | EventService の設定情報 | テストイベント送信 (POST) |
| Subscriptions | Webhook サブスクリプション一覧 | 新規作成 (POST)、削除 (DELETE) |

---

## ディレクトリ構成

```
redfish-gui/
├── gui/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                   # ダッシュボード
│   │   │   ├── login/page.tsx             # ログイン
│   │   │   ├── systems/page.tsx           # Systems (EMU)
│   │   │   ├── chassis/page.tsx           # Chassis (EMU)
│   │   │   ├── managers/page.tsx          # Managers (EMU)
│   │   │   ├── accounts/page.tsx          # AccountService (EMU)
│   │   │   ├── sessions/page.tsx          # SessionService (EMU)
│   │   │   ├── events/page.tsx            # EventService (EMU)
│   │   │   ├── update/page.tsx            # UpdateService (EMU)
│   │   │   ├── power-equipment/page.tsx   # Power Equipment (RAS-EMU)
│   │   │   ├── ras-chassis/page.tsx       # Chassis (RAS-EMU)
│   │   │   ├── ras-managers/page.tsx      # Managers (RAS-EMU)
│   │   │   ├── ras-events/page.tsx        # EventService (RAS-EMU)
│   │   │   └── ras-tasks/page.tsx         # Tasks (RAS-EMU)
│   │   ├── components/
│   │   │   ├── AppLayout.tsx              # サイドバー・AppBar レイアウト
│   │   │   └── ThemeRegistry.tsx          # MUI テーマ設定
│   │   ├── context/
│   │   │   ├── AuthContext.tsx            # 認証状態・Cookie 管理
│   │   │   └── ServerContext.tsx          # サーバー切替コンテキスト
│   │   └── lib/
│   │       └── api.ts                     # Redfish API フェッチユーティリティ
│   ├── Dockerfile                         # 本番用マルチステージビルド
│   ├── Dockerfile.dev                     # 開発用（next dev）
│   └── next.config.js                     # output: export, trailingSlash: true
├── nginx/
│   ├── default.conf                       # 本番用 Nginx 設定
│   └── default.dev.conf                   # 開発用 Nginx 設定（next dev へ転送）
├── docker-compose.yml                     # 本番：Nginx + 静的ビルド
├── docker-compose.dev.yml                 # 開発：Nginx + next dev
└── THIRD_PARTY_LICENSES.md
```
