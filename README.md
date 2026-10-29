# 分享本本 (PWA)

安全密碼與資料管理 PWA — 純前端，資料只儲存在本地瀏覽器，支援離線使用。

## 部署到 GitHub Pages

1. 在 GitHub 建立新 repo，把本資料夾所有檔案推上去。
2. 進入 repo **Settings → Pages → Build and deployment**，Source 選 **GitHub Actions**。
3. 推送到 `main` 分支會自動觸發 `.github/workflows/deploy.yml` 部署。
4. 部署完成後，網址為 `https://<你的使用者名稱>.github.io/<repo名稱>/`。

## 本地預覽

```bash
npx serve .
# 或
python3 -m http.server 8000
```

開啟 `http://localhost:8000`，用瀏覽器「安裝到桌面」即可當作 App 使用。

## 檔案結構

- `index.html` — 主頁面（Alpine.js + Tailwind CDN + Phosphor Icons）
- `app.js` — 所有應用邏輯
- `styles.css` — 自訂樣式（含浮動 + 按鈕）
- `manifest.json` — PWA 資訊
- `sw.js` — Service Worker（離線快取）
- `icons/` — 各尺寸圖示
- `.github/workflows/deploy.yml` — GitHub Pages 自動部署

## 隱私

所有資料儲存在瀏覽器 `localStorage`，不上傳任何伺服器。
