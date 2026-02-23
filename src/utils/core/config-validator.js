/**
 * 配置验证器
 * 检查运行时环境变量是否完整
 */

const REQUIRED_CONFIGS = [
  { key: 'VITE_WX_APP_ID', label: '微信AppID', severity: 'warning' },
  { key: 'VITE_API_BASE_URL', label: 'API基础地址', severity: 'warning' }
];

/**
 * 动态读取环境变量
 */
function getEnvValue(key) {
  try {
    return import.meta.env?.[key] || '';
  } catch (_e) {
    return '';
  }
}

/**
 * 验证配置完整性
 * @returns {{ valid: boolean, issues: Array, summary: string }}
 */
export function validateConfig() {
  const issues = [];

  for (const config of REQUIRED_CONFIGS) {
    const value = getEnvValue(config.key);
    if (!value) {
      issues.push({
        key: config.key,
        label: config.label,
        severity: config.severity,
        message: `缺少配置: ${config.label} (${config.key})`
      });
    }
  }

  // valid 只在有 error 级别 issue 时为 false
  const hasError = issues.some((i) => i.severity === 'error');

  return {
    valid: !hasError,
    issues,
    summary: hasError
      ? `❌ 配置验证失败，${issues.length} 个问题`
      : issues.length > 0
        ? `⚠️ 配置验证通过，${issues.length} 个警告`
        : '✅ 所有配置验证通过'
  };
}

/**
 * 打印配置状态
 */
export function printConfigStatus() {
  const result = validateConfig();
  return {
    valid: result.valid,
    issues: result.issues
  };
}

/**
 * 获取配置状态（用于分析上报）
 */
export function getConfigStatusForAnalytics() {
  const result = validateConfig();
  const missingKeys = result.issues.map((i) => i.key);

  return {
    config_valid: result.valid,
    config_missing_count: missingKeys.length,
    config_missing_keys: missingKeys.join(','),
    config_env: import.meta.env?.MODE || 'unknown',
    config_timestamp: Date.now()
  };
}
