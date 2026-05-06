# Radio Calico

A lossless internet radio web player with live metadata, cover art, and song ratings.

## Features

- **Lossless HLS streaming** — 24-bit / 48 kHz audio via hls.js with Safari native HLS fallback
- **Now Playing** — live track metadata (artist, title, album, source quality) polled every 15 seconds
- **Recently Played** — last 5 tracks with ratings
- **Cover art** — fetched automatically from the iTunes Search API
- **Song ratings** — thumbs up / thumbs down per track; one vote per user with the ability to change it; stored in PostgreSQL (prod) or SQLite (dev)
- **Persistent user identity** — IP-based anonymous token set as a 1-year cookie, no login required

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

Set `POSTGRES_PASSWORD=secret` in a `.env` file to override the default password. Set `PORT=8080` to expose nginx on a different host port. `NODE_ENV=production` is set automatically by the compose file; this enables the `Secure` flag on the `rc_uid` cookie and same-origin-only CORS.

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
