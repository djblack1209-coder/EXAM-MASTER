# 📋 刷题页面图标需求清单

## 图标规格要求

### 尺寸标准
- **@1x:** 64×64px（基础尺寸）
- **@2x:** 128×128px（推荐）
- **@3x:** 192×192px（高清屏）

### 格式要求
- **格式：** PNG（支持透明背景）
- **色彩：** 32位真彩色 + Alpha通道
- **压缩：** 使用 TinyPNG 或 ImageOptim 优化

### 设计风格
- **风格：** 扁平化、线性图标
- **颜色：** 单色或双色（主色 + 辅助色）
- **圆角：** 统一圆角半径
- **描边：** 2-3px 描边宽度

---

## 必需图标列表（13个）

### 1. 主要操作图标

#### icon-book.png
- **用途：** 开始刷题按钮
- **emoji参考：** 📚
- **颜色建议：** #00a96d（Wise Green）
- **位置：** 主要操作区 - 开始刷题按钮

#### icon-battle.png
- **用途：** PK对战按钮
- **emoji参考：** ⚔️
- **颜色建议：** #007aff（蓝色）
- **位置：** 主要操作区 - PK对战按钮

#### icon-upload.png
- **用途：** 导入资料卡片
- **emoji参考：** 📤
- **颜色建议：** #00a96d（Wise Green）
- **位置：** 主要操作区 - 导入资料卡片

---

### 2. 功能菜单图标

#### icon-folder.png
- **用途：** 文件管理
- **emoji参考：** 📁
- **颜色建议：** #FFA500（橙色）
- **位置：** 功能菜单 - 第1项

#### icon-robot.png
- **用途：** AI导师
- **emoji参考：** 🤖
- **颜色建议：** #007aff（蓝色）
- **位置：** 功能菜单 - 第2项

#### icon-error.png
- **用途：** 错题本
- **emoji参考：** ❌
- **颜色建议：** #ff453a（红色）
- **位置：** 功能菜单 - 第3项

#### icon-trophy.png
- **用途：** 学霸排行榜
- **emoji参考：** 🏆
- **颜色建议：** #FFD700（金色）
- **位置：** 功能菜单 - 第4项

#### icon-check.png
- **用途：** 总学习进度
- **emoji参考：** ✅
- **颜色建议：** #00a96d（Wise Green）
- **位置：** 功能菜单 - 第5项

---

### 3. 状态图标

#### icon-library.png
- **用途：** 题库就绪状态
- **emoji参考：** 📚
- **颜色建议：** #00a96d（Wise Green）
- **位置：** 状态卡片 - 有题库时

#### icon-cloud.png
- **用途：** 空题库状态
- **emoji参考：** ☁️
- **颜色建议：** #8E8E93（灰色）
- **位置：** 状态卡片 - 无题库时

#### icon-settings.png
- **用途：** 题库管理按钮
- **emoji参考：** ⚙️
- **颜色建议：** #007aff（蓝色）
- **位置：** 状态卡片 - 管理按钮

---

### 4. 特殊效果图标

#### icon-sparkle.png
- **用途：** AI加载动画
- **emoji参考：** ✨
- **颜色建议：** 渐变色（#00E5FF → #007AFF）
- **位置：** AI加载遮罩 - 中心图标
- **特殊要求：** 支持动画效果

#### icon-lightning.png
- **用途：** 极速体验弹窗
- **emoji参考：** ⚡
- **颜色建议：** #FFD700（金色）
- **位置：** 极速体验弹窗 - 顶部图标

---

## 存放路径

```
src/static/icons/practice/
├── icon-book.png          (开始刷题)
├── icon-book@2x.png
├── icon-book@3x.png
├── icon-battle.png        (PK对战)
├── icon-battle@2x.png
├── icon-battle@3x.png
├── icon-upload.png        (导入资料)
├── icon-upload@2x.png
├── icon-upload@3x.png
├── icon-folder.png        (文件管理)
├── icon-folder@2x.png
├── icon-folder@3x.png
├── icon-robot.png         (AI导师)
├── icon-robot@2x.png
├── icon-robot@3x.png
├── icon-error.png         (错题本)
├── icon-error@2x.png
├── icon-error@3x.png
├── icon-trophy.png        (排行榜)
├── icon-trophy@2x.png
├── icon-trophy@3x.png
├── icon-check.png         (学习进度)
├── icon-check@2x.png
├── icon-check@3x.png
├── icon-library.png       (题库就绪)
├── icon-library@2x.png
├── icon-library@3x.png
├── icon-cloud.png         (空题库)
├── icon-cloud@2x.png
├── icon-cloud@3x.png
├── icon-settings.png      (题库管理)
├── icon-settings@2x.png
├── icon-settings@3x.png
├── icon-sparkle.png       (AI加载)
├── icon-sparkle@2x.png
├── icon-sparkle@3x.png
├── icon-lightning.png     (极速体验)
├── icon-lightning@2x.png
└── icon-lightning@3x.png
```

---

## 图标设计参考

### 推荐设计工具
1. **Figma** - 在线协作设计
2. **Sketch** - Mac专业设计工具
3. **Adobe Illustrator** - 矢量图形设计
4. **Iconify** - 免费图标库

### 推荐图标库
1. **Heroicons** - https://heroicons.com/
2. **Lucide Icons** - https://lucide.dev/
3. **Phosphor Icons** - https://phosphoricons.com/
4. **Tabler Icons** - https://tabler-icons.io/

### 在线图标生成器
1. **Flaticon** - https://www.flaticon.com/
2. **Icons8** - https://icons8.com/
3. **Iconfinder** - https://www.iconfinder.com/

---

## 使用说明

### 1. 创建图标目录
```bash
mkdir -p src/static/icons/practice
```

### 2. 放置图标文件
将所有图标文件按照上述路径结构放置

### 3. 在代码中引用
```vue
<!-- 示例：使用图标 -->
<image 
  class="icon" 
  src="/static/icons/practice/icon-book.png" 
  mode="aspectFit"
></image>
```

### 4. 响应式图标（支持多倍图）
```vue
<!-- uni-app 会自动选择合适的倍图 -->
<image 
  class="icon" 
  src="/static/icons/practice/icon-book.png"
  mode="aspectFit"
></image>
```

---

## 优化建议

### 性能优化
1. **压缩图标：** 使用 TinyPNG 压缩所有图标
2. **懒加载：** 对非首屏图标使用懒加载
3. **雪碧图：** 考虑将小图标合并为雪碧图

### 视觉优化
1. **统一风格：** 所有图标保持一致的设计风格
2. **对齐网格：** 图标元素对齐到像素网格
3. **视觉平衡：** 确保图标视觉重量平衡

### 无障碍优化
1. **替代文本：** 为图标添加 aria-label
2. **高对比度：** 确保图标在深色模式下可见
3. **触控目标：** 图标按钮至少 44×44px

---

## 完成检查清单

- [ ] 所有13个图标已设计完成
- [ ] 图标已导出为 @1x、@2x、@3x 三种尺寸
- [ ] 图标已使用 TinyPNG 压缩
- [ ] 图标已放置到正确的目录
- [ ] 代码中已更新图标引用路径
- [ ] 深色模式下图标显示正常
- [ ] 图标在不同设备上显示清晰

---

## 联系方式

如有图标设计问题，请联系设计团队或参考以上推荐的图标库。

**最后更新：** 2026-01-23
