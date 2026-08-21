# 部署与运维指南

> 合并自 deploy/docs/ 和 laf-backend/ 中的部署文档

## 当前文档拆分

- 本文件保留全仓部署、运维和应急响应总览。
- 当前 Sealos/Laf 后端云函数部署、发布后 smoke 和平台现象见 [09A-LAF-BACKEND-DEPLOYMENT.md](./09A-LAF-BACKEND-DEPLOYMENT.md)。
- 后端分仓迁移步骤见 [09B-BACKEND-MIGRATION-GUIDE.md](./09B-BACKEND-MIGRATION-GUIDE.md)。
- 发布状态和剩余阻断项以 `npm run release:gate:report`、`data/release-external-audit.json`、本文件和 [11-RELEASE-NOTES.md](./11-RELEASE-NOTES.md) 为准。长期结论写回核心文档，临时证据留在 `data/release-evidence/`。

## 2026-08-07 当前生产基线

- 腾讯云是唯一现役生产主机：H5/PWA 由 Nginx 的本地 8080 服务提供，API 由本地 3001 服务提供。
- `exam.245334.xyz` 是用户入口，`api.245334.xyz` 只承载 API；两者经 Cloudflare Tunnel 进入同一台主机。
- `exam-master-health.timer` 每五分钟执行公网业务健康检查。
- Sealos 环境已暂停并返回 503，只能作为未来经人工确认后的冷恢复目标，不是 Nginx 自动故障转移目标。
- Oracle 3055 / ARM-2 已退役，旧 `exam-master-h5.service` 和 18119 端口只是历史记录，不得在 Oracle Singapore 上重建。
- 故障恢复依赖已校验备份、产品部署脚本和公网业务探针；新的付费备机或重新启用 Sealos 必须人工拍板。

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
AUTH_HEADER='Bearer <admin-token>'
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


## 2026-08-21 最终生产复查

- Tencent Nginx 为 active，`nginx -t` 成功；本地 Node/PM2 有 2 个在线进程，health-check 返回 200。
- 公开 H5 首页与 API health 均返回 200；本轮未执行登录写入、支付、课程数据变更、故障注入或自动切流。
- Sealos 继续是人工确认后的冷恢复路径，不是 Nginx 自动故障转移目标。旧 `failover-test.sh` 已确认没有 Git、systemd、timer、cron、部署或浏览器调用者，保留删除状态。
- 没有实体 WeChat 设备，因此只完成服务器、浏览器/公开入口和 API 读回；不得声称完成微信真实链路。
