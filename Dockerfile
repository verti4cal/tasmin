# --- Stage 1: install workspace deps once, shared by both builds ---
# python3/make/g++ are needed to build better-sqlite3's native addon when no
# prebuilt binary matches the image's platform/ABI.
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install

# --- Stage 2: build frontend ---
FROM deps AS web-build
WORKDIR /repo
COPY web ./web
COPY tsconfig.base.json ./
RUN npm run build --workspace web

# --- Stage 3: build backend ---
FROM deps AS server-build
WORKDIR /repo
COPY server ./server
COPY tsconfig.base.json ./
RUN npm run build --workspace server

# --- Stage 4: runtime ---
# git + python3 + PlatformIO stay installed permanently (the firmware
# compiler shells out to them at request time); make/g++ are only needed
# transiently to build better-sqlite3's native addon and are purged after.
# This is the deliberate size tradeoff for bundling the firmware compiler —
# expect an image in the ~1GB+ range, growing further on first build as
# PlatformIO downloads toolchains for whatever env you compile.
FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/app.db
ENV WEB_DIST_PATH=/app/web-dist
ENV TASMOTA_SRC_DIR=/data/tasmota-src
ENV FIRMWARE_OUTPUT_DIR=/data/firmware-builds
ENV PLATFORMIO_CORE_DIR=/data/platformio-core

COPY server/package.json ./package.json
RUN npm install --omit=dev \
  && pip install --break-system-packages --no-cache-dir platformio \
  && apt-get purge -y make g++ && apt-get autoremove -y

COPY --from=server-build /repo/server/dist ./dist
COPY --from=server-build /repo/server/src/infra/db/migrations ./dist/infra/db/migrations
COPY --from=web-build /repo/web/dist ./web-dist

VOLUME ["/data"]
EXPOSE 3000

CMD ["sh", "-c", "node dist/infra/db/migrate.js && node dist/server.js"]
