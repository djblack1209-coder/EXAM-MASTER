/**
 * 上传 cdn-assets 到 Laf 云存储
 *
 * 用法: TOKEN_PLACEHOLDER
 *
 * 注意: 需要先将 upload-static-assets 函数部署到 Laf
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { request } from 'https';
import { request as httpRequest } from 'http';

const API_BASE = 'https://nf98ia8qnt.sealosbja.site';
const TOKEN_PLACEHOLDER
const CDN_DIR = 'cdn-assets';
const BATCH_SIZE = 3; // 每批上传3个文件

if (!ADMIN_TOKEN) {
  console.error('请设置 ADMIN_TOKEN 环境变量');
  console.error('用法: TOKEN_PLACEHOLDER
  process.exit(1);
}

// 递归收集所有PNG文件
function collectFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else if (entry.name.endsWith('.png')) {
      files.push({
        path: relative(base, fullPath),
        data: readFileSync(fullPath).toString('base64'),
        size: statSync(fullPath).size
      });
    }
  }
  return files;
}

async function uploadBatch(files) {
  const payload = JSON.stringify({ files: files.map(f => ({ path: f.path, data: f.data })) });
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/upload-static-assets`);
    const isHttps = url.protocol === 'https:';
    const reqFn = isHttps ? request : httpRequest;
    
    const req = reqFn({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 60000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } 
        catch { resolve({ error: body.substring(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('收集 cdn-assets 文件...');
  const allFiles = collectFiles(CDN_DIR);
  console.log(`共 ${allFiles.length} 个文件, 总大小 ${Math.round(allFiles.reduce((s,f) => s+f.size, 0)/1024)}KB\n`);

  // 分批上传
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    const names = batch.map(f => f.path).join(', ');
    process.stdout.write(`[${i+1}-${Math.min(i+BATCH_SIZE, allFiles.length)}/${allFiles.length}] ${names}... `);
    
    try {
      const result = await uploadBatch(batch);
      if (result.code === 0) {
        console.log('✅');
        // 打印每个文件的URL
        for (const r of result.data?.results || []) {
          if (r.ok) console.log(`   ${r.url}`);
        }
      } else {
        console.log(`❌ ${result.message || JSON.stringify(result).substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log('\n上传完成。请将返回的 URL 基础路径设置到 .env.production 的 VITE_CDN_URL');
}

main().catch(console.error);
