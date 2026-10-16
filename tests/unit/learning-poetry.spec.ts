import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import checkedPoem from '../../src/services/learning/poetry-cache.json';
import {
  createPoetryLookup,
  matchPoetrySearch,
  POETRY_CONTEXT,
  POETRY_LOOKUP_LIMITS
} from '../../laf-backend/functions/_shared/learning-poetry.js';

const node = {
  id: '123',
  title: '登鹳雀楼',
  author: { name: '王之涣' },
  content: '白日依山尽，黄河入海流。\n欲穷千里目，更上一层楼。'
};
const response = (poem = node) => ({ data: { searchPoems: { edges: [{ node: poem }] } } });
const publicAddress = { address: '93.184.216.34', family: 4 };

function transport({ value = response(), status = 200, headers = {}, text, respond = true }: any = {}) {
  const resolver = vi.fn().mockResolvedValue([publicAddress]);
  let options: any;
  let body: string;
  let upstreamDestroyed = false;
  const request = vi.fn((url: URL, input: any, accept: any) => {
    options = input;
    const req: any = new EventEmitter();
    req.end = (data: string) => {
      body = data;
      if (!respond) return;
      queueMicrotask(() => {
        const res: any = new EventEmitter();
        res.statusCode = status;
        res.headers = { 'content-type': 'application/json; charset=utf-8', ...headers };
        res.destroy = () => {
          upstreamDestroyed = true;
        };
        accept(res);
        if (upstreamDestroyed) return;
        res.emit('data', Buffer.from(text ?? JSON.stringify(value)));
        if (!upstreamDestroyed) res.emit('end');
      });
    };
    input.signal.addEventListener('abort', () => req.emit('error', new Error('aborted')), { once: true });
    return req;
  });
  return {
    resolver,
    request,
    options: () => options,
    body: () => body,
    destroyed: () => upstreamDestroyed
  };
}
afterEach(() => vi.useRealTimers());

it('只匹配独立古籍中的完整原文/作者/篇名，返回现有缓存引用，不采用上游正文或现代批注', () => {
  const match = matchPoetrySearch(response());
  expect(match).toMatchObject({ referenceId: checkedPoem.id, sourceUrl: checkedPoem.sourceUrl });
  expect(Object.keys(match!)).toEqual(['referenceId', 'sourceUrl', 'upstreamPoemId', 'provider']);
  expect(checkedPoem.originalRights).toBe('public-domain-classical-original');
  expect(checkedPoem.attributionNote).toContain('朱斌');
  expect(
    matchPoetrySearch(
      response({
        ...node,
        title: '登鸛雀樓',
        author: { name: '王之渙' },
        content: '白日依山盡黄河入海流欲窮千里目更上一層樓'
      })
    )
  ).toEqual(match);
});

it.each([
  null,
  { data: { searchPoems: { edges: [] } } },
  { ...response(), errors: [{ message: 'untrusted private text' }] },
  { ...response(), errors: 'not an array' },
  response({ ...node, content: node.content + '现代注释' }),
  response({ ...node, content: '欲穷千里目，更上一层楼。' }),
  response({ ...node, content: '<p>' + node.content + '</p>' }),
  response({ ...node, author: { name: '朱斌' } }),
  response({ ...node, title: '其他篇名' }),
  response({ ...node, id: 'https://internal/private' }),
  { data: { searchPoems: { edges: Array.from({ length: 6 }, () => ({ node })) } } },
  { data: { searchPoems: { edges: [{ node }, { node }] } } }
])('错误/歧义/超界数据不得取得已核来源引用 %#', (value) => {
  expect(matchPoetrySearch(value)).toBeNull();
});

it('默认关闭，未知主题或含私有材料的对象输入不解析DNS、不出网', async () => {
  const h = transport();
  expect(await createPoetryLookup(h)(POETRY_CONTEXT)).toBeNull();
  const get = createPoetryLookup({ ...h, enabled: true });
  for (const context of [
    'student@example.com',
    '独立练习正确',
    { context: POETRY_CONTEXT, answer: 'private answer' }
  ]) {
    expect(await get(context)).toBeNull();
  }
  expect(h.resolver).not.toHaveBeenCalled();
  expect(h.request).not.toHaveBeenCalled();
});

it('只有固定公网目标/固定标题只读查询，无身份头或动态正文，DNS固定且保留原TLS检查', async () => {
  const h = transport();
  const get = createPoetryLookup({ ...h, enabled: true });
  const first = get(POETRY_CONTEXT);
  expect(get(POETRY_CONTEXT)).toBe(first);
  expect(await first).toMatchObject({ referenceId: checkedPoem.id });
  expect(await get(POETRY_CONTEXT)).toEqual(await first);
  expect(h.request).toHaveBeenCalledTimes(1);
  expect(h.resolver).toHaveBeenCalledTimes(1);
  expect(h.request.mock.calls[0][0].href).toBe('https://poetry.palemoky.com/graphql');
  const options = h.options();
  expect(options).toMatchObject({ method: 'POST', agent: false });
  expect(options.rejectUnauthorized).not.toBe(false);
  expect(Object.keys(options.headers).sort()).toEqual(['Accept', 'Accept-Encoding', 'Content-Length', 'Content-Type']);
  expect(JSON.parse(h.body())).toEqual({
    query:
      'query { searchPoems(query: "登鹳雀楼", searchType: TITLE, page: 1, pageSize: 5) { edges { node { id title content author { name } } } } }'
  });
  const callback = vi.fn();
  options.lookup('poetry.palemoky.com', {}, callback);
  expect(callback).toHaveBeenCalledWith(null, publicAddress.address, 4);
  options.lookup('poetry.palemoky.com', { all: true }, callback);
  expect(callback).toHaveBeenLastCalledWith(null, [publicAddress]);
});

it('沿原公网地址合同拒绝受阻或混合DNS，不以直连或换地址绕过', async () => {
  const h = transport();
  h.resolver.mockResolvedValue([publicAddress, { address: '127.0.0.1', family: 4 }]);
  expect(await createPoetryLookup({ ...h, enabled: true })(POETRY_CONTEXT)).toBeNull();
  expect(h.request).not.toHaveBeenCalled();
});

it.each([
  { status: 302, headers: { location: 'http://127.0.0.1/private' } },
  { status: 429 },
  { status: 503 },
  { headers: { 'content-type': 'text/html' } },
  { headers: { 'content-encoding': 'gzip' } },
  { headers: { 'content-length': '32769' } },
  { text: '{invalid json' },
  { text: 'x'.repeat(32769) }
])('重定向/限流/失败/坏类型/过大响应只失败回退，不重试、不泄露上游正文 %#', async (input) => {
  const h = transport(input);
  const get = createPoetryLookup({ ...h, enabled: true });
  expect(await get(POETRY_CONTEXT)).toBeNull();
  expect(await get(POETRY_CONTEXT)).toBeNull();
  expect(h.request).toHaveBeenCalledTimes(1);
});

it('800毫秒包含DNS；已超时的迟到解析不得再启动外部请求', async () => {
  vi.useFakeTimers();
  const h = transport();
  let finish: any;
  h.resolver.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const get = createPoetryLookup({ ...h, enabled: true });
  const pending = get(POETRY_CONTEXT);
  await vi.advanceTimersByTimeAsync(POETRY_LOOKUP_LIMITS.timeoutMs + 1);
  expect(await pending).toBeNull();
  finish([publicAddress]);
  await vi.advanceTimersByTimeAsync(1);
  expect(h.request).not.toHaveBeenCalled();
  expect(await get(POETRY_CONTEXT)).toBeNull();
  expect(h.resolver).toHaveBeenCalledTimes(1);
});

it('请求挂起时到期会取消socket，缓存失败不自动重试；学习提交不依赖此内部可选模块', async () => {
  vi.useFakeTimers();
  const h = transport({ respond: false });
  const get = createPoetryLookup({ ...h, enabled: true });
  const pending = get(POETRY_CONTEXT);
  await vi.advanceTimersByTimeAsync(POETRY_LOOKUP_LIMITS.timeoutMs + 1);
  expect(await pending).toBeNull();
  expect(h.options().signal.aborted).toBe(true);
  expect(await get(POETRY_CONTEXT)).toBeNull();
  expect(h.request).toHaveBeenCalledTimes(1);
});
