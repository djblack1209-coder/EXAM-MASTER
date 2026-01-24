#!/bin/bash
# Cline自动化修复脚本: 修复H5环境uni对象未定义问题
# 执行时间: 2026-01-24
# 优先级: P0 - 阻塞级

set -e  # 遇到错误立即退出

echo "🔧 开始修复 uni 对象未定义问题..."
echo ""

# 步骤1: 检查问题根因
echo "📋 步骤1: 诊断问题..."
echo "- 检查 pages.json 首页配置"
echo "- 当前首页: src/pages/splash/index (启动屏)"
echo "- 问题: splash页面使用了uni.reLaunch，但H5环境uni对象未初始化"
echo ""

# 步骤2: 临时解决方案 - 修改pages.json，将index设为首页
echo "📝 步骤2: 应用临时修复..."
echo "- 将 src/pages/index/index 设为首页"
echo "- 保留 splash 页面供后续修复"
echo ""

# 备份原始pages.json
cp pages.json pages.json.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 已备份 pages.json"

# 使用sed修改pages.json（将splash和index顺序对调）
# 注意：这是临时方案，生产环境需要修复splash页面的uni对象问题
cat > pages.json.tmp << 'EOF'
{
    "pages": [
        {
            "path": "src/pages/index/index",
            "style": {
                "navigationBarTitleText": "Exam Master",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/splash/index",
            "style": {
                "navigationBarTitleText": "Exam Master",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/index",
            "style": {
                "navigationBarTitleText": "智能刷题",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/do-quiz",
            "style": {
                "navigationBarTitleText": "刷题进行中",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/pk-battle",
            "style": {
                "navigationBarTitleText": "PK 对战",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/rank",
            "style": {
                "navigationBarTitleText": "学霸排行榜",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/rank-list",
            "style": {
                "navigationBarTitleText": "学霸风云榜",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/import-data",
            "style": {
                "navigationBarTitleText": "资料导入",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/practice/file-manager",
            "style": {
                "navigationBarTitleText": "文件管理",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/school/index",
            "style": {
                "navigationBarTitleText": "择校分析",
                "navigationBarBackgroundColor": "#1A1A1A",
                "navigationStyle": "custom"
            }
        },
        {
            "path": "src/pages/school/detail",
            "style": {
                "navigationBarTitleText": "院校详情",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/settings/index",
            "style": {
                "navigationBarTitleText": "系统设置",
                "navigationBarBackgroundColor": "#1A1A1A",
                "navigationStyle": "custom"
            }
        },
        {
            "path": "src/pages/social/friend-list",
            "style": {
                "navigationBarTitleText": "我的好友",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/profile/index",
            "style": {
                "navigationBarTitleText": "个人中心",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/chat/index",
            "style": {
                "navigationBarTitleText": "AI 助教",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/chat/chat",
            "style": {
                "navigationBarTitleText": "智能对话",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/mistake/index",
            "style": {
                "navigationBarTitleText": "错题本",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/plan/index",
            "style": {
                "navigationBarTitleText": "我的学习计划",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/plan/create",
            "style": {
                "navigationBarTitleText": "创建学习计划",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        },
        {
            "path": "src/pages/universe/index",
            "style": {
                "navigationBarTitleText": "探索宇宙",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#000000"
            }
        },
        {
            "path": "src/pages/study-detail/index",
            "style": {
                "navigationBarTitleText": "学习详情",
                "navigationStyle": "custom",
                "navigationBarBackgroundColor": "#1A1A1A"
            }
        }
    ],
    "globalStyle": {
        "navigationBarTextStyle": "white",
        "navigationBarTitleText": "Exam Master",
        "navigationBarBackgroundColor": "#1A1A1A",
        "backgroundColor": "#121212",
        "backgroundTextStyle": "light",
        "enablePullDownRefresh": false
    },
    "tabBar": {
        "color": "#8F939C",
        "selectedColor": "#00E5FF",
        "backgroundColor": "#1E1E1E",
        "borderStyle": "black",
        "list": [
            {
                "pagePath": "src/pages/index/index",
                "text": "首页",
                "iconPath": "/static/tabbar/home.png",
                "selectedIconPath": "/static/tabbar/home-active.png"
            },
            {
                "pagePath": "src/pages/practice/index",
                "text": "刷题",
                "iconPath": "/static/tabbar/practice.png",
                "selectedIconPath": "/static/tabbar/practice-active.png"
            },
            {
                "pagePath": "src/pages/school/index",
                "text": "择校",
                "iconPath": "/static/tabbar/school.png",
                "selectedIconPath": "/static/tabbar/school-active.png"
            },
            {
                "pagePath": "src/pages/profile/index",
                "text": "我的",
                "iconPath": "/static/tabbar/profile.png",
                "selectedIconPath": "/static/tabbar/profile-active.png"
            }
        ]
    },
    "uniIdRouter": {}
}
EOF

mv pages.json.tmp pages.json
echo "✅ 已修改 pages.json，将首页设为 index"
echo ""

# 步骤3: 重启开发服务器
echo "🔄 步骤3: 重启开发服务器..."
echo "- 请手动停止当前运行的 npm run dev:h5"
echo "- 然后重新执行: npm run dev:h5"
echo ""

# 步骤4: 验证修复
echo "✅ 修复完成！"
echo ""
echo "📋 验收清单:"
echo "  [ ] 停止当前开发服务器 (Ctrl+C)"
echo "  [ ] 重新运行: npm run dev:h5"
echo "  [ ] 访问 http://localhost:5173/"
echo "  [ ] 确认页面正常显示（不再白屏）"
echo "  [ ] 确认控制台无 'uni is not defined' 错误"
echo ""
echo "⚠️  注意事项:"
echo "  - 这是临时修复方案，跳过了启动屏"
echo "  - 后续需要修复 splash 页面的 uni 对象问题"
echo "  - 或者为 H5 环境添加专门的启动逻辑"
echo ""
echo "📝 后续任务:"
echo "  1. 修复 splash 页面的 uni.reLaunch 调用"
echo "  2. 添加 H5 环境检测和兼容性处理"
echo "  3. 考虑为 H5 和小程序使用不同的启动流程"
echo ""
