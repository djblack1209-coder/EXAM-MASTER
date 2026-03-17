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

  // 注入 permission（权限描述）
  appJson.permission = {
    'scope.userLocation': {
      desc: '用于展示院校所在地区与位置相关信息'
    }
  };

  // 注入 requiredPrivateInfos（隐私API声明）
  appJson.requiredPrivateInfos = ['chooseAddress', 'chooseLocation', 'choosePoi'];

  // 注入 __usePrivacyCheck__
  appJson.__usePrivacyCheck__ = true;

  writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf-8');
  console.log('✅ 微信小程序 permission + requiredPrivateInfos 注入成功');
} catch (err) {
  console.error('❌ 注入失败:', err.message);
  process.exit(1);
}
