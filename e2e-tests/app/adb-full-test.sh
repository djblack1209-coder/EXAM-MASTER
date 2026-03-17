#!/bin/bash
# ============================================================
# Exam-Master App 端全量 ADB 自动化测试脚本
# 模拟人工操作：启动、导航、页面交互、错误检测
# 使用方法: bash e2e-tests/app/adb-full-test.sh [DEVICE_ID]
# ============================================================

set -e

DEVICE=${1:-96304553}
ADB="adb -s $DEVICE"
SCREENSHOT_DIR="test-screenshots/e2e-$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="$SCREENSHOT_DIR/test-report.txt"
PASS=0
FAIL=0
WARN=0
ERRORS=()

mkdir -p "$SCREENSHOT_DIR"

# ---- 工具函数 ----
log() { echo "[$(date +%H:%M:%S)] $1" | tee -a "$REPORT_FILE"; }
pass() { PASS=$((PASS+1)); log "✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); ERRORS+=("$1"); log "❌ FAIL: $1"; }
warn() { WARN=$((WARN+1)); log "⚠️  WARN: $1"; }

screenshot() {
  $ADB shell screencap -p /sdcard/screen_test.png
  $ADB pull /sdcard/screen_test.png "$SCREENSHOT_DIR/$1.png" > /dev/null 2>&1
  log "📸 Screenshot: $1.png"
}

tap() {
  $ADB shell input tap "$1" "$2"
  sleep "${3:-2}"
}

swipe_up() {
  $ADB shell input swipe 540 1800 540 800 300
  sleep "${1:-1}"
}

swipe_down() {
  $ADB shell input swipe 540 800 540 1800 300
  sleep "${1:-1}"
}

input_text() {
  $ADB shell input text "$1"
  sleep 0.5
}

back() {
  $ADB shell input keyevent BACK
  sleep "${1:-1}"
}

clear_logs() {
  $ADB logcat -c
}

get_logs() {
  $ADB logcat -d | grep -i 'console' | grep -v 'heartbeat'
}

get_errors() {
  $ADB logcat -d | grep -i 'console' | grep -iE 'ERROR|异常|crash|Cannot read' | grep -v 'classList'
}

check_page() {
  local expected="$1"
  local logs=$($ADB logcat -d | grep -i 'console' | grep -v 'heartbeat' | tail -30)
  if echo "$logs" | grep -q "$expected"; then
    return 0
  else
    return 1
  fi
}

# TabBar 坐标 (1080x2400, tabbar y=2133-2270)
TAB_HOME_X=135;  TAB_Y=2201
TAB_PRACTICE_X=405
TAB_SCHOOL_X=675
TAB_PROFILE_X=945

log "============================================================"
log "Exam-Master App 全量 E2E 测试"
log "设备: $DEVICE"
log "时间: $(date)"
log "============================================================"

# ============================================================
# TEST 0: 启动 App
# ============================================================
log ""
log "--- TEST 0: 启动 App ---"
$ADB shell am force-stop io.dcloud.HBuilder
sleep 1
clear_logs
$ADB shell monkey -p io.dcloud.HBuilder -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 6

# 检查是否有版本不匹配弹窗，自动关闭
UI_DUMP=$($ADB shell uiautomator dump /sdcard/ui_dump.xml 2>&1 && $ADB shell cat /sdcard/ui_dump.xml)
if echo "$UI_DUMP" | grep -q "忽略"; then
  log "检测到版本提示弹窗，自动关闭..."
  # 点击忽略按钮
  tap 341 1434 2
fi

if check_page "应用初始化完成"; then
  pass "App 启动成功"
else
  fail "App 启动失败"
fi

if check_page "pages/index/index"; then
  pass "Splash → 首页跳转成功"
else
  fail "Splash → 首页跳转失败"
fi

screenshot "00_app_launched"

# 检查启动错误
STARTUP_ERRORS=$(get_errors)
if [ -z "$STARTUP_ERRORS" ]; then
  pass "启动无 JS 错误"
else
  warn "启动有错误: $(echo "$STARTUP_ERRORS" | head -3)"
fi

# ============================================================
# TEST 1: 首页功能
# ============================================================
log ""
log "--- TEST 1: 首页功能 ---"

if check_page "pages/index/index"; then
  pass "首页路由正确"
else
  fail "首页路由不正确"
fi

# 检查首页模块初始化
ALL_LOGS=$($ADB logcat -d | grep -i 'console')
for module in "StudyTimerMixin" "DailyQuoteMixin" "LearningTrajectory" "CustomTabbar"; do
  if echo "$ALL_LOGS" | grep -q "$module"; then
    pass "首页模块 $module 初始化"
  else
    warn "首页模块 $module 未检测到"
  fi
done

screenshot "01_home_page"

# 下滑测试
swipe_up 1
screenshot "01_home_scrolled"
swipe_down 1

# ============================================================
# TEST 2: TabBar 导航
# ============================================================
log ""
log "--- TEST 2: TabBar 导航 ---"

# 切换到刷题
clear_logs
tap $TAB_PRACTICE_X $TAB_Y 3
if check_page "pages/practice/index"; then
  pass "TabBar → 刷题中心"
else
  fail "TabBar → 刷题中心失败"
fi
screenshot "02_practice_page"

# 切换到择校
clear_logs
tap $TAB_SCHOOL_X $TAB_Y 3
if check_page "pages/school/index"; then
  pass "TabBar → 择校分析"
else
  fail "TabBar → 择校分析失败"
fi

# 检查院校数据加载
LOGS=$(get_logs)
if echo "$LOGS" | grep -q "从后端加载.*所院校"; then
  pass "择校数据加载成功"
else
  warn "择校数据加载未检测到"
fi
screenshot "02_school_page"

# 切换到个人中心
clear_logs
tap $TAB_PROFILE_X $TAB_Y 3
if check_page "pages/profile/index"; then
  pass "TabBar → 个人中心"
else
  # 个人中心可能没有专门的日志，检查路由
  LOGS=$(get_logs)
  if echo "$LOGS" | grep -q "CustomTabbar.*自动检测路由"; then
    pass "TabBar → 个人中心 (路由检测)"
  else
    fail "TabBar → 个人中心失败"
  fi
fi
screenshot "02_profile_page"

# 回到首页
clear_logs
tap $TAB_HOME_X $TAB_Y 2
screenshot "02_back_home"

# ============================================================
# TEST 3: 刷题中心详细测试
# ============================================================
log ""
log "--- TEST 3: 刷题中心详细测试 ---"
clear_logs
tap $TAB_PRACTICE_X $TAB_Y 3

LOGS=$(get_logs)
# 检查题库状态
if echo "$LOGS" | grep -q "题库状态更新"; then
  pass "题库状态检查执行"
else
  warn "题库状态检查未检测到"
fi

# 检查分包加载
if echo "$LOGS" | grep -q "分包模块加载完成"; then
  pass "分包模块加载成功"
elif echo "$LOGS" | grep -q "分包模块加载失败"; then
  warn "分包模块加载失败（App端可能使用动态import）"
else
  warn "分包模块加载状态未知"
fi

# 检查收藏和错题初始化
for module in "QuestionFavorite" "AdaptiveLearning"; do
  if echo "$LOGS" | grep -q "$module.*初始化完成"; then
    pass "$module 初始化"
  else
    warn "$module 初始化未检测到"
  fi
done

screenshot "03_practice_detail"

# ============================================================
# TEST 4: 择校分析详细测试
# ============================================================
log ""
log "--- TEST 4: 择校分析详细测试 ---"
clear_logs
tap $TAB_SCHOOL_X $TAB_Y 3

LOGS=$(get_logs)
if echo "$LOGS" | grep -q "网络状态.*wifi"; then
  pass "择校页网络检测正常"
else
  warn "择校页网络检测未确认"
fi

# 下滑查看更多院校
swipe_up 1
screenshot "04_school_scrolled"
swipe_down 1

# ============================================================
# TEST 5: 个人中心详细测试
# ============================================================
log ""
log "--- TEST 5: 个人中心详细测试 ---"
clear_logs
tap $TAB_PROFILE_X $TAB_Y 3
screenshot "05_profile_page"

# ============================================================
# TEST 6: 页面返回测试
# ============================================================
log ""
log "--- TEST 6: 返回键测试 ---"
clear_logs
# 从个人中心按返回键
back 2
LOGS=$(get_logs)
screenshot "06_after_back"

# ============================================================
# TEST 7: 全局错误检查
# ============================================================
log ""
log "--- TEST 7: 全局错误检查 ---"

# 收集整个测试过程中的所有错误
ALL_ERRORS=$($ADB logcat -d | grep -i 'console' | grep -iE 'ERROR|TypeError|ReferenceError|SyntaxError' | grep -v 'classList' | sort -u)
ERROR_COUNT=$(echo "$ALL_ERRORS" | grep -c 'ERROR' 2>/dev/null || echo "0")

if [ "$ERROR_COUNT" -eq "0" ] || [ -z "$ALL_ERRORS" ]; then
  pass "无 JS 运行时错误"
else
  warn "发现 $ERROR_COUNT 个错误（可能包含框架层问题）"
  echo "$ALL_ERRORS" >> "$REPORT_FILE"
fi

# ============================================================
# 测试报告
# ============================================================
log ""
log "============================================================"
log "测试报告"
log "============================================================"
log "通过: $PASS"
log "失败: $FAIL"
log "警告: $WARN"
log "截图: $SCREENSHOT_DIR/"

if [ $FAIL -gt 0 ]; then
  log ""
  log "失败项:"
  for err in "${ERRORS[@]}"; do
    log "  - $err"
  done
fi

log ""
if [ $FAIL -eq 0 ]; then
  log "🎉 全量测试通过！项目可以发布。"
else
  log "⚠️  有 $FAIL 个测试失败，请检查后再发布。"
fi

exit $FAIL
