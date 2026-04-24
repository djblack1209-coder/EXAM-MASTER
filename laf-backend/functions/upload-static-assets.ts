/**
 * 批量上传静态资源到 Laf 云存储
 *
 * 仅限管理员调用，用于将 cdn-assets 中的图片上传到云存储
 * 上传完成后可删除此函数
 *
 * 请求示例:
 *   POST /upload-static-assets
 *   Headers: { Authorization: ${AUTH_HEADER} }
 *   Body: { files: [{ path: "badges/perfect-score.png", data: "<base64>" }] }
 */

import cloud from '@lafjs/cloud';

export default async function (ctx: any) {
  // 管理员鉴权
  const adminSecret = process.env.ADMIN_SECRET;
  const token = ctx.headers?.['x-admin-token'] || ctx.query?.adminToken;
  if (!adminSecret || token !== adminSecret) {
    return { code: 403, message: '需要管理员权限' };
  }

  const { files } = ctx.body || {};
  if (!Array.isArray(files) || files.length === 0) {
    return { code: 400, message: '缺少 files 参数' };
  }

  const bucket: any = cloud.storage.bucket('default');
  const results: any[] = [];

  for (const file of files) {
    const { path: filePath, data: base64Data } = file;
    if (!filePath || !base64Data) {
      results.push({ path: filePath, ok: false, error: '缺少 path 或 data' });
      continue;
    }

    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const storagePath = `cdn-assets/${filePath}`;

      await bucket.putObject(storagePath, buffer, {
        ContentType: filePath.endsWith('.png') ? 'image/png' : 'application/octet-stream'
      });

      const url = await bucket.getObjectUrl(storagePath);
      results.push({ path: filePath, ok: true, url, size: buffer.length });
    } catch (e: any) {
      results.push({ path: filePath, ok: false, error: e.message });
    }
  }

  const successCount = results.filter(r => r.ok).length;
  return {
    code: 0,
    message: `上传完成: ${successCount}/${files.length} 成功`,
    data: { results }
  };
}
