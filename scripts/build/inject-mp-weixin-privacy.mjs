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

  // 确保 requiredPrivateInfos 与实际使用的API一致
  // 项目中仅使用了 chooseMessageFile（文件管理页面选择文件导入题库）
  // 注意：不要声明未使用的API，否则微信审核会拒绝
  appJson.requiredPrivateInfos = ['chooseMessageFile'];

  // 注入 __usePrivacyCheck__（开启隐私保护弹窗）
  appJson.__usePrivacyCheck__ = true;

  writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf-8');
  console.log('✅ 微信小程序 permission + requiredPrivateInfos 注入成功');
} catch (err) {
  console.error('❌ 注入失败:', err.message);
  process.exit(1);
}
