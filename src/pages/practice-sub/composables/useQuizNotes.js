/**
 * 题目笔记管理 composable
 *
 * 从 do-quiz.vue 提取的笔记相关逻辑，包括：
 * - 笔记弹窗的打开/关闭
 * - 笔记内容编辑与标签选择
 * - 笔记保存与列表刷新
 */

import { ref, computed } from 'vue';
import { addQuestionNote, getNotesByQuestion, getNoteTags } from '../question-note.js';
import { toast } from '@/utils/toast.js';

/**
 * 题目笔记管理
 * @returns {{
 *   currentQuestionNotes: import('vue').Ref<Array<Object>>,
 *   showNoteModal: import('vue').Ref<boolean>,
 *   noteContent: import('vue').Ref<string>,
 *   selectedNoteTags: import('vue').Ref<Array<string>>,
 *   availableNoteTags: import('vue').ComputedRef<Array<Object>>,
 *   handleOpenNote: (currentQuestion: Object) => void,
 *   toggleNoteTag: (tagId: string) => void,
 *   handleSaveNote: (currentQuestion: Object) => void,
 *   updateQuestionNotes: (currentQuestion: Object) => void
 * }}
 */
export function useQuizNotes() {
  // ==================== 响应式状态 ====================

  /** @type {import('vue').Ref<Array<Object>>} 当前题目的笔记列表 */
  const currentQuestionNotes = ref([]);

  /** @type {import('vue').Ref<boolean>} 笔记弹窗是否显示 */
  const showNoteModal = ref(false);

  /** @type {import('vue').Ref<string>} 笔记输入内容 */
  const noteContent = ref('');

  /** @type {import('vue').Ref<Array<string>>} 已选中的笔记标签 ID 列表 */
  const selectedNoteTags = ref([]);

  // ==================== 计算属性 ====================

  /** @type {import('vue').ComputedRef<Array<Object>>} 可用的笔记标签（带使用次数） */
  const availableNoteTags = computed(() => getNoteTags());

  // ==================== 内部工具 ====================

  /**
   * 获取题目的唯一标识
   * @param {Object} question - 题目对象
   * @returns {string} 题目 ID
   */
  function getQuestionId(question) {
    return question.id || question.question;
  }

  // ==================== 方法 ====================

  /**
   * 打开笔记弹窗
   * 加载当前题目已有笔记，并重置输入区域
   * @param {Object} currentQuestion - 当前题目对象
   */
  function handleOpenNote(currentQuestion) {
    if (!currentQuestion) return;

    // 加载当前题目的笔记
    currentQuestionNotes.value = getNotesByQuestion(getQuestionId(currentQuestion));

    // 重置输入状态
    noteContent.value = '';
    selectedNoteTags.value = [];
    showNoteModal.value = true;
  }

  /**
   * 切换笔记标签的选中状态
   * 已选中则取消，未选中则添加
   * @param {string} tagId - 标签 ID
   */
  function toggleNoteTag(tagId) {
    const index = selectedNoteTags.value.indexOf(tagId);
    if (index >= 0) {
      selectedNoteTags.value.splice(index, 1);
    } else {
      selectedNoteTags.value.push(tagId);
    }
  }

  /**
   * 保存笔记
   * 校验内容非空 → 调用存储 → 刷新列表 → 关闭弹窗
   * @param {Object} currentQuestion - 当前题目对象
   */
  function handleSaveNote(currentQuestion) {
    if (!noteContent.value.trim()) {
      toast.info('请输入笔记内容');
      return;
    }

    const questionId = getQuestionId(currentQuestion);

    const result = addQuestionNote({
      questionId,
      questionContent: currentQuestion.question,
      content: noteContent.value.trim(),
      tags: selectedNoteTags.value,
      category: currentQuestion.category
    });

    if (result.success) {
      toast.success('笔记已保存');

      // 刷新当前题目的笔记列表
      currentQuestionNotes.value = getNotesByQuestion(questionId);

      // 关闭弹窗并重置表单
      showNoteModal.value = false;
      noteContent.value = '';
      selectedNoteTags.value = [];
    } else {
      toast.info('保存失败');
    }
  }

  /**
   * 刷新当前题目的笔记列表
   * 通常在切换题目时调用
   * @param {Object} currentQuestion - 当前题目对象
   */
  function updateQuestionNotes(currentQuestion) {
    if (currentQuestion) {
      currentQuestionNotes.value = getNotesByQuestion(getQuestionId(currentQuestion));
    }
  }

  // ==================== 导出 ====================

  return {
    // 响应式状态
    currentQuestionNotes,
    showNoteModal,
    noteContent,
    selectedNoteTags,

    // 计算属性
    availableNoteTags,

    // 方法
    handleOpenNote,
    toggleNoteTag,
    handleSaveNote,
    updateQuestionNotes
  };
}
