#!/bin/bash
# ============================================
# Exam-Master 资源监控脚本
# 用于压力测试期间实时监控 Pod CPU/Memory
# 并记录 HPA 扩容响应时间
# ============================================

set -e

# 配置
NAMESPACE="${NAMESPACE:-exam-master}"
INTERVAL="${INTERVAL:-5}"  # 监控间隔（秒）
OUTPUT_DIR="${OUTPUT_DIR:-./monitoring-logs}"
LOG_FILE="${OUTPUT_DIR}/resource-monitor-$(date +%Y%m%d-%H%M%S).log"
HPA_LOG="${OUTPUT_DIR}/hpa-events-$(date +%Y%m%d-%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 打印带时间戳的日志
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}INFO${NC}" "$1"; }
log_warn() { log "${YELLOW}WARN${NC}" "$1"; }
log_error() { log "${RED}ERROR${NC}" "$1"; }
log_success() { log "${GREEN}OK${NC}" "$1"; }

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl 未安装"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "命名空间 $NAMESPACE 不存在"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 获取 Pod 资源使用情况
get_pod_metrics() {
    log_info "========== Pod 资源使用情况 =========="
    
    # 获取 Pod 指标
    kubectl top pods -n "$NAMESPACE" 2>/dev/null | while read line; do
        echo "$line" | tee -a "$LOG_FILE"
    done
    
    echo "" | tee -a "$LOG_FILE"
}

# 获取节点资源使用情况
get_node_metrics() {
    log_info "========== 节点资源使用情况 =========="
    
    kubectl top nodes 2>/dev/null | while read line; do
        echo "$line" | tee -a "$LOG_FILE"
    done
    
    echo "" | tee -a "$LOG_FILE"
}

# 监控 HPA 状态
monitor_hpa() {
    log_info "========== HPA 状态 =========="
    
    kubectl get hpa -n "$NAMESPACE" -o wide 2>/dev/null | while read line; do
        echo "$line" | tee -a "$LOG_FILE"
    done
    
    echo "" | tee -a "$LOG_FILE"
}

# 记录 HPA 扩容事件
record_hpa_events() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 获取 HPA 相关事件
    kubectl get events -n "$NAMESPACE" --field-selector reason=SuccessfulRescale \
        --sort-by='.lastTimestamp' 2>/dev/null | tail -20 >> "$HPA_LOG"
    
    # 检查是否有新的扩容事件
    local recent_events=$(kubectl get events -n "$NAMESPACE" \
        --field-selector reason=SuccessfulRescale \
        --sort-by='.lastTimestamp' -o json 2>/dev/null | \
        jq -r '.items[-1] | select(.lastTimestamp != null) | "\(.lastTimestamp) \(.message)"' 2>/dev/null)
    
    if [ -n "$recent_events" ]; then
        echo "$timestamp - HPA 扩容事件: $recent_events" >> "$HPA_LOG"
        log_warn "检测到 HPA 扩容事件: $recent_events"
    fi
}

# 计算 HPA 响应时间
calculate_hpa_response_time() {
    log_info "========== HPA 响应时间分析 =========="
    
    # 获取最近的扩容事件
    local events=$(kubectl get events -n "$NAMESPACE" \
        --field-selector reason=SuccessfulRescale \
        --sort-by='.lastTimestamp' -o json 2>/dev/null)
    
    if [ -z "$events" ] || [ "$events" == "null" ]; then
        log_info "暂无 HPA 扩容事件"
        return
    fi
    
    echo "$events" | jq -r '.items[] | "\(.lastTimestamp) | \(.involvedObject.name) | \(.message)"' 2>/dev/null | \
        tail -10 | while read line; do
            echo "  $line" | tee -a "$LOG_FILE"
        done
    
    echo "" | tee -a "$LOG_FILE"
}

# 获取 Pod 详细状态
get_pod_status() {
    log_info "========== Pod 详细状态 =========="
    
    kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null | while read line; do
        echo "$line" | tee -a "$LOG_FILE"
    done
    
    echo "" | tee -a "$LOG_FILE"
}

# 检查资源告警阈值
check_resource_alerts() {
    log_info "========== 资源告警检查 =========="
    
    # 获取 Pod CPU/Memory 使用情况并检查阈值
    kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null | while read pod cpu mem; do
        # 提取 CPU 数值（去掉 m 后缀）
        cpu_value=$(echo "$cpu" | sed 's/m//')
        # 提取 Memory 数值（去掉 Mi 后缀）
        mem_value=$(echo "$mem" | sed 's/Mi//')
        
        # CPU 告警阈值: 800m (80%)
        if [ "$cpu_value" -gt 800 ] 2>/dev/null; then
            log_warn "Pod $pod CPU 使用率过高: ${cpu}"
        fi
        
        # Memory 告警阈值: 800Mi
        if [ "$mem_value" -gt 800 ] 2>/dev/null; then
            log_warn "Pod $pod 内存使用率过高: ${mem}"
        fi
    done
    
    echo "" | tee -a "$LOG_FILE"
}

# 生成监控报告
generate_report() {
    local report_file="${OUTPUT_DIR}/monitoring-report-$(date +%Y%m%d-%H%M%S).md"
    
    log_info "生成监控报告: $report_file"
    
    cat > "$report_file" << EOF
# Exam-Master 资源监控报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**命名空间**: $NAMESPACE

## 1. Pod 资源使用情况

\`\`\`
$(kubectl top pods -n "$NAMESPACE" 2>/dev/null)
\`\`\`

## 2. HPA 状态

\`\`\`
$(kubectl get hpa -n "$NAMESPACE" -o wide 2>/dev/null)
\`\`\`

## 3. HPA 扩容事件

\`\`\`
$(kubectl get events -n "$NAMESPACE" --field-selector reason=SuccessfulRescale --sort-by='.lastTimestamp' 2>/dev/null | tail -20)
\`\`\`

## 4. Pod 状态

\`\`\`
$(kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null)
\`\`\`

## 5. 节点资源

\`\`\`
$(kubectl top nodes 2>/dev/null)
\`\`\`

---
*报告由 monitor-resources.sh 自动生成*
EOF

    log_success "报告已生成: $report_file"
}

# 持续监控模式
continuous_monitor() {
    log_info "开始持续监控模式 (间隔: ${INTERVAL}s)"
    log_info "日志文件: $LOG_FILE"
    log_info "HPA 事件日志: $HPA_LOG"
    log_info "按 Ctrl+C 停止监控"
    
    echo "" | tee -a "$LOG_FILE"
    
    # 记录初始 Pod 数量
    local initial_replicas=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    local scale_start_time=""
    
    while true; do
        echo "============================================" | tee -a "$LOG_FILE"
        echo "监控时间: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
        echo "============================================" | tee -a "$LOG_FILE"
        
        get_pod_metrics
        monitor_hpa
        check_resource_alerts
        record_hpa_events
        
        # 检测 Pod 数量变化（HPA 触发）
        local current_replicas=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
        
        if [ "$current_replicas" -gt "$initial_replicas" ]; then
            if [ -z "$scale_start_time" ]; then
                scale_start_time=$(date +%s)
                log_warn "检测到扩容: $initial_replicas -> $current_replicas"
            fi
            
            # 检查新 Pod 是否就绪
            local ready_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
            if [ "$ready_pods" -eq "$current_replicas" ]; then
                local scale_end_time=$(date +%s)
                local response_time=$((scale_end_time - scale_start_time))
                log_success "HPA 扩容完成! 响应时间: ${response_time}s"
                echo "$(date '+%Y-%m-%d %H:%M:%S') - HPA 扩容响应时间: ${response_time}s ($initial_replicas -> $current_replicas)" >> "$HPA_LOG"
                initial_replicas=$current_replicas
                scale_start_time=""
            fi
        elif [ "$current_replicas" -lt "$initial_replicas" ]; then
            log_info "检测到缩容: $initial_replicas -> $current_replicas"
            initial_replicas=$current_replicas
        fi
        
        sleep "$INTERVAL"
    done
}

# 单次检查模式
single_check() {
    log_info "执行单次资源检查"
    
    get_pod_status
    get_pod_metrics
    get_node_metrics
    monitor_hpa
    calculate_hpa_response_time
    check_resource_alerts
    generate_report
    
    log_success "检查完成"
}

# 显示帮助
show_help() {
    cat << EOF
Exam-Master 资源监控脚本

用法: $0 [选项]

选项:
    -c, --continuous    持续监控模式
    -s, --single        单次检查模式（默认）
    -r, --report        仅生成报告
    -n, --namespace     指定命名空间（默认: exam-master）
    -i, --interval      监控间隔秒数（默认: 5）
    -o, --output        输出目录（默认: ./monitoring-logs）
    -h, --help          显示帮助

示例:
    $0 -c                           # 持续监控
    $0 -s                           # 单次检查
    $0 -c -i 10 -n exam-master      # 每10秒监控一次
    $0 -r                           # 仅生成报告

EOF
}

# 主函数
main() {
    local mode="single"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--continuous)
                mode="continuous"
                shift
                ;;
            -s|--single)
                mode="single"
                shift
                ;;
            -r|--report)
                mode="report"
                shift
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -i|--interval)
                INTERVAL="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 重新设置日志文件路径
    mkdir -p "$OUTPUT_DIR"
    LOG_FILE="${OUTPUT_DIR}/resource-monitor-$(date +%Y%m%d-%H%M%S).log"
    HPA_LOG="${OUTPUT_DIR}/hpa-events-$(date +%Y%m%d-%H%M%S).log"
    
    log_info "Exam-Master 资源监控脚本"
    log_info "命名空间: $NAMESPACE"
    
    check_dependencies
    
    case $mode in
        continuous)
            continuous_monitor
            ;;
        single)
            single_check
            ;;
        report)
            generate_report
            ;;
    esac
}

# 捕获 Ctrl+C
trap 'echo ""; log_info "监控已停止"; generate_report; exit 0' INT

main "$@"
