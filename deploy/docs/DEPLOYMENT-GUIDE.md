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
