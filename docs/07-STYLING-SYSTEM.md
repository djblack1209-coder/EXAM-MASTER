---
name: Wenli · 问理
description: 连续对话学习的安静阅读空间
colors:
  ink: '#f8f5ee'
  muted: '#e1ddd2'
  paper: '#f3f0e8'
  paper-ink: '#3f4234'
  sage: '#d9dfbe'
  brand: '#433f35'
  glass: 'rgba(65, 60, 52, 0.78)'
typography:
  body:
    fontFamily: 'Helvetica Neue, PingFang SC, Microsoft YaHei, sans-serif'
    fontSize: '14px'
    lineHeight: 1.65
rounded:
  frame: '28px'
  panel: '24px'
  control: '12px'
spacing:
  panel: '24px'
  mobile-panel: '20px'
---

# 品牌与视觉系统

## Overview

工作品牌 **Wenli · 问理**，中文两字、英文五字母，表达从提问到理解。原创 W 标志由两段连续曲线与下方落点组成；线条对应持续学习路径，落点对应一次有依据的检验。不是复制其他产品图形，也不限制为考研。

采用已安装 [Impeccable 开源设计技能](https://github.com/pbakaus/impeccable)，其工具/指导为 Apache-2.0；本项目原创 Logo 不因使用该技能自动更改整个项目的 UNLICENSED 许可。公开名称检索只用于排除明显同类重名，不代表商标、域名或商店名称可注册。

用户已确定 Reading Library / Mood Tracker 的阅读和节奏方向。保留暖石、鼠尾草和自然光玻璃空间，不新增访谈或另建演示项目。产品事实在 01，设计事实在本文，不另建根级重复文档；当前环境无可用设计子代理，由同一任务完成源码与渲染复核。

## Colors

前景使用暖白，次级文字为同色系暖灰；明亮主操作使用纸色与深色文字；鼠尾草仅用于真实任务进度，不表示精确掌握率。品牌使用深暖石色。值来自 learning-space.css 与 brand.js，主题改变不切换 Logo 语义。

## Typography

沿用当前系统字体栈；不下载未授权字体。正文 14px / 1.65，品牌中文 19px / 500、英文 13px / 400。首页标题桌面 42px、手机 34px；对话标题依现有断点收缩。正文 measure 以当前消息 68ch 为准。

## Layout

最大外框 1320px，左目录 236px、1100px 下为 216px，900px 下折叠目录，520px 下继续收紧。桌面边距 36px 40px，手机预留 dock 与安全区；微信读取状态栏/胶囊位置并有失败回退。

## Elevation & Depth

使用本地 learning-room.webp 的静态自然光背景，文字承载层先保证不透明底色，再按支持情况使用 blur。减少透明度/提高对比度时关闭图片和模糊；无能力的平台退回实色。背景来源 sidecar 不是完整授权证明。

## Shapes

标志源文件在 src/static/brand/：mark.svg、mark-light.svg、icon.svg、icon-maskable.svg。普通标志至少 16px，留白不小于线宽；深色面使用浅色版。应用图标与 PWA 192/512 PNG 由原始 SVG 栅格化，maskable 图形位于安全区域。不要拉伸、旋转或为每个页面重画一套 Logo。

## Components

共享 Shell 用本地浅色 SVG 标志，登录/启动与 PWA 用本地 PNG，避免 CDN 保留旧品牌。按钮的加载、禁用、错误与键盘焦点保持明确；恢复备份采用就地面板，只有实际合并和撤销需要保护性确认。

## Do's and Don'ts

- 使用 brand.js 的显示品牌；编译期页面/manifest 的副本由测试检查。
- 阅读和练习优先；指标须来自有效记录。
- 保留已建立的玻璃阅读语言，同时提供实色退后和减少动效。
- 不修改存储键、应用 ID、数据库名或题源路径来追随显示改名。
- 不把源代码、构建、模型、设备和公开发布合并为一个通过标签。

既有辅助字号、个别小按钮和全局按压效果仍需设备可访问性评估，未提升为新组件的质量标准。

2026-09-30 实际 H5 已检查桌面与手机宽度的品牌、共享指标、目录和 dock，手机页面无横向溢出。Impeccable 单次静态扫描报告一项系统字体过度常见的风格提示；保留当前跨端中文系统字体，不将其当成功能缺陷或静默更换字体。截图与检测原文在 tmp/rebrand-rebuild/；本轮不据此宣称真机可访问性通过。
