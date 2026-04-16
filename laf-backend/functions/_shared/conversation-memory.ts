/**
 * AI 好友对话记忆管理共享模块
 *
 * 负责加载和保存 AI 好友的对话记忆，支持：
 * - 加载最近 10 条对话记忆，格式化为可读文本
 * - 原子化保存新对话，自动保留最近 20 条，避免并发竞态
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { createLogger } from './api-response';

const logger = createLogger('[ConversationMemory]');

/**
 * 加载用户与指定 AI 好友的对话记忆
 *
 * 从 ai_friend_memory 集合中读取最近 10 条对话，
 * 格式化为"用户: xxx\n好友类型: xxx"的可读文本。
 *
 * @param userId - 用户 ID
 * @param friendType - AI 好友类型标识
 * @returns 格式化后的对话记忆文本，无记忆时返回空字符串
 */
export async function loadConversationMemory(userId: string, friendType: string): Promise<string> {
  try {
    const db = cloud.database();
    const collection = db.collection('ai_friend_memory');
    const result = await collection.where({ userId, friendType }).getOne();

    if (result.data && result.data.conversations && result.data.conversations.length > 0) {
      // 取最近 10 条，格式化为可读文本
      const recent = result.data.conversations.slice(-10);
      return recent
        .map(
          (c: { userMessage: string; aiResponse: string }) => `用户: ${c.userMessage}\n${friendType}: ${c.aiResponse}`
        )
        .join('\n---\n');
    }

    return '';
  } catch (error) {
    logger.error('[Memory] 加载对话记忆失败:', error);
    return '';
  }
}

/**
 * 保存一轮新的对话到用户的 AI 好友记忆中
 *
 * 使用原子操作 push + slice 避免 read-modify-write 竞态，
 * 自动保留最近 20 条对话。若记录不存在则创建新记录。
 *
 * @param userId - 用户 ID
 * @param friendType - AI 好友类型标识
 * @param userMessage - 用户发送的消息（截断至 200 字符）
 * @param aiResponse - AI 回复的消息（截断至 400 字符）
 */
export async function saveConversationMemory(
  userId: string,
  friendType: string,
  userMessage: string,
  aiResponse: string
): Promise<void> {
  try {
    const memDb = cloud.database();
    const memCmd = memDb.command;
    const collection = memDb.collection('ai_friend_memory');

    const newConversation = {
      userMessage: userMessage.substring(0, 200),
      aiResponse: aiResponse.substring(0, 400),
      timestamp: Date.now()
    };

    // 原子更新：push 新对话 + slice 保留最近 20 条，避免 read-modify-write 竞态
    const updateResult = await collection.where({ userId, friendType }).update({
      conversations: memCmd.push({
        each: [newConversation],
        slice: -20
      }),
      updatedAt: Date.now()
    });

    if (!updateResult.updated) {
      // 不存在则创建（极端并发下可能重复，但 conversations 不会丢数据）
      try {
        await collection.add({
          userId,
          friendType,
          conversations: [newConversation],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } catch (addErr) {
        // 并发创建冲突，再尝试一次原子更新
        await collection.where({ userId, friendType }).update({
          conversations: memCmd.push({
            each: [newConversation],
            slice: -20
          }),
          updatedAt: Date.now()
        });
      }
    }

    logger.info(`[Memory] 保存对话记忆成功: ${userId} - ${friendType}`);
  } catch (error) {
    logger.error('[Memory] 保存对话记忆失败:', error);
    // 不影响主流程
  }
}
