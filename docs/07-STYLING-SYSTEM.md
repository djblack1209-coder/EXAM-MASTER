# Styling System

> Auto-generated: 2026-03-22

## Architecture Overview

EXAM-MASTER uses a layered styling system:

```
Layer 1: CSS Custom Properties (runtime, in App.vue :root)
Layer 2: SCSS Design Tokens (build-time, auto-injected via Vite)
Layer 3: Theme Presets (Wise green / Bitget dark)
Layer 4: Component Scoped Styles (<style lang="scss" scoped>)
Layer 5: Utility Classes (global in App.vue)
```

## File Inventory

### Core Design System

| File           | Path                              | Purpose                                                                                |
| -------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Design Tokens  | `src/styles/_design-tokens.scss`  | Core SCSS variables (colors, spacing, typography) — auto-injected into every component |
| Dark Mode Vars | `src/styles/_dark-mode-vars.scss` | `@mixin dark-mode-vars` — all CSS variable overrides for dark mode                     |

### Theme Files

| File         | Path                         | Purpose                                                                           |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------- |
| Wot Theme    | `src/styles/_wot-theme.scss` | wot-design-uni component library theme overrides                                  |
| Theme Engine | `src/design/theme-engine.js` | Runtime theme switching (JS: `applyTheme()`, `getCurrentTheme()`, `watchTheme()`) |

### Design System Utilities

| File              | Path                                | Purpose                                 |
| ----------------- | ----------------------------------- | --------------------------------------- |
| Button Animations | `src/styles/button-animations.scss` | Global button press feedback animations |

### Global Styles (App.vue)

`src/App.vue` contains ~570 lines of global styles including:

- CSS custom property definitions (`:root` and `page`)
- Dark mode overrides (`@media prefers-color-scheme: dark` + `.dark` class)
- Apple Glass effects (`.apple-glass`, `.apple-glass-card`, `.apple-group-card`, `.apple-glass-pill`)
- Utility classes (`.card`, `.glass-card`, `.btn`, `.btn-primary`, `.btn-secondary`)
- Text color utilities (`.text-main`, `.text-sub`, `.text-primary`, `.text-success`, etc.)
- Background utilities (`.bg-page`, `.bg-card`)
- Performance utilities (`.will-change-transform`, `.gpu-accelerated`)
- Click feedback states (`.clickable:active`, `.card-hover:active`, etc.)
- Dark mode smooth transitions
- driver.js onboarding style overrides

## Color System

### Light Mode (Default - Wise Green)

| Variable               | Value     | Usage                         |
| ---------------------- | --------- | ----------------------------- |
| `--background`         | `#b8eb89` | Page background (fresh green) |
| `--foreground`         | `#10281a` | Main text (dark green-black)  |
| `--card`               | `#eaf9d5` | Card background (light green) |
| `--primary`            | `#0f5f34` | Brand color (deep green)      |
| `--primary-foreground` | `#ffffff` | Brand text (white)            |
| `--muted`              | `#d0ecad` | Muted background              |
| `--muted-foreground`   | `#35533f` | Muted text                    |
| `--border`             | `#98cd6f` | Border color (grass green)    |
| `--success`            | `#10b981` | Success state                 |
| `--warning`            | `#f59e0b` | Warning state                 |
| `--danger`             | `#ef4444` | Error/danger state            |
| `--info`               | `#3b82f6` | Info state                    |

### Dark Mode

Applied via `@mixin dark-mode-vars` in `_dark-mode-vars.scss`:

- Triggered by `@media (prefers-color-scheme: dark)` or `.dark` / `.dark-mode` class
- Inverts to dark backgrounds (`#0b0b0f`, `#161622`) with muted color palette
- Images get `opacity: 0.9; filter: brightness(0.9)` treatment

## Design Token System

### Spacing Scale

| Token           | Value |
| --------------- | ----- |
| `--spacing-xs`  | 4px   |
| `--spacing-sm`  | 8px   |
| `--spacing-md`  | 16px  |
| `--spacing-lg`  | 20px  |
| `--spacing-xl`  | 24px  |
| `--spacing-2xl` | 32px  |
| `--spacing-3xl` | 40px  |

### Border Radius Scale

| Token           | Value  |
| --------------- | ------ |
| `--radius-xs`   | 4px    |
| `--radius-sm`   | 8px    |
| `--radius-md`   | 16px   |
| `--radius-lg`   | 24px   |
| `--radius-xl`   | 32px   |
| `--radius-full` | 9999px |

### Shadow Scale

| Token         | Value                             |
| ------------- | --------------------------------- |
| `--shadow-sm` | `0 1px 3px rgba(17,17,26,0.04)`   |
| `--shadow-md` | `0 4px 14px rgba(17,17,26,0.07)`  |
| `--shadow-lg` | `0 10px 24px rgba(17,17,26,0.12)` |
| `--shadow-xl` | `0 18px 38px rgba(17,17,26,0.16)` |

### Typography

| Token                     | Value |
| ------------------------- | ----- |
| `--font-weight-regular`   | 400   |
| `--font-weight-medium`    | 500   |
| `--font-weight-semibold`  | 600   |
| `--font-weight-bold`      | 700   |
| `--font-weight-extrabold` | 800   |

### Transitions

| Token                 | Value                                    |
| --------------------- | ---------------------------------------- |
| `--transition-fast`   | 0.15s                                    |
| `--transition-normal` | 0.3s                                     |
| `--transition-slow`   | 0.5s                                     |
| `--ease-default`      | `cubic-bezier(0.4, 0, 0.2, 1)`           |
| `--ease-bounce`       | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` |

## Vite Integration

Design tokens are auto-injected via `vite.config.js`:

```js
css: {
  preprocessorOptions: {
    scss: {
      additionalData: `
        @use "src/styles/_design-tokens.scss" as *;
        $env-mode: "${mode}";
        $is-production: ${isProduction};
      `;
    }
  }
}
```

This means every `.vue` file with `<style lang="scss">` automatically has access to all design token variables without importing.

## Theme Switching Flow

1. User toggles theme in Settings page
2. `ThemeSelectorModal.vue` calls `useThemeStore().setThemeType(type)`
3. Store emits `themeTypeUpdate` event
4. `App.vue` listens and calls `switchTheme(mode)`
5. `theme-engine.js` → `applyTheme()`:
   - Adds/removes `.dark` class on `page` element
   - Updates `data-theme` attribute
   - Saves to `uni.setStorageSync('theme_mode')`
6. CSS custom properties cascade handles the rest
7. Navigation bar color updated via `uni.setNavigationBarColor()`

## Component Library (wot-design-uni)

- Base UI components from [wot-design-uni](https://wot-design-uni.cn/) v1.14.0
- Themed via `src/styles/_wot-theme.scss` (CSS variable overrides)
- Components used: wd-button, wd-input, wd-toast, wd-picker, wd-popup, wd-cell, wd-icon, etc.
- Imported from `wot-design-uni/components/common/abstracts/variable.scss` for base variables

## UI Quality Metrics

The project maintains UI quality through an automated gate check (`npm run audit:ui-quality`). As of 2026-03-23, the score is **97/100**.

**Passing Checks (242):**

- Most Vue components successfully implement error handling and are GPU-accelerated.
- Loading states are implemented in 26 components.
- Error handlers are implemented in 154 components.
- 68 components are GPU-accelerated.

**Current Warnings (7):**

- Missing user prompts in error catch blocks:
  - `src/components/base/base-icon/base-icon.vue`
  - `src/components/business/index/WelcomeBanner.vue`
  - `src/pages/practice-sub/question-bank.vue`
  - `src/pages/settings/InviteModal.vue`
- Missing loading states for asynchronous operations:
  - `src/pages/study-detail/FSRSOptimizer.vue`
