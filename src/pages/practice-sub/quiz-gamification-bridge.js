/**
 * 游戏化桥接模块（已降级）
 * gamification store 已移除，保留空实现确保编译通过
 */

/** 刷题会话开始（降级：空操作） */
export function onQuizSessionStart() {}

/** 答题结果回调（降级：空操作） */
export function onAnswerResult(_result) {}

/** 刷题会话结束（降级：空操作） */
export function onQuizSessionEnd() {}

/** 绑定游戏化事件（降级：返回空清理函数） */
export function bindGamificationEvents() {
  return () => {};
}
