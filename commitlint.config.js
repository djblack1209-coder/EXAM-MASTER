/**
 * Commitlint 配置
 * 强制使用 Conventional Commits 规范
 * @see https://www.conventionalcommits.org/
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',     // 新功能
      'fix',      // 修复 bug
      'docs',     // 文档变更
      'style',    // 代码格式（不影响功能）
      'refactor', // 重构（既不是新功能也不是修复）
      'perf',     // 性能优化
      'test',     // 测试相关
      'build',    // 构建/依赖变更
      'ci',       // CI/CD 配置
      'chore',    // 其他杂项
      'revert'    // 回滚
    ]],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 200]
  }
};
