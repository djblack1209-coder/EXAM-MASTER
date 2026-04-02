#!/usr/bin/env bash
# Maestro 共享环境初始化脚本
# 所有 maestro 相关脚本统一 source 此文件，避免重复维护 Java 环境逻辑

# macOS Homebrew OpenJDK 路径（CI 上不存在但追加不影响）
export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk}"

# JVM 参数：--enable-native-access（所有版本支持）
if [[ " ${JAVA_TOOL_OPTIONS:-} " != *" --enable-native-access=ALL-UNNAMED "* ]]; then
  JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --enable-native-access=ALL-UNNAMED"
fi

# JVM 参数：--sun-misc-unsafe-memory-access（仅 Java 21+ 支持，低版本会导致 JVM 启动失败）
# 注意：java -version 在 JAVA_TOOL_OPTIONS 已设置时，stderr 会先输出 "Picked up JAVA_TOOL_OPTIONS: ..."
# 必须过滤掉这行再提取版本号，否则 sed 会匹配到 "Picked" 而非版本数字
JAVA_MAJOR=$(java -version 2>&1 | grep -i 'version' | head -1 | sed -E 's/.*"([0-9]+).*/\1/' || echo 0)
# 防御：如果提取失败（非数字），回退为 0
[[ "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || JAVA_MAJOR=0
if [[ "$JAVA_MAJOR" -ge 21 ]] && [[ " ${JAVA_TOOL_OPTIONS:-} " != *" --sun-misc-unsafe-memory-access=allow "* ]]; then
  JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --sun-misc-unsafe-memory-access=allow"
fi

export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS# }"
