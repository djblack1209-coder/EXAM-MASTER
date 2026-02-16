/**
 * 清理所有对话数据的工具脚本
 * 使用方法：在需要的地方调用 clearAllChatData()
 */
import { logger } from '@/utils/logger.js';

/**
 * 清空所有本地存储的对话相关数据
 */
export function clearAllChatData() {
  try {
    // 清空可能的对话历史存储键
    const chatKeys = [
      'chat_history',
      'chat_messages',
      'conversation_history',
      'chat_conversations',
      'ai_chat_history',
      'messages_history'
    ];

    chatKeys.forEach((key) => {
      try {
        storageService.remove(key);
        logger.log(`✅ 已删除存储键: ${key}`);
      } catch (_e) {
        // 键不存在时忽略错误
      }
    });

    logger.log('✅ 所有对话数据已清理完成');
    return true;
  } catch (error) {
    console.error('❌ 清理对话数据时出错:', error);
    return false;
  }
}

/**
 * 清空聊天页面的消息数组（需要在页面中调用）
 */
export function clearChatMessages(vueInstance) {
  if (vueInstance && vueInstance.messages) {
    // 保留初始欢迎消息
    vueInstance.messages = [
      {
        role: 'assistant',
        content: '你好！我是你的智能导师。我已经准备好为你解析这份资料中的难点。你想先从哪个章节开始？',
        time: '刚才',
        showTime: true
      }
    ];
    logger.log('✅ 聊天消息已清空');
    return true;
  }
  return false;
}
