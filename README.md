# Radio Calico

A lossless internet radio web player with live metadata, cover art, and song ratings.

## Features

- **Lossless HLS streaming** — 24-bit / 48 kHz audio via hls.js with Safari native HLS fallback
- **Now Playing** — live track metadata (artist, title, album, source quality) polled every 15 seconds
- **Recently Played** — last 5 tracks with ratings
- **Cover art** — fetched automatically from the iTunes Search API
- **Song ratings** — thumbs up / thumbs down per track, stored in SQLite; one vote per user with the ability to change it
- **Persistent user identity** — IP-based anonymous token set as a 1-year cookie, no login required

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express 5 |
| Database | SQLite via better-sqlite3 |
| Frontend | Vanilla HTML / CSS / JS (no framework, no build step) |
| HLS playback | hls.js (CDN) |
| Cover art | iTunes Search API |
| Testing | Jest + Supertest + jsdom (39 tests) |
| Container | Docker (multi-stage) + Docker Compose |

## Project Structure

```
server.js               Express entry point
routes/api.js           REST API (token, ratings, users, posts)
db/database.js          SQLite connection and schema
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
docker-compose.yml      Production deployment
docker-compose.dev.yml  Development with live reload
.dockerignore
```

## Getting Started

### Docker (recommended)

**Development** — live reload, SQLite data persisted on host at `db/radiocalico.db`:

```bash
docker compose -f docker-compose.dev.yml up --build
```

**Production** — minimal image (~120 MB), SQLite data in a named Docker volume:

```bash
docker compose up --build        # foreground
docker compose up -d --build     # detached
```

Set `PORT=8080` (or any port) in a `.env` file alongside the compose file to change the host port; the container always listens on 3000 internally.

To inspect the database in either mode:
```bash
docker compose exec app sh
# inside: sqlite3 db/radiocalico.db
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
