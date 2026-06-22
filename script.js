const QUESTIONS_PER_ROUND = 10;
const TOKEN_STORAGE_KEY = 'spotify_guess_song_token';
const CODE_VERIFIER_STORAGE_KEY = 'spotify_guess_song_code_verifier';

let allPlaylistSongs = [];
let gameSongs = [];
let currentIndex = 0;
let controller = null;
let spotifyApi = null;
let isRevealed = false;

const trackIndex = document.querySelector('#trackIndex');
const trackTotal = document.querySelector('#trackTotal');
const songTitle = document.querySelector('#songTitle');
const artistName = document.querySelector('#artistName');
const coverMask = document.querySelector('#coverMask');
const playBtn = document.querySelector('#playBtn');
const revealBtn = document.querySelector('#revealBtn');
const prevBtn = document.querySelector('#prevBtn');
const nextBtn = document.querySelector('#nextBtn');
const resetBtn = document.querySelector('#resetBtn');
const mount = document.querySelector('#spotifyMount');
const footerNote = document.querySelector('footer p');
const playlistUrlInput = document.querySelector('#playlistUrl');
const loginBtn = document.querySelector('#loginBtn');
const loadPlaylistBtn = document.querySelector('#loadPlaylistBtn');
const statusText = document.querySelector('#statusText');

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function getStoredToken() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  const token = JSON.parse(raw);
  if (!token.access_token || Date.now() > token.expires_at) return null;
  return token.access_token;
}

function saveToken(tokenData) {
  const expiresInMs = (tokenData.expires_in || 3600) * 1000;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
    access_token: tokenData.access_token,
    expires_at: Date.now() + expiresInMs - 60000
  }));
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomString(length = 64) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, value => possible[value % possible.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

async function loginSpotify() {
  if (!SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID.includes('PASTE_')) {
    setStatus('請先到 config.js 填入 Spotify Client ID。');
    return;
  }

  const codeVerifier = randomString();
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  localStorage.setItem(CODE_VERIFIER_STORAGE_KEY, codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: 'playlist-read-private playlist-read-collaborative',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  const codeVerifier = localStorage.getItem(CODE_VERIFIER_STORAGE_KEY);
  if (!codeVerifier) {
    setStatus('找不到登入驗證資料，請重新連接 Spotify。');
    return;
  }

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    setStatus('Spotify 登入失敗，請確認 Redirect URI 是否和後台完全一致。');
    return;
  }

  saveToken(await response.json());
  localStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);
  window.history.replaceState({}, document.title, getRedirectUri());
  setStatus('Spotify 已連接，可以抓歌單開始遊戲。');
}

function extractPlaylistId(input) {
  const text = input.trim();
  if (!text) return '';

  const uriMatch = text.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  const urlMatch = text.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[a-zA-Z0-9]{20,}$/.test(text)) return text;
  return '';
}

async function spotifyFetch(url) {
  const token = getStoredToken();
  if (!token) throw new Error('請先連接 Spotify。');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    throw new Error('Spotify 登入已過期，請重新連接 Spotify。');
  }

  if (!response.ok) {
    throw new Error('抓取歌單失敗，請確認歌單權限與網址是否正確。');
  }

  return response.json();
}

async function fetchPlaylistTracks(playlistId) {
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,uri,artists(name),is_playable,type))`;
  const tracks = [];

  while (url) {
    const data = await spotifyFetch(url);
    data.items.forEach(item => {
      const track = item.track;
      if (!track || track.type !== 'track' || !track.id || track.is_playable === false) return;
      tracks.push({
        title: track.name,
        artist: track.artists.map(artist => artist.name).join('、'),
        uri: track.uri
      });
    });
    url = data.next;
  }

  return tracks;
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
    setStatus(`這份歌單目前可用歌曲只有 ${allPlaylistSongs.length} 首，請至少放 10 首。`);
  }

  gameSongs = shuffleSongs(allPlaylistSongs).slice(0, Math.min(QUESTIONS_PER_ROUND, allPlaylistSongs.length));
  currentIndex = 0;
  trackTotal.textContent = gameSongs.length;

  if (footerNote) footerNote.textContent = `本輪已從 Spotify 歌單隨機抽出 ${gameSongs.length} 首歌`;
  renderQuestion();
}

async function loadPlaylistAndStart() {
  try {
    const playlistId = extractPlaylistId(playlistUrlInput.value || DEFAULT_PLAYLIST_URL || '');
    if (!playlistId) {
      setStatus('請貼上正確的 Spotify Playlist 網址。');
      return;
    }

    setStatus('正在抓取 Spotify 歌單...');
    allPlaylistSongs = await fetchPlaylistTracks(playlistId);
    setStatus(`已抓到 ${allPlaylistSongs.length} 首可用歌曲，開始隨機出題。`);
    startNewRound();
  } catch (error) {
    setStatus(error.message);
  }
}

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const options = { width: '100%', height: '152', uri: 'spotify:track:1k0HWr86sW60kK5A5gFsy7' };
  IFrameAPI.createController(mount, options, (EmbedController) => {
    controller = EmbedController;
  });
};

function renderQuestion() {
  if (!gameSongs.length) {
    songTitle.textContent = '尚未建立題目';
    artistName.textContent = '請先連接 Spotify 並抓取歌單';
    trackIndex.textContent = '0';
    trackTotal.textContent = '0';
    return;
  }

  const item = gameSongs[currentIndex];
  isRevealed = false;
  trackIndex.textContent = currentIndex + 1;
  songTitle.textContent = '••••••••';
  artistName.textContent = '點擊揭曉歌名與歌手';
  coverMask.classList.remove('is-hidden');
  revealBtn.textContent = '揭曉答案';

  if (controller) controller.loadUri(item.uri);
}

function revealAnswer() {
  if (!gameSongs.length) return;
  const item = gameSongs[currentIndex];
  isRevealed = true;
  songTitle.textContent = item.title;
  artistName.textContent = item.artist;
  coverMask.classList.add('is-hidden');
  revealBtn.textContent = '已揭曉';
}

playBtn.addEventListener('click', () => {
  if (controller) controller.resume();
});
loginBtn.addEventListener('click', loginSpotify);
loadPlaylistBtn.addEventListener('click', loadPlaylistAndStart);
revealBtn.addEventListener('click', revealAnswer);
prevBtn.addEventListener('click', () => {
  if (!gameSongs.length) return;
  currentIndex = (currentIndex - 1 + gameSongs.length) % gameSongs.length;
  renderQuestion();
});
nextBtn.addEventListener('click', () => {
  if (!gameSongs.length) return;
  currentIndex = (currentIndex + 1) % gameSongs.length;
  renderQuestion();
});
resetBtn.addEventListener('click', startNewRound);

if (DEFAULT_PLAYLIST_URL && !DEFAULT_PLAYLIST_URL.includes('PASTE_')) {
  playlistUrlInput.value = DEFAULT_PLAYLIST_URL;
}

handleSpotifyCallback();
if (getStoredToken()) setStatus('Spotify 已連接，可以抓歌單開始遊戲。');
