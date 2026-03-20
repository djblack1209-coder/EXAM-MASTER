# Spec: Knowledge Graph Interactive Visualization

## 1. Overview
The current `knowledge-graph/index.vue` renders nodes manually using absolute positioned DOM elements and radial gradients. While visually okay, it is not a true interactive graph and lacks deep integration with our newly established `fsrs-optimizer.ts` Moat. We will upgrade this page to visually reflect FSRS memory stability (e.g., nodes glowing brightly if mastered, dim if forgetting) and hook it up to the AI Tutor to generate targeted mini-quizzes upon clicking weak nodes.

## 2. Approach
- **Visual Encoding**: Map FSRS `stability` and `scheduled_days` to node styling (opacity, glow radius, border color).
- **Component Refactor**: Replace raw `<view>` structures in the Action Strip with `<wd-button>` or `<BaseCard>` for UI consistency.
- **Tutor Integration**: When a "dim" (weak) node is clicked, present a sleek Wot Design popup `<wd-popup>` offering to "Summon AI Tutor for a targeted 5-question drill on this weak point". This directly links the Graph UX with the Backend AI generation.

## 3. Scope of this Iteration
- Refactor UI of `knowledge-graph/index.vue` to adopt `wot-design-uni` (`wd-button`, `wd-popup`).
- Implement visual mapping logic (e.g. `opacity: Math.max(0.3, node.stability / 10)`).
- Implement the "Summon AI Tutor" flow using `lafService.callFunction('proxy-ai', { action: 'adaptive_pick', node_id: activeNode.id })`.
