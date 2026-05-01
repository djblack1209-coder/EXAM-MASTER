/**
 * 订阅消息服务 — MVP stub
 */
export function requestSubscribeMessage() {
  return Promise.resolve({ success: false });
}
export function checkSubscriptionStatus() {
  return false;
}
export default { requestSubscribeMessage, checkSubscriptionStatus };
