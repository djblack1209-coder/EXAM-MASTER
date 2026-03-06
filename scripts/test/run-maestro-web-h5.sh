#!/usr/bin/env bash
set -euo pipefail

if [[ "${SKIP_MAESTRO_SYNTAX_CHECK:-0}" != "1" ]]; then
  bash scripts/test/maestro-check-syntax.sh
fi

if [[ "${SKIP_MAESTRO_PREFLIGHT:-0}" != "1" ]]; then
  bash scripts/test/maestro-preflight.sh
fi

export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk}"

if [[ " ${JAVA_TOOL_OPTIONS:-} " != *" --enable-native-access=ALL-UNNAMED "* ]]; then
  JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --enable-native-access=ALL-UNNAMED"
fi
if [[ " ${JAVA_TOOL_OPTIONS:-} " != *" --sun-misc-unsafe-memory-access=allow "* ]]; then
  JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --sun-misc-unsafe-memory-access=allow"
fi
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS# }"

BASE_URL_VALUE="${BASE_URL:-http://10.0.2.2:5173}"
H5_HOST_VALUE="${H5_HOST:-0.0.0.0}"
H5_PORT_VALUE="${H5_PORT:-5173}"
BOOT_WAIT_SECONDS="${H5_BOOT_WAIT_SECONDS:-15}"
LOG_FILE="${MAESTRO_H5_LOG:-/tmp/exam-master-h5.log}"
WEB_REPORT_FILE="${MAESTRO_WEB_REPORT_FILE:-docs/reports/maestro-web-smoke.xml}"
WEB_RESULT_DIR="${MAESTRO_WEB_RESULT_DIR:-test-results/maestro-web}"

npm run dev:h5 -- --host "$H5_HOST_VALUE" --port "$H5_PORT_VALUE" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

sleep "$BOOT_WAIT_SECONDS"

maestro test tests/maestro/flows/10-web-h5-smoke.yaml \
  --format JUNIT \
  --output "$WEB_REPORT_FILE" \
  --test-output-dir "$WEB_RESULT_DIR" \
  -e BASE_URL="$BASE_URL_VALUE"

echo "[maestro-web-h5] flow passed"
