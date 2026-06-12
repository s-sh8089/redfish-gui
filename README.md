# Redfish GUI

Redfish API シミュレータを操作するための Web GUI です。  
2 つのシミュレータ（**redfish-emu** / **redfish-ras-emu**）を画面右上のトグルで切り替えて操作できます。

## 対応シミュレータ

| シミュレータ | ポート | リポジトリ |
|---|---|---|
| redfish-emu | 8008 | https://github.com/s-sh8089/redfish-emu |
| redfish-ras-emu | 8009 | https://github.com/s-sh8089/redfish-ras-emu |

## 技術スタック

- **Next.js 14** (App Router)
- **Material UI (MUI) v5**
- **TypeScript**

## セットアップ・起動

### 環境変数の設定

接続先のホストとポートを `.env.local` で設定します。

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

---

### Docker Compose で起動する（推奨）

#### シミュレータと同一ネットワークで接続する場合

GUI とシミュレータをそれぞれ別の Compose ファイルで起動している場合、共有ネットワークを作成してコンテナ間を接続します。

**1. 共有ネットワークを作成する（初回のみ）**

```bash
docker network create redfish-net
```

**2. 各シミュレータの `docker-compose.yml` に `redfish-net` を追加する**

```yaml
services:
  redfish-emu:       # サービス名は各リポジトリに合わせる
    networks:
      - redfish-net

networks:
  redfish-net:
    external: true
```

**3. `gui/.env.local` のホスト名をサービス名に変更する**

```env
NEXT_PUBLIC_EMU_HOST=redfish-emu       # emu側 compose のサービス名
NEXT_PUBLIC_EMU_PORT=8008

NEXT_PUBLIC_RAS_EMU_HOST=redfish-ras-emu   # ras-emu側 compose のサービス名
NEXT_PUBLIC_RAS_EMU_PORT=8009
```

> **注意:** `localhost` のままにするとコンテナ内で自分自身を指してしまい `ECONNREFUSED` になります。

**4. GUI を起動する**

```bash
docker compose up --build
```

- GUI: http://localhost:3008

---

### ローカルで起動する

```bash
cd gui
yarn install
yarn dev        # http://localhost:3000
```

---

### シミュレータの起動

シミュレータは別途 Docker で起動してください。

```bash
# redfish-emu (port 8008)
cd redfish-emu && docker compose up --build

# redfish-ras-emu (port 8009)
cd redfish-ras-emu && docker compose up --build
```

---

## 画面一覧

### 共通 UI

| 要素 | 内容 |
|---|---|
| AppBar (上部) | 画面タイトル、サーバー切替トグル（redfish-emu / redfish-ras-emu） |
| サイドバー | 選択中のサーバーに対応したナビゲーションメニュー |

サーバーを切り替えると接続先ポートとナビゲーション項目が自動で切り替わります。

---

## redfish-emu (port 8008)

### ダッシュボード (`/`)

- BMC（Manager）の一覧をカード表示
- 電源状態・ステータス・ファームウェアバージョンを一覧確認

### Systems (`/systems`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | システム情報（メーカー、モデル、シリアル番号、BIOS バージョン等） | 電源操作 (On / ForceOff / GracefulShutdown 等 8 種)、Boot 設定変更 (PATCH) |
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
| Accounts | アカウント一覧（ユーザー名、ロール、有効/無効状態） | 新規作成 (POST)、パスワード・ロール・ロック状態の編集 (PATCH)、削除 (DELETE) |
| Roles | ロール一覧（権限一覧） | — |

### Sessions (`/sessions`)

- アクティブセッション一覧（ユーザー名・セッション ID）
- 新規セッション作成（ログイン）(POST) → X-Auth-Token を画面表示
- セッション削除 (DELETE)

### Events (`/events`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | EventService の設定情報 | テストイベント送信 (POST)：イベントタイプ・重大度・メッセージ・MessageId を指定 |
| Subscriptions | Webhook サブスクリプション一覧 | 新規作成 (POST)：送信先 URL・コンテキスト・イベントタイプを指定、削除 (DELETE) |

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
| Overview | PDU 基本情報（メーカー、モデル、定格） | Health 変更 (OK / Warning / Critical) (PATCH) |
| Outlets | コンセント一覧（電源状態、電圧、電流、電力） | ON / OFF (PATCH)、PowerCycle 等のアクション (POST) |
| Sensors | センサー一覧（計測値、単位、閾値） | センサー値の直接書き換え (PATCH) |
| Mains | 主回路情報（電圧、電流、電力、電力量） | — |
| Branches | ブランチ回路情報 | — |
| Metrics | PDU 全体の電力・電力量 | — |

#### UPS タブ

| サブタブ | 内容 | 操作 |
|---|---|---|
| Overview | UPS 基本情報（定格、バッテリ充電率、バックアップ推定時間） | LineInputStatus 変更 (PATCH)：Normal / OutOfRange / OutOfPower / LossOfInput 等 |
| Outlets | UPS 出力コンセント一覧 | ON / OFF (PATCH)、アクション (POST) |
| Sensors | センサー一覧 | センサー値の直接書き換え (PATCH) |
| Mains | 入力回路情報 | — |
| Metrics | 入出力電力、バッテリ情報 | — |

### Chassis (`/ras-chassis`)

| タブ | 内容 | 操作 |
|---|---|---|
| Overview | ラックシャーシ情報 | Health 変更 (PATCH) |
| Sensors | センサー一覧（温度、湿度、電力等） | センサー値の直接書き換え (PATCH) |
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
| Overview | EventService の設定情報 | テストイベント送信 (POST)：イベントタイプ・重大度・メッセージ・OriginOfCondition を指定 |
| Subscriptions | Webhook サブスクリプション一覧 | 新規作成 (POST)、削除 (DELETE) |

---

## ディレクトリ構成

```
gui/
├── src/
│   ├── app/
│   │   ├── page.tsx              # ダッシュボード
│   │   ├── systems/page.tsx      # Systems (EMU)
│   │   ├── chassis/page.tsx      # Chassis (EMU)
│   │   ├── managers/page.tsx     # Managers (EMU)
│   │   ├── accounts/page.tsx     # AccountService (EMU)
│   │   ├── sessions/page.tsx     # SessionService (EMU)
│   │   ├── events/page.tsx       # EventService (EMU)
│   │   ├── update/page.tsx       # UpdateService (EMU)
│   │   ├── power-equipment/      # Power Equipment (RAS-EMU)
│   │   ├── ras-chassis/          # Chassis (RAS-EMU)
│   │   ├── ras-managers/         # Managers (RAS-EMU)
│   │   └─�� ras-events/           # EventService (RAS-EMU)
│   ├── components/
│   │   ├── AppLayout.tsx         # サイドバー・AppBar レイアウト
│   │   └── ThemeRegistry.tsx     # MUI テーマ設定
│   ├── context/
│   │   └── ServerContext.tsx     # サーバー切替コンテキスト
│   └── lib/
│       └── api.ts                # Redfish API フェッチユーティリティ
└── Dockerfile
```
