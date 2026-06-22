# Spotify Playlist 猜歌遊戲

這版已改成：

Spotify Playlist → 自動抓歌單 → 隨機抽 10 首 → 產生題目

## 設定方式

1. 到 Spotify Developer Dashboard 建立 App
2. 複製 Client ID
3. 開啟 `config.js`
4. 填入：

```js
const SPOTIFY_CLIENT_ID = "你的 Client ID";
const DEFAULT_PLAYLIST_URL = "你的 Spotify 歌單網址";
```

5. 到 Spotify App Settings 加入 Redirect URI：

GitHub Pages 範例：

```txt
https://你的帳號.github.io/guess-song-game/
```

本機測試範例：

```txt
http://127.0.0.1:5500/
```

> Redirect URI 必須和實際網址完全一致，包含最後的 `/`。

## 使用方式

1. 開啟網站
2. 點「連接 Spotify」
3. 登入並授權
4. 回到網站後點「抓歌單並開始」
5. 系統會從歌單隨機抽 10 首

## 注意

- 歌單至少要有 10 首可播放歌曲。
- Spotify Embed 播放會受到瀏覽器、登入狀態、地區與 Spotify 帳號限制影響。
- 不要把 Client Secret 放在前端網站，所以此版本使用 PKCE 登入流程。
