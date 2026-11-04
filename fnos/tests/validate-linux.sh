#!/bin/sh
set -eu
# Run from the project root after building the payload. Nothing is installed on the NAS.
root=$(pwd)
mkdir -p artifacts/fnos-linux
chmod 0777 artifacts/fnos-linux
: "${QINGYE_FIXTURES:?Set QINGYE_FIXTURES to the generated Office fixture directory}"
docker run --rm --platform linux/amd64 --network none --user 1000:1000 \
 --tmpfs /app:rw,mode=1777 \
 -v "$root/fnos/build/payload:/payload:ro" \
 -v "$root/fnos:/test-fnos:ro" -v "$root/src:/test-src:ro" -v "$root/tests:/test-fixtures:ro" \
 -v "$QINGYE_FIXTURES:/fixtures:ro" -v "$root/artifacts/fnos-linux:/results" \
 -e QINGYE_FFMPEG=/app/runtime/bin/ffmpeg -e QINGYE_SOFFICE=/app/runtime/bin/soffice \
 -e QINGYE_DATA_DIR=/tmp/qingye-test-settings \
 docker.m.daocloud.io/library/node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 \
 sh -c 'set -eu
 # 用工作区当前的引擎源码，不要用 payload 里缓存的旧副本，否则会验证到过期的 src。
 cp -R /test-src /app/src
 mkdir /app/fnos
 cp -R /test-fnos/server.mjs /test-fnos/local-mcp.mjs /test-fnos/web-entry.mjs /test-fnos/web /test-fnos/tests /test-fnos/package /app/fnos/
 cp /payload/package.json /app/package.json
 ln -s /payload/runtime /app/runtime
 ln -s /payload/node_modules /app/node_modules
 ln -s /payload/assets /app/assets
 cp -R /test-fixtures /app/tests
 /app/runtime/bin/node /app/fnos/tests/linux-smoke.mjs
 /app/runtime/bin/node /app/fnos/tests/server.test.mjs
 QINGYE_LIFECYCLE_DIR=/app/fnos/package/cmd bash /app/fnos/tests/lifecycle.sh'
