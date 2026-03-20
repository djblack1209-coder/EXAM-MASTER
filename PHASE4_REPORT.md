# Phase 4: Extreme Decoupling & Refactoring Plan
## 1. Code Smell Detection (The Strongest Coupling Points)
The architecture suffers from the following severe Code Smells:
1. God Object (Monolithic Controller): do-quiz.vue (2600+ lines) and pk-battle.vue (3300+ lines). These files handle UI rendering, drag-and-drop gesture math, WebSockets, AI analysis states, AND business logic routing in a single Options API export.
2. God Object (API Gateway): lafService.js (2500+ lines). Every single API call is hardcoded into one class, causing a massive bottleneck for modifications and breaking the Single Responsibility Principle.
3. Environment Pollution: Direct usage of window and localStorage in cross-platform (WeChat Mini-Program) environments, causing silent or fatal crashes on specific devices.
4. Incomplete Composition API Migration: Half the project uses Vue 3 script setup, while core domains use Vue 2 Options API.
## 2. Decoupling Strategy & Design Patterns
### A. The "lafService.js" Interface Segregation
Strategy: Instead of one massive class, split the service into domain-specific modules (AuthService, PracticeService, AIProxyService) that extend a base RequestService class handling the rate-limiting and token refresh logic.
### B. The "do-quiz.vue" Dependency Injection
Strategy: Refactor to Composition API (script setup). Extract gesture math into useSwipeGesture.js, timer logic into useQuizTimer.js, and API logic into the stores. Inject these dependencies rather than having the component define them directly.
### C. The "pk-battle.vue" Observer Pattern
Strategy: Separate the WebSocket networking logic from the UI. Create a PKRoomEngine class that emits events (RoomJoined, AnswerReceived). The Vue component will only observe these events and react.
## 3. Prioritized Refactoring Backlog (Action Items)
### Priority 1: Fix Fatal Environment Leaks (P0 - Immediate)
- Action: Replace all window.* and localStorage.* usages with uni.getSystemInfoSync() and storageService.js.
- Files to fix first: src/design/theme-engine.js, src/utils/core/offline-queue.js, src/components/layout/custom-tabbar/custom-tabbar.vue.
### Priority 2: Fix UI Performance Hazards (P1 - High)
- Action: Add unique :key bindings to all v-for directives.
- Files to fix first: src/pages/practice-sub/do-quiz.vue, src/pages/practice-sub/pk-battle.vue.
### Priority 3: API Gateway Segregation (P2 - Medium/High)
- Action: Refactor src/services/lafService.js into domain files.
### Priority 4: Component Decomposition (P3 - Strategic)
- Action: Refactor do-quiz.vue and pk-battle.vue to Composition API (<script setup>).
