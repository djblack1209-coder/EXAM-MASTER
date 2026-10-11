import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
describe('login password privacy on shared input', () => {
  it('login and registration hide the password until explicit visibility action', () => {
    const source = readFileSync('src/pages/login/index.vue', 'utf8');
    expect(source).toContain(`:type="showPassword ? 'text' : 'password'"`);
    expect(source).toContain('showPassword = !showPassword');
    expect(source).toContain('showPassword = ref(false)');
  });
  it('native input maps password to the uni-app masking property', () => {
    const source = readFileSync('src/components/base/base-input/base-input.vue', 'utf8');
    expect(source).toContain(`:password="type === 'password'"`);
  });
});
