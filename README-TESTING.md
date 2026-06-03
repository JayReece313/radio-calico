# Testing Guide

Radio Calico uses [Jest](https://jestjs.io/) for all tests — both backend API tests (via [Supertest](https://github.com/ladjs/supertest)) and frontend logic tests (via [jsdom](https://github.com/jsdom/jsdom)).

## Running Tests

```bash
# Run all tests
npm test

# Backend only
npm run test:backend

# Frontend only
npm run test:frontend

# Security scan (fails on moderate+ vulnerabilities)
npm run test:security
```

Or via the Makefile (`make help` lists all targets):

```bash
make test
make test-backend
make test-frontend
make security
make audit-fix    # auto-fix where possible
```

## Test Structure

```
tests/
  setup/
    db.js                  In-memory SQLite factory used by backend tests
  backend/
    ratings.test.js        /api/ratings GET and POST endpoint tests
    token.test.js          /api/token and /api/health endpoint tests
  frontend/
    utils.test.js          Pure utility functions (songKey, formatTime, esc)
    ratings.test.js        DOM-based rating button behaviour (applyCachedVote, applyRatingUI)
```

## What Is Covered

### Backend (Supertest + in-memory SQLite)

**`tests/backend/ratings.test.js`** — 12 tests
- `GET /api/ratings` returns zero counts for unrated songs
- `GET /api/ratings` returns correct counts and the requesting user's vote
- `POST /api/ratings` creates thumbs-up and thumbs-down votes
- `POST /api/ratings` replaces an existing vote without doubling counts (vote-changing)
- `POST /api/ratings` accumulates votes from multiple users correctly
- `POST /api/ratings` rejects invalid ratings (`0`, missing fields)

**`tests/backend/token.test.js`** — 5 tests
- `GET /api/token` returns a 64-character hex token
- `GET /api/token` sets the `rc_uid` cookie
- `GET /api/token` returns the same token when a valid cookie is provided
- `GET /api/token` issues a new token when the cookie is invalid
- `GET /api/health` returns `{ status: 'ok' }`

### Frontend (jsdom)

**`tests/frontend/utils.test.js`** — 13 tests
- `songKey` joins artist and title with `||`
- `formatTime` formats seconds into `mm:ss` and `h:mm:ss`
- `esc` HTML-escapes `&`, `<`, `>`, and `"`

**`tests/frontend/ratings.test.js`** — 9 tests
- `applyCachedVote` with no cached vote leaves both buttons enabled
- `applyCachedVote` with a thumbs-up vote disables only the up button and applies `voted-up`
- `applyCachedVote` with a thumbs-down vote disables only the down button and applies `voted-down`
- `applyCachedVote` clears stale CSS classes on re-render
- `applyRatingUI` updates count text and delegates to `applyCachedVote`

## How the Backend Tests Work

Each backend test file mocks the database module before any other code runs:

```js
jest.mock('../../db/database', () => {
  const { createTestDb } = require('../setup/db');
  return createTestDb(); // fresh in-memory SQLite
});
```

`createTestDb()` (in `tests/setup/db.js`) creates a `:memory:` SQLite database with the same schema as production. The `song_ratings` table is wiped in `beforeEach` so tests are isolated:

```js
beforeEach(() => {
  db.prepare('DELETE FROM song_ratings').run();
});
```

`server.js` only calls `app.listen()` when run directly (`require.main === module`), so Supertest can import the app without binding a port.

## How the Frontend Tests Work

Frontend tests run in a simulated browser environment provided by jsdom. Each test file that needs the DOM declares this at the top:

```js
/**
 * @jest-environment jsdom
 */
```

The testable functions (`votedSongs`, `songKey`, `applyCachedVote`, etc.) live in `public/ratings.js`, which exports via a Node.js guard:

```js
if (typeof module !== 'undefined') {
  module.exports = { votedSongs, songKey, applyCachedVote, applyRatingUI, formatTime, esc };
}
```

This means the file works as a plain `<script>` in the browser and as a `require()`-able module in Jest.

The `votedSongs` cache is a shared mutable object. Tests reset it in `beforeEach`:

```js
beforeEach(() => {
  Object.keys(votedSongs).forEach(k => delete votedSongs[k]);
});
```

## Adding New Tests

**New backend route test:** add to `tests/backend/`, include the `jest.mock('../../db/database', ...)` block, and use `supertest` against the exported `app`.

**New frontend logic test:** add the function to `public/ratings.js` and its export, then write the test in `tests/frontend/`. Add `/** @jest-environment jsdom */` if DOM access is needed.
