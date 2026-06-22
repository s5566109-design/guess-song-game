const QUESTIONS_PER_ROUND = 10;

const SHEET_URL =
  "https://opensheet.elk.sh/1GFKgz3gFAvxso4Fos6tFADfVJXrzthp1Kh55JqzBhhM/Songs";

let allPlaylistSongs = [];
let gameSongs = [];
let currentIndex = 0;
let controller = null;
let isRevealed = false;

const trackIndex = document.querySelector("#trackIndex");
const trackTotal = document.querySelector("#trackTotal");
const songTitle = document.querySelector("#songTitle");
const artistName = document.querySelector("#artistName");
const coverMask = document.querySelector("#coverMask");
const playBtn = document.querySelector("#playBtn");
const revealBtn = document.querySelector("#revealBtn");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const resetBtn = document.querySelector("#resetBtn");
const mount = document.querySelector("#spotifyMount");
const footerNote = document.querySelector("footer p");
const playlistUrlInput = document.querySelector("#playlistUrl");
const loginBtn = document.querySelector("#loginBtn");
const loadPlaylistBtn = document.querySelector("#loadPlaylistBtn");
const statusText = document.querySelector("#statusText");

function setStatus(message) {
  if (statusText) statusText.textContent = message;
}

function getTrackId(url) {
  if (!url) return null;

  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function getSpotifyUri(url) {
  const trackId = getTrackId(url);
  return trackId ? `spotify:track:${trackId}` : null;
}

async function fetchSongsFromSheet() {
  const response = await fetch(SHEET_URL);

  if (!response.ok) {
    throw new Error("讀取 Google Sheet 題庫失敗，請確認 Sheet 是否公開。");
  }

  const data = await response.json();

  return data
    .map((song) => {
      const spotifyUrl = song["Spotify網址"];
      const uri = getSpotifyUri(spotifyUrl);

      return {
        title: song["歌曲名稱"],
        artist: song["歌手"],
        spotify: spotifyUrl,
        category: song["分類"],
        uri
      };
    })
    .filter((song) => song.title && song.artist && song.uri);
}

function shuffleSongs(list) {
  const copied = [...list];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[randomIndex]] = [copied[randomIndex], copied[i]];
  }

  return copied;
}

function startNewRound() {
  if (allPlaylistSongs.length < QUESTIONS_PER_ROUND) {
    setStatus(`題庫目前只有 ${allPlaylistSongs.length} 首，請至少放 10 首。`);
  }

  gameSongs = shuffleSongs(allPlaylistSongs).slice(
    0,
    Math.min(QUESTIONS_PER_ROUND, allPlaylistSongs.length)
  );

  currentIndex = 0;
  trackTotal.textContent = gameSongs.length;

  if (footerNote) {
    footerNote.textContent = `本輪已從 Google Sheet 題庫隨機抽出 ${gameSongs.length} 首歌`;
  }

  renderQuestion();
}

async function loadPlaylistAndStart() {
  try {
    setStatus("正在讀取 Google Sheet 題庫...");

    allPlaylistSongs = await fetchSongsFromSheet();

    if (!allPlaylistSongs.length) {
      setStatus("題庫沒有可用歌曲，請確認欄位名稱與 Spotify 網址。");
      return;
    }

    setStatus(`已讀取 ${allPlaylistSongs.length} 首歌，開始隨機出題。`);
    startNewRound();
  } catch (error) {
    setStatus(error.message);
  }
}

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const options = {
    width: "100%",
    height: "152",
    uri: "spotify:track:1k0HWr86sW60kK5A5gFsy7"
  };

  IFrameAPI.createController(mount, options, (EmbedController) => {
    controller = EmbedController;

    if (gameSongs.length) {
      renderQuestion();
    }
  });
};

function renderQuestion() {
  if (!gameSongs.length) {
    songTitle.textContent = "尚未建立題目";
    artistName.textContent = "請先讀取 Google Sheet 題庫";
    trackIndex.textContent = "0";
    trackTotal.textContent = "0";
    return;
  }

  const item = gameSongs[currentIndex];

  isRevealed = false;
  trackIndex.textContent = currentIndex + 1;
  songTitle.textContent = "••••••••";
  artistName.textContent = "點擊揭曉歌名與歌手";
  coverMask.classList.remove("is-hidden");
  revealBtn.textContent = "揭曉答案";

  if (controller && item.uri) {
    controller.loadUri(item.uri);
  }
}

function revealAnswer() {
  if (!gameSongs.length) return;

  const item = gameSongs[currentIndex];

  isRevealed = true;
  songTitle.textContent = item.title;
  artistName.textContent = item.artist;
  coverMask.classList.add("is-hidden");
  revealBtn.textContent = "已揭曉";
}

playBtn.addEventListener("click", () => {
  if (controller) controller.resume();
});

loadPlaylistBtn.addEventListener("click", loadPlaylistAndStart);
revealBtn.addEventListener("click", revealAnswer);

prevBtn.addEventListener("click", () => {
  if (!gameSongs.length) return;

  currentIndex =
    (currentIndex - 1 + gameSongs.length) % gameSongs.length;

  renderQuestion();
});

nextBtn.addEventListener("click", () => {
  if (!gameSongs.length) return;

  currentIndex =
    (currentIndex + 1) % gameSongs.length;

  renderQuestion();
});

resetBtn.addEventListener("click", startNewRound);

if (playlistUrlInput) {
  playlistUrlInput.value = "Google Sheet 題庫自動同步";
  playlistUrlInput.disabled = true;
}

if (loginBtn) {
  loginBtn.style.display = "none";
}

if (loadPlaylistBtn) {
  loadPlaylistBtn.textContent = "讀取題庫並開始";
}

setStatus("請按「讀取題庫並開始」開始遊戲。");
