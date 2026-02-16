#!/bin/bash

# 删除项目中所有对话相关文件的脚本
# 使用方法: bash scripts/delete-chat-files.sh

echo "🗑️  开始删除对话相关文件..."

# 删除聊天页面文件
echo "删除聊天页面..."
rm -rf pages/chat/

# 删除聊天组件
echo "删除聊天组件..."
rm -rf components/ai-consult/

# 删除开发文档（可选，包含对话记录）
echo "删除开发文档..."
rm -rf .trae/documents/

# 删除编译产物中的聊天相关文件
echo "删除编译产物..."
rm -rf unpackage/dist/dev/mp-weixin/pages/chat/
rm -rf unpackage/dist/dev/mp-weixin/components/ai-consult/

# 从 pages.json 中移除聊天页面配置（需要手动编辑）
echo ""
echo "⚠️  请手动从 pages.json 中删除以下配置:"
echo "  - pages/chat/index"
echo "  - pages/chat/chat"
echo ""
echo "✅ 文件删除完成！"
