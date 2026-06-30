# 同學會 App 版本更新看板

讓「需要知道 App 有什麼功能更新或修了什麼 Bug」的跨部門同事，一個網址就能一目了然。
資料來源為 Jira（HRTX），每次發版重新產生後同事重整即看到最新。

---

## 這個資料夾有什麼

```
release-board/
├─ build.js              產生器（讀 releases/ → 產出加密的 index.html）
├─ releases/
│   └─ 2.63.0.json       每個版本一個 JSON（新增版本就多一個檔）
├─ index.html            產生出來的成品（加密過，這個才上傳到 GitHub）
└─ README.md             本說明
```

---

## 看板長相

每個版本一個區塊，最新的排最上面，內含三個區塊：

- **✨ 新功能**：只收 Jira 的 **Epic**。顯示 功能名、可點的 Jira 單號、白話說明、影響。
- **🐛 Bug 修復**：只收 Jira 的 **Bug**。顯示 問題名、Jira 單號、原本狀況、修好後。
- **⚙️ 後端／設定調整（免更新 App）**：收貼了 `release-note-backend` label 的單，依完成日排序。

> Task（RD 實作子單、埋點）與 Stage-bug（測試階段修掉、用戶沒遇到過）**不收進對外看板**，避免雜訊。

---

## 白話從哪來（混合規則）

- Jira 單描述開頭若有 `【對外說明】...`，看板**優先用這段人工版**，標 ✍️ 人工。
- 沒有的話，由 AI 從描述自動濃縮兩句，標 🤖 AI摘要（提醒可校稿）。

想讓某張單的對外說明 100% 受控，就在該單描述最前面加一行，例如：

```
【對外說明】爆料頁多了「主動式 ETF」分頁，可集中看 ETF 相關爆料。
```

---

## 怎麼更新（發新版時）

口頭觸發：發完版跟我（Claude）說一句即可——

> 「`2.64.0` 發了，更新看板」

我會自動：撈該版 Jira 單 → 分類 → 產生 `releases/2.64.0.json` → 重跑 `build.js` → 給你新的 `index.html`，你上傳覆蓋即可。

手動自己跑也可以：

1. 在 `releases/` 新增一個 `版號.json`（照 `2.63.0.json` 格式）

2. 終端機執行（把密碼換成你的）：

   ```bash
   BOARD_PASSWORD=你的密碼 node build.js
   ```

3. 把產生出的 `index.html` 上傳到 GitHub 覆蓋舊的

> ⚠️ 密碼只在「產生時」用來加密，**不要寫進任何檔案**。`build.js` 從環境變數讀，repo 裡只有看不懂的密文。

---

## 第一次部署到 GitHub Pages（純網頁操作，免指令）

1. 建好 repo（`Bryan47nice/hIsToRy`，Public，Add README = On）。

2. repo 頁面 → **Add file → Upload files** → 把 `index.html` 拖進去 → **Commit changes**。

3. **Settings → Pages** → Source 選 **Deploy from a branch** → 分支 `main`、資料夾 `/ (root)` → **Save**。

4. 等約 1 分鐘，頁面網址會是： `https://bryan47nice.github.io/hIsToRy/`
   把這個網址發給同事加書籤即可，輸入密碼後就能看。

> 之後每次更新，只要重複步驟 2（上傳新的 `index.html` 覆蓋）即可，同事網址不變、重整就最新。

---

## 安全性說明

- 採前端 AES-256-GCM 加密（PBKDF2-SHA256，20 萬次迭代），一組共用密碼。
- 擋得住「拿到連結的路人」與「意外外流」；但密文會下載到瀏覽器，**非軍規級**，理論上可離線暴力破解。
- 適合「內部版本摘要」這類敏感度。若日後需要真正的帳號登入權限，可升級到 Cloudflare Access 或 Confluence。

---

## 版本迭代記錄

### v1.1.1（2026-06-30）

1. 修正密碼輸入框跑版：登入頁（gate）的樣式區塊缺少 `box-sizing:border-box`，導致 `#pw` 加上左右 padding 後寬度超出卡片、輸入框外溢、眼睛切換鈕看起來懸在中間。已補上 reset，輸入框收齊卡片內、與「進入」按鈕等寬。
   - 注意：此為 `build.js` 的修正；要讓線上生效須用密碼重新 `BOARD_PASSWORD=… node build.js` 產出 `index.html` 再推上去。

### v1.1.0（2026-06-30）

1. 新增版本收合功能：每個版本區塊可點標題展開／收合，最新版預設展開、其餘預設收合，含箭頭動畫。

2. 密碼輸入框新增顯示／隱藏切換（眼睛 icon）。

3. 版本標頭加上「N 新功能 · N Bug」迷你摘要，收合狀態下也能快速掃描。

4. 自動化上傳採方案 A：發版時由 Claude 透過已登入的瀏覽器自動上傳 commit，無需手動拖檔。

### v1.0.0（2026-06-30）

1. 初版上線：版本更新看板，含「新功能 / Bug 修復 / 後端調整」三區塊。

2. 資料來源串 Jira（HRTX），以 `fixVersion` 撈單、依 `issuetype` 自動分類（Epic→新功能、Bug→Bug 修復）。

3. 白話採混合策略：`【對外說明】` 人工優先，否則 AI 自動摘要並標記。

4. 前端 AES 加密保護，可部署於 GitHub Pages。

5. 首版內容為 App v2.63.0（4 新功能、8 Bug 修復）。
