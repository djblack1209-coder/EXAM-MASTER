## PROMPT_FOR_V0_DEV

### Theme Engine
- **Function/Description**: Foundation for real-time theme switching between Wise-Light and Bitget-Dark modes, managing all color variables, typography, and component styles.
- **Design Instruction**: 
  - **Wise-Light**: Clean fintech aesthetic with soft blues (#4A90E2), whites (#FFFFFF), and light grays (#F5F7FA); typography: sans-serif with clear hierarchy, 16px base font.
  - **Bitget-Dark**: Cyber trading theme with dark backgrounds (#1A1C23), neon blues (#00E0FF), and purple accents (#9B51E0); typography: futuristic sans-serif with sharp edges, 15px base font.
- **Interaction & States**: Smooth 300ms transition when toggling themes; persistent theme preference stored in local storage; dev-mode banner shows current theme and color palette.
- **UniApp Compatibility Note**: Use UniApp's `uni.setNavigationBarColor` API to sync native navigation with current theme; leverage CSS variables for dynamic styling across all components.

### Onboarding Page
- **Function/Description**: User registration flow introducing Exam-Master's features, with swipeable screens and CTA to login/register.
- **Design Instruction**: 
  - **Wise-Light**: Gradient backgrounds transitioning from light blue to white; minimal illustrations with soft shadows; rounded CTA buttons with subtle hover effects.
  - **Bitget-Dark**: Dark gradient with neon accents; futuristic illustrations with glow effects; sharp-edged CTA buttons with neon borders and pulsing hover animations.
- **Interaction & States**: Swiper-based navigation with page indicators; loading state for CTA buttons; error state for invalid inputs; dev-mode shows swipe indicators and screen transition logs.
- **UniApp Compatibility Note**: Use UniApp's `<swiper>` component with `circular` mode; wrap CTA buttons in `<button>` for native haptic feedback.

### Login Page (Social/OTP)
- **Function/Description**: Secure authentication page supporting social login (Google, Apple) and OTP verification, with passwordless option.
- **Design Instruction**: 
  - **Wise-Light**: Clean card-based layout with white background; social login buttons with brand colors and rounded corners; OTP input fields with subtle separators.
  - **Bitget-Dark**: Dark card with neon border glow; social login buttons with dark backgrounds and brand logos; OTP fields with neon active states.
- **Interaction & States**: Social login buttons with loading spinners; OTP input auto-focus and validation; error states for invalid codes; dev-mode shows API request logs and authentication flow steps.
- **UniApp Compatibility Note**: Use UniApp's `<input>` with `type="number"` for OTP; leverage `uni.login` API for social authentication; add `data-testid="login-otp-input"` to OTP fields.

### Homepage (Exam Entry)
- **Function/Description**: Main entry point showing available exams, recent activity, and quick-access features like question bank and analytics.
- **Design Instruction**: 
  - **Wise-Light**: Grid layout of exam cards with soft shadows; progress indicators for ongoing exams; top navigation with search bar; clean typography with bold exam titles.
  - **Bitget-Dark**: Grid of exam cards with neon borders; animated progress bars for ongoing exams; dark search bar with glowing input field; futuristic card hover effects.
- **Interaction & States**: Pull-to-refresh to sync exam list; exam cards with tap-to-start animation; loading state for exam data; dev-mode shows API response times and data sync status.
- **UniApp Compatibility Note**: Use wrapped `<scroll-view>` with pull-to-refresh UI; implement exam cards with `<view>` and `@tap` events; add `data-testid="exam-card-{id}"` to each card.

### Question Bank Page
- **Function/Description**: Repository of questions with filtering, searching, and management capabilities (add, edit, delete).
- **Design Instruction**: 
  - **Wise-Light**: List view with alternating row backgrounds; filter chips with rounded corners; action buttons with soft colors; search bar with clear icon.
  - **Bitget-Dark**: List view with dark rows and neon dividers; filter chips with neon accents; action buttons with glowing effects; search bar with neon input glow.
- **Interaction & States**: Left-swipe to delete questions; long-press for multi-select mode; pull-to-refresh to sync questions; loading state for question data; dev-mode shows question count and filter applied logs.
- **UniApp Compatibility Note**: Implement swipe gestures with UniApp's `@touchstart` and `@touchend` events; use wrapped `<scroll-view>` for list; add `data-testid="question-item-{id}"` to each question.

### Result Analytics Page
- **Function/Description**: Visual representation of exam results with charts, progress trends, and detailed performance breakdowns.
- **Design Instruction**: 
  - **Wise-Light**: Clean charts with blue color scheme; progress bars with smooth transitions; data cards with rounded corners and soft shadows; toggle between overview and detailed views.
  - **Bitget-Dark**: Neon-styled charts with dark backgrounds; animated progress bars with glow effects; data cards with neon borders; futuristic toggle switches.
- **Interaction & States**: Smooth chart animations on load; toggle between views with slide transitions; loading state for analytics data; dev-mode shows data source and chart rendering time.
- **UniApp Compatibility Note**: Use UniApp's `<canvas>` for custom charts or wrap a chart library; implement toggle with `<switch>` component; add `data-testid="analytics-chart-{type}"` to charts.

### Profile Page
- **Function/Description**: User account management with personal information, theme settings, and app preferences.
- **Design Instruction**: 
  - **Wise-Light**: Card-based layout with user avatar, name, and stats; settings sections with clear icons; theme toggle as a soft switch; logout button with red accent.
  - **Bitget-Dark**: Dark profile card with neon avatar border; settings sections with glowing icons; theme toggle as a neon switch; logout button with neon red glow.
- **Interaction & States**: Theme toggle with smooth transition; loading state for profile data; error state for failed updates; dev-mode shows preference storage status and API calls.
- **UniApp Compatibility Note**: Use UniApp's `<image>` for avatar with `mode="aspectFill"`; implement theme toggle with `<switch>`; add `data-testid="profile-theme-toggle"` to theme switch.

### Dev Dashboard
- **Function/Description**: Developer-focused view showing test coverage, tech debt, and cleanup tools for maintaining code quality.
- **Design Instruction**: 
  - **Wise-Light**: Dashboard grid with cards showing test coverage ring, tech debt score, and cleanup tools; charts with blue accents; buttons with soft hover effects.
  - **Bitget-Dark**: Dark dashboard with neon-styled metrics; test coverage ring with neon glow; tech debt counter with red/yellow/green indicators; cleanup buttons with glowing effects.
- **Interaction & States**: Test coverage ring animates from 0% to 56% on load; tech debt score updates in real-time; cleanup tools show loading spinners when triggered; dev-mode shows detailed audit logs.
- **UniApp Compatibility Note**: Use `<canvas>` for test coverage ring; implement cleanup tools with `uni.request` to backend endpoints; add `data-testid="dev-dashboard-coverage-ring"` to coverage ring.

### Custom NavBar Component
- **Function/Description**: App-wide navigation bar with title fade effect, cloud sync indicator, and theme toggle button.
- **Design Instruction**: 
  - **Wise-Light**: White background with blue title; subtle shadow at bottom; cloud sync icon with soft blue color; theme toggle as a small switch.
  - **Bitget-Dark**: Dark background with neon title; glowing bottom border; cloud sync icon with neon blue glow; theme toggle as a small neon switch.
- **Interaction & States**: Title fades in/out on scroll; cloud sync icon animates when syncing; theme toggle triggers global theme change; dev-mode shows nav height and title visibility logs.
- **UniApp Compatibility Note**: Use UniApp's `custom-nav-bar` component with `titleNView` configuration; implement cloud sync animation with CSS keyframes; add `data-testid="navbar-theme-toggle"` to theme button.

### Custom TabBar Component
- **Function/Description**: Bottom navigation with haptic feedback, icon animations, and active state indicators.
- **Design Instruction**: 
  - **Wise-Light**: White background with blue active icons; subtle shadow at top; rounded corners for tab items; haptic feedback on tap.
  - **Bitget-Dark**: Dark background with neon active icons; glowing top border; sharp-edged tab items; strong haptic feedback on tap.
- **Interaction & States**: Icon animations when switching tabs; haptic feedback triggers on tab tap; active tab shows animated indicator; dev-mode shows tab change logs and haptic intensity.
- **UniApp Compatibility Note**: Use UniApp's custom TabBar configuration in `pages.json`; implement haptic feedback with `uni.vibrateShort`; add `data-testid="tabbar-item-{name}"` to each tab.

### Styled Scroll-View Wrapper
- **Function/Description**: Wrapper for UniApp's `<scroll-view>` with custom pull-to-refresh UI and smooth scrolling.
- **Design Instruction**: 
  - **Wise-Light**: Pull-to-refresh indicator with blue spinner and progress bar; smooth scrolling with subtle bounce effect; scrollbar with soft gray color.
  - **Bitget-Dark**: Pull-to-refresh indicator with neon spinner and glow effect; smooth scrolling with dark bounce effect; scrollbar with neon blue color.
- **Interaction & States**: Pull-to-refresh triggers loading animation; refresh success state with checkmark; error state with retry option; dev-mode shows scroll position and refresh trigger logs.
- **UniApp Compatibility Note**: Use UniApp's `<scroll-view>` with `refresher-enabled`; customize refresher UI with `refresher-default-style` and `refresher-background`; add `data-testid="scroll-view-wrapper"` to wrapper.

### Styled Picker Wrapper
- **Function/Description**: Styled wrapper for UniApp's `<picker>` component with custom styling and animations.
- **Design Instruction**: 
  - **Wise-Light**: Picker with white background and blue header; rounded corners; smooth sliding animation; option text with clear hierarchy.
  - **Bitget-Dark**: Picker with dark background and neon header; sharp edges; sliding animation with glow effects; option text with neon active state.
- **Interaction & States**: Picker opens with fade-in animation; option selection with haptic feedback; confirm/cancel buttons with loading states; dev-mode shows picker value and selection logs.
- **UniApp Compatibility Note**: Wrap UniApp's `<picker>` in a custom component with styled overlay; implement confirm/cancel using native picker events; add `data-testid="styled-picker-{type}"` to picker.

### Audit Panel Component
- **Function/Description**: Collapsible bottom sheet for hard-coded string audit results, with "Fix-all" buttons and post-cleanup modal.
- **Design Instruction**: 
  - **Wise-Light**: Bottom sheet with white background and blue header; audit results in a clean list; "Fix-all" button with blue background; post-cleanup modal with progress animation.
  - **Bitget-Dark**: Bottom sheet with dark background and neon header; audit results with neon highlights; "Fix-all" button with neon border; post-cleanup modal with glowing scan animation.
- **Interaction & States**: Bottom sheet slides up/down with smooth animation; "Fix-all" button shows loading spinner; post-cleanup modal displays scan animation and Git diff link; dev-mode shows audit log details and fix progress.
- **UniApp Compatibility Note**: Implement bottom sheet with `<view>` and `transform` animations; use UniApp's `<modal>` for post-cleanup dialog; add `data-testid="audit-panel-fix-all"` to "Fix-all" button.

### Git Hook Progression UI
- **Function/Description**: Visual indicators for Git hooks (pre-commit, pre-push) showing progress and logs.
- **Design Instruction**: 
  - **Wise-Light**: Pre-commit: Thin blue top progress bar; Pre-push: Full-screen overlay with clean white background, step-by-step logs with blue indicators.
  - **Bitget-Dark**: Pre-commit: Thin neon top progress bar; Pre-push: Full-screen dark overlay with neon step indicators and glowing logs.
- **Interaction & States**: Pre-commit bar animates from 0% to 100%; Pre-push overlay shows sequential steps with loading spinners; success/failure states with clear indicators; dev-mode shows hook execution time and command logs.
- **UniApp Compatibility Note**: Implement progress bars with CSS width transitions; use `<view>` for full-screen overlay; leverage UniApp's `onLoad` to detect Git hook events; add `data-testid="git-hook-progress"` to progress elements.

### Cloud Sync Indicator
- **Function/Description**: Subtle animating cloud icon in NavBar showing Laf Cloud sync status.
- **Design Instruction**: 
  - **Wise-Light**: Small cloud icon with soft blue color; pulsing animation when syncing; checkmark for success; exclamation mark for error.
  - **Bitget-Dark**: Small cloud icon with neon blue glow; glowing pulse animation when syncing; neon checkmark for success; neon exclamation for error.
- **Interaction & States**: Idle state: static icon; Syncing: pulsing animation; Success: checkmark appears briefly; Error: exclamation mark with tooltip; dev-mode shows sync frequency and data size.
- **UniApp Compatibility Note**: Implement animation with CSS keyframes; use `uni.request` to poll sync status; add `data-testid="cloud-sync-indicator"` to icon.

### Question Interaction Component
- **Function/Description**: Dynamic question display with gamification elements, progress tracking, and gesture support.
- **Design Instruction**: 
  - **Wise-Light**: Clean question layout with white background; answer options with rounded corners; smooth progress bar transitions; correct answer shows green highlight.
  - **Bitget-Dark**: Dark question layout with neon border; answer options with sharp edges; animated progress bar with glow; correct answer shows neon green highlight.
- **Interaction & States**: Smooth progress bar animation when answering correctly; left-swipe to skip; long-press for hints; loading state for next question; dev-mode shows question difficulty and answer time.
- **UniApp Compatibility Note**: Use `<rich-text>` for formatted questions; implement progress bar with CSS transitions; add `data-testid="question-answer-{option}"` to each answer option.

### Dev-Mode Banner
- **Function/Description**: Persistent banner in dev environments showing current build mode, theme, and quick-access to dev tools.
- **Design Instruction**: 
  - **Wise-Light**: Yellow banner with black text; rounded corners; collapsible with dev tool icons; hover effects on icons.
  - **Bitget-Dark**: Orange neon banner with dark text; sharp edges; collapsible with glowing dev tool icons; pulsing hover effects.
- **Interaction & States**: Click to collapse/expand; tool icons open respective dev panels; shows real-time build info; dev-mode shows banner visibility logs.
- **UniApp Compatibility Note**: Implement banner with conditional rendering based on `process.env.NODE_ENV`; use `uni.getSystemInfo` to check environment; add `data-testid="dev-mode-banner"` to banner.