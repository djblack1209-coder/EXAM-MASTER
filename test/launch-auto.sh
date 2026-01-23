#!/bin/bash
# 微信开发者工具自动化启动脚本

# 配置项（请根据实际情况修改）
PROJECT_PATH="/Users/blackdj/Desktop/EXAM-MASTER"
CLI_PATH="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
PORT=56649

echo "🚀 启动开发者工具（自动化模式）..."
echo "项目路径: $PROJECT_PATH"
echo "端口: $PORT"

# 启动开发者工具并开启自动化
"$CLI_PATH" --auto "$PROJECT_PATH" --auto-port $PORT

echo "✅ 启动完成！"
echo "请在开发者工具中确认项目已打开，然后运行验收脚本"
