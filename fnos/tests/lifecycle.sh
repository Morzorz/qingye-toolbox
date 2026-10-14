#!/bin/bash
set -eu
export TRIM_APPDEST=/app
export TRIM_PKGVAR=/tmp/qingye-lifecycle/state
export TRIM_PKGHOME=/tmp/qingye-lifecycle/home
export TRIM_PKGTMP=/tmp/qingye-lifecycle/tmp
export TRIM_DATA_SHARE_PATHS=/tmp/qingye-lifecycle/files
export TRIM_TEMP_LOGFILE=/tmp/qingye-lifecycle/error.log
mkdir -p "$TRIM_PKGVAR" "$TRIM_PKGHOME" "$TRIM_PKGTMP" "$TRIM_DATA_SHARE_PATHS"
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" start
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" status
first=$(cat "$TRIM_PKGVAR/qingye.pid")
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" start
[ "$first" = "$(cat "$TRIM_PKGVAR/qingye.pid")" ]
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" stop
set +e
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" status
status=$?
set -e
[ "$status" = 3 ]
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" start
bash "${QINGYE_LIFECYCLE_DIR:-/lifecycle}/main" stop
printf 'PASS fnOS lifecycle: start, ready socket, idempotent start, stop, stopped status, restart\n'
