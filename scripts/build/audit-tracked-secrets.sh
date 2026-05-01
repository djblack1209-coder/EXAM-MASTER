#!/usr/bin/env bash
set -euo pipefail

PATTERN='(sk-[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AKID[0-9A-Za-z]{16,}|AIza[0-9A-Za-z_-]{30,}|hf_[A-Za-z0-9]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|laf_[A-Za-z0-9]{20,}|BSAT[0-9A-Za-z_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
AUDIT_FILE=$(mktemp "${TMPDIR:-/tmp}/exam-master-secret-audit.XXXXXX")
trap 'rm -f "$AUDIT_FILE"' EXIT

set +e
git grep -nE "$PATTERN" >"$AUDIT_FILE"
grep_status=$?
set -e

if [[ "$grep_status" -eq 0 ]]; then
  echo "[secret-audit] potential secrets found in tracked files"
  sed -E \
    -e 's/sk-[A-Za-z0-9_-]{8,}/sk-***REDACTED***/g' \
    -e 's/github_pat_[A-Za-z0-9_]{8,}/github_pat_***REDACTED***/g' \
    -e 's/gh[pousr]_[A-Za-z0-9_]{8,}/gh*_***REDACTED***/g' \
    -e 's/AKIA[0-9A-Z]{8,}/AKIA***REDACTED***/g' \
    -e 's/AKID[0-9A-Za-z]{8,}/AKID***REDACTED***/g' \
    -e 's/AIza[0-9A-Za-z_-]{8,}/AIza***REDACTED***/g' \
    -e 's/hf_[A-Za-z0-9]{8,}/hf_***REDACTED***/g' \
    -e 's/xox[baprs]-[0-9A-Za-z-]{8,}/xox*-***REDACTED***/g' \
    -e 's/laf_[A-Za-z0-9]{8,}/laf_***REDACTED***/g' \
    -e 's/BSAT[0-9A-Za-z_\-]{8,}/BSAT***REDACTED***/g' \
    "$AUDIT_FILE"
  exit 1
fi

if [[ "$grep_status" -ne 1 ]]; then
  echo "[secret-audit] git grep failed with exit code ${grep_status}" >&2
  exit "$grep_status"
fi

echo "[secret-audit] no tracked secret patterns found"
