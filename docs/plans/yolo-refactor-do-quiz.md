# Modular Composables Plan for `do-quiz.vue`

The `do-quiz.vue` file relies on a massive `data()` block and `methods: {}` block.

## Immediate Action Items
To refactor it safely, we should instead:
1. Extract ALL the `methods: {}` handling AI Proxy requests into a Composable `useQuizAI.js`.
2. Extract ALL the `methods: {}` handling Answer Submission and Database Storage into `useQuizSubmit.js`.
3. Extract the gesture swiping logic out of the component methods into `useQuizSwiper.js`.

Let's verify the `methods` block structure.
