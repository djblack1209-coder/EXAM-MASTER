# 小程序 PNG 物料生成提示词清单

> 状态：待生成
> 更新日期：2026-04-28
> 目标：替换项目内全部 PNG 素材，统一为成熟、现代、绿色、玻璃拟物的备考产品视觉系统

## 一、生成与交付规则

### 1.1 放置目录

生成完成后，请按原项目相对路径镜像放入：

```text
asset-inbox/png-redesign/
```

示例：

```text
asset-inbox/png-redesign/src/static/images/logo.png
asset-inbox/png-redesign/src/static/tabbar/home.png
asset-inbox/png-redesign/cdn-assets/badges/streak-7day.png
```

后续批量替换时，以该目录下的相对路径覆盖项目内同名文件。不要把不同路径下的同名文件放在同一个扁平目录里，例如 `src/static/images/logo.png` 和 `src/pages/login/static/logo.png` 必须保留各自目录。

### 1.2 全局视觉方向

所有素材统一使用以下方向：

```text
Modern premium exam preparation app asset, inspired by Wise green and Apple glass material, mature fintech product quality, clean educational focus, soft white and mint green palette, primary green #9FE870, deep green #163300, translucent glass surfaces, soft realistic lighting, subtle depth, crisp details, quiet and professional, no childish mascot.
```

### 1.3 全局负面提示词

每张图都追加以下负面提示词：

```text
No owl, no bird mascot, no cartoon mascot, no childish 3D toy style, no emoji, no sticker style, no graduation cap, no trophy, no rocket, no flame, no coins, no swords, no shield fantasy icon, no institution names, no teacher names, no QR code, no watermark, no readable text, no logo imitation of Wise or Apple, no purple blue gradient, no ZA Bank green, no cyberpunk, no beige brown theme, no clutter, no low resolution, no jagged edges.
```

### 1.4 背景规则

- Logo、TabBar、功能图标、徽章、特效：透明背景 PNG。
- 插画、分享封面、PWA 图标：可以使用浅绿/白色背景，但不要出现文字。
- 所有图标必须留出 12% 到 18% 安全边距，避免在小程序端被裁切。
- 所有文件最终保持原文件名和原尺寸。

## 二、品牌与 Logo

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `src/static/images/logo.png` | 200x200 | 透明 | Minimal modern app logo for a serious postgraduate exam preparation product, abstract open book merged with an upward progress path, negative space forming rising steps, primary Wise-like green #9FE870 with deep green #163300, geometric fintech quality, subtle east wood element symbolism through upward-right growth direction, flat vector-friendly mark, premium and calm, centered with generous padding. |
| `src/pages/login/static/logo.png` | 132x132 | 透明 | Compact version of the same modern exam prep app logo, abstract open book and upward path, optimized for small login icon, fewer details, strong silhouette, Wise-like green and deep green, transparent background, premium Apple-like clarity. |
| `cdn-assets/images/logo-full.png` | 400x400 | 浅绿或透明 | Full brand logo mark without text, abstract book leaves opening upward into a progress path, premium fintech education identity, glassy green highlight, deep green structural strokes, balanced square composition, mature and trustworthy. |
| `public/static/pwa-icons/icon-192x192.png` | 192x192 | 实底 | PWA app icon, modern green rounded-square icon, abstract open book with upward progress path, Wise-like green foreground, deep green detail, soft mint background, high contrast at small size, no text. |
| `public/static/pwa-icons/icon-512x512.png` | 512x512 | 实底 | Large PWA app icon, same abstract book and upward path mark, premium Apple-style rounded-square app icon, soft glass depth, mint white background, Wise-like green accent, no text, no mascot. |
| `public/static/pwa-icons/icon-512x512-maskable.png` | 512x512 | 实底 | Maskable PWA app icon with extra safe padding, centered abstract open book and upward progress path, green fintech education style, rounded-square mint background, all key elements inside central 70% safe zone, no text. |

## 三、基础头像与分享图

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `src/static/images/default-avatar.png` | 150x150 | 实底 | Default user avatar for a mature study app, abstract human profile made of simple deep green lines, soft mint circular background, subtle glass highlight, professional and neutral, no facial detail, no cartoon, centered. |
| `cdn-assets/images/app-share-cover.png` | 500x500 | 实底 | Square share cover for a modern postgraduate exam preparation app, elegant arrangement of glass study cards, progress rings, abstract knowledge nodes, white and mint green background, Wise-like green focal accent, premium Apple-style lighting, no text, no people, no mascot. |
| `src/pages/practice-sub/static/images/pk-share-cover.png` | 500x400 | 实底 | Share cover for timed quiz challenge, modern glass quiz interface fragments, two abstract progress arcs competing side by side, energetic but mature green lighting, no battle weapons, no characters, no text, professional exam prep mood. |

## 四、底部导航图标

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `src/static/tabbar/home.png` | 81x81 | 透明 | Minimal outline tab bar icon, home dashboard for study progress, deep gray green stroke, no fill, rounded geometric lines, transparent background, optimized for 81px. |
| `src/static/tabbar/home-active.png` | 81x81 | 透明 | Active tab bar icon, same home study dashboard shape, Wise-like green fill with deep green stroke, subtle glass highlight, transparent background, optimized for 81px. |
| `src/static/tabbar/practice.png` | 81x81 | 透明 | Minimal outline tab bar icon, quiz practice card with three answer dots, deep gray green stroke, no fill, rounded geometric lines, transparent background. |
| `src/static/tabbar/practice-active.png` | 81x81 | 透明 | Active tab bar icon, quiz practice card with answer dots, Wise-like green fill, deep green stroke, soft glass highlight, transparent background. |
| `src/static/tabbar/profile.png` | 81x81 | 透明 | Minimal outline tab bar icon, user profile combined with study record sheet, deep gray green stroke, no fill, rounded geometric lines, transparent background. |
| `src/static/tabbar/profile-active.png` | 81x81 | 透明 | Active tab bar icon, user profile and study record sheet, Wise-like green fill, deep green stroke, subtle glass highlight, transparent background. |
| `src/static/tabbar/school.png` | 81x81 | 透明 | Legacy optional tab icon, minimal outline academic building abstracted as data columns and a book spine, deep gray green stroke, no fill, mature, transparent background. |
| `src/static/tabbar/school-active.png` | 81x81 | 透明 | Legacy optional active tab icon, academic building abstracted as data columns and a book spine, Wise-like green fill, deep green stroke, transparent background. |

## 五、功能图标

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `src/static/icons/ai-chat.png` | 120x120 | 透明 | Premium line icon for AI study assistant, abstract chat bubble with small knowledge node constellation, deep green outline with soft mint glass fill, modern fintech app style, transparent background. |
| `src/static/icons/bookmark-save.png` | 120x120 | 透明 | Premium line icon for saved questions, bookmark merged with a small document corner, deep green outline, subtle Wise-green glass fill, no star badge, transparent background. |
| `src/static/icons/camera-search.png` | 120x120 | 透明 | Premium line icon for camera search OCR, camera frame merged with scanning brackets, deep green outline, mint glass highlight, professional utility style, transparent background. |
| `src/static/icons/clock-timer.png` | 120x120 | 透明 | Premium line icon for timed practice, clean clock dial with progress arc, deep green outline, Wise-green accent on arc, no alarm cartoon, transparent background. |
| `src/static/icons/crossed-swords.png` | 120x120 | 透明 | Replace battle swords with mature challenge icon: two intersecting progress bars forming a subtle X, quiz competition energy, deep green outline, mint glass fill, no weapons, transparent background. |
| `src/static/icons/doc-convert.png` | 120x120 | 透明 | Premium line icon for document conversion, two layered document sheets with circular sync arrow, deep green outline, soft glass mint fill, no text, transparent background. |
| `src/static/icons/flame-streak.png` | 120x120 | 透明 | Replace flame with study streak icon: rising leaf-shaped progress trail and small dots, Wise-green gradient, deep green outline, mature, no fire, transparent background. |
| `src/static/icons/rocket-launch.png` | 120x120 | 透明 | Replace rocket with growth launch icon: upward path arrow emerging from an open book, Wise-green fill, deep green outline, premium education style, no rocket, transparent background. |
| `src/static/icons/star-badge.png` | 120x120 | 透明 | Replace star badge with mastery seal icon: circular progress medallion with clean check node, deep green outline, mint glass fill, no trophy, no cartoon star, transparent background. |
| `src/static/icons/target-bullseye.png` | 120x120 | 透明 | Premium line icon for goals, minimal focus target made of two rings and a central knowledge node, deep green outline, Wise-green accent, transparent background. |
| `src/static/icons/trophy-cup.png` | 120x120 | 透明 | Replace trophy with achievement marker: elegant rising milestone pillar and check mark, premium glass green style, no trophy cup, no medal ribbon, transparent background. |
| `src/pages/plan/static/icons/notebook-pen.png` | 128x128 | 透明 | Modern plan icon, notebook with precise schedule lines and slim pen, deep green outline, Wise-green glass fill, calm Apple-like depth, transparent background. |
| `src/pages/plan/static/icons/pencil-paper.png` | 128x128 | 透明 | Modern creation icon, clean paper sheet and pencil forming an upward path, deep green outline, mint glass surface, mature exam prep utility style, transparent background. |
| `src/pages/practice-sub/static/icons/brain-bolt.png` | 128x128 | 透明 | Replace brain bolt with knowledge network insight icon: abstract neural nodes and a subtle upward signal line, Wise-green nodes, deep green edges, no brain cartoon, no lightning, transparent background. |
| `src/pages/practice-sub/static/icons/checkmark-circle.png` | 128x128 | 透明 | Premium correctness icon, circular glass ring with precise check mark, Wise-like green fill, deep green stroke, soft highlight, transparent background. |
| `src/pages/settings/static/icons/share-arrow.png` | 128x128 | 透明 | Premium share icon, upward-right arrow connected to two small nodes, deep green outline, soft mint glass fill, mature iOS-like utility icon, transparent background. |
| `src/pages/settings/static/icons/shield-check.png` | 128x128 | 透明 | Replace shield fantasy look with privacy assurance icon: rounded document lock and check node, deep green outline, Wise-green accent, mature security utility style, transparent background. |

## 六、游戏化与反馈特效

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `src/pages/practice-sub/static/effects/combo-fire.png` | 200x200 | 透明 | Abstract combo feedback effect for timed quiz, green energy ring and speed streaks, Wise-like green particles, premium motion asset, no flame, no cartoon, no text, transparent background. |
| `src/pages/practice-sub/static/effects/confetti-burst.png` | 200x200 | 透明 | Mature success burst effect, small glass fragments and green-white particles radiating softly, no party confetti colors, no childish shapes, transparent background. |
| `src/pages/practice-sub/static/effects/level-up-arrow.png` | 200x200 | 透明 | Level-up effect, upward progress arrow with stair-step light trail, Wise-green glow, deep green edge, premium fintech motion asset, transparent background. |
| `src/pages/practice-sub/static/effects/xp-coins.png` | 200x200 | 透明 | Replace coins with XP particles, abstract circular progress tokens and small green light points, glass material, no money coins, no gold, transparent background. |
| `cdn-assets/effects/star-sparkle.png` | 120x120 | 透明 | Subtle focus sparkle effect, four-point soft glints and tiny mint particles, premium Apple-like highlight, Wise-green and white, no cartoon star, transparent background. |

## 七、徽章系统

徽章不要做奖杯、金币、勋章绶带。统一做“知识节点 + 进度环 + 玻璃铭牌”的成熟系统。

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `cdn-assets/badges/streak-7day.png` | 200x200 | 透明 | Achievement badge for 7-day study streak, seven small connected progress nodes forming an upward arc, Wise-green glass ring, deep green details, mature premium style, no flame, no text. |
| `cdn-assets/badges/streak-30day.png` | 200x200 | 透明 | Achievement badge for 30-day consistency, dense circular progress orbit with 30 subtle ticks, Wise-green glass material, premium and calm, no flame, no text. |
| `cdn-assets/badges/accuracy-90.png` | 200x200 | 透明 | Achievement badge for high accuracy, precise target ring with check node, white and Wise-green glass, deep green edge, no numbers, no text, no trophy. |
| `cdn-assets/badges/first-100.png` | 200x200 | 透明 | Achievement badge for first 100 questions, stacked answer cards with a completed progress ring, mint glass and deep green, no visible numbers, no text. |
| `cdn-assets/badges/master-500.png` | 200x200 | 透明 | Achievement badge for large practice volume, layered knowledge cards and a full progress halo, premium Wise-green glass, mature, no text, no trophy. |
| `cdn-assets/badges/pk-victory.png` | 200x200 | 透明 | Achievement badge for challenge win, two progress arcs converging into a bright central check node, energetic but mature, no swords, no crown, no text. |
| `cdn-assets/badges/scholar.png` | 200x200 | 透明 | Achievement badge for scholar identity, abstract open book with luminous knowledge node above it, Wise-green glass, deep green lines, no graduation cap, no text. |
| `cdn-assets/badges/speed-demon.png` | 200x200 | 透明 | Achievement badge for speed mastery, sleek timer arc with fast green trail, premium glass material, no demon, no cartoon, no text. |
| `cdn-assets/badges/perfect-score.png` | 200x200 | 透明 | Achievement badge for perfect round, complete circular glass ring with crisp check mark and small knowledge nodes, Wise-green and white, no trophy, no text. |
| `cdn-assets/badges/knowledge-explorer.png` | 200x200 | 透明 | Achievement badge for knowledge exploration, small 3D knowledge graph cluster inside a glass circle, Wise-green nodes, deep green edges, mature and premium, no text. |

## 八、插画与空状态

| 目标路径 | 尺寸 | 背景 | 提示词 |
|---|---:|---|---|
| `cdn-assets/illustrations/ai-welcome.png` | 512x512 | 浅绿背景 | Modern AI study welcome illustration, abstract glass knowledge network, study cards, progress lines and soft green light, no robot, no mascot, no human face, premium Apple-like composition, no text. |
| `cdn-assets/illustrations/empty-search.png` | 512x512 | 浅绿背景 | Empty search illustration for study resources, magnifying glass over translucent document cards and knowledge nodes, soft mint-white background, Wise-green accent, mature and quiet, no text. |
| `cdn-assets/illustrations/mascot-owl.png` | 400x400 | 浅绿背景 | Replacement for old mascot asset: abstract brand companion object, open book transformed into a small knowledge constellation, no animal, no owl, no face, premium green glass material, centered. |
| `cdn-assets/illustrations/school-guide.png` | 400x400 | 浅绿背景 | School selection guide illustration, abstract campus data map with columns, paths and study cards, green glass style, no building cartoon, no people, no text. |
| `src/pages/login/static/illustrations/onboard-choose-exam.png` | 600x327 | 浅绿背景 | Onboarding illustration for choosing exam track, large glass selection cards for English, Politics, Math represented by abstract icons, white-mint background, Wise-green highlights, no readable text, no people. |
| `src/pages/login/static/illustrations/onboard-set-goal.png` | 600x327 | 浅绿背景 | Onboarding illustration for setting study goals, elegant progress rings, calendar dots and upward path, Apple-like glass depth, Wise-green accent, no text, no cartoon. |
| `src/pages/login/static/illustrations/onboard-import.png` | 600x327 | 浅绿背景 | Onboarding illustration for importing resources, PDF sheets flowing into structured quiz cards and knowledge nodes, green glass material, mature data pipeline feel, no text, no brand names. |
| `src/pages/login/static/illustrations/onboard-ready.png` | 600x327 | 浅绿背景 | Onboarding completion illustration, clean study dashboard with glowing progress path and knowledge nodes, calm premium green-white style, no trophy, no rocket, no text. |
| `src/pages/practice-sub/static/illustrations/pk-waiting.png` | 600x327 | 浅绿背景 | Waiting for timed challenge illustration, two abstract quiz progress orbits preparing to start, glass cards, Wise-green glow, no characters, no weapons, no text. |
| `src/pages/study-detail/static/illustrations/empty-journey.png` | 600x327 | 浅绿背景 | Empty learning journey illustration, elegant route of knowledge nodes over soft glass cards, white and mint background, calm premium feel, no character, no text. |
| `src/pages/study-detail/static/stack-of-books.png` | 512x512 | 透明或浅绿 | Abstract knowledge library illustration, layered translucent study documents and book-like planes, Wise-green edges, glass material, no cartoon book stack, no text. |
| `src/pages/study-detail/static/study.png` | 512x512 | 透明或浅绿 | Focused study state illustration, abstract desk-free composition of reading card, timer arc and knowledge nodes, soft green light, no human face, no cartoon, no text. |

## 九、生成批次建议

建议按以下顺序生成，便于统一风格：

1. Logo/PWA 一组：先确定品牌图形。
2. TabBar 一组：必须同一构图语言，未选中和选中成对生成。
3. 功能图标一组：全部透明背景，统一线宽和圆角。
4. 徽章/特效一组：统一玻璃圆环语言，避免低幼游戏化。
5. 插画/分享图一组：统一浅绿背景、玻璃卡片、抽象知识节点。

## 十、批量替换验收标准

- `rg --files -g '*.png'` 中所有 PNG 均有对应新文件，或已明确从代码和注册表移除。
- 小程序端不再出现猫头鹰、火箭、火焰、金币、奖杯、剑、emoji 式图标。
- TabBar 图标在 81x81 下仍清晰，选中态和未选中态一眼可辨。
- 透明背景图四角 alpha 为 0，不带白边、绿边、压缩噪声。
- 分享封面和插画无文字，避免 AI 生成乱码。
- 生成文件总大小不应显著超过旧版；小程序主包图片必须继续控制在发布限制内。
