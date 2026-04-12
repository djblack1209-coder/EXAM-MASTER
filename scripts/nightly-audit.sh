#!/usr/bin/env bash
# ============================================================================
# EXAM-MASTER 夜间全量审计脚本
# ============================================================================
# 设计理念：
#   每天中国时间 00:00 自动触发，利用 Claude Code 非交互模式 (-p) 分阶段执行
#   全量审计 + 自动修复，覆盖前端/后端/架构/运维/文档等全部维度。
#   8 小时窗口（00:00~08:00 CST），按价值位阶依次执行 7 个审计阶段。
#
# 调用方式：
#   手动运行:  ./scripts/nightly-audit.sh
#   定时运行:  macOS LaunchAgent (com.exam-master.nightly-audit.plist)
#   手动测试:  ./scripts/nightly-audit.sh --test  (只跑冒烟测试)
#   只跑特定阶段: ./scripts/nightly-audit.sh --stage 3
#
# 日志输出：
#   logs/nightly-audit/YYYY-MM-DD/stage-N-xxx.log
#   logs/nightly-audit/YYYY-MM-DD/summary.md
# ============================================================================

set -euo pipefail

# --- 配置区 ---
PROJECT_DIR="/Users/blackdj/Desktop/EXAM-MASTER"
CLAUDE_BIN="/usr/local/bin/claude"
FNM_BIN="/opt/homebrew/bin/fnm"
NODE_VERSION="20"

# 每个阶段的预算上限（美元），防止单阶段跑飞
BUDGET_PER_STAGE=8.0
# 总预算上限
BUDGET_TOTAL=50.0
# 截止时间（08:00 CST）
CUTOFF_HOUR=8
# 每阶段超时：70分钟（7个阶段 × 70分钟 = 490分钟 ≈ 8小时窗口）
STAGE_TIMEOUT_SEC=4200
# API 预检最大重试次数
API_MAX_RETRIES=5
# API 预检重试间隔（秒）
API_RETRY_INTERVAL=120

# Claude 模型配置（夜间便宜时段可用更强模型）
MODEL="sonnet"
FALLBACK_MODEL="sonnet"

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
LOCK_FILE="/tmp/exam-master-nightly-audit.lock"

# 解析命令行参数
TEST_MODE=false
SINGLE_STAGE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --test)  TEST_MODE=true; shift ;;
        --stage) SINGLE_STAGE="$2"; shift 2 ;;
        *)       shift ;;
    esac
done

# 防止重复运行
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo -e "${RED}[审计] 已有实例运行中 (PID: $PID)，退出${NC}"
        exit 1
    fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# 创建日志目录
mkdir -p "$LOG_DIR"

# 初始化 Node 环境（fnm）
setup_node() {
    if [ -x "$FNM_BIN" ]; then
        eval "$($FNM_BIN env --shell bash)"
        $FNM_BIN use "$NODE_VERSION" --silent-if-unchanged 2>/dev/null || true
    fi
}

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

# 清理可能残留的 Claude 进程（确保独占 API）
cleanup_claude_processes() {
    log "${YELLOW}[清理]${NC}" "检查残留 Claude 进程..."

    # 杀掉之前的 claude -p 进程（不杀交互式会话）
    local stale_pids
    stale_pids=$(pgrep -f "claude.*--print\|claude.*-p " 2>/dev/null || true)
    if [ -n "$stale_pids" ]; then
        log "${YELLOW}[清理]${NC}" "终止残留 Claude 非交互进程: $stale_pids"
        echo "$stale_pids" | xargs kill 2>/dev/null || true
        sleep 3
    fi
}

# API 可用性预检（确保中转 API 能响应）
check_api_availability() {
    log "${CYAN}[预检]${NC}" "测试 API 可用性..."

    for i in $(seq 1 $API_MAX_RETRIES); do
        local test_output
        test_output=$("$CLAUDE_BIN" -p "回复OK" \
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

# 运行一个审计阶段（带重试）
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

    local prompt
    prompt=$(cat "$prompt_file")

    log "${GREEN}[开始]${NC}" "阶段 ${stage_num}: ${stage_name}"
    echo "## 阶段 ${stage_num}: ${stage_name}" >> "$SUMMARY_FILE"
    echo "**开始时间**: $(TZ='Asia/Shanghai' date +'%H:%M:%S CST')" >> "$SUMMARY_FILE"

    # 构建 Claude 参数
    local claude_args=(
        -p "$prompt"
        --dangerously-skip-permissions
        --model "$MODEL"
        --max-budget-usd "$BUDGET_PER_STAGE"
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

    # 执行 Claude（使用后台进程 + 超时控制，macOS 无 timeout 命令）
    "$CLAUDE_BIN" "${claude_args[@]}" > "$stage_log" 2>&1 &
    local claude_pid=$!

    # 等待完成或超时
    local elapsed=0
    while kill -0 "$claude_pid" 2>/dev/null; do
        sleep 10
        elapsed=$(( $(date +%s) - start_time ))

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

    cleanup_claude_processes

    if check_api_availability; then
        log "${GREEN}[冒烟测试]${NC}" "所有预检通过"
        notify "夜间审计" "冒烟测试通过，系统就绪"
    else
        log "${RED}[冒烟测试]${NC}" "预检失败"
        notify "夜间审计" "冒烟测试失败：API 不可用"
        exit 1
    fi
}

# --- 主流程 ---

main() {
    # 冒烟测试模式
    if [ "$TEST_MODE" = true ]; then
        smoke_test
        exit 0
    fi

    log "${GREEN}[启动]${NC}" "EXAM-MASTER 夜间全量审计 - ${DATE_TAG}"
    log "${CYAN}[信息]${NC}" "时间窗口: 00:00~08:00 CST | 预算: \$${BUDGET_TOTAL} | 模型: ${MODEL}"
    notify "夜间审计" "开始全量审计 - ${DATE_TAG}"

    # 初始化 Node
    setup_node

    # 清理残留进程
    cleanup_claude_processes

    # API 可用性预检
    if ! check_api_availability; then
        echo "# 夜间审计报告 - ${DATE_TAG}" > "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
        echo "**状态**: API 不可用，审计未执行" >> "$SUMMARY_FILE"
        exit 1
    fi

    # 写入摘要头部
    cat > "$SUMMARY_FILE" << EOF
# 夜间审计报告 - ${DATE_TAG}

**执行时间**: $(TZ='Asia/Shanghai' date +'%Y-%m-%d %H:%M:%S CST')
**模型**: ${MODEL} (备用: ${FALLBACK_MODEL})
**预算**: 单阶段 \$${BUDGET_PER_STAGE} / 总计 \$${BUDGET_TOTAL}
**阶段超时**: $(( STAGE_TIMEOUT_SEC / 60 ))分钟

---

EOF

    # 切换到项目目录
    cd "$PROJECT_DIR"

    # --- 7 个审计阶段，按价值位阶排序 ---

    # 阶段 1：健康预检 + 构建验证（必须先通过，否则后续无意义）
    run_stage 1 "health-precheck" "${PROMPT_DIR}/01-health-precheck.md" || true

    # 阶段 2：安全审计（密钥泄露/权限/输入校验）
    run_stage 2 "security-audit" "${PROMPT_DIR}/02-security-audit.md" || true

    # 阶段 3：后端 API + 数据完整性审计
    run_stage 3 "backend-api-audit" "${PROMPT_DIR}/03-backend-api-audit.md" || true

    # 阶段 4：前端架构 + 分层合规审计
    run_stage 4 "frontend-arch-audit" "${PROMPT_DIR}/04-frontend-arch-audit.md" || true

    # 阶段 5：UI/UX 视觉 + 交互审计（截图比对）
    run_stage 5 "ui-ux-visual-audit" "${PROMPT_DIR}/05-ui-ux-visual-audit.md" || true

    # 阶段 6：文件治理 + 文档同步审计
    run_stage 6 "file-governance" "${PROMPT_DIR}/06-file-governance.md" || true

    # 阶段 7：运维 + CI/CD + 部署审计
    run_stage 7 "ops-cicd-audit" "${PROMPT_DIR}/07-ops-cicd-audit.md" || true

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
    notify "夜间审计" "审计完成，请查看报告"

    # 推送远程（如有变更）
    if git status --porcelain | grep -q .; then
        git add -A
        git commit -m "[审计] 夜间全量审计自动修复 - ${DATE_TAG}" || true
        git push origin "$(git branch --show-current)" 2>/dev/null || log "${YELLOW}[警告]${NC}" "推送远程失败，请手动推送"
    fi
}

main "$@"
