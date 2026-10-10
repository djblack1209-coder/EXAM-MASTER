import { createHash } from 'node:crypto';
import { grammarScopeFor, normalizeGrammarReference, LANGUAGE_TOOL_SOURCE } from './learning-grammar-contract.js';
import { sameComputeSnapshot } from './learning-compute-contract.js';
const fail = (code) => {
  throw Object.assign(new Error('语法检查未完成，原答保持'), { code });
};
export async function checkGrammarReference(scope, readContext, runtime, signal) {
  let url;
  try {
    url = new URL(runtime.url);
  } catch {
    fail('RUNTIME_UNAVAILABLE');
  }
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/v2/check' ||
    url.search ||
    url.hash
  )
    fail('RUNTIME_UNAVAILABLE');
  const initial = await readContext();
  const expected = grammarScopeFor(initial.state, scope.conversationId);
  if (
    initial.ownerId !== scope.ownerId ||
    expected.questionKey !== scope.questionKey ||
    expected.attemptId !== scope.attemptId
  )
    fail('CONTEXT_CHANGED');
  if (signal?.aborted) fail('CANCELLED');
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20000);
  let reader;
  try {
    const response = await fetch(url.href, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ language: 'en-US', text: expected.expected.attempt.answer })
    });
    if (!response.ok) fail('RUNTIME_UNAVAILABLE');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536)) fail('OUTPUT_LIMIT');
    reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) fail('OUTPUT_LIMIT');
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      body.software?.version !== LANGUAGE_TOOL_SOURCE.version ||
      body.software?.premium !== false ||
      !Array.isArray(body.matches) ||
      body.matches.length > 40
    )
      fail('INVALID_REFERENCE');
    const current = await readContext();
    if (controller.signal.aborted || signal?.aborted) fail('CANCELLED');
    if (
      current.ownerId !== scope.ownerId ||
      !sameComputeSnapshot(grammarScopeFor(current.state, scope.conversationId), expected)
    )
      fail('CONTEXT_CHANGED');
    return normalizeGrammarReference(
      {
        contract: 'grammar-reference-v1',
        requestId: createHash('sha256')
          .update(JSON.stringify([scope, expected, LANGUAGE_TOOL_SOURCE, 'en-US']))
          .digest('hex'),
        questionKey: scope.questionKey,
        attemptId: scope.attemptId,
        source: LANGUAGE_TOOL_SOURCE,
        result: {
          upstream: 'languagetool',
          version: LANGUAGE_TOOL_SOURCE.version,
          language: 'en-US',
          gradingAuthority: false,
          findings: body.matches.map((m) => ({
            offset: m.offset,
            length: m.length,
            original: expected.expected.attempt.answer.slice(m.offset, m.offset + m.length),
            message: m.message,
            ruleId: m.rule?.id,
            replacements: Array.isArray(m.replacements) ? m.replacements.slice(0, 8).map((r) => r.value) : null
          }))
        }
      },
      current.state,
      scope.conversationId,
      scope.questionKey
    );
  } catch (error) {
    if (signal?.aborted) fail('CANCELLED');
    if (controller.signal.aborted) fail('TIME_LIMIT');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    await reader?.cancel().catch(() => undefined);
    controller.abort();
  }
}
