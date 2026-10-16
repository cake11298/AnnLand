# Ann Land — Happy 21st Birthday · Oct. 8th, 2026

用 three.js 打造的 3D 生日小樂園。

## 玩法
1. 找到樂園裡 8 份會發光的禮物（每份都是一張禮物券）
2. 集滿後的儀式：禮物飛向蛋糕、21 根蠟燭依序點亮、閉眼許願
3. 按住空白鍵（手機：按住按鈕）吹熄蠟燭 → 煙霧、天色轉暗、愛心與「21」「Ann」「10/8」煙火、天燈、生日快樂歌
4. 摩天輪、旋轉木馬靠近按 E 可搭乘

操作：WASD / 方向鍵移動、拖曳轉視角、滾輪縮放；手機使用左下搖桿。

## 秘密地圖：多倫多城市（city.html）
進入畫面右上角「神秘密碼」→ 輸入 `49-6c-6f-76-65-55`（IloveU 的 16 進位）解鎖。解鎖後按鈕會變成「前往城市」。
- 開放世界市中心：9 × 7 條街（Yonge、King、Queen…）、紅綠燈車流、King St 504 路面電車可搭乘
- 6 個城市印章：咖啡館、Yonge-Dundas 大螢幕、ANN 21 招牌、塔頂觀景台、Distillery 麵包店、湖濱碼頭；集滿有湖上煙火
- Shift 跑步、小地圖、白天／黃昏／夜晚切換；進度存在瀏覽器
- 想改印章文字：編輯 `src/game/cityLayout.js` 的 `SPOTS`、`FINALE`

## 開發
```bash
npm install
npm run dev       # 本機開發 http://localhost:5173
npm test          # vitest 單元測試（遊戲邏輯、場景配置）
npm run build     # 產出 dist/
npm run preview   # 預覽 build 結果
```

## 部署
- **GitHub Pages**：`npm run deploy`（會先跑測試與 build，再把 `dist/`（含 index.html 與 city.html）推到 `gh-pages` 分支）。第一次需到 repo Settings → Pages，把 Source 設為 *Deploy from a branch* → `gh-pages` / `(root)`。
- 右下角語音小工具在 `src/voiceAgent.js`（agent-id 與安全說明都在裡面）。
- **Vercel / Netlify**：Build command `npm run build`，Output `dist`。

## 結構
```
src/
  main.js            渲染迴圈、操控、HUD、慶祝流程
  audio.js           Web Audio 音效與生日快樂歌
  game/state.js      純邏輯：禮物、蠟燭、生日倒數（有測試）
  game/layout.js     樂園配置與樹木生成（有測試）
  game/melody.js     旋律資料
  world/world.js     場景：蛋糕、摩天輪、旋轉木馬、大門、禮物、氣球、玩家
  world/effects.js   彩帶、煙火
  secretGate.js      神秘密碼輸入框
  game/secret.js     密碼驗證（有測試）
  game/cityLayout.js 城市街道、建築生成、印章、紅綠燈規則（有測試）
  city/main.js       城市的操控、互動、鏡頭
  city/cityWorld.js  城市場景：大樓、塔、市政廳、大螢幕、湖濱
  city/traffic.js    車流與路面電車
  city/minimap.js    小地圖
tests/               vitest
```

想改禮物內容：編輯 `src/game/state.js` 的 `GIFTS`；搭乘留言在 `RIDE_NOTE`。
