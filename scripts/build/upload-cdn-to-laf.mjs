#!/usr/bin/env node

/**
 * 将 cdn-assets/ 静态资源上传到 Laf 云存储
 *
 * ==================== 说明 ====================
 *
 * 此脚本用于将本地 cdn-assets/ 目录下的图片文件上传到 Laf 的云存储（S3 兼容），
 * 使微信小程序端可以通过网络地址加载这些资源。
 *
 * Laf 云存储的工作方式（参考 upload-avatar.ts 的实现）：
 *   const bucket = cloud.storage.bucket('default');
 *   await bucket.putObject(fileName, fileBuffer, { ContentType: mimeType });
 *   const url = await bucket.getObjectUrl(fileName);
 *
 * ==================== 上传方案 ====================
 *
 * 方案一：通过 Laf 控制台手动上传（推荐，最简单）
 *   1. 打开 Laf 控制台 → 存储 → default 存储桶
 *   2. 创建 cdn-assets/ 目录
 *   3. 依次上传 badges/、illustrations/、effects/、images/ 子目录中的文件
 *   4. 上传完成后，文件 URL 格式为：
 *      https://nf98ia8qnt.sealosbja.site/storage/cdn-assets/badges/streak-7day.png
 *   5. 将 .env.production 中的 VITE_CDN_URL 设为：
 *      VITE_CDN_URL=https://nf98ia8qnt.sealosbja.site/storage/cdn-assets
 *
 * 方案二：写一个 Laf 云函数批量上传
 *   在 laf-backend/functions/ 下创建一个 upload-cdn-assets.ts 云函数，
 *   接收 Base64 编码的文件内容，调用 cloud.storage.bucket('default').putObject()。
 *   然后本脚本通过 HTTP 请求调用该云函数完成批量上传。
 *
 *   云函数伪代码：
 *   ```typescript
 *   export default async function (ctx: FunctionContext) {
 *     const { files } = ctx.body; // [{ path: 'badges/xxx.png', base64: '...' }]
 *     const bucket = cloud.storage.bucket('default');
 *     const results = [];
 *     for (const file of files) {
 *       const buffer = Buffer.from(file.base64, 'base64');
 *       const key = `cdn-assets/${file.path}`;
 *       await bucket.putObject(key, buffer, { ContentType: 'image/png' });
 *       const url = await bucket.getObjectUrl(key);
 *       results.push({ path: file.path, url });
 *     }
 *     return { code: 0, data: results };
 *   }
 *   ```
 *
 * 方案三：使用 S3 CLI 直接上传
 *   Laf 云存储兼容 S3 协议，可以用 aws-cli 或 s3cmd 直接上传：
 *   aws s3 sync ./cdn-assets/ s3://default/cdn-assets/ \
 *     --endpoint-url <Laf S3 endpoint> \
 *     --acl public-read
 *   S3 端点和凭据可以在 Laf 控制台的存储设置中找到。
 *
 * ==================== 上传完成后 ====================
 *
 * 1. 验证文件可访问：
 *    curl -I https://nf98ia8qnt.sealosbja.site/storage/cdn-assets/badges/streak-7day.png
 *    应返回 200 和正确的 Content-Type
 *
 * 2. 更新 .env.production：
 *    VITE_CDN_URL=https://nf98ia8qnt.sealosbja.site/storage/cdn-assets
 *
 * 3. 重新构建微信小程序：
 *    npm run build:mp-weixin
 *
 * 4. 在微信开发者工具中验证图片是否正常加载
 *
 * ==================== 目录结构 ====================
 *
 * 上传后 Laf 存储桶中的目录结构应为：
 *   cdn-assets/
 *     badges/
 *       streak-7day.png
 *       streak-30day.png
 *       accuracy-90.png
 *       first-100.png
 *       master-500.png
 *       pk-victory.png
 *       scholar.png
 *       speed-demon.png
 *       perfect-score.png
 *       knowledge-explorer.png
 *     illustrations/
 *       mascot-owl.png
 *       ai-welcome.png
 *       empty-search.png
 *       school-guide.png
 *     effects/
 *       star-sparkle.png（如有）
 *     images/
 *       app-share-cover.png（如有）
 */

console.log('[upload-cdn-to-laf] 此脚本目前仅包含操作说明，请阅读文件头部注释。');
console.log('[upload-cdn-to-laf] 推荐使用方案一：通过 Laf 控制台手动上传。');
console.log('[upload-cdn-to-laf] 详见：scripts/build/upload-cdn-to-laf.mjs');
