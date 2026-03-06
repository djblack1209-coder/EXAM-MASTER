#!/usr/bin/env bash
set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "[maestro-setup] Homebrew is required: https://brew.sh"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  brew install openjdk
fi

if ! command -v maestro >/dev/null 2>&1; then
  curl -Ls "https://get.maestro.mobile.dev" | bash
fi

echo "[maestro-setup] add runtime env in current shell:"
echo "export PATH=\"/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH\""
echo "export JAVA_HOME=\"/opt/homebrew/opt/openjdk\""

export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk"

java -version
maestro --version

echo "[maestro-setup] completed"
