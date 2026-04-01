#!/usr/bin/env bash
set -euo pipefail

bash scripts/test/maestro-check-syntax.sh
bash scripts/test/maestro-preflight.sh

# 加载 Maestro 共享环境（Java PATH / JAVA_HOME / JAVA_TOOL_OPTIONS）
source "$(dirname "$0")/maestro-env.sh"

APP_ID_VALUE="${APP_ID:-}"
WEB_REPORT_FILE="${MAESTRO_WEB_REPORT_FILE:-docs/reports/maestro-web-smoke.xml}"
APK_PATH_VALUE="${ANDROID_APK_PATH:-${MAESTRO_ANDROID_APK_PATH:-}}"
AUTO_INSTALL_APK="${MAESTRO_AUTO_INSTALL_APK:-1}"

detect_apk_from_workspace() {
  local pattern=""
  local apk_file=""
  local candidates=(
    "artifacts/android/*.apk"
    "artifacts/*.apk"
    "dist/build/app/*.apk"
    "dist/build/app-plus/*.apk"
    "unpackage/*.apk"
    "unpackage/release/*.apk"
    "android/app/build/outputs/apk/debug/*.apk"
    "android/app/build/outputs/apk/release/*.apk"
  )

  shopt -s nullglob
  for pattern in "${candidates[@]}"; do
    for apk_file in $pattern; do
      if [[ -f "$apk_file" ]]; then
        printf '%s' "$apk_file"
        shopt -u nullglob
        return 0
      fi
    done
  done
  shopt -u nullglob

  return 1
}

has_ready_device() {
  if ! command -v adb >/dev/null 2>&1; then
    return 1
  fi

  if ! adb get-state >/dev/null 2>&1; then
    return 1
  fi

  return 0
}

detect_app_id_from_device() {
  if ! has_ready_device; then
    return 1
  fi

  local line pkg candidate="" candidate_count=0
  while IFS= read -r line; do
    pkg="${line#package:}"
    case "$pkg" in
      *exam*|*master*|*kaoyan*|*uni*)
        candidate_count=$((candidate_count + 1))
        if [[ -z "$candidate" ]]; then
          candidate="$pkg"
        fi
        ;;
    esac
  done < <(adb shell pm list packages -3 2>/dev/null | tr -d '\r')

  if [[ "$candidate_count" -eq 1 && -n "$candidate" ]]; then
    APP_ID_VALUE="$candidate"
    return 0
  fi

  return 1
}

resolve_app_id_from_apk() {
  local apk_path="$1"
  local app_id=""
  local line=""

  if [[ ! -f "$apk_path" ]]; then
    return 1
  fi

  if command -v apkanalyzer >/dev/null 2>&1; then
    while IFS= read -r line; do
      app_id="$(printf '%s' "$line" | tr -d '\r')"
      break
    done < <(apkanalyzer manifest application-id "$apk_path" 2>/dev/null || true)
  fi

  if [[ -z "$app_id" ]] && command -v aapt >/dev/null 2>&1; then
    while IFS= read -r line; do
      case "$line" in
        "package: name='"*)
          line="${line#package: name='}"
          app_id="${line%%'*}"
          break
          ;;
      esac
    done < <(aapt dump badging "$apk_path" 2>/dev/null || true)
  fi

  if [[ -n "$app_id" ]]; then
    printf '%s' "$app_id"
    return 0
  fi

  return 1
}

install_apk_to_device() {
  local apk_path="$1"

  if [[ ! -f "$apk_path" ]]; then
    echo "[maestro-run] apk not found: $apk_path"
    return 1
  fi

  if ! has_ready_device; then
    echo "[maestro-run] adb device unavailable, skip apk install"
    return 1
  fi

  echo "[maestro-run] installing apk: $apk_path"
  if adb install -r "$apk_path"; then
    echo "[maestro-run] apk install succeeded"
    return 0
  fi

  echo "[maestro-run] retry install with downgrade allowed"
  if adb install -r -d "$apk_path"; then
    echo "[maestro-run] apk install succeeded (downgrade)"
    return 0
  fi

  echo "[maestro-run] apk install failed"
  return 1
}

is_package_installed() {
  local package_name="$1"

  if [[ -z "$package_name" ]]; then
    return 1
  fi

  if ! has_ready_device; then
    return 1
  fi

  local line=""
  while IFS= read -r line; do
    if [[ "$line" == "package:$package_name" ]]; then
      return 0
    fi
  done < <(adb shell pm list packages "$package_name" 2>/dev/null | tr -d '\r')

  return 1
}

if [[ -z "$APK_PATH_VALUE" ]]; then
  AUTO_DETECTED_APK="$(detect_apk_from_workspace || true)"
  if [[ -n "$AUTO_DETECTED_APK" ]]; then
    APK_PATH_VALUE="$AUTO_DETECTED_APK"
    echo "[maestro-run] auto-detected apk path: $APK_PATH_VALUE"
  fi
fi

if [[ -z "$APP_ID_VALUE" ]] && [[ -n "$APK_PATH_VALUE" ]]; then
  APP_ID_FROM_APK="$(resolve_app_id_from_apk "$APK_PATH_VALUE" || true)"
  if [[ -n "$APP_ID_FROM_APK" ]]; then
    APP_ID_VALUE="$APP_ID_FROM_APK"
    echo "[maestro-run] resolved APP_ID from apk: $APP_ID_VALUE"
  else
    echo "[maestro-run] unable to resolve APP_ID from apk metadata"
  fi
fi

if [[ -z "$APP_ID_VALUE" ]] && detect_app_id_from_device; then
  echo "[maestro-run] detected APP_ID from device: $APP_ID_VALUE"
fi

if [[ -n "$APK_PATH_VALUE" ]] && [[ "$AUTO_INSTALL_APK" == "1" ]]; then
  if [[ -n "$APP_ID_VALUE" ]] && is_package_installed "$APP_ID_VALUE"; then
    echo "[maestro-run] package already installed: $APP_ID_VALUE"
  else
    install_apk_to_device "$APK_PATH_VALUE" || true
  fi
fi

if [[ -z "$APP_ID_VALUE" ]] && detect_app_id_from_device; then
  echo "[maestro-run] detected APP_ID from device after install: $APP_ID_VALUE"
fi

if [[ -n "$APP_ID_VALUE" ]] && ! is_package_installed "$APP_ID_VALUE" && [[ -n "$APK_PATH_VALUE" ]] && [[ "$AUTO_INSTALL_APK" == "1" ]]; then
  install_apk_to_device "$APK_PATH_VALUE" || true
fi

if [[ -z "$APP_ID_VALUE" ]]; then
  if [[ "${MAESTRO_REQUIRE_NATIVE:-0}" == "1" ]]; then
    echo "[maestro-run] APP_ID is required when MAESTRO_REQUIRE_NATIVE=1"
    echo "[maestro-run] you can provide APP_ID directly: APP_ID=\"com.exam.master\" npm run test:maestro"
    echo "[maestro-run] or provide apk for auto install: ANDROID_APK_PATH=\"artifacts/android/app-debug.apk\" MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro"
    echo "[maestro-run] checked default apk paths: artifacts/android/*.apk, dist/build/app/*.apk, unpackage/*.apk"
    exit 2
  fi

  echo "[maestro-run] APP_ID missing, running Android H5 fallback flow"

  if ! has_ready_device; then
    if [[ "${MAESTRO_REQUIRE_DEVICE:-0}" == "1" ]]; then
      echo "[maestro-run] no Android device/emulator connected and MAESTRO_REQUIRE_DEVICE=1"
      exit 4
    fi

    echo "[maestro-run] no Android device/emulator connected, skip fallback flow"
    mkdir -p "$(dirname "$WEB_REPORT_FILE")"
    cat >"$WEB_REPORT_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" failures="0" errors="0" skipped="1">
  <testsuite name="maestro-web-h5" tests="1" failures="0" errors="0" skipped="1">
    <testcase classname="maestro" name="10-web-h5-smoke">
      <skipped message="No Android device/emulator connected"/>
    </testcase>
  </testsuite>
</testsuites>
EOF
    cp "$WEB_REPORT_FILE" "docs/reports/maestro-results.xml"
    echo "[maestro-run] native suite skipped (no APP_ID and no device)"
    exit 0
  fi

  SKIP_MAESTRO_SYNTAX_CHECK=1 SKIP_MAESTRO_PREFLIGHT=1 bash scripts/test/run-maestro-web-h5.sh
  if [[ -f "$WEB_REPORT_FILE" ]]; then
    cp "$WEB_REPORT_FILE" "docs/reports/maestro-results.xml"
  fi
  echo "[maestro-run] native suite skipped (no APP_ID)"
  exit 0
fi

if [[ "${MAESTRO_REQUIRE_NATIVE:-0}" == "1" ]] && ! is_package_installed "$APP_ID_VALUE"; then
  echo "[maestro-run] native required but package not installed: $APP_ID_VALUE"
  echo "[maestro-run] provide ANDROID_APK_PATH to auto install or install manually with adb"
  exit 3
fi

FLOW_DIR="tests/maestro/flows"
NATIVE_FLOWS=(
  "$FLOW_DIR/00-smoke.yaml"
  "$FLOW_DIR/01-login-input.yaml"
  "$FLOW_DIR/02-core-practice.yaml"
  "$FLOW_DIR/03-high-risk-tools.yaml"
  "$FLOW_DIR/04-state-recovery.yaml"
)

if [[ "${MAESTRO_RUN_WEB_H5:-0}" == "1" ]]; then
  echo "[maestro-run] MAESTRO_RUN_WEB_H5=1 -> running H5 flow with local dev server"
  SKIP_MAESTRO_SYNTAX_CHECK=1 SKIP_MAESTRO_PREFLIGHT=1 bash scripts/test/run-maestro-web-h5.sh
fi

set +e
maestro test "${NATIVE_FLOWS[@]}" \
  --format JUNIT \
  --output docs/reports/maestro-results.xml \
  --test-output-dir test-results/maestro \
  -e APP_ID="$APP_ID_VALUE" \
  -e E2E_EMAIL="${E2E_EMAIL:-qa@example.com}" \
  -e E2E_PASSWORD="${E2E_PASSWORD:-Passw0rd!}"
RC=$?
set -e

if [[ $RC -ne 0 ]]; then
  echo "[maestro-run] suite failed or blocked (code=$RC)"
  echo "[maestro-run] common blockers: no device, missing Xcode, missing Android SDK"
  exit $RC
fi

echo "[maestro-run] suite passed"
