# Spec: UI/UX Wot-Design-Uni Integration

## 1. Overview
The current UI components in pages (e.g. `do-quiz.vue`, `pk-battle.vue`) are implemented using plain `<button>`, `<view>` and massive custom CSS classes like `.apple-glass-card`, `.ds-hover-btn`, `.btn-primary`. This creates a fragmented UX, hard-to-maintain code, and high payload. We will migrate these raw UI elements to the already installed `wot-design-uni` component library, using custom CSS variables to theme them to our Wise Light / Bitget Dark style.

## 2. Approach
- **Global Theming**: We will map our existing `--em-brand` and design tokens into `wot-design-uni` root variables in `App.vue` or a unified token file.
- **Component Replacement**:
  - Raw `<button>` -> `<wd-button>`
  - Custom custom-styled modals -> `<wd-popup>` / `<wd-message-box>`
  - Progress bars -> `<wd-progress>`
  - Inputs / Forms -> `<wd-input>`
- **Preserving Identity**: We retain the "glassmorphism" aesthetic by applying our utility classes (like `.apple-glass-card`) as wrappers *around* or *in conjunction with* Wot Design components, but letting Wot handle the interaction states (focus, tap, loading).

## 3. Execution Plan
1. **Theming Bridge**: Create `src/styles/_wot-theme.scss` to map `--em-*` variables to Wot variables.
2. **Missing Base Components**: Implement `BaseButton.vue`, `BaseCard.vue` in `src/components/base/` as thin wrappers around `<wd-button>` and `<wd-card>` if necessary, OR directly use `wd-*` in business components to reduce wrapper fatigue. Given `easycom` is set up for `wd-*`, direct usage is preferred for standard UI, while `Base*` is kept for domain-specific defaults (e.g., `BaseCard` handling glassmorphism automatically).
3. **Refactor `do-quiz.vue`**: Replace all standard buttons and popups in the core learning page.
4. **Refactor `GoalSettingModal` / Dialogs**: Replace custom modals with `wd-popup`.
