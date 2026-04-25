# 部署与运维指南

> 合并自 deploy/docs/ 和 laf-backend/ 中的部署文档

---

# Exam-Master 部署运维手册

> 版本: v1.0.0 | 更新日期: 2026-01-27 | 维护者: DevOps Team

---

## 一、系统架构

### 1.1 整体架构图

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                        用户端                                │
                                    │  ┌─────────────────┐         ┌─────────────────┐           │
                                    │  │   微信小程序     │         │      H5 端      │           │
                                    │  │  (uni-app)      │         │   (uni-app)     │           │
                                    │  └────────┬────────┘         └────────┬────────┘           │
                                    └───────────┼────────────────────────────┼───────────────────┘
                                                │                            │
                                                ▼                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         Sealos 云平台                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Kubernetes Cluster (exam-master namespace)                      │  │
│  │                                                                                              │  │
│  │   ┌──────────────────┐     ┌──────────────────────────────────────────────────────────┐    │  │
│  │   │  Nginx Ingress   │────▶│                    Service Mesh                          │    │  │
│  │   │  (SSL/WAF/限流)   │     │  ┌────────────────┐    ┌────────────────┐               │    │  │
│  │   └──────────────────┘     │  │   Frontend     │    │    Backend     │               │    │  │
│  │                            │  │   (Nginx)      │    │   (Node.js)    │               │    │  │
│  │                            │  │   Replicas: 2  │    │   Replicas: 2  │               │    │  │
│  │                            │  │   HPA: 2-5     │    │   HPA: 2-10    │               │    │  │
│  │                            │  └────────────────┘    └───────┬────────┘               │    │  │
│  │                            └────────────────────────────────┼────────────────────────┘    │  │
│  │                                                             │                             │  │
│  │   ┌─────────────────────────────────────────────────────────┼─────────────────────────┐  │  │
│  │   │                           数据层                         │                         │  │  │
│  │   │   ┌────────────────┐    ┌────────────────┐    ┌────────┴───────┐                 │  │  │
│  │   │   │    MongoDB     │    │     Redis      │    │   ConfigMap    │                 │  │  │
│  │   │   │  (ReplicaSet)  │    │   (Cluster)    │    │    Secrets     │                 │  │  │
│  │   │   └────────────────┘    └────────────────┘    └────────────────┘                 │  │  │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                          │  │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │   │                           监控层                                                   │  │  │
│  │   │   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐                 │  │  │
│  │   │   │   Prometheus   │───▶│    Grafana     │    │  AlertManager  │                 │  │  │
│  │   │   │   (指标采集)    │    │   (可视化)     │    │    (告警)      │                 │  │  │
│  │   │   └────────────────┘    └────────────────┘    └────────────────┘                 │  │  │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────────┐
                              │           外部服务                   │
                              │  ┌───────────┐    ┌───────────┐    │
                              │  │ 智谱 AI   │    │ 腾讯云 BDA │    │
                              │  │ GLM-4-Plus│    │ (人像分割) │    │
                              │  └───────────┘    └───────────┘    │
                              └─────────────────────────────────────┘
```

### 1.2 CI/CD 流水线

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Push   │───▶│  Lint   │───▶│  Test   │───▶│ Security│───▶│  Build  │───▶│ Deploy  │
│  Code   │    │  Check  │    │  Unit   │    │  Scan   │    │  Image  │    │ Staging │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                                                │
                                                                                ▼
                                                                         ┌─────────────┐
                                                                         │   Canary    │
                                                                         │  (5% 流量)   │
                                                                         └──────┬──────┘
                                                                                │ 10分钟观察
                                                                                ▼
                                                                         ┌─────────────┐
                                                                         │  Full Deploy│
                                                                         │  (100% 流量) │
                                                                         └─────────────┘
```

---

## 二、环境信息

### 2.1 生产环境

| 项目 | 值 |
|------|-----|
| 集群地址 | Sealos (sealosbja) |
| 命名空间 | exam-master |
| API 域名 | nf98ia8qnt.sealosbja.site |
| 镜像仓库 | ghcr.io/exam-master |
| 监控地址 | grafana.exam-master.example.com |

### 2.2 资源配置

| 组件 | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|------|-------------|-----------|----------------|--------------|----------|
| Backend | 100m | 500m | 256Mi | 512Mi | 2-10 |
| Frontend | 50m | 200m | 64Mi | 128Mi | 2-5 |
| MongoDB | 500m | 2000m | 1Gi | 4Gi | 3 |
| Redis | 100m | 500m | 256Mi | 512Mi | 3 |

---

## 三、部署指南

### 3.1 前置条件

```bash
# 安装必要工具
brew install kubectl helm docker

# 配置 kubectl
mkdir -p ~/.kube
# 将 kubeconfig 内容写入 ~/.kube/config

# 验证连接
kubectl cluster-info
kubectl get nodes
```

### 3.2 首次部署

```bash
# 1. 创建命名空间
kubectl apply -f deploy/k8s/namespace.yaml

# 2. 创建 RBAC 配置
kubectl apply -f deploy/k8s/rbac.yaml

# 3. 创建 ConfigMap 和 Secrets
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/secrets.yaml

# 4. 部署应用
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
kubectl apply -f deploy/k8s/ingress.yaml
kubectl apply -f deploy/k8s/hpa.yaml

# 5. 验证部署
kubectl get all -n exam-master
kubectl rollout status deployment/exam-master-backend -n exam-master
```

### 3.3 更新部署

```bash
# 方式一：通过 CI/CD 自动部署（推荐）
git push origin main

# 方式二：手动更新镜像
kubectl set image deployment/exam-master-backend \
  backend=ghcr.io/exam-master/exam-master-backend:v1.0.1 \
  -n exam-master

# 验证更新
kubectl rollout status deployment/exam-master-backend -n exam-master
```

### 3.4 回滚部署

```bash
# 查看历史版本
kubectl rollout history deployment/exam-master-backend -n exam-master

# 回滚到上一版本
kubectl rollout undo deployment/exam-master-backend -n exam-master

# 回滚到指定版本
kubectl rollout undo deployment/exam-master-backend -n exam-master --to-revision=2
```

---

## 四、监控告警

### 4.1 监控指标

| 指标类型 | 指标名称 | 告警阈值 | 说明 |
|----------|----------|----------|------|
| 业务指标 | QPS | - | 每秒请求数 |
| 业务指标 | 错误率 | >1% (P1), >5% (P0) | 5xx 错误占比 |
| 业务指标 | P95 延迟 | >2s (P1) | 95 分位响应时间 |
| 资源指标 | CPU 使用率 | >80% (P1) | 容器 CPU 使用率 |
| 资源指标 | 内存使用率 | >85% (P1) | 容器内存使用率 |
| 资源指标 | 磁盘使用率 | >85% (P2) | 节点磁盘使用率 |

### 4.2 告警通知

| 级别 | 通知方式 | 响应时间 |
|------|----------|----------|
| P0 | 电话 + 短信 + 企业微信 | 5 分钟 |
| P1 | 短信 + 企业微信 | 15 分钟 |
| P2 | 邮件 + 企业微信 | 30 分钟 |

### 4.3 Grafana 大盘

访问地址：`http://localhost:3001` (本地) 或 `https://grafana.exam-master.example.com` (生产)

主要大盘：
- Exam-Master 监控大盘：服务概览、资源使用、API 性能
- MongoDB 监控大盘：连接数、查询性能、复制延迟
- Node 监控大盘：节点资源使用情况

---

## 五、备份恢复

### 5.1 备份策略

| 备份类型 | 频率 | 保留时间 | 存储位置 |
|----------|------|----------|----------|
| 全量备份 | 每日 03:00 | 30 天 | 本地 + OSS |
| 增量备份 | 每小时 | 7 天 | 本地 |
| 跨地域备份 | 每日 | 30 天 | 异地 OSS |

### 5.2 备份命令

```bash
# 手动执行全量备份
./deploy/scripts/backup-mongodb.sh full

# 手动执行增量备份
./deploy/scripts/backup-mongodb.sh incremental

# 列出可用备份
./deploy/scripts/restore-mongodb.sh list
```

### 5.3 恢复命令

```bash
# 全量恢复
./deploy/scripts/restore-mongodb.sh full exam-master-full-20260127_030000.tar.gz

# 时间点恢复
./deploy/scripts/restore-mongodb.sh point-in-time \
  exam-master-full-20260127_030000.tar.gz \
  "2026-01-27 05:00:00"
```

---

## 六、安全配置

### 6.1 安全基线

| 项目 | 要求 | 状态 |
|------|------|------|
| 容器运行用户 | 非 root | ✅ |
| 镜像漏洞扫描 | High 级别必须修复 | ✅ |
| 网络策略 | 最小化开放端口 | ✅ |
| Secret 管理 | 使用 K8s Secrets | ✅ |
| SSL/TLS | 强制 HTTPS | ✅ |
| WAF | 启用基础防护 | ✅ |

### 6.2 安全扫描

```bash
# 运行依赖漏洞扫描
npm audit

# 运行容器镜像扫描
trivy image exam-master-backend:latest

# 查看安全扫描报告
# GitHub Actions 自动生成，查看 Security 标签页
```

---

## 七、常用命令

### 7.1 日常运维

```bash
# 查看所有资源
kubectl get all -n exam-master

# 查看 Pod 日志
kubectl logs -f deployment/exam-master-backend -n exam-master --tail=100

# 进入 Pod 调试
kubectl exec -it <pod-name> -n exam-master -- /bin/sh

# 查看资源使用
kubectl top pods -n exam-master

# 查看事件
kubectl get events -n exam-master --sort-by='.lastTimestamp'
```

### 7.2 扩缩容

```bash
# 手动扩容
kubectl scale deployment exam-master-backend -n exam-master --replicas=5

# 查看 HPA 状态
kubectl get hpa -n exam-master

# 调整 HPA 配置
kubectl patch hpa exam-master-backend-hpa -n exam-master \
  -p '{"spec":{"maxReplicas":15}}'
```

### 7.3 配置更新

```bash
# 更新 ConfigMap
kubectl edit configmap exam-master-config -n exam-master

# 更新 Secret
kubectl edit secret exam-master-secrets -n exam-master

# 重启 Pod 以应用新配置
kubectl rollout restart deployment/exam-master-backend -n exam-master
```

---

## 八、依赖清单

### 8.1 外部服务依赖

| 服务 | 用途 | 地址 | 备注 |
|------|------|------|------|
| 智谱 AI | AI 对话/出题 | api.zhipuai.cn | GLM-4-Plus |
| 腾讯云 BDA | 人像分割 | bda.tencentcloudapi.com | |
| 微信开放平台 | 小程序登录 | api.weixin.qq.com | |

### 8.2 内部服务依赖

| 服务 | 版本 | 用途 |
|------|------|------|
| MongoDB | 7.0 | 主数据库 |
| Redis | 7.x | 缓存/会话 |
| Nginx | 1.25 | 反向代理 |
| Node.js | 20.x | 后端运行时 |

---

## 九、联系方式

| 角色 | 职责 | 联系方式 |
|------|------|----------|
| 技术负责人 | 技术决策、架构设计 | |
| DevOps | 部署运维、监控告警 | |
| DBA | 数据库管理、备份恢复 | |
| 安全负责人 | 安全审计、漏洞修复 | |

---

*最后更新: 2026-01-27 | 维护者: DevOps Team*

---
# smart-study-engine Sealos Laf 部署指南

> 将智能学习引擎云函数部署到 Sealos Laf 备用环境

## 背景

- 函数文件: `laf-backend/functions/smart-study-engine.ts` (1071 行)
- 4 个核心 action: `analyze_mastery` | `error_clustering` | `sprint_priority` | `generate_plan`
- 依赖: FSRS 算法、requireAuth 鉴权、checkRateLimitDistributed 分布式限流
- 当前状态: 仅在腾讯云主服务器运行，Sealos 备用环境缺失此函数
- 影响: AIDailyBriefing 功能在 Sealos 故障转移时退化为纯本地规则

## 部署步骤

### 1. 打开 Sealos Laf 控制台

访问: https://nf98ia8qnt.sealosbja.site  
登录后进入「云函数」管理页面

### 2. 创建新云函数

1. 点击「+ 新建云函数」
2. 函数名称: `smart-study-engine`
3. 请求方法: `POST`
4. 描述: `智能学习引擎 - 自适应学习计划/知识图谱分析/间隔重复调度`

### 3. 粘贴代码

1. 打开本地文件 `laf-backend/functions/smart-study-engine.ts`
2. 全选复制，粘贴到 Laf 编辑器中
3. **注意**: 函数开头的 `import` 语句中引用的公共模块 (`requireAuth`, `checkRateLimitDistributed` 等) 必须已在 Laf 上部署

### 4. 检查依赖模块

确保以下公共模块已部署到 Sealos:

| 模块 | 用途 | 状态 |
|------|------|------|
| `requireAuth` | 用户鉴权 | 应该已有 |
| `checkRateLimitDistributed` | 分布式限流 | 应该已有 |
| FSRS 相关 | 间隔重复算法 | 检查 `ts-fsrs` 是否在 Laf 依赖中 |

如果 `ts-fsrs` 未安装:
1. 进入 Laf 控制台的「依赖管理」
2. 搜索并安装 `ts-fsrs`

### 5. 发布并测试

1. 点击「发布」按钮部署函数
2. 在 Laf 控制台的「日志」面板中观察是否有错误
3. 使用以下 curl 命令测试:

```bash
# 替换 YOUR_TOKEN 为有效的用户 token
curl -X POST https://nf98ia8qnt.sealosbja.site/smart-study-engine \
  -H "Content-Type: application/json" \
  -H "Authorization: ${AUTH_HEADER}" \
  -d '{"action": "analyze_mastery", "params": {"subjectId": "test"}}'
```

预期返回: `{"code": 0, "data": {...}}` 或 `{"code": 401, ...}`（token 无效时）

### 6. 验证故障转移

部署后，AIDailyBriefing 在主服务器故障时会自动切换到 Sealos，此时应能调用 smart-study-engine 获取个性化学习建议，而非退化到纯本地规则。

## 注意事项

- 代码中的 MongoDB 集合名称（如 `answers`, `questions`）在 Sealos Laf 中需与主服务器保持一致
- 函数内置了限流机制（60秒内3次），确保 Laf 的 Redis/内存限流配置正常
- FSRS 参数使用了默认值，与主服务器一致，无需额外配置

---
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

---
# Laf Backend Deployment Guide (Current)

更新时间: 2026-02-28
应用 ID: `nf98ia8qnt`
调用域名: `https://nf98ia8qnt.sealosbja.site`

---

## 1. 当前部署基线

- 已部署云函数: `40`（业务函数 35 + `_shared` 5）
- `question-bank` 最新修复已上线（含 JWT 鉴权逻辑修复）
- 关键函数均已可调用（见“验证结果”）
- 函数入口采用 **TS-only** 策略（`laf-backend/functions/*.ts`），不再维护同名 `.js` 入口

建议把本文件与 `docs/archive/2026-02-reset/BASELINE-START-2026-02-28.md`、`docs/archive/2026-02-reset/BACKUP-STATUS-2026-02-28.md` 作为当前交付文档来源。

---

## 2. 常用命令

在目录 `laf-backend/` 执行：

```bash
# 查看当前云端函数清单
/Users/blackdj/.npm-global/bin/laf func list

# 发布单个函数
/Users/blackdj/.npm-global/bin/laf func push <function-name>

# 发布全部函数
/Users/blackdj/.npm-global/bin/laf func push
```

在仓库根目录执行（线上 smoke）：

```bash
# 公开接口 smoke（默认重试 8 次）
npm run test:cloud:smoke

# 带真实账号鉴权 smoke（可选）
SMOKE_EMAIL="<email>" SMOKE_PASSWORD="<password>" npm run test:cloud:smoke

# Laf 函数源码一致性审计（建议发布前执行 strict）
npm run audit:laf:function-sources -- --strict
```

---

## 3. 发布后最小验证清单

### 3.1 基础可用性

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/health-check"
```

预期包含: `{"code":0,"status":"ok"}`

### 3.2 关键业务验证

1. 登录签发 token（邮箱登录）

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/login" \
  -H "Content-Type: application/json" \
  -d '{"type":"email","email":"<email>","password":"<password>"}'
```

2. 携带 token 调用受保护接口（以 `doc-convert` 为例）

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/doc-convert" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${AUTH_HEADER}" \
  -d '{"action":"get_types"}'
```

3. `question-bank` 鉴权分支验证

```bash
# 公共 action（无 token）
curl -sS "https://nf98ia8qnt.sealosbja.site/question-bank" \
  -H "Content-Type: application/json" \
  -d '{"action":"random","data":{"count":1}}'

# 非法 token
curl -sS "https://nf98ia8qnt.sealosbja.site/question-bank" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${AUTH_HEADER}" \
  -d '{"action":"random"}'
```

---

## 4. 已完成的线上验证（摘要）

- `proxy-ai` `health_check` 正常
- `npm run test:cloud:smoke` 可复用脚本已落地（含 `Function Not Found` 重试策略）
- `question-bank` 修复后鉴权行为符合预期（401/403/400 分支正常）
- `login`（email/password）可签发 JWT
- `login` 已新增 `type=qq` 分支（H5/App/QQ小程序）
- `doc-convert`、`user-profile`、`favorite-manager`、`mistake-manager` 的带 token 调用通过
- `group-service`、`material-manager`、`study-stats`、`ai-friend-memory`、`school-query(get_favorites)` 的带 token 调用通过
- `id-photo-segment-base64`、`photo-bg` 基础链路可调用
- `send-email-code` 在 Gmail SMTP 配置后线上返回 `code:0`

---

## 5. 已知平台现象

- Sealos 网关偶发首次请求 `Function Not Found`
- 同一请求重试后通常恢复正常

建议：

- 验证脚本统一增加 2-3 次短间隔重试
- 关键监控以连续失败率为准，不以单次失败判定故障

---

## 6. 仍需补齐项

- QQ OAuth 仍需在 QQ 平台后台确认回调域与上线审核
- 前端端到端（真机/浏览器）全流程回归尚未完成
- 生产环境备份恢复演练记录需补齐（参考 `docs/archive/2026-02-reset/BACKUP-STATUS-2026-02-28.md`）

---

## 7. 管理员密钥说明

- 管理员接口依赖环境变量 `ADMIN_SECRET`（如 `school-query sync_from_chsi`、`db-create-indexes`）
- 查看位置：Sealos/Laf 控制台 -> 当前应用 -> Environment Variables
- 若未配置，建议生成高强度随机值后写入 `ADMIN_SECRET`，并同步到团队密钥管理工具

---

## 8. 安全与文档规范

- 不要在文档中记录 PAT、API Key、Secret 明文
- 仅在 `.env` / 平台环境变量中维护密钥
- 每次发布后更新：
  - `docs/archive/2026-02-reset/BASELINE-START-2026-02-28.md`
  - `docs/archive/2026-02-reset/BACKUP-STATUS-2026-02-28.md`
  - 本文件（若部署基线或验证结论发生变化）

---
# 前后端分仓迁移指南

> 本文档记录将 `laf-backend/` 从 EXAM-MASTER 主仓库拆分为独立仓库的操作步骤。

## 前置条件

- 已在 GitHub 创建新仓库 `EXAM-MASTER-BACKEND`
- 当前 `laf-backend/` 目录已包含独立运行所需的全部文件

## 迁移步骤

### 1. 从主仓库提取后端历史（保留 git 历史）

```bash
# 在主仓库目录执行
cd /path/to/EXAM-MASTER

# 使用 git subtree split 提取 laf-backend 目录的完整历史
git subtree split -P laf-backend -b backend-split

# 创建临时目录，初始化新仓库
mkdir /tmp/exam-master-backend
cd /tmp/exam-master-backend
git init
git pull /path/to/EXAM-MASTER backend-split

# 关联远程仓库并推送
git remote add origin git@github.com:djblack1209-coder/EXAM-MASTER-BACKEND.git
git push -u origin main
```

### 2. 验证新仓库

```bash
cd /tmp/exam-master-backend

# 确认目录结构
ls -la
# 应包含: functions/ deploy/ scripts/ data/ database/ database-schema/
#         types/ utils/ triggers/ .github/ package.json tsconfig.json README.md

# 确认 git 历史
git log --oneline | head -20
```

### 3. 清理主仓库

```bash
cd /path/to/EXAM-MASTER

# 删除已迁移的后端目录
git rm -r laf-backend/

# 删除已迁移到后端的根目录资源
git rm -r data/
git rm -r database/
git rm -r scripts/crawlers/
git rm -r scripts/data-sync/
git rm scripts/test/load-test-50qps.js
git rm scripts/test/load-test.ts
git rm scripts/test/pk-atomicity-test.js
git rm scripts/test/security-audit.js
git rm scripts/test/test-ai-service.js
git rm scripts/test/test-ai-upgrade.js
git rm scripts/test/test-cot-verification.js

# 提交
git commit -m "chore: 移除已迁移至独立仓库的后端代码"
```

### 4. 更新前端 CI/CD

主仓库的 `.github/workflows/ci-cd.yml` 需要移除后端构建步骤：
- 删除 `Build and push backend image` step
- 删除 staging/production 部署中的 backend 相关 kubectl 命令
- 保留前端专属的 lint → test → build → deploy 流程

### 5. 更新 .gitignore

移除主仓库 `.gitignore` 中的后端相关条目：
```
# 删除这些行
laf-backend/.app.yaml
laf-backend/.env*
```

### 6. 更新文档引用

以下文档中引用了 `laf-backend/` 路径，需要更新为新仓库地址：
- `docs/API.md`
- `docs/SCRIPTS.md`
- `deploy/docs/DEPLOYMENT-GUIDE.md`
- `deploy/docs/EMERGENCY-RESPONSE.md`

### 7. 更新 Docker 构建上下文

`deploy/docker/Dockerfile` 中的 `COPY laf-backend/ ./` 需要删除（后端已有独立 Dockerfile）。
`deploy/docker/docker-compose.yml` 中的 backend service 需要改为引用外部镜像或删除。

## 分仓后的目录结构

### 前端仓库 (EXAM-MASTER)
```
EXAM-MASTER/
├── src/                    # 前端源码
├── common/                 # 公共样式
├── static/                 # 静态资源
├── scripts/                # 前端构建/修复脚本
│   ├── build/
│   ├── fix/
│   ├── optimize/
│   ├── refactor/
│   └── test/               # 前端测试脚本
├── tests/                  # 单元/视觉测试
├── deploy/                 # 前端部署配置
├── docs/                   # 项目文档
├── .github/workflows/      # 前端 CI/CD
├── package.json
└── vite.config.js
```

### 后端仓库 (EXAM-MASTER-BACKEND)
```
EXAM-MASTER-BACKEND/
├── functions/              # 云函数（API）
│   └── _shared/
├── database-schema/        # 数据库 Schema
├── database/               # SQL Schema
├── data/                   # 静态数据
├── triggers/               # 数据库触发器
├── types/                  # TypeScript 类型
├── utils/                  # 工具函数
├── scripts/                # 后端脚本
│   ├── crawlers/
│   ├── data-sync/
│   └── test/
├── deploy/                 # 后端部署配置
│   ├── docker/
│   ├── k8s/
│   └── monitoring/
├── .github/workflows/      # 后端 CI/CD
├── package.json
└── tsconfig.json
```
