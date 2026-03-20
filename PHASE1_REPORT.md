# Phase 1: Global Topology & Granularity Alignment Report
## 1. Dependency Graph & Architecture Tree
The project follows a standard Vue3/uni-app frontend structure coupled with a serverless Laf backend.
### Frontend Architecture (src/)
- Core Business Pages (57 total, 43 sub-packages)
- Shared Components (15 total)
- Business Components (23 total)
- Composables (22 total)
- Services (Laf BaaS Integration)
- State Management (13 Pinia Stores)
### Backend Architecture (laf-backend/)
- Cloud Functions (85 total)
- Shared Modules (_shared/)
## 2. Orphaned / Dead Modules (Ghost Modules)
Static analysis identified 26 potential orphaned files in the frontend that are not explicitly imported:
- src/components/business/chat/ChatBox.vue
- src/components/business/chat/SessionList.vue
- src/mixins/navigationMixin.js
- src/mixins/todoMixin.js
*Evaluation*: Mixins are likely remnants of Vue 2. Chat components seem incomplete. Composables that are unused should be evaluated for deletion or integration.
## 3. Granularity Alignment & God Objects
The codebase suffers from severe granularity issues. There is a massive mix of Options API (72 files) and Composition API (31 files), indicating an incomplete migration to Vue 3.
### Critical God Objects Detected:
1. pages/practice-sub/pk-battle.vue (3378 lines) - Massive Options API component mixing UI, websocket, and core game loops.
2. pages/practice-sub/import-data.vue (2803 lines) - Huge Options API file handling file parsing and UI.
3. pages/practice-sub/do-quiz.vue (2689 lines) - Core practice engine built with Options API.
4. services/lafService.js (2576 lines) - A monolithic API gateway. It contains rate-limiting, error handling, and every single API call definition.
5. pages/school/index.vue (2440 lines) - Giant Options API file for school searching.
### Granularity Imbalance:
- While some logic is nicely extracted into composables, core pages are still monolithic Options API components.
- The backend appears more granular (85 separate cloud functions), but the frontend service layer (lafService.js) is a single bottleneck file.
