import { describe, expect, it } from 'vitest';

import { DEMO_QUESTIONS } from '../../src/config/home-data.js';

describe('示例题库答题契约', () => {
  it('答案使用 do-quiz 可识别的 A-D 选项标签', () => {
    for (const question of DEMO_QUESTIONS) {
      expect(question.answer).toMatch(/^[A-D]$/);
    }
  });

  it('每道示例题都有可展示解析', () => {
    for (const question of DEMO_QUESTIONS) {
      expect(question.explanation || question.analysis || question.desc).toEqual(expect.any(String));
      expect(question.explanation || question.analysis || question.desc).not.toHaveLength(0);
    }
  });
});
