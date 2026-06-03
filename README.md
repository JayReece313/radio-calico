# Radio Calico

A lossless internet radio web player with live metadata, cover art, and song ratings.

## Features

- **Lossless HLS streaming** — 24-bit / 48 kHz audio via hls.js with Safari native HLS fallback
- **Now Playing** — live track metadata (artist, title, album, source quality) polled every 15 seconds
- **Recently Played** — last 5 tracks with ratings
- **Cover art** — fetched automatically from the iTunes Search API
- **Song ratings** — thumbs up / thumbs down per track; one vote per user with the ability to change it; stored in PostgreSQL (prod) or SQLite (dev)
- **Persistent user identity** — IP-based anonymous token (derived from nginx's `X-Real-IP`, not the spoofable `X-Forwarded-For`) set as a 1-year cookie, no login required

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express 5 |
| Database (prod) | PostgreSQL 17 via pg |
| Database (dev) | SQLite via better-sqlite3 |
| Reverse proxy | nginx (serves statics, proxies `/api/*`) |
| Frontend | Vanilla HTML / CSS / JS (no framework, no build step) |
| HLS playback | hls.js (CDN) |
| Cover art | iTunes Search API |
| Testing | Jest + Supertest + jsdom (39 tests) |
| Container | Docker (multi-stage) + Docker Compose |

## Project Structure

```
server.js               Express entry point
routes/api.js           REST API (token, ratings, users, posts)
db/database.js          Dual-mode DB: pg.Pool (prod) or better-sqlite3 (dev)
nginx.conf              nginx: serves statics, proxies /api/* to app:3000
public/
  index.html            HTML markup
  style.css             All styles
  ratings.js            Pure rating logic and utilities
  app.js                Frontend entry point (HLS, DOM, render)
  RadioCalicoLogoTM.png
tests/
  setup/db.js           In-memory SQLite factory for tests
  backend/              API tests (Supertest)
  frontend/             DOM and utility tests (jsdom)
Dockerfile              Multi-stage build (base → dev / prod-deps → production)
docker-compose.yml      Production: postgres + app + nginx (port 80)
docker-compose.dev.yml  Development with live reload (SQLite, port 3000)
.dockerignore
```

## Getting Started

### Docker (recommended)

**Development** — live reload, SQLite data persisted on host at `db/radiocalico.db`:

```bash
docker compose -f docker-compose.dev.yml up --build
```

**Production** — 3-service stack: PostgreSQL, Express app, nginx on port 80:

```bash
docker compose up --build        # foreground
docker compose up -d --build     # detached
```

Copy `.env.example` to `.env` and set a strong `POSTGRES_PASSWORD` before running. `POSTGRES_PASSWORD` is required — `docker compose up` will fail fast with an error if it is unset, so there is no insecure default to forget. Set `PORT=8080` to expose nginx on a different host port. `NODE_ENV=production` is set automatically by the compose file; this enables same-origin-only CORS. The `rc_uid` cookie's `Secure` flag is derived per request from `X-Forwarded-Proto` (set by nginx), so it is correctly omitted on HTTP and applied on HTTPS without further config. Force it with `COOKIE_SECURE=true` (or disable with `false`); default `auto`.

**CORS:** cross-origin requests are blocked by default. Set `CORS_ORIGIN=https://yourdomain.com` in the app environment if you need to allow a specific external origin.

To inspect the database:
```bash
docker compose exec postgres psql -U radiocalico radiocalico
```

### Without Docker

**Prerequisites:** Node.js 18+

```bash
npm install
npm start        # production-like, port 3000
npm run dev      # auto-restarts on file changes
```

Open `http://localhost:3000`.

## Testing

Run tests on the host (the test suite is not included in the Docker image):

```bash
npm test                 # all 39 tests
npm run test:backend     # API tests only
npm run test:frontend    # DOM and utility tests only
npm run test:security    # npm audit (fails on moderate+ vulnerabilities)
```

Or use the Makefile:

```bash
make test
make test-backend
make test-frontend
make security            # npm audit
make audit-fix           # auto-fix audit vulnerabilities
```

See [README-TESTING.md](README-TESTING.md) for full details on test structure and how to add new tests.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/token` | Get or create persistent user token |
| `GET` | `/api/ratings?song_key=&user_token=` | Fetch rating counts + user's vote |
| `POST` | `/api/ratings` | Submit or change a rating |
| `GET` | `/api/health` | Health check |

## Brand

Colors, typography, and logo usage are defined in `RadioCalico_Style_Guide.txt`. The palette uses Mint (`#D8F2D5`), Forest Green (`#1F4E23`), Teal (`#38A29D`), and Charcoal (`#231F20`) with Montserrat and Open Sans typefaces.

## Improvements to Page Speed

A static audit of `public/`, `index.html`, and `nginx.conf` surfaced the following opportunities. Findings are recorded here as a backlog; no code changes have been applied yet.

### Current state (resources fetched before "ready to play")

| Resource | Size | Source | Notes |
|---|---|---|---|
| `index.html` | 4 KB | `public/` | uncompressed, no cache headers |
| `style.css` | 8 KB | `public/` | uncompressed, no cache headers |
| `app.js` | 11 KB | `public/` | uncompressed, no cache headers, sync `<script>` |
| `ratings.js` | 2 KB | `public/` | same |
| `RadioCalicoLogoTM.png` | 56 KB, 672×672 | `public/` | rendered at 28 px (nav) and 40 px (footer) — ~24× oversized |
| `hls.min.js` | ~110 KB | `cdn.jsdelivr.net/npm/hls.js@latest` | `@latest` defeats long-term CDN caching; sync `<script>` |
| Google Fonts CSS + 2 families | ~50 KB | fonts.googleapis.com | render-blocking; `preconnect` is set |

First paint costs ~250 KB raw, and almost none of it is cached for repeat visits.

### Recommended fixes (ranked by impact ÷ effort)

1. **Enable gzip/brotli + cache headers in `nginx.conf`** *(largest single win)*
   - Text assets currently ship uncompressed. Compression alone cuts roughly 75% off `app.js`, `style.css`, and the Google Fonts CSS. There are also no `Cache-Control` headers, so every navigation re-downloads everything.
   - Example:
     ```nginx
     gzip on;
     gzip_types text/plain text/css application/javascript application/json image/svg+xml;
     gzip_min_length 256;
     gzip_vary on;

     location ~* \.(?:css|js|png|svg|woff2)$ {
         expires 30d;
         add_header Cache-Control "public, max-age=2592000";
     }
     ```

2. **Shrink the logo asset**
   - `RadioCalicoLogoTM.png` is 672×672 for a 28-pixel nav slot and a 40-pixel footer slot.
   - Easiest: replace with an SVG (~2–5 KB, scales perfectly) — saves ~50 KB and looks sharper on retina.
   - Alternative: generate two raster sizes (`logo-56.png` for nav @2×, `logo-80.png` for footer @2×).

3. **Pin `hls.js` and add `defer`**
   - The current tag is `https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js` — synchronous and bound to a moving `@latest` URL, which means a new CDN object on every hls.js release.
   - Recommended (replace `REPLACE_WITH_REAL_HASH` before committing — see one-liner below):
     ```html
     <script defer src="https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js"
             integrity="sha384-REPLACE_WITH_REAL_HASH"
             crossorigin="anonymous"></script>
     <script defer src="/ratings.js"></script>
     <script defer src="/app.js"></script>
     ```
   - **Generate the SRI hash before pasting the snippet** — the placeholder above will cause the browser to block `hls.min.js` (and then `Hls` is undefined when `app.js` calls `Hls.isSupported()`). On macOS/Linux:
     ```bash
     curl -sSL https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js \
       | openssl dgst -sha384 -binary | openssl base64 -A
     ```
     Prepend `sha384-` to the output and paste it into the `integrity` attribute. If you'd rather skip SRI entirely, delete the `integrity` attribute (the pinned version + `crossorigin="anonymous"` is still a meaningful improvement over `@latest`).
   - `defer` also removes a subtle race: `app.js` calls `Hls.isSupported()` synchronously and works today only because the script tag sits at body-end.

4. **Set explicit `width` / `height` on `<img>` tags**
   - Both `#nowArt` and `.footer-logo` lack intrinsic sizes in markup, so the browser reflows when they load (Cumulative Layout Shift hit). One attribute pair on each fixes it.

5. **Enable HTTP/2 in nginx**
   - The listener is currently HTTP/1.1 on port 80. HTTP/2 multiplexes the 6–7 parallel requests (HTML → CSS → font CSS → 2 font files → 2 scripts → logo) over one connection. Requires TLS in practice: `listen 443 ssl http2;` once a certificate is added.

6. **Self-host or preload the two font files**
   - `preconnect` to `fonts.gstatic.com` is set, but the actual WOFF2 URLs aren't known until the Google CSS arrives — that's two RTTs before text renders. Either:
     - Add `<link rel="preload" as="font" type="font/woff2" href="..." crossorigin>` for the specific WOFF2 file used, **or**
     - Self-host both families (~30 KB woff2 each) and serve them with the cache headers from fix #1.
   - **CSP update required when self-hosting.** The current `Content-Security-Policy` in `nginx.conf` restricts `font-src` to `fonts.gstatic.com` only — `'self'` is **not** allowed, so locally-served WOFF2 files would be blocked by the browser. Before this fix can ship, add `'self'` to `font-src` (e.g. `font-src 'self' fonts.gstatic.com`). If the Google Fonts CSS is also pulled in-house, the inline `<link>` tag will then load from `'self'`, which `style-src` already permits — but verify, and if the CSS itself moves to a separate file under `/public`, no further `style-src` change is needed. Only the `font-src` change is mandatory.

### Smaller wins (optional)

- **Inline critical CSS** for the nav and Now-Playing card so the first paint doesn't depend on `style.css`.
- Add `loading="lazy"` to `.footer-logo` (always below the fold).
- Pipeline the first metadata poll in parallel with `GET /api/token` (`Promise.all`) so the Now-Playing card paints one RTT sooner.
- Minify `index.html` in production (it's only 4 KB, so the payoff is small).

### Suggested first PR

Bundling fixes **#1 (nginx gzip + cache)**, **#2 (logo)**, and **#3 (pin hls.js + defer)** into a single PR is ~30 lines of changes total, has no architectural impact, and likely halves transferred bytes and time-to-interactive on repeat visits.
