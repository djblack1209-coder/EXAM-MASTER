/**
 * 微信小程序构建后注入 permission 和 requiredPrivateInfos
 * 用法: node scripts/build/inject-mp-weixin-privacy.mjs
 * 或在 package.json 的 build:mp-weixin 后自动执行
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appJsonPath = resolve(__dirname, '../../dist/build/mp-weixin/app.json');

try {
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf-8'));

  // requiredPrivateInfos 仅接受 8 个地理位置相关 API（chooseAddress/chooseLocation 等）
  // chooseMessageFile 不属于此字段范围，其隐私保护由 __usePrivacyCheck__ 机制管理
  // 本项目未使用任何地理位置 API，故设为空数组
  appJson.requiredPrivateInfos = [];

  // 注入 __usePrivacyCheck__（开启隐私保护弹窗）
  appJson.__usePrivacyCheck__ = true;

  writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf-8');
  console.log('✅ 微信小程序 permission + requiredPrivateInfos 注入成功');
} catch (err) {
  console.error('❌ 注入失败:', err.message);
  process.exit(1);
}
