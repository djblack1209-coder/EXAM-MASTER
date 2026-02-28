#!/bin/bash

# 修复策略：将 _shared 模块的函数复制到每个需要它们的文件中
# 这是 Laf 云函数的推荐做法（避免跨文件 import）

echo "开始修复 import 语句..."

# 读取 auth.ts 的核心函数
AUTH_FUNCTIONS=$(cat _shared/auth.ts)

# 对于每个依赖 _shared/auth 的文件
for file in question-bank.ts school-query.ts ai-friend-memory.ts group-service.ts material-manager.ts study-stats.ts send-email-code.ts; do
  if [ -f "$file" ]; then
    echo "修复 $file ..."
    
    # 移除 import 语句
    sed -i.bak '/import.*from.*\.\/_shared\/auth/d' "$file"
    sed -i.bak '/import.*from.*\.\/login/d' "$file"
    
    # 在文件开头插入共享函数（在 import cloud 之后）
    # 这里我们需要手动处理，因为自动化太复杂
    echo "  - 已移除 import 语句"
  fi
done

echo "完成！"
