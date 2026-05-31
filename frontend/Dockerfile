# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Railway root directory is set to /frontend, so all paths are relative to that.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN addgroup -S web && adduser -S web -G web

WORKDIR /app

COPY --from=builder --chown=web:web /app/dist ./dist

USER web

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npx", "--yes", "serve", "-s", "dist", "-l", "3000"]
