# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- dependencies
# No build toolchain: better-sqlite3 bundles linuxmusl-{x64,arm64} prebuilds in
# its tarball and declares no install script, and @node-rs/argon2 publishes
# musl napi binaries. Adding python3/make/g++ here would cost minutes and be
# used by nothing.
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ----------------------------------------------------------------------- build
FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders so the build can evaluate modules that read these at import time.
# They never reach the runtime image; real values are injected as env vars.
ENV MASTER_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    JWT_SECRET=build-time-placeholder-not-used-at-runtime-ok \
    ACME_EMAIL=build@invalid \
    DISABLE_WORKER=1
RUN npm run build

# --------------------------------------------------------------------- runtime
FROM node:26-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini wget \
 && addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts tsconfig.json ./
# src and scripts ship too: the operational CLIs (admin:reset, aws:check,
# openapi:check) run through tsx against the TypeScript sources.
COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R app:app /app/data
USER app

EXPOSE 3000
ENV NODE_ENV=production \
    APP_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    SQLITE_PATH=/app/data/local-cert.db

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null || exit 1

# tini reaps the children the ACME worker spawns and forwards signals.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "next", "start"]
