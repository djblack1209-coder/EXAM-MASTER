# Vue 3 文档摘要缓存

> 项目版本：Vue 3.4.21

## defineProps / defineEmits 不需要 import

- **来源**：https://cn.vuejs.org/api/sfc-script-setup.html
- **结论**：`defineProps`、`defineEmits`、`defineExpose`、`defineSlots` 都是编译器宏，在 `<script setup>` 中直接使用，不需要 import。如果 import 了反而可能报错。
- **日期**：2026-03-29

## ref vs reactive 的选择

- **来源**：https://cn.vuejs.org/guide/essentials/reactivity-fundamentals.html
- **结论**：推荐优先使用 `ref()`。`reactive()` 有限制：不能替换整个对象（会丢失响应式），解构会丢失响应式。`ref()` 没有这些限制，只是需要 `.value` 访问。
- **日期**：2026-03-29

## watch vs watchEffect

- **来源**：https://cn.vuejs.org/guide/essentials/watchers.html
- **结论**：`watch` 需要明确指定监听源，惰性执行（第一次不触发，除非设 `immediate: true`）。`watchEffect` 自动追踪依赖，创建时立即执行一次。需要精确控制监听什么用 `watch`，需要自动收集依赖用 `watchEffect`。
- **日期**：2026-03-29

## provide / inject 响应式丢失

- **来源**：https://cn.vuejs.org/guide/components/provide-inject.html
- **结论**：`provide` 传递的值如果是 `ref()` 或 `reactive()`，注入方会自动保持响应式。但如果 provide 的是解构后的普通值（比如 `provide('count', count.value)`），注入方拿到的就不是响应式的。必须 provide ref 本身：`provide('count', count)`。
- **日期**：2026-03-29
