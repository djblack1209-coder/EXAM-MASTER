import cloud from '@lafjs/cloud';
import { runLearningModelTask } from './proxy-ai.js';
import { ProviderError } from './_shared/ai-providers/learning-provider.js';

export default async function (ctx: any) {
  // response必须绑定当前请求，不使用全局fallback向别人的连接发送内容。
  const response = cloud.res;
  let sequence = 0,
    previews = 0,
    lastAt = 0,
    lastText = '',
    bytes = 0;
  const emit = (event: string, value: any) => {
    if (!response || response.destroyed || response.writableEnded)
      throw new ProviderError('CANCELLED', '流式客户端已断开');
    if (!response.headersSent) {
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders?.();
    }
    const text = `event: ${event}\nid: ${++sequence}\ndata: ${JSON.stringify(value)}\n\n`;
    bytes += Buffer.byteLength(text);
    if (bytes > 2 * 1024 * 1024) throw new ProviderError('RESPONSE_LIMIT', '教学流式传输超过限制');
    return response.write(text);
  };
  const result = await runLearningModelTask(ctx, {
    stream: true,
    response,
    onStart: (metadata) => {
      if (!response?.write || !response?.setHeader || !response?.once)
        throw new ProviderError('STREAM_TRANSPORT_UNAVAILABLE', '当前后端没有可验证的流式传输，不调用模型');
      emit('start', { ...metadata, version: 1 });
    },
    onPreview: (text) => {
      if (!text || text === lastText || previews >= 32 || (previews && Date.now() - lastAt < 100)) return;
      lastText = text;
      lastAt = Date.now();
      previews++;
      if (!emit('preview', { text, provisional: true }))
        throw new ProviderError('CLIENT_BACKPRESSURE', '客户端接收缓慢，已停止新增模型输出');
    }
  });
  if (!response?.headersSent && !result.success) return result;
  try {
    if (!response.headersSent) {
      if (!result.success || !('data' in result) || !result.data) return result;
      emit('start', {
        version: 1,
        requestId: ctx.body.requestId,
        modelId: ctx.body.modelId,
        model: result.data.model,
        source: result.data.source,
        transport: 'sse-v1',
        reused: true
      });
    }
    if (!emit(result.success ? 'result' : 'error', result))
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          response.removeListener('drain', finish);
          response.removeListener('close', finish);
          resolve();
        };
        const timer = setTimeout(finish, 1000);
        response.once('drain', finish);
        response.once('close', finish);
      });
    if (!response.writableEnded && !response.destroyed) response.end();
  } catch {
    response?.destroy?.(); // 最终收据没送达，客户端保留未完成；同ID可读取原成本账结果。
  }
  return null;
}
