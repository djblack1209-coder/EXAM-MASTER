#!/usr/bin/env bash
# ============================================
# EXAM-MASTER 故障转移测试脚本
#
# 测试场景:
#   1. 正常连通性测试
#   2. 主后端健康检查
#   3. 模拟主后端故障 → 验证自动切换到 Sealos
#   4. 恢复主后端 → 验证自动恢复
#
# 用法: bash deploy/tencent/scripts/failover-test.sh [server-ip]
# ============================================

set -euo pipefail

SERVER="${1:-101.43.41.96}"
SEALOS="https://nf98ia8qnt.sealosbja.site"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "  ${RED}✗ FAIL${NC}: $1"; FAILURES=$((FAILURES+1)); }
info() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
FAILURES=0

echo "============================================"
echo "  EXAM-MASTER 故障转移测试"
echo "  Target: ${SERVER}"
echo "  Sealos: ${SEALOS}"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ==================== Test 1: Nginx 连通性 ====================
info "Test 1: Nginx 连通性"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Nginx 健康检查 (HTTP ${HTTP_CODE})"
else
    fail "Nginx 不可达 (HTTP ${HTTP_CODE})"
fi

# ==================== Test 2: 主后端连通性 ====================
info "Test 2: 主后端 (Docker) 连通性"

RESPONSE=$(curl -s "http://${SERVER}/exam-master/health-check" 2>/dev/null || echo '{"error":"unreachable"}')
if echo "$RESPONSE" | jq -e '.code == 0 or .status == "ok"' > /dev/null 2>&1; then
    pass "主后端健康检查正常"
    echo "       Response: $(echo $RESPONSE | jq -c '.' 2>/dev/null || echo $RESPONSE)"
else
    fail "主后端不可达: $RESPONSE"
fi

# ==================== Test 3: Sealos 备用连通性 ====================
info "Test 3: Sealos 备用后端连通性"

SEALOS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SEALOS}/health-check" --max-time 10 2>/dev/null || echo "000")
if [ "$SEALOS_CODE" = "200" ]; then
    pass "Sealos 后端可达 (HTTP ${SEALOS_CODE})"
else
    fail "Sealos 后端不可达 (HTTP ${SEALOS_CODE})"
fi

# ==================== Test 4: API 端到端 ====================
info "Test 4: API 端到端 (school-query)"

API_RESPONSE=$(curl -s -X POST "http://${SERVER}/exam-master/school-query" \
    -H "Content-Type: application/json" \
    -d '{"action":"search","keyword":"清华"}' \
    --max-time 15 2>/dev/null || echo '{"error":"timeout"}')

if echo "$API_RESPONSE" | jq -e '.code == 0 or .success == true' > /dev/null 2>&1; then
    pass "school-query API 正常"
else
    warn_msg=$(echo "$API_RESPONSE" | head -c 200)
    fail "school-query API 异常: ${warn_msg}"
fi

# ==================== Test 5: 模拟故障转移 ====================
info "Test 5: 模拟主后端故障 (需要 SSH 权限)"

echo -e "  ${YELLOW}[手动步骤]${NC} 请在另一个终端执行:"
echo "    ssh root@${SERVER} 'docker stop exam-master-backend'"
echo ""
read -p "  已停止主后端容器? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  等待 Nginx 检测故障 (30s fail_timeout)..."
    sleep 5

    # 测试是否自动切换到 Sealos
    FAILOVER_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER}/exam-master/health-check" --max-time 15 2>/dev/null || echo "000")
    FAILOVER_RESPONSE=$(curl -s "http://${SERVER}/exam-master/health-check" --max-time 15 2>/dev/null || echo "")

    if [ "$FAILOVER_CODE" = "200" ]; then
        pass "故障转移成功！请求已路由到 Sealos 备用 (HTTP ${FAILOVER_CODE})"
    elif [ "$FAILOVER_CODE" = "502" ] || [ "$FAILOVER_CODE" = "504" ]; then
        # Nginx 可能还在尝试主后端
        echo "  等待 Nginx 标记主后端为 down..."
        sleep 30
        FAILOVER_CODE2=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER}/exam-master/health-check" --max-time 15 2>/dev/null || echo "000")
        if [ "$FAILOVER_CODE2" = "200" ]; then
            pass "故障转移成功 (延迟后)！HTTP ${FAILOVER_CODE2}"
        else
            fail "故障转移失败 (HTTP ${FAILOVER_CODE2})"
        fi
    else
        fail "故障转移异常 (HTTP ${FAILOVER_CODE})"
    fi

    # ==================== Test 6: 恢复测试 ====================
    info "Test 6: 恢复主后端"
    echo -e "  ${YELLOW}[手动步骤]${NC} 请执行:"
    echo "    ssh root@${SERVER} 'docker start exam-master-backend'"
    echo ""
    read -p "  已重启主后端? (y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  等待容器启动 (10s)..."
        sleep 10

        RECOVERY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER}/exam-master/health-check" --max-time 10 2>/dev/null || echo "000")
        if [ "$RECOVERY_CODE" = "200" ]; then
            pass "主后端已恢复 (HTTP ${RECOVERY_CODE})"
        else
            fail "主后端恢复失败 (HTTP ${RECOVERY_CODE})"
        fi
    fi
else
    echo "  跳过故障转移测试"
fi

# ==================== 结果汇总 ====================
echo ""
echo "============================================"
if [ $FAILURES -eq 0 ]; then
    echo -e "  ${GREEN}所有测试通过！${NC}"
else
    echo -e "  ${RED}${FAILURES} 个测试失败${NC}"
fi
echo "============================================"

exit $FAILURES
