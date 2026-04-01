#!/usr/bin/env bash
set -euo pipefail

# 加载 Maestro 共享环境（Java PATH / JAVA_HOME / JAVA_TOOL_OPTIONS）
source "$(dirname "$0")/maestro-env.sh"

if ! command -v maestro >/dev/null 2>&1; then
  echo "[maestro-check] maestro not found, run: bash scripts/test/setup-maestro-macos.sh"
  exit 1
fi

for flow in tests/maestro/flows/*.yaml; do
  maestro check-syntax "$flow"
done

echo "[maestro-check] all flow syntax checks passed"
