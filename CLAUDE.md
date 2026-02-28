# ReFile

## 專案概述

檔案虛擬化 CLI + 自架雲端空間。把本地大檔案上傳到自己的 server，本地只留 JSON pointer，需要時再 pull 回來。

## 架構

```
refile/
├── src/              # CLI (commander)
│   ├── commands/     # push / pull / status / init
│   ├── backends/     # self-hosted / http-upload / s3 / duk
│   ├── core/         # hasher, file-walker, refile-format
│   └── config/       # types + config loader
├── server/           # 自架檔案空間 (Express)
│   └── src/
│       ├── index.ts  # /upload, /f/:hash/:filename, /health
│       └── storage.ts # SHA256 dedup, 磁碟存儲
└── workers/          # (legacy) Cloudflare Workers — 已棄用
```

## 核心流程

```
push: 檔案 → SHA256 hash → 上傳 server → 寫 .refile pointer → 刪原檔
pull: 讀 pointer → 下載 → hash 驗證 → 還原檔案 + metadata → 刪 pointer
```

## 虛擬副檔名

| MIME | 副檔名 |
|------|--------|
| video/* | .revid |
| audio/* | .remusic |
| image/* | .repic |
| 其他 | .refile |

## Server

- Express + multer, 存檔案到 `data/files/`, metadata 到 `data/meta/`
- SHA256 hash dedup — 同檔案不重複存
- 12 字元 short hash 做 URL ID
- Bearer token auth（`API_KEY` 環境變數）
- 最大 500MB per file
- 部署：用 cloudpipe

## 部署（CloudPipe）

已部署到 CloudPipe，公網可用：
- **URL**: `https://refile.isnowfriend.com`
- **Port**: 4010
- **buildCommand**: `cd server && npm install --include=dev && npm run build`
- **entryFile**: `server/dist/index.js`
- **healthEndpoint**: `/health`
- **.env** 放在 `cloudpipe/projects/refile/.env`（不是 server/ 裡）

注意：CloudPipe build 時 `npm install` 預設不裝 devDependencies，要加 `--include=dev` 才有 `tsc`。

## 跑法

```bash
# 本地開發
cd server && API_KEY=your-key npm run dev

# 部署（push 到 GitHub 自動觸發，或手動）
# CloudPipe dashboard: http://localhost:8787/_admin

# CLI
refile init          # 選 Self-hosted, 填 https://refile.isnowfriend.com
refile push ./files  # 上傳 + 虛擬化
refile pull ./files  # 拉回還原
refile status        # 看空間節省統計
```

## 整合

- **MemoryGuy**: 已整合 refile 模組在 `src/main/services/refile/`，UI 可直接用 self-hosted backend 做磁碟虛擬化

## 未來方向

### v2: 儲存優化
- 影片轉碼 (H.265/AV1) — 省 40-60%
- 圖片轉 WebP/AVIF — 省 30%
- Block-level dedup — 相似檔案切塊去重
- 透明壓縮層 — 文字/程式碼類檔案上傳時壓縮，下載時解壓
- 冷熱分層 — 常用放 SSD，久沒用搬便宜儲存

### v3: 商業化
- 對外提供便宜雲端空間服務
- 手機 app 整合（取代 Google Photos/iCloud 爆空間問題）
- 用量計費 + 訂閱制

## 注意事項

- `workers/` 是舊的 Cloudflare Workers 架構，已被 `server/` 取代
- refile CLI 和 MemoryGuy 裡的 refile 模組是各自獨立的 copy，改一邊要記得同步另一邊
- Server 的 `data/` 目錄在 .gitignore 裡，不進 repo
