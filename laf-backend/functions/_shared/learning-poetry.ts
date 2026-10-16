import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { resolveCloudEndpoint } from './ai-providers/learning-provider.js';

const origin = 'https://poetry.palemoky.com';
const endpoint = `${origin}/graphql`;
export const POETRY_CONTEXT = 'independent-practice-correct';
export const POETRY_LOOKUP_LIMITS = Object.freeze({ timeoutMs: 800, responseBytes: 32768, results: 5 });
// Fixed public title only. No caller text, identity, learning answer or model-generated URL enters this request.
const query = JSON.stringify({
  query:
    'query { searchPoems(query: "登鹳雀楼", searchType: TITLE, page: 1, pageSize: 5) { edges { node { id title content author { name } } } } }'
});
// Independently checked classical original, not the service implementation or its dataset.
// https://zh.wikisource.org/wiki/御定全唐詩_(四庫全書本)/卷253 (2026-10-15; 一作朱斌詩)
const original = '白日依山盡黃河入海流欲窮千里目更上一層樓';
const aliases: Record<string, string> = { 涣: '渙', 鹳: '鸛', 楼: '樓', 尽: '盡', 黄: '黃', 穷: '窮', 层: '層' };
const fold = (value: string) => value.replace(/[涣鹳楼尽黄穷层]/gu, (char) => aliases[char]);

export type PoetryReferenceMatch = Readonly<{
  referenceId: string;
  sourceUrl: string;
  upstreamPoemId: string;
  provider: string;
}>;

export function matchPoetrySearch(value: any): PoetryReferenceMatch | null {
  if (value?.errors !== undefined && (!Array.isArray(value.errors) || value.errors.length)) return null;
  const edges = value?.data?.searchPoems?.edges;
  if (!Array.isArray(edges) || edges.length > POETRY_LOOKUP_LIMITS.results) return null;
  const matches = edges
    .map((edge: any) => edge?.node)
    .filter(
      (node: any) =>
        typeof node?.id === 'string' &&
        /^\d{1,12}$/u.test(node.id) &&
        typeof node.title === 'string' &&
        node.title.length <= 64 &&
        fold(node.title.trim()) === '登鸛雀樓' &&
        typeof node.author?.name === 'string' &&
        node.author.name.length <= 64 &&
        fold(node.author.name.trim()) === '王之渙' &&
        typeof node.content === 'string' &&
        node.content.length <= 256 &&
        fold(node.content).replace(/[\s，。,.]/gu, '') === original
    );
  if (matches.length !== 1) return null;
  return Object.freeze({
    referenceId: 'qts253-step-v1',
    sourceUrl: 'https://zh.wikisource.org/wiki/御定全唐詩_(四庫全書本)/卷253',
    upstreamPoemId: matches[0].id,
    provider: origin
  });
}

function readSearch(
  url: URL,
  address: { address: string; family: number },
  signal: AbortSignal,
  request: typeof https.request
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        agent: false,
        signal,
        lookup: (_host, options: any, callback: any) =>
          options?.all ? callback(null, [address]) : callback(null, address.address, address.family),
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'identity',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(query)
        }
      },
      (res) => {
        if (
          res.statusCode !== 200 ||
          !/^application\/json(?:;|$)/iu.test(String(res.headers['content-type'] || '')) ||
          !['', 'identity'].includes(String(res.headers['content-encoding'] || '')) ||
          Number(res.headers['content-length'] || 0) > POETRY_LOOKUP_LIMITS.responseBytes
        ) {
          res.destroy();
          reject(new Error('POETRY_RESPONSE_REJECTED'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > POETRY_LOOKUP_LIMITS.responseBytes) {
            res.destroy();
            reject(new Error('POETRY_RESPONSE_TOO_LARGE'));
          } else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('POETRY_RESPONSE_ABORTED')));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error('POETRY_RESPONSE_INVALID'));
          }
        });
      }
    );
    req.on('error', reject);
    req.end(query);
  });
}

// Internal backend seam only: no public route or client caller is enabled by this module.
// A future authenticated caller must keep the existing local encouragement immediate and rebind late UI results.
export function createPoetryLookup({
  enabled = false,
  resolver = lookup,
  request = https.request,
  now = Date.now
} = {}) {
  let cached: { expiresAt: number; value: PoetryReferenceMatch | null } | null = null;
  let inflight: Promise<PoetryReferenceMatch | null> | null = null;
  return function lookupPoetry(context: unknown): Promise<PoetryReferenceMatch | null> {
    if (enabled !== true || context !== POETRY_CONTEXT) return Promise.resolve(null);
    if (cached && now() < cached.expiresAt) return Promise.resolve(cached.value);
    if (inflight) return inflight;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const work = (async () => {
      const resolved = await resolveCloudEndpoint(endpoint, [origin], resolver);
      if (controller.signal.aborted) return null;
      const value = await readSearch(resolved.url, resolved.address, controller.signal, request);
      return controller.signal.aborted ? null : matchPoetrySearch(value);
    })().catch(() => null);
    inflight = Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, POETRY_LOOKUP_LIMITS.timeoutMs);
      })
    ])
      .then((value) => {
        // One public context entry; failed lookups cool down and never start an automatic retry.
        cached = { value, expiresAt: now() + (value ? 86400000 : 60000) };
        return value;
      })
      .finally(() => {
        clearTimeout(timer);
        inflight = null;
      });
    return inflight;
  };
}
