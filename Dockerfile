# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- dependencies
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./

# --ignore-scripts, then rebuild the one package that genuinely needs its own.
#
# better-sqlite3 has a root binding.gyp and no install script, which makes npm
# run `node-gyp rebuild` implicitly — it would need a full python3/make/g++
# toolchain to produce a build/Release binary the loader never even looks at:
# lib/binding.js resolves prebuilds/<platform>.node, and the tarball ships
# linuxmusl-x64 and linuxmusl-arm64. So the compile is pure waste, and skipping
# it removes the toolchain entirely.
#
# esbuild (via tsx, used by the operational CLIs) is the only dependency with a
# real postinstall, so it is rebuilt explicitly. sharp's binding.gyp lives under
# src/, not at the package root, so npm never triggers it.
RUN npm ci --ignore-scripts \
 && npm rebuild esbuild \
 && node -e "require('better-sqlite3'); require('@node-rs/argon2')" \
 && node -e "require('esbuild')"

# ----------------------------------------------------------------------- build
FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secret placeholders are needed: every route is force-dynamic, so nothing
# that reads MASTER_KEY / JWT_SECRET / ACME_EMAIL is evaluated at build time.
ENV DISABLE_WORKER=1
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
