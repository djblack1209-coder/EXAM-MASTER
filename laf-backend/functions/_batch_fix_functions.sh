#!/bin/bash

# 批量修复所有依赖 _shared 的函数
# 策略：内联 extractBearerToken，使用 cloud.invoke 调用 verifyJWT

echo "开始批量修复云函数..."

# 定义需要修复的函数列表
FUNCTIONS=(
  "school-query"
  "ai-friend-memory"
  "group-service"
  "material-manager"
  "study-stats"
  "send-email-code"
)

for func in "${FUNCTIONS[@]}"; do
  if [ -f "${func}.ts" ]; then
    echo "修复 ${func}.ts ..."
    
    # 备份原文件
    cp "${func}.ts" "${func}.ts.backup"
    
    # 移除所有相对路径 import
    sed -i '' '/import.*from.*\.\/_shared/d' "${func}.ts"
    sed -i '' '/import.*from.*\.\/login/d' "${func}.ts"
    
    # 在 import cloud 之后插入辅助函数
    # 使用 awk 在第一个 import cloud 之后插入
    awk '
      /^import cloud from/ && !inserted {
        print
        print ""
        print "// === 内联辅助函数 ==="
        print "function extractBearerToken(rawToken: unknown): string {"
        print "  if (typeof rawToken !== '\''string'\'') return '\'''\';"
        print "  const trimmed = rawToken.trim();"
        print "  if (!trimmed) return '\'''\';"
        print "  const bearerMatch = trimmed.match(/^Bearer(?:\\s+(.+))?$/i);"
        print "  if (!bearerMatch) return trimmed;"
        print "  return (bearerMatch[1] || '\'\'').trim();"
        print "}"
        print ""
        print "async function verifyToken(token: string) {"
        print "  try {"
        print "    const result = await cloud.invoke('\''login'\'', { _internal_action: '\''verify_jwt'\'', token });"
        print "    return result?.data?.payload || null;"
        print "  } catch { return null; }"
        print "}"
        print "// === 内联辅助函数结束 ==="
        print ""
        inserted = 1
        next
      }
      { print }
    ' "${func}.ts.backup" > "${func}.ts"
    
    # 替换 verifyJWT 调用为 await verifyToken
    sed -i '' 's/verifyJWT(/await verifyToken(/g' "${func}.ts"
    
    echo "  ✅ ${func}.ts 修复完成"
  else
    echo "  ⚠️  ${func}.ts 不存在，跳过"
  fi
done

echo ""
echo "批量修复完成！"
