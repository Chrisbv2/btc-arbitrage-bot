# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Install native build tools for better-sqlite3 (requires node-gyp on Alpine).
# Railway root directory is set to /backend, so all paths are relative to that.
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Layer-cache deps separately from source
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Strip dev deps; keeps only runtime node_modules in the layer
RUN npm prune --production

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Non-root user (principle of least privilege)
RUN addgroup -S arb && adduser -S arb -G arb

WORKDIR /app

# Copy compiled output and pruned production deps from builder
COPY --from=builder --chown=arb:arb /app/dist         ./dist
COPY --from=builder --chown=arb:arb /app/node_modules ./node_modules
COPY --from=builder --chown=arb:arb /app/package.json ./package.json

# Persistent data directory for SQLite — mount a volume here in production
RUN mkdir -p /app/data && chown -R arb:arb /app/data

USER arb

EXPOSE 3001

ENV NODE_ENV=production

# DB defaults to /app/data/arb.db (derived from __dirname in dist/index.js).
# Override with DB_PATH env var to use a mounted volume path.

# wget ships with BusyBox on Alpine; no curl needed
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/status || exit 1

CMD ["node", "dist/index.js"]
