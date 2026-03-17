#!/usr/bin/env bash
set -euo pipefail

REPORT_FILE="${MAESTRO_PREFLIGHT_REPORT:-docs/reports/maestro-preflight.md}"
RUN_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"

mkdir -p "$(dirname "$REPORT_FILE")"

ADB_OK="no"
DEVICE_BLOCK="adb unavailable"
THIRD_PARTY_COUNT=0
CANDIDATE_PACKAGES="(none)"

if command -v adb >/dev/null 2>&1; then
  ADB_OK="yes"
  DEVICE_BLOCK="$(adb devices -l || true)"

  THIRD_PARTY_RAW="$(adb shell pm list packages -3 2>/dev/null | tr -d '\r' || true)"
  if [[ -n "$THIRD_PARTY_RAW" ]]; then
    THIRD_PARTY_COUNT="$(printf '%s\n' "$THIRD_PARTY_RAW" | wc -l | tr -d ' ')"
    CANDIDATE_PACKAGES="$(printf '%s\n' "$THIRD_PARTY_RAW" | grep -Ei 'exam|master|kaoyan|uni' || true)"
    if [[ -z "$CANDIDATE_PACKAGES" ]]; then
      CANDIDATE_PACKAGES="(none)"
    fi
  fi
fi

cat >"$REPORT_FILE" <<EOF
# Maestro Preflight

- Generated at: ${RUN_AT}
- adb available: ${ADB_OK}

## Connected Devices

\`\`\`text
${DEVICE_BLOCK}
\`\`\`

## Third-party Packages

- Count: ${THIRD_PARTY_COUNT}

\`\`\`text
${CANDIDATE_PACKAGES}
\`\`\`

## Heuristic

- Candidate keywords: exam / master / kaoyan / uni
EOF

echo "[maestro-preflight] report written: $REPORT_FILE"
