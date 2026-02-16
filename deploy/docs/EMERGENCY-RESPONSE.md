# Exam-Master 应急响应手册

> 版本: v1.0.0 | 更新日期: 2026-01-27 | 维护者: DevOps Team

---

## 一、告警分级与响应时效

| 级别 | 定义 | 响应时间 | 通知方式 | 示例 |
|------|------|----------|----------|------|
| **P0** | 服务完全不可用 | 5 分钟内 | 电话 + 短信 + 企业微信 | 服务宕机、数据库不可用 |
| **P1** | 服务严重降级 | 15 分钟内 | 短信 + 企业微信 | 错误率 >1%、延迟 >2s |
| **P2** | 服务轻微异常 | 30 分钟内 | 邮件 + 企业微信 | CPU >80%、磁盘 >85% |
| **P3** | 预警/优化建议 | 4 小时内 | 邮件 | 证书即将过期、资源利用率低 |

---

## 二、On-Call 轮值制度

### 2.1 轮值安排
- 轮值周期：每周一 10:00 交接
- 轮值人员：至少 2 人（主 + 备）
- 交接内容：未解决问题、待观察事项、本周变更计划

### 2.2 On-Call 职责
1. 7×24 小时响应告警
2. 初步定位问题并执行应急处理
3. 必要时升级至相关负责人
4. 记录故障处理过程和根因分析

### 2.3 升级路径
```
On-Call 工程师 → 技术负责人 → CTO → CEO
     5分钟          15分钟      30分钟
```

---

## 三、常见故障处理

### 3.1 服务不可用 (ServiceDown)

**症状**: 健康检查失败，用户无法访问

**排查步骤**:
```bash
# 1. 检查 Pod 状态
kubectl get pods -n exam-master -o wide

# 2. 查看 Pod 事件
kubectl describe pod <pod-name> -n exam-master

# 3. 查看容器日志
kubectl logs -f <pod-name> -n exam-master --tail=100

# 4. 检查 Service 和 Endpoints
kubectl get svc,ep -n exam-master

# 5. 检查 Ingress
kubectl describe ingress -n exam-master
```

**处理方案**:
| 原因 | 处理方式 |
|------|----------|
| Pod CrashLoopBackOff | 查看日志定位错误，修复后重新部署 |
| ImagePullBackOff | 检查镜像地址和拉取凭证 |
| Pending (资源不足) | 扩容节点或调整资源请求 |
| Ingress 配置错误 | 检查并修复 Ingress 规则 |

---

### 3.2 Pod OOMKilled

**症状**: Pod 因内存不足被终止

**排查步骤**:
```bash
# 1. 确认 OOM 事件
kubectl describe pod <pod-name> -n exam-master | grep -A5 "Last State"

# 2. 查看内存使用历史
kubectl top pods -n exam-master

# 3. 查看 Prometheus 内存指标
# 访问 Grafana 监控大盘
```

**处理方案**:
```bash
# 临时方案：增加内存限制
kubectl patch deployment exam-master-backend -n exam-master \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi"}}}]}}}}'

# 长期方案：优化代码内存使用，添加内存泄漏检测
```

**预防措施**:
- 设置合理的内存 requests 和 limits
- 配置 HPA 自动扩缩容
- 定期进行内存泄漏检测

---

### 3.3 数据库主从切换

**症状**: MongoDB 主节点不可用

**排查步骤**:
```bash
# 1. 检查 MongoDB 副本集状态
kubectl exec -it mongodb-0 -n exam-master -- mongosh --eval "rs.status()"

# 2. 查看主节点
kubectl exec -it mongodb-0 -n exam-master -- mongosh --eval "rs.isMaster()"

# 3. 检查连接数
kubectl exec -it mongodb-0 -n exam-master -- mongosh --eval "db.serverStatus().connections"
```

**处理方案**:
```bash
# 手动触发主从切换（如需要）
kubectl exec -it mongodb-0 -n exam-master -- mongosh --eval "rs.stepDown()"

# 检查应用连接字符串是否使用副本集模式
# mongodb://mongodb-0,mongodb-1,mongodb-2/exam-master?replicaSet=rs0
```

---

### 3.4 流量突增

**症状**: QPS 异常升高，响应延迟增加

**排查步骤**:
```bash
# 1. 查看当前 QPS
kubectl exec -n exam-master deploy/prometheus -- \
  promtool query instant 'sum(rate(http_requests_total{namespace="exam-master"}[1m]))'

# 2. 查看 HPA 状态
kubectl get hpa -n exam-master

# 3. 查看 Pod 资源使用
kubectl top pods -n exam-master
```

**处理方案**:
```bash
# 1. 手动扩容
kubectl scale deployment exam-master-backend -n exam-master --replicas=10

# 2. 调整 HPA 配置
kubectl patch hpa exam-master-backend-hpa -n exam-master \
  -p '{"spec":{"maxReplicas":20}}'

# 3. 启用限流（如果是恶意流量）
# 修改 Ingress 限流配置
kubectl annotate ingress exam-master-ingress -n exam-master \
  nginx.ingress.kubernetes.io/limit-rps="50" --overwrite
```

---

### 3.5 504 Gateway Timeout

**症状**: 请求超时，返回 504 错误

**排查步骤**:
```bash
# 1. 检查后端服务响应时间
kubectl logs -f <pod-name> -n exam-master | grep -i "response time"

# 2. 检查 Ingress 超时配置
kubectl describe ingress exam-master-ingress -n exam-master

# 3. 检查上游服务（AI API）响应时间
```

**处理方案**:
```bash
# 1. 增加 Ingress 超时时间
kubectl annotate ingress exam-master-ingress -n exam-master \
  nginx.ingress.kubernetes.io/proxy-read-timeout="120" --overwrite

# 2. 优化慢接口
# 检查 AI 调用是否需要异步处理

# 3. 添加请求超时熔断
```

---

### 3.6 证书过期

**症状**: HTTPS 访问失败，浏览器提示证书错误

**排查步骤**:
```bash
# 1. 检查证书有效期
kubectl get secret exam-master-tls -n exam-master -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -dates

# 2. 检查 cert-manager 状态
kubectl get certificate -n exam-master
kubectl describe certificate exam-master-tls -n exam-master
```

**处理方案**:
```bash
# 1. 手动触发证书续期
kubectl delete certificate exam-master-tls -n exam-master
# cert-manager 会自动重新申请

# 2. 检查 cert-manager 日志
kubectl logs -n cert-manager deploy/cert-manager

# 3. 临时方案：手动更新证书
kubectl create secret tls exam-master-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n exam-master --dry-run=client -o yaml | kubectl apply -f -
```

---

## 四、回滚操作

### 4.1 应用回滚

```bash
# 查看部署历史
kubectl rollout history deployment/exam-master-backend -n exam-master

# 回滚到上一版本
kubectl rollout undo deployment/exam-master-backend -n exam-master

# 回滚到指定版本
kubectl rollout undo deployment/exam-master-backend -n exam-master --to-revision=2

# 验证回滚状态
kubectl rollout status deployment/exam-master-backend -n exam-master
```

### 4.2 数据库回滚

```bash
# 列出可用备份
./deploy/scripts/restore-mongodb.sh list

# 执行恢复
./deploy/scripts/restore-mongodb.sh full exam-master-full-20260127_030000.tar.gz

# 时间点恢复
./deploy/scripts/restore-mongodb.sh point-in-time \
  exam-master-full-20260127_030000.tar.gz \
  "2026-01-27 05:00:00"
```

### 4.3 配置回滚

```bash
# 使用 GitOps 回滚（ArgoCD）
argocd app rollback exam-master --revision <revision>

# 或手动回滚 ConfigMap
kubectl rollout undo deployment/exam-master-backend -n exam-master
```

---

## 五、故障复盘模板

### 5.1 复盘报告模板

```markdown
# 故障复盘报告

## 基本信息
- 故障时间：YYYY-MM-DD HH:MM - HH:MM
- 影响范围：
- 故障级别：P0/P1/P2
- 值班人员：

## 故障时间线
| 时间 | 事件 | 操作人 |
|------|------|--------|
| HH:MM | 收到告警 | |
| HH:MM | 开始排查 | |
| HH:MM | 定位原因 | |
| HH:MM | 执行修复 | |
| HH:MM | 服务恢复 | |

## 根因分析
### 直接原因

### 根本原因

## 影响评估
- 影响用户数：
- 影响时长：
- 业务损失：

## 改进措施
| 措施 | 负责人 | 完成时间 |
|------|--------|----------|
| | | |

## 经验教训

```

---

## 六、常用命令速查

### 6.1 Kubernetes 命令

```bash
# 查看所有资源
kubectl get all -n exam-master

# 查看 Pod 日志
kubectl logs -f <pod-name> -n exam-master --tail=100

# 进入 Pod 调试
kubectl exec -it <pod-name> -n exam-master -- /bin/sh

# 查看资源使用
kubectl top pods -n exam-master
kubectl top nodes

# 查看事件
kubectl get events -n exam-master --sort-by='.lastTimestamp'

# 强制删除 Pod
kubectl delete pod <pod-name> -n exam-master --force --grace-period=0
```

### 6.2 监控命令

```bash
# 查看 Prometheus 告警
kubectl exec -n exam-master deploy/prometheus -- \
  promtool query instant 'ALERTS{alertstate="firing"}'

# 查看错误率
kubectl exec -n exam-master deploy/prometheus -- \
  promtool query instant 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100'
```

### 6.3 数据库命令

```bash
# 连接 MongoDB
kubectl exec -it mongodb-0 -n exam-master -- mongosh

# 查看数据库状态
db.serverStatus()

# 查看慢查询
db.currentOp({"secs_running": {$gt: 5}})
```

---

## 七、联系方式

| 角色 | 姓名 | 电话 | 企业微信 |
|------|------|------|----------|
| 技术负责人 | | | |
| DBA | | | |
| 安全负责人 | | | |
| 产品负责人 | | | |

---

*最后更新: 2026-01-27 | 下次审核: 2026-04-27*
