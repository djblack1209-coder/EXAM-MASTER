/**
 * 全链路测试 3: 错题本 & 收藏流程
 * 答错 -> 自动收录 -> 错题本管理 -> 复习 -> 掌握标记
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));
// Mock mistake-classifier（避免复杂智能依赖）
vi.mock('@/utils/practice/mistake-classifier.js', () => ({
  mistakeClassifier: {
    classify: vi.fn(() => ({
      tags: [{ type: 'knowledge', value: '马原' }],
      category: '政治',
      difficulty: 'medium',
      errorType: 'concept_confusion',
      knowledgePoints: ['唯物辩证法', '矛盾论']
    }))
  }
}));

describe('全链路: 错题本 & 收藏', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  describe('Phase 1: 错题自动收录', () => {
    it('答错后自动收录到错题本', async () => {
      const { autoCollectMistake } = await import('@/utils/practice/mistake-auto-collect.js');

      const question = {
        id: 'q_001',
        question: '唯物辩证法的核心是什么？',
        options: ['A.对立统一规律', 'B.量变质变规律', 'C.否定之否定规律', 'D.因果规律'],
        answer: 'A',
        category: '政治'
      };

      const result = await autoCollectMistake(question, 'B', '智能解析：对立统一规律是核心');

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.wrongCount).toBe(1);
      expect(result.classification).toBeTruthy();

      // 验证已写入存储
      const stored = global.__mockStorage['mistake_book'];
      expect(stored).toBeTruthy();
      expect(stored.length).toBe(1);
      expect(stored[0].question).toBe('唯物辩证法的核心是什么？');
      expect(stored[0].user_answer).toBe('B');
      expect(stored[0].correct_answer).toBe('A');
      expect(stored[0].is_mastered).toBe(false);
    });

    it('同一题再次答错 - 更新错误次数', async () => {
      const { autoCollectMistake } = await import('@/utils/practice/mistake-auto-collect.js');

      const question = {
        id: 'q_002',
        question: '重复错题测试',
        options: ['A', 'B', 'C', 'D'],
        answer: 'C'
      };

      await autoCollectMistake(question, 'A');
      const result2 = await autoCollectMistake(question, 'B');

      expect(result2.success).toBe(true);
      expect(result2.isNew).toBe(false);
      expect(result2.wrongCount).toBe(2);

      const stored = global.__mockStorage['mistake_book'];
      expect(stored.length).toBe(1); // 不重复添加
    });

    it('数字答案自动转换为字母', async () => {
      const { autoCollectMistake } = await import('@/utils/practice/mistake-auto-collect.js');

      const question = { id: 'q_003', question: '数字答案测试', options: ['A', 'B', 'C', 'D'], answer: 'A' };
      const result = await autoCollectMistake(question, 2); // 2 -> C

      expect(result.success).toBe(true);
      const stored = global.__mockStorage['mistake_book'];
      expect(stored[0].user_answer).toBe('C');
    });

    it('空题目不收录', async () => {
      const { autoCollectMistake } = await import('@/utils/practice/mistake-auto-collect.js');
      const result = await autoCollectMistake(null, 'A');
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_question');
    });

    it('错题统计自动更新', async () => {
      const { autoCollectMistake, getMistakeStats } = await import('@/utils/practice/mistake-auto-collect.js');

      await autoCollectMistake({ id: 'q_s1', question: '统计测试1', answer: 'A' }, 'B');
      await autoCollectMistake({ id: 'q_s2', question: '统计测试2', answer: 'C' }, 'D');

      const stats = getMistakeStats();
      expect(stats.totalCount).toBe(2);
      expect(stats.byCategory['政治']).toBe(2);
      expect(stats.byDifficulty['medium']).toBe(2);
    });
  });

  describe('Phase 2: 错题复习与掌握', () => {
    it('recordReview - 答对提升掌握度', async () => {
      const { autoCollectMistake, recordReview } = await import('@/utils/practice/mistake-auto-collect.js');

      await autoCollectMistake({ id: 'q_review', question: '复习测试', answer: 'A' }, 'B');

      // 连续答对 4 次
      for (let i = 0; i < 4; i++) {
        recordReview('q_review', true);
      }

      const stored = global.__mockStorage['mistake_book'];
      const mistake = stored.find((m) => m.id === 'q_review');
      expect(mistake.review_count).toBe(4);
      expect(mistake.mastery_level).toBe(80);
      // FSRS双重掌握条件：stability > 30天 且 mastery_level >= 80
      // 4次答对后 stability 远不到30天，所以 is_mastered 仍为 false
      expect(mistake.is_mastered).toBe(false);
    });

    it('recordReview - 答错降低掌握度', async () => {
      const { autoCollectMistake, recordReview } = await import('@/utils/practice/mistake-auto-collect.js');

      await autoCollectMistake({ id: 'q_review2', question: '复习降级测试', answer: 'A' }, 'B');

      recordReview('q_review2', true); // +20 -> 20
      recordReview('q_review2', true); // +20 -> 40
      recordReview('q_review2', false); // -10 -> 30

      const stored = global.__mockStorage['mistake_book'];
      const mistake = stored.find((m) => m.id === 'q_review2');
      expect(mistake.mastery_level).toBe(30);
      expect(mistake.is_mastered).toBe(false);
    });

    it('markAsMastered - 直接标记掌握', async () => {
      const { autoCollectMistake, markAsMastered } = await import('@/utils/practice/mistake-auto-collect.js');

      await autoCollectMistake({ id: 'q_master', question: '掌握测试', answer: 'A' }, 'B');

      const result = markAsMastered('q_master');
      expect(result).toBe(true);

      const stored = global.__mockStorage['mistake_book'];
      const mistake = stored.find((m) => m.id === 'q_master');
      expect(mistake.is_mastered).toBe(true);
      expect(mistake.mastery_level).toBe(100);
    });

    it('markAsMastered - 不存在的 ID 返回 false', async () => {
      const { markAsMastered } = await import('@/utils/practice/mistake-auto-collect.js');
      global.__mockStorage['mistake_book'] = [];
      const result = markAsMastered('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Phase 3: 批量收录', () => {
    it('batchCollectMistakes 批量收录多道错题', async () => {
      const { batchCollectMistakes } = await import('@/utils/practice/mistake-auto-collect.js');

      const mistakes = [
        { question: { id: 'b1', question: '批量1', answer: 'A' }, userAnswer: 'B' },
        { question: { id: 'b2', question: '批量2', answer: 'C' }, userAnswer: 'D' },
        { question: { id: 'b3', question: '批量3', answer: 'B' }, userAnswer: 'A' }
      ];

      const result = await batchCollectMistakes(mistakes);

      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.successCount).toBe(3);
    });

    it('batchCollectMistakes 空数组返回失败', async () => {
      const { batchCollectMistakes } = await import('@/utils/practice/mistake-auto-collect.js');
      const result = await batchCollectMistakes([]);
      expect(result.success).toBe(false);
    });
  });

  describe('Phase 4: StorageService 错题云端同步', () => {
    it('未登录时降级到本地存储', async () => {
      const { storageService } = await import('@/services/storageService.js');

      const result = await storageService.addMistake({
        question: '离线错题',
        options: ['A', 'B', 'C', 'D'],
        user_answer: 'A',
        correct_answer: 'B'
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
      expect(result.sync_status).toBe('local_only');
      expect(result.id).toMatch(/^local_/);
    });

    it('getSyncStatus 统计同步状态', async () => {
      const { storageService } = await import('@/services/storageService.js');

      global.__mockStorage['mistake_book'] = [
        { id: '1', sync_status: 'synced' },
        { id: '2', sync_status: 'synced' },
        { id: '3', sync_status: 'pending' },
        { id: '4', sync_status: 'local_only' },
        { id: '5', sync_status: 'conflict' }
      ];

      const status = storageService.getSyncStatus();
      expect(status.total).toBe(5);
      expect(status.synced).toBe(2);
      expect(status.pending).toBe(1);
      expect(status.localOnly).toBe(1);
      expect(status.conflict).toBe(1);
    });

    it('_getMistakesLocal 分页和筛选', async () => {
      const { storageService } = await import('@/services/storageService.js');

      global.__mockStorage['mistake_book'] = Array.from({ length: 30 }, (_, i) => ({
        id: `m_${i}`,
        is_mastered: i < 10,
        created_at: Date.now() - i * 1000
      }));

      // 分页
      const page1 = storageService._getMistakesLocal(1, 10);
      expect(page1.list.length).toBe(10);
      expect(page1.total).toBe(30);
      expect(page1.hasMore).toBe(true);

      const page3 = storageService._getMistakesLocal(3, 10);
      expect(page3.list.length).toBe(10);
      expect(page3.hasMore).toBe(false);

      // 筛选未掌握
      const unmastered = storageService._getMistakesLocal(1, 50, { is_mastered: false });
      expect(unmastered.total).toBe(20);
    });

    it('_removeMistakeLocal 删除本地错题', async () => {
      const { storageService } = await import('@/services/storageService.js');

      global.__mockStorage['mistake_book'] = [
        { id: 'del_1', question: '要删除的' },
        { id: 'del_2', question: '保留的' }
      ];

      const result = storageService._removeMistakeLocal('del_1');
      expect(result.success).toBe(true);

      const remaining = global.__mockStorage['mistake_book'];
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('del_2');
    });

    it('_removeMistakeLocal 删除不存在的 ID', async () => {
      const { storageService } = await import('@/services/storageService.js');
      global.__mockStorage['mistake_book'] = [];

      const result = storageService._removeMistakeLocal('nonexistent');
      expect(result.success).toBe(false);
    });

    it('_updateMistakeStatusLocal 更新掌握状态', async () => {
      const { storageService } = await import('@/services/storageService.js');

      global.__mockStorage['mistake_book'] = [{ id: 'upd_1', is_mastered: false }];

      const result = storageService._updateMistakeStatusLocal('upd_1', true);
      expect(result.success).toBe(true);

      const mistake = global.__mockStorage['mistake_book'][0];
      expect(mistake.is_mastered).toBe(true);
      expect(mistake.last_practice_time).toBeTruthy();
    });

    it('batchRemoveMistakes 仅删除目标 ID，不会误清空错题本', async () => {
      const { storageService } = await import('@/services/storageService.js');

      global.__mockStorage['mistake_book'] = [
        { id: 'keep_1', question: '保留1' },
        { id: 'del_1', question: '删除1' },
        { id: 'keep_2', question: '保留2' }
      ];

      const result = await storageService.batchRemoveMistakes(['del_1']);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
      const remaining = global.__mockStorage['mistake_book'];
      expect(remaining.map((m) => m.id)).toEqual(['keep_1', 'keep_2']);
    });

    it('resolveConflict(merge) 会回写 updateFields 并将本地冲突标记为 synced', async () => {
      const { storageService } = await import('@/services/storageService.js');
      const { lafService } = await import('@/services/lafService.js');

      global.__mockStorage['EXAM_USER_ID'] = 'test_user';

      const requestSpy = vi.spyOn(lafService, 'request');
      requestSpy.mockResolvedValueOnce({ success: true, code: 0, message: 'ok', data: [] });
      requestSpy.mockResolvedValueOnce({ success: true, code: 0, message: 'ok', data: {} });

      storageService.save(
        'mistake_book',
        [
          {
            id: 'cloud_1',
            sync_status: 'conflict',
            wrong_count: 1,
            tags: ['local-tag'],
            note: '本地简短备注',
            updated_at: 120,
            _conflict_cloud_data: {
              _id: 'cloud_1',
              wrong_count: 3,
              tags: ['cloud-tag'],
              notes: '云端更长的备注内容',
              updated_at: 100
            }
          }
        ],
        true
      );

      const result = await storageService.resolveConflict('cloud_1', 'merge');
      expect(result.success).toBe(true);
      expect(result.cloudPersisted).toBe(true);

      const updateCall = requestSpy.mock.calls.find(([, payload]) => payload?.action === 'updateFields');
      expect(updateCall).toBeTruthy();
      expect(updateCall[1].data.id).toBe('cloud_1');
      expect(updateCall[1].data.fields.wrong_count).toBe(3);
      expect(updateCall[1].data.fields.tags).toEqual(expect.arrayContaining(['local-tag', 'cloud-tag']));

      const merged = storageService.get('mistake_book', [])[0];
      expect(merged.sync_status).toBe('synced');
      expect(merged.notes).toBe('云端更长的备注内容');
      expect(merged._needs_remote_merge).toBeUndefined();
    });
  });
});
