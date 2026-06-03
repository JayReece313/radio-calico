# Rating-Submit Flow

Sequence diagram for the path a thumbs-up / thumbs-down vote takes from a button click to PostgreSQL and back, including the optimistic-UI cache, the cookie-resolved user token, and the `ON CONFLICT DO UPDATE` upsert.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser<br/>(app.js + ratings.js)
    participant V as votedSongs<br/>(in-memory cache)
    participant N as nginx :80
    participant E as Express :3000<br/>(routes/api.js)
    participant DB as PostgreSQL<br/>(song_ratings)

    Note over B,DB: Page load — token resolution happens once
    B->>N: GET /api/token (cookie: rc_uid?)
    N->>E: proxy + X-Real-IP, X-Forwarded-Proto
    alt rc_uid cookie valid (64-hex)
        E-->>N: 200 { token: existing }
    else no/invalid cookie
        E->>E: sha256("radiocalico:" + X-Real-IP)
        E-->>N: 200 + Set-Cookie: rc_uid=…<br/>(Secure if XFP=https)
    end
    N-->>B: token

    Note over B,DB: User clicks 👍 on the Now-Playing card
    U->>B: click thumbsUp
    B->>B: disable both buttons<br/>(prevent double-vote)
    B->>V: votedSongs[songKey] = 1 (optimistic)
    B->>B: applyRatingUI() — paint voted-up state

    par Server write
        B->>N: POST /api/ratings<br/>{song_key, rating: 1, user_token}
        N->>E: proxy
        E->>DB: INSERT … ON CONFLICT(song_key, user_token)<br/>DO UPDATE SET rating = EXCLUDED.rating
        DB-->>E: ok
        E->>DB: SELECT SUM(up), SUM(down)<br/>WHERE song_key = $1
        DB-->>E: counts
        E-->>N: 201 { thumbs_up, thumbs_down, user_rating: 1 }
        N-->>B: counts
        B->>B: applyRatingUI() — update count badges
    and Failure path (only on error)
        B--xB: catch / data.error
        B->>V: re-read votedSongs[songKey]
        B->>B: applyCachedVote()<br/>(restores last known good state)
    end

    Note over B,DB: 15s later — metadata poll re-renders the card
    B->>N: GET metadatav2.json (CloudFront — not shown)
    Note right of B: renderNowPlaying clones buttons (sheds stale listeners),<br/>then immediately calls applyCachedVote(songKey) from votedSongs<br/>before awaiting fetchRatings — so the 👍 stays locked with no flicker
    B->>N: GET /api/ratings?song_key=&user_token=
    N->>E: proxy
    E->>DB: SELECT counts + user's row
    DB-->>E: { thumbs_up, thumbs_down, user_rating }
    E-->>N: 200
    N-->>B: server truth
    B->>V: hydrate votedSongs from server response
    B->>B: applyRatingUI() — final counts shown
```

## What this diagram is meant to surface

- **The optimistic-UI contract.** `votedSongs` is updated *before* the POST is in flight (step 4), so the UI feels instant. Any error path (the `par … and` failure branch) reverts via `applyCachedVote` reading the cache — never a raw `disabled = false`, so vote-changing across cards still works.
- **Why the metadata-poll re-render doesn't flicker.** When the 15-second poll triggers `renderNowPlaying`, the code clones-and-replaces the buttons to drop stale click handlers, then synchronously calls `applyCachedVote(songKey)` *before* awaiting `fetchRatings`. The "locked 👍" state is restored from cache during the async gap, then `applyRatingUI` overlays server counts when they arrive.
- **`ON CONFLICT DO UPDATE`** is what lets the same `(song_key, user_token)` pair flip from 👍 to 👎 in a single atomic statement — no `SELECT` → `UPDATE`-or-`INSERT` race window.
- **Token resolution happens exactly once per page load**, gated before any rating call (the `(async () => { … })()` block in `app.js`). Every subsequent rating request carries the cached `USER_TOKEN`, so the cookie round-trip isn't repeated.

See also: [`architecture.md`](./architecture.md) for the system-wide component view.
