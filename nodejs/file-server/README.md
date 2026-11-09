# File Server

以 Vue 3 與本地 `taiwan.css` 介面管理指定資料夾，支援瀏覽、新增與刪除資料夾、下載、批次上傳及同名覆寫、刪除檔案。

## 啟動

在專案根目錄執行：

```powershell
node .\nodejs\file-server "C:\要分享的資料夾"
```

預設使用 `http://localhost:3000`，並監聽 `0.0.0.0`。其他裝置請輸入主機的區域網路 IP（例如 `http://192.168.1.10:3000`）。可用 `PORT` 指定連接埠。

第一次執行或相依套件尚未安裝時，先在此資料夾執行 `npm install`。

## API

- `GET /api/files?directory=<相對資料夾>`：列出目前資料夾
- `GET /api/download?directory=<相對資料夾>&name=<檔名>`：下載檔案
- `POST /api/upload`：`multipart/form-data`，以 `directory` 指定相對資料夾，並重複附加 `files` 欄位批次上傳；同名檔案會覆寫
- `POST /api/folders`：JSON `{ "directory": "<父資料夾>", "name": "<新資料夾名稱>" }`
- `DELETE /api/folders`：JSON `{ "directory": "<父資料夾>", "name": "<資料夾名稱>" }`；會遞迴刪除資料夾及其中的所有內容
- `DELETE /api/files`：JSON `{ "directory": "<相對資料夾>", "name": "<檔名>" }`

單檔沒有程式設定的大小上限，每次最多上傳 20 個檔案；實際大小受暫存空間、目標磁碟與檔案系統限制。上傳使用磁碟暫存，不會將整個檔案載入記憶體。伺服器只允許操作啟動時指定資料夾內的一般檔案與資料夾，會拒絕符號連結。此服務沒有登入或存取金鑰；同一網路內的使用者都能管理檔案，請只在可信任的區域網路中使用。
