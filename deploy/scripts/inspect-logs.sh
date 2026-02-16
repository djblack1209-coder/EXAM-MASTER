#!/bin/bash
# ============================================
# Exam-Master 日志巡检脚本
# 过滤 500/502 错误，分析 RPC 调用失败
# ============================================

set -e

# 配置
NAMESPACE="${NAMESPACE:-exam-master}"
OUTPUT_DIR="${OUTPUT_DIR:-./log-inspection}"
HOURS="${HOURS:-24}"  # 检查最近多少小时的日志
KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
ES_URL="${ES_URL:-http://localhost:9200}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 日志文件
REPORT_FILE="${OUTPUT_DIR}/log-inspection-$(date +%Y%m%d-%H%M%S).md"
ERROR_LOG="${OUTPUT_DIR}/errors-$(date +%Y%m%d-%H%M%S).log"
RPC_LOG="${OUTPUT_DIR}/rpc-failures-$(date +%Y%m%d-%H%M%S).log"

# 打印带时间戳的日志
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
}

log_info() { log "${BLUE}INFO${NC}" "$1"; }
log_warn() { log "${YELLOW}WARN${NC}" "$1"; }
log_error() { log "${RED}ERROR${NC}" "$1"; }
log_success() { log "${GREEN}OK${NC}" "$1"; }

# 统计变量
TOTAL_500_ERRORS=0
TOTAL_502_ERRORS=0
TOTAL_RPC_FAILURES=0
AFFECTED_SERVICES=()

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl 未安装"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warn "jq 未安装，部分功能可能受限"
    fi
    
    log_success "依赖检查通过"
}

# 从 Kubernetes 日志中提取错误
inspect_k8s_logs() {
    log_info "========== 检查 Kubernetes Pod 日志 =========="
    
    # 获取所有 Pod
    local pods=$(kubectl get pods -n "$NAMESPACE" --no-headers -o custom-columns=":metadata.name" 2>/dev/null)
    
    if [ -z "$pods" ]; then
        log_warn "命名空间 $NAMESPACE 中没有找到 Pod"
        return
    fi
    
    for pod in $pods; do
        log_info "检查 Pod: $pod"
        
        # 提取 500 错误
        local errors_500=$(kubectl logs "$pod" -n "$NAMESPACE" --since="${HOURS}h" 2>/dev/null | \
            grep -E "(500|Internal Server Error|InternalServerError)" | head -50 || true)
        
        if [ -n "$errors_500" ]; then
            local count_500=$(echo "$errors_500" | wc -l)
            TOTAL_500_ERRORS=$((TOTAL_500_ERRORS + count_500))
            echo "=== Pod: $pod - 500 错误 ===" >> "$ERROR_LOG"
            echo "$errors_500" >> "$ERROR_LOG"
            echo "" >> "$ERROR_LOG"
            log_warn "Pod $pod 发现 $count_500 条 500 错误"
        fi
        
        # 提取 502 错误
        local errors_502=$(kubectl logs "$pod" -n "$NAMESPACE" --since="${HOURS}h" 2>/dev/null | \
            grep -E "(502|Bad Gateway|BadGateway)" | head -50 || true)
        
        if [ -n "$errors_502" ]; then
            local count_502=$(echo "$errors_502" | wc -l)
            TOTAL_502_ERRORS=$((TOTAL_502_ERRORS + count_502))
            echo "=== Pod: $pod - 502 错误 ===" >> "$ERROR_LOG"
            echo "$errors_502" >> "$ERROR_LOG"
            echo "" >> "$ERROR_LOG"
            log_warn "Pod $pod 发现 $count_502 条 502 错误"
        fi
        
        # 检查 RPC/gRPC 调用失败
        local rpc_errors=$(kubectl logs "$pod" -n "$NAMESPACE" --since="${HOURS}h" 2>/dev/null | \
            grep -iE "(rpc|grpc|connection refused|ECONNREFUSED|ETIMEDOUT|service unavailable|upstream connect error|no healthy upstream)" | head -50 || true)
        
        if [ -n "$rpc_errors" ]; then
            local count_rpc=$(echo "$rpc_errors" | wc -l)
            TOTAL_RPC_FAILURES=$((TOTAL_RPC_FAILURES + count_rpc))
            echo "=== Pod: $pod - RPC 调用失败 ===" >> "$RPC_LOG"
            echo "$rpc_errors" >> "$RPC_LOG"
            echo "" >> "$RPC_LOG"
            log_warn "Pod $pod 发现 $count_rpc 条 RPC 调用失败"
            AFFECTED_SERVICES+=("$pod")
        fi
    done
}

# 分析微服务间调用失败
analyze_rpc_failures() {
    log_info "========== 分析 RPC 调用失败 =========="
    
    if [ ! -f "$RPC_LOG" ] || [ ! -s "$RPC_LOG" ]; then
        log_success "未发现 RPC 调用失败"
        return
    fi
    
    echo ""
    echo "RPC 调用失败分析:"
    echo "----------------------------------------"
    
    # 统计连接拒绝错误
    local conn_refused=$(grep -c "ECONNREFUSED\|connection refused" "$RPC_LOG" 2>/dev/null || echo "0")
    echo "  连接拒绝 (ECONNREFUSED): $conn_refused 次"
    
    # 统计超时错误
    local timeouts=$(grep -c "ETIMEDOUT\|timeout" "$RPC_LOG" 2>/dev/null || echo "0")
    echo "  连接超时 (ETIMEDOUT): $timeouts 次"
    
    # 统计服务不可用
    local unavailable=$(grep -c "service unavailable\|no healthy upstream" "$RPC_LOG" 2>/dev/null || echo "0")
    echo "  服务不可用: $unavailable 次"
    
    # 统计上游连接错误
    local upstream=$(grep -c "upstream connect error" "$RPC_LOG" 2>/dev/null || echo "0")
    echo "  上游连接错误: $upstream 次"
    
    echo "----------------------------------------"
    
    # 分析可能的原因
    echo ""
    echo "可能的原因分析:"
    
    if [ "$conn_refused" -gt 0 ]; then
        echo "  [!] 连接拒绝: 目标服务可能未启动或端口配置错误"
    fi
    
    if [ "$timeouts" -gt 0 ]; then
        echo "  [!] 连接超时: 网络延迟过高或服务响应慢"
    fi
    
    if [ "$unavailable" -gt 0 ]; then
        echo "  [!] 服务不可用: 服务发现失败或所有实例都不健康"
    fi
    
    if [ "$upstream" -gt 0 ]; then
        echo "  [!] 上游错误: Ingress/网关无法连接到后端服务"
    fi
}

# 检查 Elasticsearch/Kibana 日志（如果可用）
inspect_elasticsearch_logs() {
    log_info "========== 检查 Elasticsearch 日志 =========="
    
    # 检查 ES 是否可用
    if ! curl -s "$ES_URL/_cluster/health" > /dev/null 2>&1; then
        log_warn "Elasticsearch 不可用，跳过 ES 日志检查"
        return
    fi
    
    log_info "Elasticsearch 可用，开始查询..."
    
    # 计算时间范围
    local since_time=$(date -u -v-${HOURS}H '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
                       date -u -d "${HOURS} hours ago" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null)
    
    # 查询 500 错误
    local query_500='{
        "query": {
            "bool": {
                "must": [
                    {"range": {"@timestamp": {"gte": "now-'${HOURS}'h"}}},
                    {"match": {"status_code": 500}}
                ]
            }
        },
        "size": 100
    }'
    
    local es_500=$(curl -s -X GET "$ES_URL/exam-master-*/_search" \
        -H "Content-Type: application/json" \
        -d "$query_500" 2>/dev/null | jq '.hits.total.value // 0' 2>/dev/null || echo "0")
    
    log_info "Elasticsearch 中 500 错误数: $es_500"
    
    # 查询 502 错误
    local query_502='{
        "query": {
            "bool": {
                "must": [
                    {"range": {"@timestamp": {"gte": "now-'${HOURS}'h"}}},
                    {"match": {"status_code": 502}}
                ]
            }
        },
        "size": 100
    }'
    
    local es_502=$(curl -s -X GET "$ES_URL/exam-master-*/_search" \
        -H "Content-Type: application/json" \
        -d "$query_502" 2>/dev/null | jq '.hits.total.value // 0' 2>/dev/null || echo "0")
    
    log_info "Elasticsearch 中 502 错误数: $es_502"
}

# 检查服务间连通性
check_service_connectivity() {
    log_info "========== 检查服务间连通性 =========="
    
    # 获取所有服务
    local services=$(kubectl get svc -n "$NAMESPACE" --no-headers -o custom-columns=":metadata.name,:spec.clusterIP,:spec.ports[*].port" 2>/dev/null)
    
    if [ -z "$services" ]; then
        log_warn "未找到服务"
        return
    fi
    
    echo ""
    echo "服务列表:"
    echo "----------------------------------------"
    kubectl get svc -n "$NAMESPACE" 2>/dev/null
    echo "----------------------------------------"
    
    # 检查 Endpoints
    echo ""
    echo "服务 Endpoints 状态:"
    echo "----------------------------------------"
    kubectl get endpoints -n "$NAMESPACE" 2>/dev/null
    echo "----------------------------------------"
    
    # 检查是否有空的 Endpoints（可能导致 502）
    local empty_endpoints=$(kubectl get endpoints -n "$NAMESPACE" -o json 2>/dev/null | \
        jq -r '.items[] | select(.subsets == null or .subsets == []) | .metadata.name' 2>/dev/null)
    
    if [ -n "$empty_endpoints" ]; then
        log_error "发现空的 Endpoints（可能导致 502 错误）:"
        echo "$empty_endpoints" | while read ep; do
            echo "  - $ep"
        done
    else
        log_success "所有服务 Endpoints 正常"
    fi
}

# 生成巡检报告
generate_report() {
    log_info "生成巡检报告: $REPORT_FILE"
    
    cat > "$REPORT_FILE" << EOF
# Exam-Master 日志巡检报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**检查范围**: 最近 ${HOURS} 小时
**命名空间**: $NAMESPACE

---

## 1. 错误统计摘要

| 错误类型 | 数量 | 严重程度 |
|---------|------|---------|
| 500 Internal Server Error | $TOTAL_500_ERRORS | $([ $TOTAL_500_ERRORS -gt 10 ] && echo "严重" || echo "正常") |
| 502 Bad Gateway | $TOTAL_502_ERRORS | $([ $TOTAL_502_ERRORS -gt 10 ] && echo "严重" || echo "正常") |
| RPC 调用失败 | $TOTAL_RPC_FAILURES | $([ $TOTAL_RPC_FAILURES -gt 5 ] && echo "严重" || echo "正常") |

## 2. 500 错误分析

$(if [ $TOTAL_500_ERRORS -gt 0 ]; then
    echo "### 可能原因"
    echo "- 后端服务内部异常"
    echo "- 数据库连接失败"
    echo "- 未捕获的异常"
    echo ""
    echo "### 错误样本"
    echo "\`\`\`"
    head -20 "$ERROR_LOG" 2>/dev/null || echo "无错误日志"
    echo "\`\`\`"
else
    echo "未发现 500 错误"
fi)

## 3. 502 错误分析

$(if [ $TOTAL_502_ERRORS -gt 0 ]; then
    echo "### 可能原因"
    echo "- 后端服务不可用"
    echo "- 服务启动中"
    echo "- 网关/Ingress 配置错误"
    echo "- 健康检查失败"
    echo ""
    echo "### 建议排查"
    echo "1. 检查后端 Pod 状态: \`kubectl get pods -n $NAMESPACE\`"
    echo "2. 检查服务 Endpoints: \`kubectl get endpoints -n $NAMESPACE\`"
    echo "3. 检查 Ingress 配置: \`kubectl describe ingress -n $NAMESPACE\`"
else
    echo "未发现 502 错误"
fi)

## 4. RPC/微服务调用失败分析

$(if [ $TOTAL_RPC_FAILURES -gt 0 ]; then
    echo "### 受影响的服务"
    for svc in "${AFFECTED_SERVICES[@]}"; do
        echo "- $svc"
    done
    echo ""
    echo "### 失败类型统计"
    echo "- 连接拒绝: $(grep -c "ECONNREFUSED\|connection refused" "$RPC_LOG" 2>/dev/null || echo "0") 次"
    echo "- 连接超时: $(grep -c "ETIMEDOUT\|timeout" "$RPC_LOG" 2>/dev/null || echo "0") 次"
    echo "- 服务不可用: $(grep -c "service unavailable" "$RPC_LOG" 2>/dev/null || echo "0") 次"
    echo ""
    echo "### 可能原因（微服务拆分相关）"
    echo "1. **服务发现问题**: 新拆分的服务未正确注册到服务发现"
    echo "2. **网络策略**: NetworkPolicy 阻止了服务间通信"
    echo "3. **端口配置**: 服务端口配置不一致"
    echo "4. **DNS 解析**: 服务 DNS 名称解析失败"
    echo "5. **负载均衡**: 新服务实例未加入负载均衡池"
    echo ""
    echo "### 错误样本"
    echo "\`\`\`"
    head -30 "$RPC_LOG" 2>/dev/null || echo "无 RPC 错误日志"
    echo "\`\`\`"
else
    echo "未发现 RPC 调用失败"
fi)

## 5. 服务状态

### Pod 状态
\`\`\`
$(kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null || echo "无法获取 Pod 状态")
\`\`\`

### Service 状态
\`\`\`
$(kubectl get svc -n "$NAMESPACE" 2>/dev/null || echo "无法获取 Service 状态")
\`\`\`

### Endpoints 状态
\`\`\`
$(kubectl get endpoints -n "$NAMESPACE" 2>/dev/null || echo "无法获取 Endpoints 状态")
\`\`\`

## 6. 建议操作

$(if [ $TOTAL_500_ERRORS -gt 10 ] || [ $TOTAL_502_ERRORS -gt 10 ] || [ $TOTAL_RPC_FAILURES -gt 5 ]; then
    echo "### 紧急"
    echo "- [ ] 检查所有 Pod 健康状态"
    echo "- [ ] 查看详细错误日志定位根因"
    echo "- [ ] 检查数据库和缓存连接"
    echo ""
fi)

### 常规
- [ ] 检查服务配置是否正确
- [ ] 验证服务间网络连通性
- [ ] 检查资源限制是否合理
- [ ] 查看 Prometheus 告警

---

## 附件

- 错误日志: \`$ERROR_LOG\`
- RPC 失败日志: \`$RPC_LOG\`

---
*报告由 inspect-logs.sh 自动生成*
EOF

    log_success "报告已生成: $REPORT_FILE"
}

# 显示帮助
show_help() {
    cat << EOF
Exam-Master 日志巡检脚本

用法: $0 [选项]

选项:
    -n, --namespace     指定命名空间（默认: exam-master）
    -t, --hours         检查最近多少小时的日志（默认: 24）
    -o, --output        输出目录（默认: ./log-inspection）
    -e, --es-url        Elasticsearch URL（默认: http://localhost:9200）
    -k, --kibana-url    Kibana URL（默认: http://localhost:5601）
    -h, --help          显示帮助

示例:
    $0                              # 使用默认配置检查
    $0 -t 6                         # 检查最近 6 小时
    $0 -n exam-master -t 12         # 指定命名空间和时间范围
    $0 -e http://es:9200            # 指定 ES 地址

EOF
}

# 主函数
main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -t|--hours)
                HOURS="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -e|--es-url)
                ES_URL="$2"
                shift 2
                ;;
            -k|--kibana-url)
                KIBANA_URL="$2"
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
    
    # 重新设置输出文件路径
    mkdir -p "$OUTPUT_DIR"
    REPORT_FILE="${OUTPUT_DIR}/log-inspection-$(date +%Y%m%d-%H%M%S).md"
    ERROR_LOG="${OUTPUT_DIR}/errors-$(date +%Y%m%d-%H%M%S).log"
    RPC_LOG="${OUTPUT_DIR}/rpc-failures-$(date +%Y%m%d-%H%M%S).log"
    
    echo "============================================"
    echo "  Exam-Master 日志巡检"
    echo "============================================"
    echo ""
    log_info "命名空间: $NAMESPACE"
    log_info "检查范围: 最近 ${HOURS} 小时"
    log_info "输出目录: $OUTPUT_DIR"
    echo ""
    
    check_dependencies
    
    # 执行检查
    inspect_k8s_logs
    analyze_rpc_failures
    inspect_elasticsearch_logs
    check_service_connectivity
    
    # 生成报告
    generate_report
    
    # 输出摘要
    echo ""
    echo "============================================"
    echo "  巡检摘要"
    echo "============================================"
    echo ""
    echo "  500 错误总数: $TOTAL_500_ERRORS"
    echo "  502 错误总数: $TOTAL_502_ERRORS"
    echo "  RPC 调用失败: $TOTAL_RPC_FAILURES"
    echo ""
    
    if [ $TOTAL_500_ERRORS -gt 10 ] || [ $TOTAL_502_ERRORS -gt 10 ] || [ $TOTAL_RPC_FAILURES -gt 5 ]; then
        log_error "发现严重问题，请立即处理！"
        echo ""
        echo "详细信息请查看报告: $REPORT_FILE"
        exit 1
    else
        log_success "巡检完成，未发现严重问题"
        echo ""
        echo "详细报告: $REPORT_FILE"
    fi
}

main "$@"
