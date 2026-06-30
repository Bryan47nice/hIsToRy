# CLAUDE.md — 同學會 App 版本更新看板（交接脈絡）

> 這份檔案是給接手的 Claude（含 Claude Code）讀的。讀完即可無縫接手，**不需要使用者重講需求**。

## 這個專案是什麼

讓「需要知道同學會 App 有什麼功能更新或修了什麼 Bug」的**跨部門非技術同事**，用一個固定網址就能一目了然。資料來源是 Jira（HRTX）。產出是一個**前端加密**的單頁 `index.html`，托管在 GitHub Pages，同事輸入密碼即可看，每次發版更新後重整就是最新。

- GitHub repo：`Bryan47nice/hIsToRy`（Public）
- Pages 網址：`https://bryan47nice.github.io/hIsToRy/`
- 本機工作資料夾：本資料夾（`release-board/`）

## 檔案結構

```
release-board/
├─ build.js            產生器（讀 releases/*.json → 產出加密 index.html）
├─ releases/
│   └─ 2.63.0.json     每個版本一個 JSON（新增版本就多一個檔）
├─ index.html          產出的加密成品（上傳到 GitHub 的就是這個）
├─ README.md           使用約定與部署步驟（對使用者）
└─ CLAUDE.md           本檔
```

## 內容規則（重要，別改壞）

- **新功能**只收 Jira `issuetype = Epic`；**Bug 修復**只收 `issuetype = Bug`。
- **不收** `Task`（RD 實作子單／埋點）與 `Stage-bug`（測試階段修掉、用戶沒遇到過）——避免雜訊。
- **白話來源（混合）**：Jira 單描述開頭若有 `【對外說明】...` → 用人工版、標 `✍️ 人工`；否則由 AI 從描述濃縮兩句、標 `🤖 AI摘要`。
- **後端區塊**：貼了 `release-note-backend` label 的單，進「⚙️ 後端／設定調整（免更新 App）」區塊，依完成日排序。

## Jira（HRTX）撈單方式

- Site：`cmoneyteam.atlassian.net`，專案 key `HRTX`。
- 版本（fixVersion）命名帶平台前綴：`iOS_2.63.0`、`Android_2.63.0`。平台由前綴判定。
- 撈某版單：JQL `project = HRTX AND fixVersion in ("iOS_x.y.z","Android_x.y.z")`，再依 `issuetype` 分類。
- 單號連結：`https://cmoneyteam.atlassian.net/browse/{KEY}`。

## releases/*.json 結構

照 `releases/2.63.0.json` 的格式：`version`、`platforms`、`releaseDate`、`summary`、`features[]`（key/title/platform/plain/impact/ai）、`bugfixes[]`（key/title/platform/before/after/ai）、`backend[]`。

## 建置與部署

```bash
BOARD_PASSWORD=<密碼> node build.js     # 產生 index.html
```

- 加密：AES-256-GCM + PBKDF2-SHA256（20 萬次迭代）。密碼**只在建置時用環境變數注入，絕不寫進任何檔案／不提交到 repo**（repo 是 Public，只能放密文）。
- 密碼由使用者口頭提供，不要寫死在程式或本檔。
- 部署：把產出的 `index.html` commit 到 repo 根目錄；GitHub Pages 由 `main` / root 發佈。

## 更新流程（發新版時）

1. 使用者說「`x.y.z` 發了，更新看板」。
2. 撈該版 Jira 單 → 取 Epic/Bug → 產生白話與影響 → 新增 `releases/x.y.z.json`。
3. `BOARD_PASSWORD=<密碼> node build.js` 重產 `index.html`。
4. `git add -A && git commit && git push`（Claude Code 可直接做這步，使用者就不用手動上傳了）。

## 版號規則（Semantic Versioning）

- X 主版號：核心邏輯／架構大改（如改雲端、UI 框架翻新）。
- Y 次版號：新增模組（如新增區塊、新增分析）。
- Z 修訂號：細修（CSS、文字、小優化）。
- 每次交付要同步更新：README.md 的「版本迭代記錄」。

## 目前狀態（接手時）

- 已完成 **v1.1.0**：在 v1.0.0（三區塊看板＋Jira 串接＋前端加密）基礎上，新增「版本收合（最新展開其餘收合）」與「密碼顯示切換」。
- `index.html` 已用使用者提供的密碼產好並驗證（解密 OK、錯誤密碼被擋）。
- **待辦**：把目前的 `index.html`（v1.1.0）commit + push 到 `Bryan47nice/hIsToRy`，覆蓋 repo 上 v1.0.0 那版。repo 目前可能只有 index.html，建議把 `build.js`、`releases/`、`README.md`、`CLAUDE.md` 一併提交，方便日後自動化。

## 使用者的協作偏好

採「先對齊規格、再開發」的三步工作流：需求 →(1) 診斷＋架構提案後停下問 OK →(2) 使用者確認 →(3) 才全量交付完整程式碼＋commit 紀錄。交付多檔時，每個檔案的程式碼與其 commit 紀錄綁在同一段。回覆精簡。
