/**
 * 分包副本同步检测脚本
 *
 * 检查微信小程序分包中的重复文件是否与源文件保持同步。
 * 由于小程序分包限制，部分文件需要在不同分包中各存一份，
 * 此脚本确保这些副本与主版本内容一致，防止版本漂移。
 *
 * 用法: node scripts/build/check-subpkg-duplicates.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// 已知的分包副本对照表：[源文件, 副本文件]
const DUPLICATE_PAIRS = [
  [
    'src/pages/practice-sub/utils/mistake-fsrs-scheduler.js',
    'src/pages/study-detail/utils/mistake-fsrs-scheduler.js'
  ],
  [
    'src/pages/chat/composables/useTypewriter.js',
    'src/pages/practice-sub/composables/useTypewriter.js'
  ],
  [
    'src/pages/chat/privacy-authorization.js',
    'src/pages/tools/privacy-authorization.js'
  ]
];

let hasIssue = false;

for (const [src, dup] of DUPLICATE_PAIRS) {
  const srcPath = resolve(src);
  const dupPath = resolve(dup);

  if (!existsSync(srcPath)) {
    console.log(`⚠️  源文件不存在: ${src}`);
    continue;
  }
  if (!existsSync(dupPath)) {
    console.log(`⚠️  副本不存在: ${dup}`);
    continue;
  }

  // 读取文件，忽略注释行中的来源标记后比较
  const srcContent = readFileSync(srcPath, 'utf8')
    .split('\n').filter(l => !l.includes('分包副本') && !l.includes('subpackage copy')).join('\n').trim();
  const dupContent = readFileSync(dupPath, 'utf8')
    .split('\n').filter(l => !l.includes('分包副本') && !l.includes('subpackage copy')).join('\n').trim();

  if (srcContent === dupContent) {
    console.log(`✅ 同步: ${src.replace('src/pages/','')} ↔ ${dup.replace('src/pages/','')}`);
  } else {
    console.log(`❌ 不同步: ${src.replace('src/pages/','')} ↔ ${dup.replace('src/pages/','')}`);
    hasIssue = true;
  }
}

if (hasIssue) {
  console.log('\n⚠️  存在不同步的副本文件，请手动对齐！');
  process.exit(1);
} else {
  console.log('\n✅ 所有分包副本均已同步');
}
