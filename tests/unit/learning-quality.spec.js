import { describe, it, expect, vi } from 'vitest';
import fixture from '../fixtures/learning/quality-v1.json';
import { gradeAnswer } from '../../laf-backend/functions/_shared/learning-domain.js';
import { storageService } from '../../src/services/storageService.js';
describe('独立算例与必须保留待核对的固定质量集', () => {
  for (const item of fixture.cases)
    it(item.id, () => {
      const result = gradeAnswer(item, item.answer);
      expect(result).toMatchObject({ status: item.expectedStatus, outcome: item.expectedOutcome });
    });
  it('不完整微信 SDK 不能冒充 uni 存储接口', async () => {
    const runtime = globalThis.uni;
    const sdk = globalThis.wx;
    try {
      globalThis.uni = {};
      globalThis.wx = { getStorageSync: vi.fn(() => '') };
      expect(storageService.save('learning_storage_regression', { saved: true }, true)).toBe(true);
      expect(storageService.get('learning_storage_regression')).toEqual({ saved: true });
      storageService.remove('learning_storage_regression', true);
    } finally {
      globalThis.uni = runtime;
      globalThis.wx = sdk;
    }
  });
});
