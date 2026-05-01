import { describe, expect, it } from 'vitest';

import {
  buildIntakeSnapshot,
  createImportRecord,
  filterBankQuestions,
  formatIntakeStatusLabel,
  updateImportRecordStatus
} from '@/services/resource-intake-contract.js';

describe('resource intake contract', () => {
  it('creates stable import records without leaking page-specific state shape', () => {
    const record = createImportRecord(
      {
        name: '2001英语一答案解析.pdf',
        size: 2048,
        source: 'baidu',
        sourceId: 'src_eng1_2001_answer'
      },
      {
        now: new Date('2026-04-30T08:15:00Z'),
        idFactory: () => 'upload_001'
      }
    );

    expect(record).toEqual({
      id: 'upload_001',
      name: '2001英语一答案解析.pdf',
      size: 2048,
      date: '2026-04-30',
      source: '百度网盘',
      sourceKey: 'baidu',
      sourceId: 'src_eng1_2001_answer',
      status: 'ready',
      createdAt: '2026-04-30T08:15:00.000Z',
      updatedAt: '2026-04-30T08:15:00.000Z'
    });
    expect(formatIntakeStatusLabel(record.status)).toBe('待处理');
  });

  it('updates status immutably and builds a release-aware intake snapshot', () => {
    const base = createImportRecord(
      { name: 'english-2000.txt', source: 'local', status: 'generating' },
      { now: new Date('2026-04-30T08:00:00Z'), idFactory: () => 'upload_002' }
    );
    const nextRecords = updateImportRecordStatus([base], 'upload_002', 'completed', {
      now: new Date('2026-04-30T08:05:00Z')
    });

    expect(base.status).toBe('generating');
    expect(nextRecords[0].status).toBe('completed');
    expect(nextRecords[0].updatedAt).toBe('2026-04-30T08:05:00.000Z');

    const snapshot = buildIntakeSnapshot({
      records: nextRecords,
      bank: [
        { id: 'q1', category: '英语', source: '2000真题', year: 2000 },
        { id: 'q2', category: '英语', source: '2001真题', year: 2001 }
      ],
      releaseCoverage: {
        summary: { coverageRate: 0.5, publishedSlots: 2, requiredSlots: 4, pendingSlots: 1 },
        tracks: [{ track: 'english1', releaseState: 'partial', publishedCount: 2, requiredCount: 4 }]
      }
    });

    expect(snapshot.imports.total).toBe(1);
    expect(snapshot.imports.completed).toBe(1);
    expect(snapshot.generation.status).toBe('completed');
    expect(snapshot.bank.totalQuestions).toBe(2);
    expect(snapshot.bank.sources).toEqual(['2000真题', '2001真题']);
    expect(snapshot.release.state).toBe('partial');
    expect(snapshot.release.coverageRate).toBe(0.5);
  });

  it('filters local bank questions with the same shape expected by question-bank page', () => {
    const bank = [
      { id: 'q1', question: '英语阅读', category: '英语', difficulty: 'easy', year: 2000 },
      { id: 'q2', question: '数学极限', category: '数学', difficulty: 'medium', year: 2001 },
      { id: 'q3', question: '英语翻译', category: '英语', difficulty: 'hard', year: 2001 }
    ];

    const result = filterBankQuestions(bank, { category: '英语', page: 1, pageSize: 1 });

    expect(result.list).toEqual([
      { id: 'q1', question: '英语阅读', category: '英语', difficulty: 'easy', year: 2000, _id: 'q1', options: [] }
    ]);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(true);
  });
});
