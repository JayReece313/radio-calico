const STREAM_URL   = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';
const METADATA_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json';

// ── User token (server-assigned, IP-based, stored as cookie) ─────
let USER_TOKEN = null;

const audio    = document.getElementById('radio');
const playBtn  = document.getElementById('playBtn');
const iconPlay = document.getElementById('iconPlay');
const iconPause= document.getElementById('iconPause');
const volSlider= document.getElementById('volume');
const statusEl = document.getElementById('status');

const elapsedEl    = document.getElementById('elapsed');
const recentListEl = document.getElementById('recentList');

let playing = false;
let hlsReady = false;
let elapsedSec = 0;
let elapsedTimer = null;

// ── Set up HLS ──────────────────────────────────────────────────
if (Hls.isSupported()) {
  const hls = new Hls({ enableWorker: true });
  hls.loadSource(STREAM_URL);
  hls.attachMedia(audio);

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    hlsReady = true;
    setStatus('ready');
  });

  hls.on(Hls.Events.ERROR, (_, data) => {
    if (data.fatal) {
      setStatus('error', 'Stream error — retrying…');
      hls.startLoad();
    }
  });
} else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
  // Safari native HLS
  audio.src = STREAM_URL;
  audio.addEventListener('loadedmetadata', () => {
    hlsReady = true;
    setStatus('ready');
  });
  audio.addEventListener('error', () => setStatus('error', 'Stream unavailable'));
} else {
  setStatus('error', 'HLS not supported in this browser');
}

// ── Apply initial volume ─────────────────────────────────────────
audio.volume = parseFloat(volSlider.value);

// ── Play / Pause ─────────────────────────────────────────────────
playBtn.addEventListener('click', () => {
  if (!playing) {
    setStatus('connecting', 'Connecting…');
    audio.play().then(() => {
      playing = true;
      showPause();
      setStatus('live', '● Live');
      startTimer();
    }).catch(() => {
      setStatus('error', 'Playback blocked — tap again');
    });
  } else {
    audio.pause();
    playing = false;
    showPlay();
    setStatus('ready', 'Paused');
    stopTimer();
  }
});

// ── Volume ───────────────────────────────────────────────────────
volSlider.addEventListener('input', () => {
  audio.volume = parseFloat(volSlider.value);
});

// ── Elapsed timer ────────────────────────────────────────────────
function startTimer() {
  elapsedTimer = setInterval(() => {
    elapsedSec++;
    elapsedEl.textContent = formatTime(elapsedSec);
  }, 1000);
}

function stopTimer() {
  clearInterval(elapsedTimer);
  elapsedTimer = null;
}

// ── Ratings ──────────────────────────────────────────────────────
// votedSongs, songKey, applyCachedVote, applyRatingUI, formatTime, esc
// are defined in ratings.js, loaded before this script.

async function fetchRatings(artist, title) {
  const key = songKey(artist, title);
  const res  = await fetch(`/api/ratings?song_key=${encodeURIComponent(key)}&user_token=${encodeURIComponent(USER_TOKEN)}`);
  const data = await res.json();
  // Populate cache from server truth
  if (data.user_rating != null) votedSongs[key] = data.user_rating;
  return data;
}

async function submitRating(artist, title, rating) {
  const res = await fetch('/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_key: songKey(artist, title), rating, user_token: USER_TOKEN }),
  });
  return res.json();
}

// ── Artwork cache & fetcher ──────────────────────────────────────
const artworkCache = {};

async function fetchArtwork(artist, title) {
  const key = `${artist}||${title}`;
  if (key in artworkCache) return artworkCache[key];
  try {
    const term = encodeURIComponent(`${artist} ${title}`);
    const res  = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`);
    const json = await res.json();
    const url  = json.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null;
    artworkCache[key] = url;
    return url;
  } catch {
    artworkCache[key] = null;
    return null;
  }
}

function applyArt(imgEl, url) {
  if (!url) { imgEl.style.display = 'none'; return; }
  imgEl.onload  = () => { imgEl.style.display = ''; };
  imgEl.onerror = () => { imgEl.style.display = 'none'; };
  imgEl.src = url;
}

// ── Metadata polling ─────────────────────────────────────────────
let lastTitle = null;

async function fetchMetadata() {
  try {
    const res  = await fetch(METADATA_URL);
    const data = await res.json();
    renderNowPlaying(data);
    renderRecent(data);
    lastTitle = data.title;
  } catch (e) {
    // silently ignore transient fetch errors
  }
}

async function renderNowPlaying(d) {
  const nowArtEl  = document.getElementById('nowArt');
  const upBtn     = document.getElementById('nowThumbUp');
  const downBtn   = document.getElementById('nowThumbDown');
  const upCount   = document.getElementById('nowUpCount');
  const downCount = document.getElementById('nowDownCount');
  const ratingRow = document.getElementById('nowRatingRow');

  // Update track text directly — no innerHTML wipe needed
  document.getElementById('nowArtist').textContent = d.artist || '—';
  document.getElementById('nowTitle').textContent  = d.title  || '—';
  document.getElementById('nowAlbum').textContent  = d.album  || '';

  // Quality info from metadata
  const srcQ = document.getElementById('sourceQuality');
  if (srcQ) srcQ.textContent = (d.bit_depth && d.sample_rate)
    ? `Source quality: ${d.bit_depth} bit / ${(d.sample_rate / 1000).toFixed(1)} kHz`
    : '';

  // Show rating row, reset counts
  ratingRow.style.display = '';
  upCount.textContent = '0'; downCount.textContent = '0';

  // Clone buttons to remove stale listeners
  const freshUp   = upBtn.cloneNode(true);
  const freshDown = downBtn.cloneNode(true);
  upBtn.replaceWith(freshUp); downBtn.replaceWith(freshDown);

  // Immediately apply cached vote state (no async gap)
  applyCachedVote(freshUp, freshDown, d.artist, d.title);

  async function handleRate(rating) {
    freshUp.disabled = true; freshDown.disabled = true;
    try {
      const data = await submitRating(d.artist, d.title, rating);
      if (data.error) { applyCachedVote(freshUp, freshDown, d.artist, d.title); return; }
      votedSongs[songKey(d.artist, d.title)] = rating;
      applyRatingUI(freshUp, freshDown,
        document.getElementById('nowUpCount'),
        document.getElementById('nowDownCount'), data, d.artist, d.title);
    } catch { applyCachedVote(freshUp, freshDown, d.artist, d.title); }
  }

  freshUp.addEventListener('click',   () => handleRate(1));
  freshDown.addEventListener('click', () => handleRate(-1));

  // Fetch ratings from server (updates counts + populates votedSongs cache)
  try {
    const data = await fetchRatings(d.artist, d.title);
    applyRatingUI(freshUp, freshDown,
      document.getElementById('nowUpCount'),
      document.getElementById('nowDownCount'), data, d.artist, d.title);
  } catch { /* ignore */ }

  // Fetch artwork
  const url = await fetchArtwork(d.artist || '', d.title || '');
  applyArt(nowArtEl, url);
}

async function renderRecent(d) {
  const tracks = [];
  for (let i = 1; i <= 5; i++) {
    const artist = d[`prev_artist_${i}`];
    const title  = d[`prev_title_${i}`];
    if (artist || title) tracks.push({ artist, title });
  }
  if (!tracks.length) {
    recentListEl.innerHTML = '<li style="padding:12px 20px;font-size:0.875rem;color:#bbb">No history yet</li>';
    return;
  }
  recentListEl.innerHTML = tracks.map((t, i) => `
    <li>
      <span class="recent-combined">${esc(t.artist || '—')} — ${esc(t.title || '—')}</span>
      <div class="recent-rating">
        <button class="recent-rate-btn" data-idx="${i}" data-vote="1"  aria-label="Thumbs up">👍 <span class="r-up">0</span></button>
        <button class="recent-rate-btn" data-idx="${i}" data-vote="-1" aria-label="Thumbs down">👎 <span class="r-down">0</span></button>
      </div>
    </li>
  `).join('');

  tracks.forEach(async (t, i) => {
    // Ratings
    const upBtn   = recentListEl.querySelector(`.recent-rate-btn[data-idx="${i}"][data-vote="1"]`);
    const downBtn = recentListEl.querySelector(`.recent-rate-btn[data-idx="${i}"][data-vote="-1"]`);
    if (!upBtn || !downBtn) return;

    function applyRecent(data) {
      upBtn.querySelector('.r-up').textContent     = data.thumbs_up;
      downBtn.querySelector('.r-down').textContent = data.thumbs_down;
      applyCachedVote(upBtn, downBtn, t.artist, t.title);
    }

    // Immediately lock if already rated (no async gap)
    applyCachedVote(upBtn, downBtn, t.artist, t.title);

    // Wire handlers before awaiting fetchRatings
    async function handleRecentRate(rating) {
      upBtn.disabled = true; downBtn.disabled = true;
      try {
        const data = await submitRating(t.artist, t.title, rating);
        if (data.error) { applyCachedVote(upBtn, downBtn, t.artist, t.title); return; }
        votedSongs[songKey(t.artist, t.title)] = rating;
        applyRecent(data);
      } catch { applyCachedVote(upBtn, downBtn, t.artist, t.title); }
    }

    upBtn.addEventListener('click',   () => handleRecentRate(1));
    downBtn.addEventListener('click', () => handleRecentRate(-1));

    try { applyRecent(await fetchRatings(t.artist, t.title)); } catch { /* ignore */ }
  });
}

// Resolve user token from server, then start metadata polling
(async () => {
  try {
    const res  = await fetch('/api/token');
    const data = await res.json();
    USER_TOKEN = data.token;
  } catch {
    // Fallback: random token for this session only
    USER_TOKEN = crypto.randomUUID();
  }
  fetchMetadata();
  setInterval(fetchMetadata, 15000);
})();

// ── Helpers ──────────────────────────────────────────────────────
function showPlay() {
  iconPlay.style.display  = '';
  iconPause.style.display = 'none';
  playBtn.setAttribute('aria-label', 'Play');
}

function showPause() {
  iconPlay.style.display  = 'none';
  iconPause.style.display = '';
  playBtn.setAttribute('aria-label', 'Pause');
}

function setStatus(state, text) {
  statusEl.className = 'status';
  if (state === 'live')       { statusEl.classList.add('live');  }
  if (state === 'error')      { statusEl.classList.add('error'); }
  statusEl.textContent = text || { ready: 'Ready', connecting: 'Connecting…' }[state] || '';
}
