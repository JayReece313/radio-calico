# ─── Stage 1: base ─────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Build tools for better-sqlite3 native compilation (dev stage + tests only;
# production uses pg which has no native bindings)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./

# Install all deps (dev included) — compiles better-sqlite3 native binary here
RUN npm ci

# ─── Stage 2: dev ──────────────────────────────────────────────────────────
FROM base AS dev

# Source code is bind-mounted at runtime — no COPY needed
# node_modules with compiled binaries are inherited from base

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Stage 3: prod-deps ────────────────────────────────────────────────────
FROM base AS prod-deps

# Strip devDependencies (jest, supertest, jest-environment-jsdom)
RUN npm prune --omit=dev

# ─── Stage 4: production ───────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy only pruned node_modules — no build tools needed in the final image
# better-sqlite3 is a devDependency and is absent here (stripped by npm prune).
# Production uses pg (no native bindings). Do not change the base image to
# node:20-slim (glibc) — if better-sqlite3 is ever added back as a prod dep,
# the .node binary compiled on musl (alpine) would segfault on glibc.
COPY --from=prod-deps /app/node_modules ./node_modules

COPY server.js ./
COPY routes/   ./routes/
COPY db/database.js ./db/
COPY public/   ./public/
COPY package.json package-lock.json ./

# Ensure the db/ directory exists so Docker can mount the named volume into it
RUN mkdir -p db

EXPOSE 3000
CMD ["node", "server.js"]
