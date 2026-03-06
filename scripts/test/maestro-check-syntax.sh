#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk}"

if [[ " ${JAVA_TOOL_OPTIONS:-} " != *" --enable-native-access=ALL-UNNAMED "* ]]; then
  JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --enable-native-access=ALL-UNNAMED"
fi
if [[ " ${JAVA_TOOL_OPTIONS:-} " != *" --sun-misc-unsafe-memory-access=allow "* ]]; then
  JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --sun-misc-unsafe-memory-access=allow"
fi
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS# }"

if ! command -v maestro >/dev/null 2>&1; then
  echo "[maestro-check] maestro not found, run: bash scripts/test/setup-maestro-macos.sh"
  exit 1
fi

for flow in tests/maestro/flows/*.yaml; do
  maestro check-syntax "$flow"
done

echo "[maestro-check] all flow syntax checks passed"
