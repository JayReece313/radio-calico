# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Server

- **Start (production-like):** `npm start` → runs `node server.js` on port 3000
- **Start (auto-restart on save):** `npm run dev` → runs `node --watch server.js`
- **Assume the server is already running.** Do not start it unless backend code changed. If a restart is needed, use nohup so the process survives the shell session:
  ```
  pkill -f "node server.js" 2>/dev/null; sleep 1; nohup npm start > /tmp/radiocalico.log 2>&1 & echo "PID: $!"
  ```
- Verify with: `sleep 2 && cat /tmp/radiocalico.log`

There are no tests (the `test` script is a placeholder).

## Architecture

### File structure
```
server.js          Express entry point; serves /public as static, mounts /api
routes/api.js      All API endpoints (token, ratings, users, posts, health)
db/database.js     better-sqlite3 connection + schema init (runs on import)
public/
  index.html       HTML markup only
  style.css        All CSS styles
  app.js           All frontend JavaScript
  RadioCalicoLogoTM.png
```

### Backend
- **Express 5** on port 3000 (env `PORT` overrides).
- **SQLite** via `better-sqlite3` (synchronous API). Schema auto-creates on startup in `db/database.js`. Tables: `users`, `posts`, `song_ratings`.
- `song_ratings` uses `UNIQUE(song_key, user_token)` + `INSERT OR REPLACE` to allow vote-changing atomically.
- User identity: server hashes the client IP with SHA-256 (`radiocalico:<ip>`) and returns it as a 1-year `rc_uid` cookie. If the cookie already exists and is valid, the same token is returned. Frontend reads it via `GET /api/token`.

### Frontend (`public/`)
Split across three files with no build step, no framework. `index.html` is markup only; `style.css` has all styles; `app.js` has all JavaScript.

**HLS playback:** hls.js loaded from CDN; Safari falls back to native HLS. Stream URL is hardcoded as `const STREAM_URL`.

**Metadata polling:** `fetchMetadata()` polls `metadatav2.json` at the same CDN host every 15 seconds. Fields used: `title`, `artist`, `album`, `prev_artist_1`–`prev_artist_5`, `prev_title_1`–`prev_title_5`.

**Ratings flow:**
1. On page load, `GET /api/token` resolves the user token before polling starts.
2. `votedSongs` object is a client-side cache keyed by `songKey(artist, title)` → `"artist||title"`. It mirrors server truth and is used to lock buttons immediately on every render (no async gap).
3. `applyCachedVote(upBtn, downBtn, artist, title)` — the canonical function for applying vote state. Only disables the **selected** button, leaving the other enabled so users can change their vote. Call this instead of manually toggling `disabled`.
4. On submit, `votedSongs` is updated optimistically; on any error, `applyCachedVote` is called (not a raw re-enable) so the cached state is preserved.

**Cover art:** iTunes Search API (`artworkUrl100` → replace `100x100bb` with `600x600bb`). Results are memoized in `artworkCache`.
### STYLE GUIDE
- A text version of the styling guide for the webpage is at /Users/supaa_jarvis/Documents/claude_code/vscode_ClaudeCode/radiocalico/RadioCalico_Style_Guide.txt
- The Radio Calico logo is at /Users/supaa_jarvis/Documents/claude_code/vscode_ClaudeCode/radiocalico/RadioCalicoLogoTM.png

## Brand & Styles

CSS custom properties are defined in `:root` in `index.html`:
| Variable | Hex | Use |
|---|---|---|
| `--mint` | `#D8F2D5` | Page background, accents |
| `--forest` | `#1F4E23` | Headings, primary buttons |
| `--teal` | `#38A29D` | Nav bar, slider thumb, focus rings |
| `--orange` | `#EFA63C` | Call-to-action accents |
| `--charcoal` | `#231F20` | Body text |
| `--cream` | `#F5EADA` | Footer background |

Fonts: **Montserrat** (headings/labels, weights 500/600/700) and **Open Sans** (body, weight 400), loaded from Google Fonts. No local font files.

Logo file: `public/RadioCalicoLogoTM.png` — do not recolor, stretch, or add shadows per brand guide.
