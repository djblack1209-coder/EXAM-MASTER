# YOLO Refactor Plan for do-quiz.vue
The 2600-line Options API do-quiz.vue is a God Object. It mixes AI Proxy logic, UX interactions (Gesture Swiping), Websocket hooks, state management, and a huge UI template.
## 1. Modular Extraction Strategy
Rather than blindly trying to rewrite 2600 lines from Options API to Composition API in a single regex (which is impossible without breaking it), we will systematically carve out specific UI blocks into child components to reduce its lines of code to under 1000 lines.
### Step A: Extract The AI Tutor Feedback Block
- Create src/pages/practice-sub/components/TutorFeedbackCard.vue (already exists, but we can enhance it or extract the massive logic inside do-quiz's template handling AI feedback).
### Step B: Extract Question Choice Rendering
- Create src/pages/practice-sub/components/QuestionChoice.vue to handle the rendering of ABCD options, multi-select logic, and correct/incorrect styling.
### Step C: Extract AI Diagnostics Logic
- Move the AI Deep Mistake Analysis fetching logic to a dedicated composable useAIAnalysis.js (already exists partially as fetchAIAnalysis).
## 2. Refactor Action
Let's extract the renderChoice() logic and the HTML template for options into a child component.
