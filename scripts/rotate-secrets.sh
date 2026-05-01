#!/usr/bin/env bash
# ============================================================
# Exam-Master 凭据轮换脚本
# 用途：一键生成所有需要轮换的强密钥，输出到 stdout
# 使用：bash scripts/rotate-secrets.sh
# 
# ⚠️ 此脚本只生成新密钥并打印，不会自动写入任何文件
# ⚠️ 你需要手动将新密钥更新到：
#   1. laf-backend/.env（本地参考）
#   2. Sealos Laf 控制台环境变量（线上生效）
#   3. 根目录 .env.production（前端安全配置）
# ============================================================

set -euo pipefail

echo "=========================================="
echo "  Exam-Master 凭据轮换 - $(date +%Y-%m-%d)"
echo "=========================================="
echo ""

# --- 后端密钥（需更新到 Sealos 环境变量） ---

echo "# ====== 后端密钥（Sealos 环境变量） ======"
echo ""

echo "# JWT 签名密钥（最重要，轮换后所有用户需重新登录）"
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo ""

echo "# 密码哈希盐值（轮换后已有密码用户需重置密码！慎重！）"
echo "# PASSWORD_SALT=$(openssl rand -hex 32)"
echo "# ⚠️ 已注释：轮换此值会导致所有密码用户无法登录，仅在必要时启用"
echo ""

echo "# 管理员密钥"
echo "ADMIN_SECRET=$(openssl rand -hex 32)"
echo ""

echo "# 数据清理密钥"
echo "CLEANUP_SECRET=$(openssl rand -hex 32)"
echo ""

echo "# 账户清除令牌"
echo "ADMIN_PURGE_TOKEN=$(openssl rand -hex 32)"
echo ""

echo "# 服务间通信密钥"
echo "INTERNAL_API_KEY=$(openssl rand -hex 32)"
echo ""

echo "# SERVER_SECRET"
echo "SERVER_SECRET=$(openssl rand -hex 64)"
echo ""

# --- 应用安全配置 ---

echo "# ====== 应用安全配置（后端环境变量） ======"
echo ""

echo "# 请求签名盐值（后端专用；不要使用 VITE_ 前缀放入客户端包）"
echo "REQUEST_SIGN_SALT=$(openssl rand -hex 32)"
echo ""

echo "# 邀请签名密钥（后端环境变量，禁止使用 VITE_ 前缀）"
echo "INVITE_SECRET=$(openssl rand -hex 32)"
echo ""

# --- 需要在第三方平台轮换的密钥 ---
echo "# ====== 第三方平台（需手动在平台上轮换） ======"
echo ""
echo "# 以下密钥无法自动生成，需要到对应平台重新生成："
echo "#"
echo "# 1. WX_SECRET        → 微信公众平台: https://mp.weixin.qq.com"
echo "#    路径: 开发 → 开发设置 → AppSecret → 重置"
echo "#"
echo "# 2. QQ_SECRET         → QQ互联: https://connect.qq.com"
echo "#    路径: 应用管理 → 查看 → 重置AppKey"
echo "#"
echo "# 3. SEALOS_PAT        → Sealos: https://sealos.run"
echo "#    路径: 设置 → Access Token → 创建新Token → 删除旧Token"
echo "#"
echo "# 4. GITHUB_TOKEN      → GitHub: https://github.com/settings/tokens"
echo "#    路径: Fine-grained tokens → Generate new token"
echo "#"
echo "# 5. SMTP_PASS         → Gmail: https://myaccount.google.com/apppasswords"
echo "#    路径: 安全性 → 应用专用密码 → 生成新密码"
echo "#"
echo "# 6. ZHIPU_API_KEY     → 智谱: https://open.bigmodel.cn/usercenter/apikeys"
echo "#"
echo "# 7. AI Provider 号池："
echo "#    IFLOW_API_KEY              → 心流/iflow 控制台"
echo "#    GROQ_API_KEY               → https://console.groq.com/keys"
echo "#    GEMINI_API_KEY             → https://aistudio.google.com/api-keys"
echo "#    OPENROUTER_API_KEY         → https://openrouter.ai/settings/keys"
echo "#    CEREBRAS_API_KEY           → https://cloud.cerebras.ai/"
echo "#    MISTRAL_API_KEY            → https://console.mistral.ai/"
echo "#    NVIDIA_API_KEY             → https://build.nvidia.com/settings/api-keys"
echo "#    GITHUB_MODELS_TOKEN        → GitHub Models token"
echo "#    HF_TOKEN                   → https://huggingface.co/settings/tokens"
echo "#    GPT_API_FREE_KEY           → 社区免费接口 key"
echo "#    SILICONFLOW_DS_KEY_*       → 硅基流动 DS 轮转池，禁止 Pro/ 模型"
echo "#    SILICONFLOW_OFFICIAL_API_KEY → https://cloud.siliconflow.cn/account/ak"
echo "#"
echo "# 8. TENCENT_SECRET_*  → 腾讯云: https://console.cloud.tencent.com/cam/capi"
echo "#    路径: 访问管理 → API密钥管理 → 新建密钥 → 禁用旧密钥"
echo "#"
echo "# 9. SERPAPI_KEY        → https://serpapi.com/manage-api-key"
echo "#"
echo "# 10. BRAVE_SEARCH_API_KEY → https://brave.com/search/api/"
echo "#"
echo "# 11. CLOUDCONVERT_API_KEY → https://cloudconvert.com/dashboard/api/v2/keys"
echo ""

echo "=========================================="
echo "  轮换步骤："
echo "  1. 复制上面生成的新密钥"
echo "  2. 更新 laf-backend/.env 本地文件"
echo "  3. 登录 Sealos 控制台更新环境变量"
echo "  4. 更新 .env.production 前端配置"
echo "  5. 到各第三方平台轮换对应密钥"
echo "  6. 重启 Laf 应用使新密钥生效"
echo "  7. 验证所有功能正常"
echo "=========================================="
