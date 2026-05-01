# 腾讯云 H5 部署证据

> 更新时间：2026-04-30 15:35 MDT

## 结论

腾讯云 H5 静态站点已部署到 `http://101.43.41.96:8080/`。

## 部署内容

- 构建命令：`npm run build:h5`
- 部署命令：`bash deploy/tencent/scripts/deploy-h5.sh`
- 远端目录：`/opt/apps/exam-master/h5`
- Nginx 配置：`/etc/nginx/nginx.conf`、`/etc/nginx/conf.d/exam-master.conf`、`/etc/nginx/conf.d/exam-master-h5.conf`
- 最近部署时间：`2026-04-30 15:34 MDT`

## 修复记录

- 首次 reload 失败原因：`exam-master.conf` 引用了未定义的 `limit_req zone=exam_api`。
- 修复方式：统一改用主配置中已定义的 `global_api` 限流 zone。
- 验证命令：`nginx -t && systemctl reload nginx`
- 结果：Nginx 配置测试通过，服务处于 active 状态。

## 线上验证

| 项目 | 结果 |
| --- | --- |
| `http://101.43.41.96:8080/` | HTTP 200，`text/html` |
| `http://101.43.41.96:8080/health` | HTTP 200，`application/json` |
| `http://101.43.41.96/health` | HTTP 200，`application/json` |
| `https://nf98ia8qnt.sealosbja.site/health-check` | HTTP 200，`{"code":0,"status":"ok"}` |
| Playwright H5 首屏 | 标题 `开始使用`，console 0 error / 0 warning |
| 最近部署脚本复核 | H5 健康检查通过，H5 首页加载成功，Nginx reload passed |

## 仍未覆盖

微信小程序提审/发布态真机验收仍需在体验版或正式发布版完成，H5 部署不能替代微信发布态验收。
