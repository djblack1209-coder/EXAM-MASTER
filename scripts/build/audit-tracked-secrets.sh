#!/usr/bin/env bash
set -euo pipefail

PATTERN='ghp_[A-Za-z0-9]{20,}|AKID[0-9A-Za-z]{16,}|laf_[A-Za-z0-9]{20,}|BSAT[0-9A-Za-z_\-]{10,}'

if git grep -nE "$PATTERN" >/tmp/exam-master-secret-audit.txt; then
  echo "[secret-audit] potential secrets found in tracked files"
  cat /tmp/exam-master-secret-audit.txt
  exit 1
fi

echo "[secret-audit] no tracked secret patterns found"
