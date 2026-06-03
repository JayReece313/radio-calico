# System Architecture

End-to-end view of the Radio Calico runtime: browser, the nginx + Express + PostgreSQL stack inside Docker Compose, and the external services the browser talks to directly.

```mermaid
flowchart LR
    subgraph Browser["Browser (Client)"]
        UI["index.html + style.css"]
        APP["app.js<br/>(playback, polling, ratings)"]
        RJS["ratings.js<br/>(pure rating logic)"]
        HLSJS["hls.js<br/>(HLS player + worker)"]
        AUDIO["&lt;audio&gt; element"]
    end

    subgraph External["External services"]
        CF["CloudFront CDN<br/>HLS segments + metadatav2.json"]
        ITUNES["iTunes Search API<br/>(cover art)"]
        GFONTS["Google Fonts<br/>(Montserrat, Open Sans)"]
        JSD["jsDelivr CDN<br/>(hls.js library)"]
    end

    subgraph Stack["Docker Compose stack"]
        direction TB
        subgraph N["nginx :80 (public edge)"]
            STATIC["Static files (public/)"]
            HDR["Security headers<br/>CSP, X-Frame, Referrer-Policy"]
            PROXY["Reverse proxy<br/>/api/* → app:3000"]
        end

        subgraph A["Express app :3000<br/>(trust proxy: 1)"]
            ROUTES["routes/api.js<br/>/api/token, /api/ratings,<br/>/api/users, /api/posts, /api/health"]
            COOKIE["rc_uid cookie<br/>Secure=auto, HttpOnly, SameSite=Strict<br/>IP from X-Real-IP"]
            DBLAYER["db/database.js<br/>pg.Pool ↔ better-sqlite3 adapter"]
        end

        subgraph DB["PostgreSQL 17"]
            TABLES[("users<br/>posts<br/>song_ratings")]
        end

        VOL[("pg-data volume")]
    end

    UI --> APP
    UI --> RJS
    APP --> HLSJS
    HLSJS --> AUDIO

    UI -. "fonts CSS" .-> GFONTS
    UI -. "hls.min.js" .-> JSD
    HLSJS == "HLS stream<br/>(audio segments)" ==> CF
    APP == "metadata poll<br/>(every 15s)" ==> CF
    APP -- "artwork lookup" --> ITUNES
    APP == "/api/* fetch" ==> N

    N --> STATIC
    N --> HDR
    PROXY -- "X-Real-IP<br/>X-Forwarded-Proto<br/>X-Forwarded-For" --> A
    A --> COOKIE
    ROUTES --> DBLAYER
    DBLAYER -- "DATABASE_URL<br/>(prod: pg, dev: sqlite file)" --> DB
    DB --> VOL
```

## Things the diagram is encoding

- **Two independent CloudFront flows.** The audio stream (handled by `hls.js`, ~24-bit / 48 kHz HLS segments) and the metadata polling (every 15 s, plain JSON) hit the same CDN host but are completely separate from the API request flow that goes through nginx.
- **iTunes runs browser-side, not server-side.** Cover-art lookups never touch the Express app — the browser calls `itunes.apple.com` directly and memoizes results in `artworkCache`.
- **`trust proxy: 1`** is the joint Express + nginx contract that makes `req.secure` (drives cookie `Secure`) and `req.ip` correct behind nginx. `X-Real-IP` is what the token-IP derivation actually reads because the leftmost `X-Forwarded-For` entry is client-spoofable.
- **DB layer is dual-mode.** Same `await db.query(...)` API; under the hood `db/database.js` picks `pg.Pool` when `DATABASE_URL` is set, otherwise a `better-sqlite3` adapter (dev / bare-metal only — `better-sqlite3` is stripped from the production image).
- **The `pg-data` volume** is what makes the PostgreSQL container's data survive `docker compose down`; SQLite in dev uses a host bind-mount at `db/radiocalico.db` instead.

See also: [`rating-flow.md`](./rating-flow.md) for the per-request sequence behind a rating submission.
