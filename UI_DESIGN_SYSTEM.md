# Exam-Master UI Design System

## Overview
This document provides a comprehensive UI design system and page inventory for Exam-Master, a smart quiz app built with UniApp (Vue3) + Laf Cloud. It serves as a reference design that can be translated into code without losing aesthetic or functional integrity.

## Theme Engine

### Design Tokens
The theme engine supports real-time switching between Wise-Light and Bitget-Dark modes. Design tokens are defined in `src/design/theme-engine.js` and include:

#### Wise-Light Theme
- **Backgrounds**: White and light gray palette for a clean fintech aesthetic
- **Text**: Dark grays for clear hierarchy
- **Brand**: Fresh green (#9FE870) with warm and cool accents
- **Shadows**: Soft shadows with subtle glows for depth

#### Bitget-Dark Theme
- **Backgrounds**: Dark grayscale with neon accents for a cyber trading vibe
- **Text**: Bright whites and grays for readability
- **Brand**: Neon blue (#00F2FF) with glowing effects
- **Shadows**: Strong neon glows for dramatic depth

### Implementation
```javascript
// src/design/theme-engine.js
import { applyTheme, getCurrentTheme, watchTheme } from './theme-engine'

// Usage in components
export default {
  onMounted() {
    const theme = getCurrentTheme()
    applyTheme(theme)
    
    watchTheme((newTheme) => {
      applyTheme(newTheme)
    })
  }
}
```

## Page Inventory

### Tier 1: Core & Dev Dashboard

#### Onboarding Page
- **Function**: User registration flow introducing app features
- **Design**: Swipeable screens with gradient backgrounds
- **Interaction**: Smooth swiper transitions, animated CTA buttons
- **UniApp Notes**: Uses `<swiper>` component with circular mode

#### Login Page (Social/OTP)
- **Function**: Secure authentication with social login and OTP support
- **Design**: Clean card-based layout with brand-aligned styling
- **Interaction**: Loading spinners, auto-focus OTP inputs, error states
- **UniApp Notes**: Uses `uni.login` API for social auth, `<input type="number">` for OTP

#### Homepage (Exam Entry)
- **Function**: Main entry point showing available exams and quick-access features
- **Design**: Grid layout of exam cards with progress indicators
- **Interaction**: Pull-to-refresh, tap-to-start animations, loading states
- **UniApp Notes**: Uses wrapped `<scroll-view>` with custom pull-to-refresh UI

#### Question Bank
- **Function**: Repository of questions with filtering and management capabilities
- **Design**: List view with alternating row backgrounds and filter chips
- **Interaction**: Left-swipe to delete, long-press for multi-select, pull-to-refresh
- **UniApp Notes**: Implements swipe gestures with `@touchstart` and `@touchend` events

#### Result Analytics
- **Function**: Visual representation of exam results with charts and trends
- **Design**: Clean charts with smooth transitions and data cards
- **Interaction**: Toggle between overview and detailed views, animated progress bars
- **UniApp Notes**: Uses `<canvas>` for custom charts, `<switch>` for view toggles

#### Profile Page
- **Function**: User account management with personal info and preferences
- **Design**: Card-based layout with user stats and settings sections
- **Interaction**: Theme toggle, loading states for data updates
- **UniApp Notes**: Uses `<image mode="aspectFill">` for avatars

#### Dev Dashboard
- **Function**: Developer-focused view showing test coverage and tech debt
- **Design**: Dashboard grid with metrics cards and cleanup tools
- **Interaction**: Animated coverage ring, real-time tech debt counter
- **UniApp Notes**: Uses `<canvas>` for coverage ring, `uni.request` for cleanup endpoints

### Tier 2: Component Library & Native Wrappers

#### Custom NavBar
- **Function**: App-wide navigation with title fade and cloud sync indicator
- **Design**: Clean header with subtle animations and theme-aware styling
- **Interaction**: Title fades in/out on scroll, cloud sync icon animates
- **UniApp Notes**: Uses custom component with `titleNView` configuration

#### Custom TabBar
- **Function**: Bottom navigation with haptic feedback and active state indicators
- **Design**: Theme-aligned styling with animated indicators
- **Interaction**: Haptic feedback on tap, icon animations when switching tabs
- **UniApp Notes**: Configured in `pages.json`, uses `uni.vibrateShort` for haptics

#### Styled Scroll-View Wrapper
- **Function**: Custom-styled wrapper for UniApp's `<scroll-view>`
- **Design**: Pull-to-refresh UI with theme-aligned spinners and progress bars
- **Interaction**: Smooth scrolling with subtle bounce effect
- **UniApp Notes**: Uses `refresher-enabled` prop, customizes refresher UI

#### Styled Picker Wrapper
- **Function**: Styled wrapper for UniApp's `<picker>` component
- **Design**: Theme-aligned styling with smooth sliding animations
- **Interaction**: Option selection with haptic feedback, confirm/cancel buttons
- **UniApp Notes**: Wraps native picker with custom overlay

#### Audit Panel
- **Function**: Collapsible bottom sheet for hard-coded string audit results
- **Design**: Clean list with fix-all buttons and post-cleanup modal
- **Interaction**: Smooth slide-up/down animation, loading spinners for fixes
- **UniApp Notes**: Implemented with `<view>` and transform animations

### Tier 4: Micro-Interactions & Automation Hooks

#### Gestures
- **Left-swipe**: Delete questions in question bank
- **Long-press**: Multi-select questions for batch operations
- **Pull-to-refresh**: Animated refresh indicators in scroll views
- **Tap feedback**: Scale and opacity transitions for interactive elements

#### Gamification Elements
- **Progress bars**: Smooth transitions when answering questions correctly
- **Achievement badges**: Animated badges for completed milestones
- **Score animations**: Number counters that animate when scores update

#### Git Hook Progression
- **Pre-commit**: Thin top progress bar showing lint/audit progress
- **Pre-push**: Full-screen overlay with step-by-step logs
- **Success indicators**: Animated checkmarks for successful hooks

#### Cloud Sync Indicator
- **Design**: Small cloud icon in NavBar with theme-aligned styling
- **Interaction**: Pulsing animation when syncing, checkmark for success, exclamation for error
- **UniApp Notes**: Uses CSS keyframes for animation, `uni.request` to poll sync status

## Component Library

### EnhancedButton
- **Usage**: Primary, secondary, and accent buttons with hover effects
- **States**: Normal, hover, active, disabled, loading
- **Design**: Theme-aligned colors with subtle shadows and glows
- **Test ID**: `data-testid="enhanced-button-{type}"``

### StudyCard
- **Usage**: Display exam cards and question items
- **States**: Normal, hover, selected, disabled
- **Design**: Card-based layout with theme-aligned backgrounds and borders
- **Test ID**: `data-testid="study-card-{id}"``

### ProgressBar
- **Usage**: Show progress for exams, study sessions, etc.
- **Features**: Animated transitions, best range indicators, status labels
- **Design**: Theme-aligned colors with subtle glows
- **Test ID**: `data-testid="progress-bar"``

### EmptyState
- **Usage**: Display when no data is available
- **Design**: Clean illustration with helpful message and CTA
- **Test ID**: `data-testid="empty-state"``

### LoadingSpinner
- **Usage**: Indicate loading states
- **Design**: Theme-aligned spinner with smooth animation
- **Test ID**: `data-testid="loading-spinner"``

## Page Layouts

### Homepage Layout
```vue
<template>
  <view class="homepage">
    <!-- Custom NavBar -->
    <custom-navbar title="Exam-Master" show-sync-indicator />
    
    <!-- Search Bar -->
    <view class="search-bar">
      <input type="text" placeholder="Search exams..." data-testid="home-search" />
    </view>
    
    <!-- Exam Grid -->
    <scroll-view
      class="exam-grid"
      refresher-enabled
      refresher-threshold="80"
      data-testid="exam-scroll-view"
    >
      <view class="exam-card" v-for="exam in exams" :key="exam.id" data-testid="exam-card-{exam.id}">
        <text class="exam-title">{{ exam.title }}</text>
        <progress-bar :progress="exam.progress" />
        <button class="start-button" data-testid="start-exam-{exam.id}">Start</button>
      </view>
    </scroll-view>
    
    <!-- Custom TabBar -->
    <custom-tabbar />
  </view>
</template>
```

### Question Bank Layout
```vue
<template>
  <view class="question-bank">
    <!-- Custom NavBar -->
    <custom-navbar title="Question Bank" />
    
    <!-- Filter Chips -->
    <view class="filter-chips">
      <view class="chip" v-for="filter in filters" :key="filter" data-testid="filter-chip-{filter}">
        {{ filter }}
      </view>
    </view>
    
    <!-- Question List -->
    <scroll-view
      class="question-list"
      refresher-enabled
      data-testid="question-scroll-view"
    >
      <view 
        class="question-item" 
        v-for="question in questions" 
        :key="question.id"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        data-testid="question-item-{question.id}"
      >
        <view class="question-content">
          <rich-text :nodes="question.content"></rich-text>
        </view>
        <view class="question-actions">
          <button class="edit-btn" data-testid="edit-question-{question.id}">Edit</button>
          <button class="delete-btn" data-testid="delete-question-{question.id}">Delete</button>
        </view>
      </view>
    </scroll-view>
    
    <!-- Custom TabBar -->
    <custom-tabbar />
  </view>
</template>
```

## Dev Dashboard

### Test Coverage Ring
- **Design**: Circular progress indicator showing current 56% coverage
- **Animation**: Smooth transition from 0% to current value on load
- **Test ID**: `data-testid="dev-dashboard-coverage-ring"``

### Tech Debt Score
- **Design**: Live counter showing hard-coded string and console.log counts
- **Update**: Real-time updates when code changes are detected
- **Test ID**: `data-testid="tech-debt-counter"``

### Cleanup Tools
- **Design**: UI buttons for triggering auto-lint and audit tasks
- **Interaction**: Loading spinners when tasks are running, success/error notifications
- **Test ID**: `data-testid="cleanup-tools"``

## Audit Panel

### Hard-coded String Audit
- **Design**: Collapsible bottom sheet with audit results
- **Features**: Fix-all buttons, individual fix options, post-cleanup modal
- **Post-cleanup**: Modal with scan animation and Git diff link
- **Test ID**: `data-testid="audit-panel"``

## Visual Test Anchors
All components include `data-testid` attributes for Playwright integration, following the pattern:
- `component-name-{identifier}` for unique components
- `component-type` for generic components

## Accessibility Guidelines
- **Contrast Ratio**: ≥4.5:1 for text elements
- **Touch Targets**: Minimum 44px × 44px for interactive elements
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: Semantic HTML structure and ARIA attributes

## Performance Optimizations
- **GPU Acceleration**: `transform: translateZ(0)` for animated elements
- **Lazy Loading**: Images and components loaded on demand
- **Reduced Motion**: Support for `prefers-reduced-motion` media query
- **Efficient Animations**: CSS transforms and opacity for smooth performance

## Browser/Platform Compatibility
- **H5**: Full support for modern browsers
- **WeChat Mini Program**: Compatible with UniApp native behaviors
- **App**: Optimized for iOS and Android

## Development Workflow

### Git Hooks
- **Pre-commit**: Runs lint and audit, shows thin top progress bar
- **Pre-push**: Runs full test suite, shows full-screen overlay with step-by-step logs

### Visual Testing
- **Playwright**: Automated visual regression testing
- **Snapshot Testing**: Component and page snapshots
- **Responsive Testing**: Multiple viewport sizes

## Design Files
- **Figma**: [Exam-Master Design System](https://figma.com/exam-master)
- **Icon Library**: Custom icons in `icon/` directory
- **Fonts**: System fonts for optimal performance

## Implementation Guidelines
1. **Follow Design Tokens**: Use CSS variables from theme engine
2. **Component Reusability**: Leverage existing components whenever possible
3. **Performance First**: Optimize animations and interactions
4. **Accessibility**: Ensure all components are accessible
5. **Testing**: Add `data-testid` attributes for Playwright integration
6. **Theme Consistency**: Ensure all components support both themes
7. **Native Behaviors**: Respect UniApp native component behaviors

This design system serves as a comprehensive reference for implementing the Exam-Master UI, ensuring consistency, performance, and accessibility across all platforms.