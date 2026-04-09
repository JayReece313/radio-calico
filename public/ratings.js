// ── Ratings state & pure logic ────────────────────────────────────
// Loaded as a plain <script> in the browser; exported for Jest via
// the module.exports guard at the bottom.

const votedSongs = {};

function songKey(artist, title) {
  return `${artist}||${title}`;
}

// Apply voted state from cache immediately (synchronous — no async gap).
// Only the selected button is disabled; the other stays enabled to allow changing.
function applyCachedVote(upBtn, downBtn, artist, title) {
  const vote = votedSongs[songKey(artist, title)];
  upBtn.disabled = false; downBtn.disabled = false;
  upBtn.classList.remove('voted-up', 'voted-down');
  downBtn.classList.remove('voted-up', 'voted-down');
  if (vote === 1)  { upBtn.classList.add('voted-up');     upBtn.disabled = true; }
  if (vote === -1) { downBtn.classList.add('voted-down'); downBtn.disabled = true; }
}

function applyRatingUI(upBtn, downBtn, upCount, downCount, data, artist, title) {
  upCount.textContent   = data.thumbs_up;
  downCount.textContent = data.thumbs_down;
  applyCachedVote(upBtn, downBtn, artist, title);
}

// ── Utilities ─────────────────────────────────────────────────────
function formatTime(s) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm  = String(m).padStart(2, '0');
  const ss  = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Export for Node.js / Jest; no-op in the browser (no module object)
if (typeof module !== 'undefined') {
  module.exports = { votedSongs, songKey, applyCachedVote, applyRatingUI, formatTime, esc };
}
