import { computed, reactive } from 'vue';
import { questionKey } from './learning-domain.js';

const contexts = new WeakMap();
export const conversationCategoryId = (id) => `conversation:${id}`;
export function conversationLabel(conversation) {
  const profile = conversation.coach?.profile || conversation.studyProfile || {};
  return (
    String(conversation.goal || profile.goal || profile.subject || profile.subjects?.join('、') || '未归类').trim() ||
    '未归类'
  );
}
// A view over saved facts; changing this context never selects/writes a learning goal.
export function workspaceConversationContext(learning) {
  let selection = contexts.get(learning);
  if (!selection) {
    selection = reactive({ context: undefined, id: 'all' });
    contexts.set(learning, selection);
  }
  const id = computed({
    get: () => {
      if (selection.context !== learning.recordContext()) return 'all';
      return selection.id === 'unclassified' ||
        selection.id === 'all' ||
        learning.state.conversations.some((c) => conversationCategoryId(c.id) === selection.id)
        ? selection.id
        : 'all';
    },
    set: (value) => {
      selection.context = learning.recordContext();
      selection.id = value;
    }
  });
  const options = computed(() => [
    { id: 'all', label: '全部对话' },
    ...learning.state.conversations.map((c) => ({ id: conversationCategoryId(c.id), label: conversationLabel(c) })),
    { id: 'unclassified', label: '未归类' }
  ]);
  return { id, options, state: computed(() => scopeWorkspaceState(learning.state, id.value)) };
}
export function scopeWorkspaceState(state, category = 'all') {
  if (category === 'all') return state;
  const conversations = state.conversations.filter((c) => conversationCategoryId(c.id) === category);
  const ids = new Set(conversations.map((c) => c.id));
  const attempts = (state.attempts || []).filter((a) => ids.has(a.conversationId));
  const keys = new Set(attempts.map((a) => a.questionKey));
  for (const c of conversations) for (const key of c.questionKeys || []) keys.add(key);
  return {
    ...state,
    conversations,
    attempts,
    events: (state.events || []).filter((e) => ids.has(e.data?.conversationId)),
    reviews: (state.reviews || []).filter((r) =>
      r.conversationId ? ids.has(r.conversationId) : keys.has(r.questionKey)
    ),
    questions: (state.questions || []).filter((q) => keys.has(questionKey(q))),
    plans: (state.plans || []).filter((p) => ids.has(p.conversationId))
  };
}
