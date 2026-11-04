FROM docker.m.daocloud.io/library/node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

ENV DEBIAN_FRONTEND=noninteractive
RUN rm -f /etc/apt/apt.conf.d/docker-clean
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get -o Acquire::Retries=5 update \
 && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      ca-certificates ffmpeg \
      libreoffice-writer libreoffice-calc libreoffice-impress \
      fontconfig fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY src ./src
COPY fnos/server.mjs fnos/local-mcp.mjs ./fnos/
COPY fnos/web ./fnos/web
COPY assets ./assets
COPY docker ./docker
COPY LICENSE THIRD-PARTY-NOTICES.md ./

RUN mkdir -p /data/state /data/files /data/home /input /output

ENV NODE_ENV=production \
    QINGYE_STATE=/data/state \
    QINGYE_SHARE=/data/files \
    QINGYE_DEFAULT_OUTPUT=/output \
    QINGYE_ROOTS=/input:/output:/data/files \
    QINGYE_DATA_DIR=/data/state \
    QINGYE_FFMPEG=/usr/bin/ffmpeg \
    QINGYE_SOFFICE=/usr/bin/soffice \
    HOME=/data/home \
    TMPDIR=/tmp \
    SAL_USE_VCLPLUGIN=svp \
    OOO_DISABLE_RECOVERY=1

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "docker/server.mjs"]
