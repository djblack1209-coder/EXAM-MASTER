#!/usr/bin/env bash
# ============================================================================
# EXAM-MASTER 夜间全量审计脚本 v2
# ============================================================================
# 设计理念：
#   每天中国时间 00:00 自动触发，利用 Claude Code 非交互模式 (-p) 分阶段执行
#   全量审计 + 自动修复，覆盖安全/后端/前端/UI/文件/运维/性能/隐私/无障碍全部维度。
#   8 小时窗口（00:00~08:00 CST），按价值位阶依次执行 9 个审计阶段。
#
# 调用方式：
#   手动运行:  ./scripts/nightly-audit.sh
#   定时运行:  macOS LaunchAgent (com.exam-master.nightly-audit.plist)
#   手动测试:  ./scripts/nightly-audit.sh --test        (冒烟测试)
#   只跑特定阶段: ./scripts/nightly-audit.sh --stage 3
#   不休眠:    ./scripts/nightly-audit.sh --no-sleep     (手动运行时)
#
# 跨项目协调：
#   使用 /tmp/claude-nightly-audit.lock 目录锁实现多项目互斥。
#   同时间只有一个项目的审计进程能获取 Claude API。
#   其他项目自动排队等待（最多等2小时）。
#
# 日志输出：
#   logs/nightly-audit/YYYY-MM-DD/stage-N-xxx.log
#   logs/nightly-audit/YYYY-MM-DD/summary.md
# ============================================================================

set -euo pipefail

# --- 配置区 ---
PROJECT_DIR="/Users/blackdj/Desktop/EXAM-MASTER"
PROJECT_NAME="exam-master"
CLAUDE_BIN="/usr/local/bin/claude"
FNM_BIN="/opt/homebrew/bin/fnm"
NODE_VERSION="20"

# 每个阶段的预算上限（美元），防止单阶段跑飞
BUDGET_PER_STAGE=8.0
# 总预算上限
BUDGET_TOTAL=50.0
# 截止时间（08:00 CST）
CUTOFF_HOUR=8
# 每阶段超时：70分钟（7阶段 × 70分钟 ≈ 8小时窗口）
STAGE_TIMEOUT_SEC=4200
# API 预检最大重试次数
API_MAX_RETRIES=5
# API 预检重试间隔（秒）
API_RETRY_INTERVAL=120
# 跨项目锁等待上限（秒，2小时）
LOCK_WAIT_SECONDS=7200

# Claude 模型配置（夜间便宜时段可用更强模型）
MODEL="sonnet"
FALLBACK_MODEL="sonnet"

# --- 跨项目互斥锁配置 ---
# 所有项目共享同一把锁，确保串行执行
GLOBAL_LOCK_DIR="/tmp/claude-nightly-audit.lock"
# 自身防重复锁
SELF_LOCK_FILE="/tmp/exam-master-nightly-audit.lock"
# 已知的其他项目锁文件（用于感知其他项目是否在运行）
OTHER_LOCK_FILES=(
    "/tmp/pixel-loop-audit.lock"
    "/tmp/night-audit-*.lock"
)

# --- 颜色（仅终端交互时显示） ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- 初始化 ---
DATE_TAG=$(date +"%Y-%m-%d")
LOG_DIR="${PROJECT_DIR}/logs/nightly-audit/${DATE_TAG}"
PROMPT_DIR="${PROJECT_DIR}/scripts/nightly-audit-prompts"
SUMMARY_FILE="${LOG_DIR}/summary.md"

# 解析命令行参数
TEST_MODE=false
SINGLE_STAGE=""
NO_SLEEP=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --test)      TEST_MODE=true; shift ;;
        --stage)     SINGLE_STAGE="$2"; shift 2 ;;
        --no-sleep)  NO_SLEEP=true; shift ;;
        *)           shift ;;
    esac
done

# 创建日志目录
mkdir -p "$LOG_DIR"
mkdir -p "${PROJECT_DIR}/logs/nightly-audit/metrics"

# --- 工具函数 ---

log() {
    local level="$1"
    shift
    local timestamp
    timestamp=$(date +"%H:%M:%S")
    echo -e "${CYAN}[${timestamp}]${NC} ${level} $*"
    echo "[${timestamp}] ${level} $*" >> "${LOG_DIR}/runner.log"
}

# 发送 macOS 通知
notify() {
    local title="$1"
    local message="$2"
    osascript -e "display notification \"${message}\" with title \"${title}\" sound name \"Glass\"" 2>/dev/null || true
}

# 检查是否超过截止时间
is_past_cutoff() {
    local current_hour
    current_hour=$(TZ="Asia/Shanghai" date +"%H")
    [ "$current_hour" -ge "$CUTOFF_HOUR" ] && [ "$current_hour" -lt 24 ]
}

# 初始化 Node 环境（fnm）
setup_node() {
    if [ -x "$FNM_BIN" ]; then
        eval "$($FNM_BIN env --shell bash)"
        $FNM_BIN use "$NODE_VERSION" --silent-if-unchanged 2>/dev/null || true
    fi
}

# --- 锁管理（跨项目互斥） ---

# 自身防重复锁
acquire_self_lock() {
    if [ -f "$SELF_LOCK_FILE" ]; then
        local pid
        pid=$(cat "$SELF_LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "${RED}[锁]${NC}" "本项目已有审计实例运行中 (PID: $pid)，退出"
            exit 1
        fi
        # 残留锁文件，清理
        rm -f "$SELF_LOCK_FILE"
    fi
    echo $$ > "$SELF_LOCK_FILE"
}

release_self_lock() {
    rm -f "$SELF_LOCK_FILE" 2>/dev/null || true
}

# 跨项目全局锁（使用 mkdir 原子操作）
acquire_global_lock() {
    log "${CYAN}[锁]${NC}" "尝试获取跨项目全局锁..."

    local waited=0
    while ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; do
        # 锁已被占用，检查持有者是否存活
        local holder_pid=""
        local holder_project=""
        if [ -f "$GLOBAL_LOCK_DIR/pid" ]; then
            holder_pid=$(cat "$GLOBAL_LOCK_DIR/pid" 2>/dev/null || echo "")
            holder_project=$(cat "$GLOBAL_LOCK_DIR/project" 2>/dev/null || echo "未知")
        fi

        # 持有者已死 → 清理过期锁
        if [ -n "$holder_pid" ] && ! kill -0 "$holder_pid" 2>/dev/null; then
            log "${YELLOW}[锁]${NC}" "清理过期锁 (${holder_project}, PID ${holder_pid} 已死)"
            rm -rf "$GLOBAL_LOCK_DIR"
            continue
        fi

        # 检查超时
        if [ "$waited" -ge "$LOCK_WAIT_SECONDS" ]; then
            log "${RED}[锁]${NC}" "等待超时 (${LOCK_WAIT_SECONDS}秒)，${holder_project} 仍在运行，放弃"
            return 1
        fi

        # 检查截止时间
        if is_past_cutoff; then
            log "${YELLOW}[锁]${NC}" "等锁期间已超过截止时间，放弃"
            return 1
        fi

        log "${YELLOW}[锁]${NC}" "等待 ${holder_project} (PID: ${holder_pid}) 完成... (已等 ${waited}秒)"
        sleep 60
        waited=$(( waited + 60 ))
    done

    # 写入锁信息
    echo $$ > "$GLOBAL_LOCK_DIR/pid"
    echo "$PROJECT_NAME" > "$GLOBAL_LOCK_DIR/project"
    date +"%Y-%m-%d %H:%M:%S" > "$GLOBAL_LOCK_DIR/started"

    log "${GREEN}[锁]${NC}" "全局锁获取成功"
    return 0
}

release_global_lock() {
    if [ -d "$GLOBAL_LOCK_DIR" ]; then
        local lock_pid
        lock_pid=$(cat "$GLOBAL_LOCK_DIR/pid" 2>/dev/null || echo "")
        # 只释放自己持有的锁
        if [ "$lock_pid" = "$$" ]; then
            rm -rf "$GLOBAL_LOCK_DIR"
            log "${GREEN}[锁]${NC}" "全局锁已释放"
        fi
    fi
}

# 清理所有锁（EXIT trap）
cleanup_all() {
    release_global_lock
    release_self_lock
}

# 清理超过30天的旧审计日志
cleanup_old_logs() {
    log "${YELLOW}[清理]${NC}" "清理超过30天的旧审计日志..."
    local cleaned=0
    if [ -d "${PROJECT_DIR}/logs/nightly-audit" ]; then
        # 清理超过30天的日期目录
        while IFS= read -r old_dir; do
            if [ -d "$old_dir" ]; then
                rm -rf "$old_dir"
                cleaned=$((cleaned + 1))
            fi
        done < <(find "${PROJECT_DIR}/logs/nightly-audit" -maxdepth 1 -type d -mtime +30 2>/dev/null)
        
        # 清理超过30天的旧格式日志文件
        find "${PROJECT_DIR}/logs/nightly-audit" -maxdepth 1 -name "*.log" -mtime +30 -delete 2>/dev/null || true
    fi
    if [ $cleaned -gt 0 ]; then
        log "${GREEN}[清理]${NC}" "已清理 ${cleaned} 个旧日志目录"
    fi
}

# 清理可能残留的 Claude 非交互进程
cleanup_claude_processes() {
    log "${YELLOW}[清理]${NC}" "检查残留 Claude 非交互进程..."
    local stale_pids
    stale_pids=$(pgrep -f "claude.*--print\|claude.*-p " 2>/dev/null || true)
    if [ -n "$stale_pids" ]; then
        log "${YELLOW}[清理]${NC}" "终止残留进程: $stale_pids"
        echo "$stale_pids" | xargs kill 2>/dev/null || true
        sleep 3
    fi
}

# API 可用性预检（确保中转 API 能响应）
check_api_availability() {
    log "${CYAN}[预检]${NC}" "测试 API 可用性..."

    for i in $(seq 1 $API_MAX_RETRIES); do
        local test_output
        test_output=$("$CLAUDE_BIN" --bare -p "回复OK" \
            --max-budget-usd 0.5 \
            --output-format text \
            --no-session-persistence 2>&1) || true

        if echo "$test_output" | grep -qi "OK"; then
            log "${GREEN}[预检]${NC}" "API 可用 (第${i}次尝试)"
            return 0
        fi

        if [ $i -lt $API_MAX_RETRIES ]; then
            log "${YELLOW}[预检]${NC}" "API 不可用 (第${i}次)，${API_RETRY_INTERVAL}秒后重试..."
            sleep $API_RETRY_INTERVAL
        fi
    done

    log "${RED}[预检]${NC}" "API 持续不可用，放弃本次审计"
    notify "夜间审计" "API 不可用，审计已取消"
    return 1
}

# 检查是否还有其他项目在排队/运行
other_projects_running() {
    for pattern in "${OTHER_LOCK_FILES[@]}"; do
        # 支持通配符
        for lockfile in $pattern; do
            if [ -f "$lockfile" ]; then
                local pid
                pid=$(cat "$lockfile" 2>/dev/null || echo "")
                if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                    return 0  # 有其他项目在运行
                fi
            fi
        done
    done
    return 1  # 没有其他项目在运行
}

# 审计完成后决定是否让 Mac 休眠
maybe_sleep() {
    if [ "$NO_SLEEP" = true ]; then
        log "${CYAN}[休眠]${NC}" "已指定 --no-sleep，跳过休眠"
        return
    fi

    # 检查是否还有其他项目在排队
    if other_projects_running; then
        log "${CYAN}[休眠]${NC}" "检测到其他项目审计仍在运行，不休眠"
        return
    fi

    # 检查全局锁是否被其他项目占用
    if [ -d "$GLOBAL_LOCK_DIR" ]; then
        local lock_pid
        lock_pid=$(cat "$GLOBAL_LOCK_DIR/pid" 2>/dev/null || echo "")
        if [ "$lock_pid" != "$$" ] && [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            log "${CYAN}[休眠]${NC}" "全局锁被其他项目持有，不休眠"
            return
        fi
    fi

    log "${GREEN}[休眠]${NC}" "所有审计完成，30秒后进入休眠..."
    notify "夜间审计" "所有项目审计完成，Mac 即将休眠"
    sleep 30

    # 再次检查（30秒内可能有新项目启动）
    if other_projects_running; then
        log "${CYAN}[休眠]${NC}" "取消休眠：检测到新的审计进程"
        return
    fi

    # 停止 caffeinate 并让系统休眠
    pkill -f 'caffeinate -dis' 2>/dev/null || true
    pmset sleepnow 2>/dev/null || log "${YELLOW}[休眠]${NC}" "pmset sleepnow 需要管理员权限"
}

# --- 运行审计阶段 ---
# 参数: $1=阶段编号 $2=阶段名称 $3=提示词文件路径
run_stage() {
    local stage_num="$1"
    local stage_name="$2"
    local prompt_file="$3"
    local stage_log="${LOG_DIR}/stage-${stage_num}-${stage_name}.log"

    # 跳过非目标阶段（--stage 参数）
    if [ -n "$SINGLE_STAGE" ] && [ "$stage_num" != "$SINGLE_STAGE" ]; then
        return 0
    fi

    # 截止时间检查
    if is_past_cutoff; then
        log "${YELLOW}[跳过]${NC}" "阶段 ${stage_num} ${stage_name} - 已超过截止时间 (${CUTOFF_HOUR}:00 CST)"
        echo "## 阶段 ${stage_num}: ${stage_name}" >> "$SUMMARY_FILE"
        echo "**状态**: 跳过（超过截止时间）" >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
        return 1
    fi

    # 检查提示词文件
    if [ ! -f "$prompt_file" ]; then
        log "${RED}[错误]${NC}" "提示词文件不存在: ${prompt_file}"
        return 1
    fi

    # 注入项目红线规则（--bare 模式不会自动加载 CLAUDE.md）
    local redlines
    redlines="## 项目红线（必须遵守）

1. 永远不要把 API 密钥写进前端代码
2. 永远不要提交含真实密钥的 .env 文件
3. 永远不要在需登录接口跳过 requireAuth(ctx)
4. 永远不要让小程序主包超 2MB
5. 永远不要前端直接调后端（必须走 Service 层 api/domains/）
6. 永远不要未经构建验证就说完成了
7. 永远不要把服务器密码/SSH密钥写在 Git 跟踪的文件中

## 分层纪律
Page → 只调用 组件/Store/Composable
Component → props 接收数据，emit 事件
Store(Pinia) → 调用 Service，管理全局状态
Service(api/domains/) → 调用 _request-core.js 发 API 请求

---

"
    local prompt
    prompt="${redlines}$(cat "$prompt_file")"

    log "${GREEN}[开始]${NC}" "阶段 ${stage_num}: ${stage_name}"
    echo "## 阶段 ${stage_num}: ${stage_name}" >> "$SUMMARY_FILE"
    echo "**开始时间**: $(TZ='Asia/Shanghai' date +'%H:%M:%S CST')" >> "$SUMMARY_FILE"

    # 构建 Claude 参数
    # --bare: 跳过 hooks/plugins/MCP/CLAUDE.md 自动发现，启动更快更稳定
    # --dangerously-skip-permissions: 自动批准所有工具操作
    # --max-turns 50: 限制回合数防止无限循环
    local claude_args=(
        --bare
        -p "$prompt"
        --dangerously-skip-permissions
        --model "$MODEL"
        --max-budget-usd "$BUDGET_PER_STAGE"
        --max-turns 50
        --output-format "text"
    )

    # 第一个阶段新建会话，后续阶段继续同一会话（共享上下文）
    if [ "$stage_num" -gt 1 ] && [ -z "$SINGLE_STAGE" ]; then
        claude_args+=("--continue")
    fi

    if [ -n "$FALLBACK_MODEL" ]; then
        claude_args+=("--fallback-model" "$FALLBACK_MODEL")
    fi

    local start_time exit_code
    start_time=$(date +%s)
    exit_code=0

    # 执行 Claude（后台进程 + 超时控制，macOS 无 timeout 命令）
    "$CLAUDE_BIN" "${claude_args[@]}" > "$stage_log" 2>&1 &
    local claude_pid=$!

    # 等待完成或超时
    while kill -0 "$claude_pid" 2>/dev/null; do
        sleep 10
        local elapsed=$(( $(date +%s) - start_time ))

        # 超时检查
        if [ $elapsed -ge $STAGE_TIMEOUT_SEC ]; then
            kill "$claude_pid" 2>/dev/null || true
            sleep 3
            kill -9 "$claude_pid" 2>/dev/null || true
            exit_code=124
            break
        fi

        # 截止时间检查
        if is_past_cutoff; then
            kill "$claude_pid" 2>/dev/null || true
            sleep 3
            kill -9 "$claude_pid" 2>/dev/null || true
            exit_code=125
            break
        fi
    done

    if [ $exit_code -eq 0 ]; then
        wait "$claude_pid" 2>/dev/null
        exit_code=$?
    fi

    local end_time duration duration_min
    end_time=$(date +%s)
    duration=$(( end_time - start_time ))
    duration_min=$(( duration / 60 ))

    case $exit_code in
        0)
            log "${GREEN}[完成]${NC}" "阶段 ${stage_num}: ${stage_name} (${duration_min}分钟)"
            echo "**状态**: 完成 (${duration_min}分钟)" >> "$SUMMARY_FILE"
            ;;
        124)
            log "${YELLOW}[超时]${NC}" "阶段 ${stage_num}: ${stage_name} (超过$(( STAGE_TIMEOUT_SEC / 60 ))分钟限制)"
            echo "**状态**: 超时 (>$(( STAGE_TIMEOUT_SEC / 60 ))分钟)" >> "$SUMMARY_FILE"
            ;;
        125)
            log "${YELLOW}[截止]${NC}" "阶段 ${stage_num}: ${stage_name} (达到08:00截止时间)"
            echo "**状态**: 达到截止时间" >> "$SUMMARY_FILE"
            ;;
        *)
            log "${RED}[异常]${NC}" "阶段 ${stage_num}: ${stage_name} (退出码: ${exit_code})"
            echo "**状态**: 异常退出 (code=${exit_code})" >> "$SUMMARY_FILE"
            ;;
    esac

    # 提取最后 80 行作为摘要
    echo '```' >> "$SUMMARY_FILE"
    tail -80 "$stage_log" >> "$SUMMARY_FILE" 2>/dev/null || echo "(日志为空)" >> "$SUMMARY_FILE"
    echo '```' >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    return 0
}

# --- 冒烟测试模式 ---

smoke_test() {
    log "${CYAN}[冒烟测试]${NC}" "验证夜间审计系统..."

    setup_node
    log "${CYAN}[冒烟测试]${NC}" "Node: $(node --version 2>/dev/null || echo '不可用')"

    # 测试全局锁
    if acquire_global_lock; then
        log "${GREEN}[冒烟测试]${NC}" "跨项目锁: 正常"
        release_global_lock
    else
        log "${RED}[冒烟测试]${NC}" "跨项目锁: 被其他项目占用"
    fi

    # 测试 API
    if check_api_availability; then
        log "${GREEN}[冒烟测试]${NC}" "API: 可用"
    else
        log "${RED}[冒烟测试]${NC}" "API: 不可用"
        exit 1
    fi

    # 检查提示词文件
    local missing=0
    for i in $(seq 1 9); do
        local pfile="${PROMPT_DIR}/0${i}-*.md"
        if ! ls $pfile 1>/dev/null 2>&1; then
            log "${RED}[冒烟测试]${NC}" "缺少阶段${i}提示词文件"
            missing=$((missing + 1))
        fi
    done
    if [ $missing -eq 0 ]; then
        log "${GREEN}[冒烟测试]${NC}" "提示词文件: 9/9 完整"
    fi

    log "${GREEN}[冒烟测试]${NC}" "所有预检通过"
    notify "夜间审计" "冒烟测试通过，系统就绪"
}

# --- 主流程 ---

main() {
    # 冒烟测试模式
    if [ "$TEST_MODE" = true ]; then
        smoke_test
        exit 0
    fi

    # 获取自身锁（防止同一项目重复运行）
    acquire_self_lock
    trap 'cleanup_all' EXIT

    log "${GREEN}[启动]${NC}" "EXAM-MASTER 夜间全量审计 - ${DATE_TAG}"
    log "${CYAN}[信息]${NC}" "时间窗口: 00:00~08:00 CST | 预算: \$${BUDGET_TOTAL} | 模型: ${MODEL}"
    notify "夜间审计" "EXAM-MASTER 开始全量审计"

    # 初始化 Node
    setup_node

    # 清理超过30天的旧审计日志
    cleanup_old_logs

    # 获取跨项目全局锁（排队等待其他项目完成）
    if ! acquire_global_lock; then
        echo "# 夜间审计报告 - ${DATE_TAG}" > "$SUMMARY_FILE"
        echo "**状态**: 未能获取全局锁，审计未执行" >> "$SUMMARY_FILE"
        notify "夜间审计" "未能获取全局锁，审计取消"
        exit 1
    fi

    # 清理残留 Claude 进程
    cleanup_claude_processes

    # API 可用性预检
    if ! check_api_availability; then
        echo "# 夜间审计报告 - ${DATE_TAG}" > "$SUMMARY_FILE"
        echo "**状态**: API 不可用，审计未执行" >> "$SUMMARY_FILE"
        exit 1
    fi

    # 写入摘要头部
    cat > "$SUMMARY_FILE" << EOF
# EXAM-MASTER 夜间审计报告 - ${DATE_TAG}

**执行时间**: $(TZ='Asia/Shanghai' date +'%Y-%m-%d %H:%M:%S CST')
**模型**: ${MODEL} (备用: ${FALLBACK_MODEL})
**预算**: 单阶段 \$${BUDGET_PER_STAGE} / 总计 \$${BUDGET_TOTAL}
**阶段超时**: $(( STAGE_TIMEOUT_SEC / 60 ))分钟
**跨项目锁**: 已获取

---

EOF

    # 切换到项目目录
    cd "$PROJECT_DIR"

    # --- 9 个审计阶段，按价值位阶排序 ---
    run_stage 1 "health-precheck"    "${PROMPT_DIR}/01-health-precheck.md"    || true
    run_stage 2 "security-audit"     "${PROMPT_DIR}/02-security-audit.md"     || true
    run_stage 3 "backend-api-audit"  "${PROMPT_DIR}/03-backend-api-audit.md"  || true
    run_stage 4 "frontend-arch-audit" "${PROMPT_DIR}/04-frontend-arch-audit.md" || true
    run_stage 5 "ui-ux-visual-audit" "${PROMPT_DIR}/05-ui-ux-visual-audit.md" || true
    run_stage 6 "file-governance"    "${PROMPT_DIR}/06-file-governance.md"    || true
    run_stage 7 "ops-cicd-audit"     "${PROMPT_DIR}/07-ops-cicd-audit.md"     || true
    run_stage 8 "performance-audit"  "${PROMPT_DIR}/08-performance-audit.md"  || true
    run_stage 9 "privacy-a11y-audit" "${PROMPT_DIR}/09-privacy-a11y-audit.md" || true

    # --- 收尾 ---
    cat >> "$SUMMARY_FILE" << EOF
---

## 执行统计

**结束时间**: $(TZ='Asia/Shanghai' date +'%Y-%m-%d %H:%M:%S CST')
**日志目录**: \`${LOG_DIR}\`

### 下一步行动
白天接手时请查看本报告，关注标记为 **异常/超时/跳过** 的阶段。
所有修改已通过 git commit 提交（如有）。
未完成的阶段可手动执行：\`./scripts/nightly-audit.sh --stage N\`

EOF

    log "${GREEN}[结束]${NC}" "审计完成，报告: ${SUMMARY_FILE}"
    notify "夜间审计" "EXAM-MASTER 审计完成"

    # 推送远程（如有变更）
    if git status --porcelain | grep -q .; then
        git add -A
        git commit -m "audit: 夜间全量审计自动修复 - ${DATE_TAG}" || true
        git push origin "$(git branch --show-current)" 2>/dev/null || log "${YELLOW}[警告]${NC}" "推送远程失败"
    fi

    # 释放全局锁（在休眠检查之前，让下一个项目可以启动）
    release_global_lock

    # 审计结束后决定是否让 Mac 休眠
    maybe_sleep
}

main "$@"
