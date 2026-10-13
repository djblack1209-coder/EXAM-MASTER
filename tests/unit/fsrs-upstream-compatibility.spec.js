import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fsrs, generatorParameters, createEmptyCard, Rating, default_w, FSRSVersion } from 'ts-fsrs';
const saved = vi.hoisted(() => new Map());
vi.mock('@/services/storageService.js', () => ({
  storageService: {
    get: (key, fallback) => saved.get(key) ?? fallback,
    save: (key, value) => {
      saved.set(key, structuredClone(value));
      return true;
    },
    remove: (key) => saved.delete(key)
  }
}));
vi.mock('@/utils/logger.js', () => ({ logger: { log: vi.fn(), error: vi.fn() } }));
import { loadUserParams, createNewCard, scheduleCard } from '@/services/fsrs-service.js';
import * as practice from '@/pages/practice-sub/utils/mistake-fsrs-scheduler.js';
import * as detail from '@/pages/study-detail/utils/mistake-fsrs-scheduler.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { emptyLearningState, applyLearningOperation } from '@/services/learning/learning-domain.js';
import { createArithmeticQuestion } from '@/services/learning/learning-tools.js';

// 执行仓库受控、原样携带的官方CJS库，不求值任何学习输入。
const context = { exports: {}, module: { exports: {} }, Date, console };
vm.runInNewContext(readFileSync(resolve('laf-backend/functions/_shared/ts-fsrs-bundle.ts'), 'utf8'), context);
const backend = context.module.exports;
const nodeRequire = createRequire(resolve('package.json'));
const typescript = nodeRequire('./laf-backend/standalone/node_modules/typescript');
const compiled = typescript.transpileModule(
  readFileSync(resolve('laf-backend/functions/_shared/fsrs-scheduler.ts'), 'utf8'),
  {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 }
  }
).outputText;
const adapterModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: adapterModule,
  exports: adapterModule.exports,
  Date,
  console,
  require: (name) => {
    if (name !== './ts-fsrs-bundle') throw new Error('Unexpected backend dependency');
    return backend;
  }
});
const { getScheduler } = adapterModule.exports;
beforeEach(() => {
  loadUserParams(null);
  practice.loadUserFSRSParams(null);
  detail.loadUserFSRSParams(null);
  saved.clear();
});

describe('官方FSRS 5.4.2与项目适配', () => {
  it('客户端和后端使用同一真实版本，原始CJS正文与已安装官方发行一致', () => {
    expect(FSRSVersion).toBe('v5.4.2 using FSRS-6.0');
    expect(backend.FSRSVersion).toBe(FSRSVersion);
    const source = readFileSync(resolve('laf-backend/functions/_shared/ts-fsrs-bundle.ts'), 'utf8');
    expect(source.slice(source.indexOf('*/\n') + 3)).toBe(
      readFileSync(resolve('node_modules/ts-fsrs/dist/index.cjs'), 'utf8')
    );
  });
  it('17项旧参数迁移后再次约束范围，既有合法配置仍可使用', () => {
    const w = [...default_w].slice(0, 17);
    w[4] = 10;
    w[5] = 4;
    w[6] = 4;
    for (const library of [{ fsrs }, backend]) {
      const engine = library.fsrs({ w, enable_fuzz: false });
      expect(engine.parameters.w[4]).toBe(10);
      expect(engine.parameters.w[6]).toBe(4);
      expect(engine.parameters.w.every(Number.isFinite)).toBe(true);
    }
    for (const length of [17, 19, 21]) {
      expect(loadUserParams({ w: [...default_w].slice(0, length), request_retention: 0.9 })).toBe(true);
      expect(practice.loadUserFSRSParams({ w: [...default_w].slice(0, length) })).toBe(true);
      expect(detail.loadUserFSRSParams({ w: [...default_w].slice(0, length) })).toBe(true);
    }
    expect(w.slice(4, 7)).toEqual([10, 4, 4]);
  });
  it('四种明确评分的调度在客户端和真实CJS一致，结果保持有限且向未来安排', () => {
    const now = new Date('2026-10-12T16:00:00Z');
    const options = { w: [...default_w], enable_fuzz: false, enable_short_term: true };
    const front = fsrs(generatorParameters(options)),
      back = backend.fsrs(backend.generatorParameters(options));
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      const a = front.next(createEmptyCard(now), now, rating);
      const b = back.next(backend.createEmptyCard(now), now, rating);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.card.due.getTime()).toBeGreaterThan(now.getTime());
      expect(Number.isFinite(a.card.stability)).toBe(true);
    }
  });
  it('下划线留存率变更更新参数指纹与保存值，不能复用前一次设置', () => {
    const w = [...default_w];
    expect(loadUserParams({ w, request_retention: 0.8 })).toBe(true);
    expect(loadUserParams({ w, request_retention: 0.95 })).toBe(true);
    expect(saved.get('fsrs_user_params').request_retention).toBe(0.95);
  });
  it.each([
    { w: [...default_w].map((v, i) => (i === 2 ? NaN : v)) },
    { w: [...default_w].map((v, i) => (i === 2 ? Infinity : v)) },
    { w: [...default_w].map((v, i) => (i === 2 ? null : v)) },
    { w: Array(21) },
    { w: [1, 2] },
    { w: { length: 21 } },
    { w: [...default_w], request_retention: 0 },
    { w: [...default_w], request_retention: 1 },
    { w: [...default_w], request_retention: '0.9' }
  ])('非法个性参数保留既有设置；后台拒绝新增异常调度 %#', (bad) => {
    const good = { w: [...default_w], request_retention: 0.9 };
    loadUserParams(good);
    practice.loadUserFSRSParams(good);
    detail.loadUserFSRSParams(good);
    const before = structuredClone(saved.get('fsrs_user_params'));
    expect(loadUserParams(bad)).toBe(false);
    expect(saved.get('fsrs_user_params')).toEqual(before);
    expect(practice.loadUserFSRSParams(bad)).toBe(false);
    expect(detail.loadUserFSRSParams(bad)).toBe(false);
    expect(practice.hasCustomFSRSParams()).toBe(true);
    expect(detail.hasCustomFSRSParams()).toBe(true);
    expect(() => getScheduler(bad)).toThrow();
    const scheduled = scheduleCard(
      createNewCard(new Date('2026-10-12T16:00:00Z')),
      'good',
      new Date('2026-10-12T16:00:00Z')
    );
    expect(Number.isFinite(scheduled.card.due.getTime())).toBe(true);
  });
  it('旧事件保存的原答、停止和安排日期不因库升级重算', () => {
    const at = Date.parse('2026-10-12T16:00:00Z');
    let snapshot = emptyLearningState('fsrs-compat', 'America/Los_Angeles');
    const apply = (id, type, data) => {
      snapshot = applyLearningOperation(snapshot, { id, type, data, at }).state;
    };
    apply('c', 'conversation.start', { goal: '12 + 8' });
    apply('q-add', 'question.add', { question: createArithmeticQuestion('q', '12 + 8') });
    apply('focus', 'question.focus', { conversationId: 'c', questionKey: 'q@1' });
    apply('answer', 'attempt.submit', { conversationId: 'c', answer: '20', explicit: true });
    apply('review', 'review.schedule', {
      attemptId: 'answer',
      due: at + 3600000,
      rating: 'good',
      policy: 'reliable-due-v1',
      evidenceIds: ['answer']
    });
    apply('stop', 'task.stop', { conversationId: 'c' });
    const restored = prepareLearningRestore(emptyLearningState('fsrs-compat'), JSON.stringify(snapshot), {
      now: Date.now()
    }).state;
    expect(restored.reviews).toEqual(snapshot.reviews);
    expect(restored.reviews[0].due).toBe(at + 3600000);
    expect(restored.attempts).toEqual(snapshot.attempts);
    expect(restored.conversations[0].stopped).toBe(true);
  });
});
