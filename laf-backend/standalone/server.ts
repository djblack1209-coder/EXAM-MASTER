/**
 * EXAM-MASTER 独立 Express 服务器
 *
 * 将 Laf 云函数映射为 HTTP 路由:
 *   POST /函数名 → 执行对应云函数
 *
 * 兼容层: cloud-shim.ts 提供 @lafjs/cloud 的 API 仿真
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { setCurrentResponse, closeDb, runWithResponse } from './cloud-shim.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const FUNCTIONS_DIR = path.resolve(__dirname, '../functions');
const STORAGE_DIR = process.env.STORAGE_DIR || '/app/storage';

const app = express();

// 信任一层代理（Nginx），确保 req.ip 获取真实客户端 IP，防止 X-Forwarded-For 欺骗
app.set('trust proxy', 1);

// ==================== 中间件 ====================

// CORS 安全配置
// ⚠️ 生产环境必须设置 ALLOWED_ORIGINS 环境变量（逗号分隔的域名列表）
// 例: ALLOWED_ORIGINS=https://api.245334.xyz,https://nf98ia8qnt.sealosbja.site
const DEFAULT_ORIGINS = [
  'https://api.245334.xyz',
  'https://nf98ia8qnt.sealosbja.site',
  'http://localhost:5173',
  'http://localhost:3000'
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : DEFAULT_ORIGINS;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    maxAge: 86400 // 预检缓存24小时
  })
);

// 基本安全头（防御纵深：即使 Nginx 层缺失也有保底）
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 大体积 JSON 解析器（仅用于头像上传/文档转换等需要 base64 的端点）
const largeBodyParser = express.json({ limit: '50mb' });

// 请求超时保护（120秒）
app.use((req, _res, next) => {
  req.setTimeout(120000);
  next();
});

// 静态文件服务 (用于 cloud.storage 上传的文件)
app.use('/storage', express.static(STORAGE_DIR));

// 文件上传 (multer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// ==================== 请求日志 ====================

app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health' && req.path !== '/health-check') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ==================== 云函数加载器 ====================

interface FunctionModule {
  default: (ctx: any) => Promise<any>;
}

const functionCache = new Map<string, FunctionModule>();

async function loadFunction(name: string): Promise<FunctionModule | null> {
  if (functionCache.has(name)) return functionCache.get(name)!;

  // 编译后的 JS 文件路径
  const jsPath = path.join(FUNCTIONS_DIR, `${name}.js`);

  if (!fs.existsSync(jsPath)) {
    return null;
  }

  try {
    const mod = await import(jsPath);
    functionCache.set(name, mod);
    return mod;
  } catch (err) {
    console.error(`[load-function] Failed to load ${name}:`, err);
    return null;
  }
}

// ==================== 路由注册 ====================

// 健康检查 (优先级最高，不走云函数)
// 注：仅返回状态，不暴露内部信息。详细诊断请使用 health-check 云函数（需 admin 鉴权）
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// YAML 元数据读取 — 获取允许的 HTTP 方法
function getAllowedMethods(funcName: string): string[] {
  const yamlPath = path.join(FUNCTIONS_DIR, `${funcName}.yaml`);
  if (fs.existsSync(yamlPath)) {
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      const methodsMatch = content.match(/methods:\s*\n([\s\S]*?)(?:\n\w|$)/);
      if (methodsMatch) {
        const methods: string[] = [];
        const lines = methodsMatch[1].split('\n');
        for (const line of lines) {
          const m = line.match(/^\s*-\s*(\w+)/);
          if (m) methods.push(m[1].toUpperCase());
        }
        return methods.length ? methods : ['GET', 'POST'];
      }
    } catch {}
  }
  return ['GET', 'POST']; // 默认支持 GET 和 POST
}

// 动态注册所有云函数路由
// ⚠️ 安全：admin/cron-only 函数不对外暴露路由（即使函数内有 admin 鉴权，减少攻击面）
const INTERNAL_ONLY_FUNCTIONS = new Set([
  'db-create-indexes',
  'db-migrate-timestamps',
  'data-cleanup',
  'account-purge',
  'material-manager' // 标记为 "NOT connected to frontend"，不应暴露
]);

async function registerFunctions() {
  const files = fs
    .readdirSync(FUNCTIONS_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_') && f !== 'index.js');

  for (const file of files) {
    const funcName = file.replace('.js', '');

    // 跳过内部管理函数（不注册为 HTTP 路由）
    if (INTERNAL_ONLY_FUNCTIONS.has(funcName)) {
      console.log(`  [skip] ${funcName} (internal-only, not exposed)`);
      continue;
    }

    const methods = getAllowedMethods(funcName);

    // 注册路由: /:funcName
    const handler = async (req: express.Request, res: express.Response) => {
      const mod = await loadFunction(funcName);
      if (!mod || !mod.default) {
        return res.status(404).json({ code: 404, message: `Function ${funcName} not found` });
      }

      // 构建 Laf 兼容的 ctx 对象
      const ctx: any = {
        body: req.body || {},
        headers: req.headers as Record<string, string>,
        method: req.method,
        query: req.query as Record<string, string>,
        params: req.params,
        socket: { remoteAddress: req.ip || req.socket.remoteAddress },
        request: { body: req.body },
        files: null as any
      };

      // 处理文件上传
      if (req.files || (req as any).file) {
        ctx.files = {};
        if (req.files && !Array.isArray(req.files)) {
          for (const [fieldName, files] of Object.entries(req.files)) {
            const f = Array.isArray(files) ? files[0] : files;
            ctx.files[fieldName] = {
              data: f.buffer,
              buffer: f.buffer,
              mimetype: f.mimetype,
              type: f.mimetype,
              originalFilename: f.originalname,
              filename: f.originalname,
              name: f.originalname,
              size: f.size
            };
          }
        } else if ((req as any).file) {
          const f = (req as any).file;
          ctx.files = {
            file: {
              data: f.buffer,
              buffer: f.buffer,
              mimetype: f.mimetype,
              type: f.mimetype,
              originalFilename: f.originalname,
              filename: f.originalname,
              name: f.originalname,
              size: f.size
            }
          };
        }
      }

      // 设置 cloud.res 供 SSE 使用 (proxy-ai-stream)
      // 使用 AsyncLocalStorage 隔离并发请求，避免 SSE 数据发送到错误客户端
      setCurrentResponse(res);

      try {
        const result = await runWithResponse(res, () => mod.default(ctx));

        // 如果函数已经通过 cloud.res 发送了响应 (SSE), 不再发送
        if (res.headersSent) return;

        // 正常 JSON 响应
        if (result !== undefined && result !== null) {
          res.json(result);
        } else {
          res.status(204).end();
        }
      } catch (err: any) {
        if (res.headersSent) return;
        console.error(`[function-error] ${funcName}:`, err.message);
        // 不向客户端暴露内部错误细节（可能含文件路径、连接字符串等）
        res.status(500).json({
          code: 500,
          success: false,
          message: 'Internal Server Error'
        });
      }
    };

    // 需要大体积 JSON 的端点（头像上传、文档转换、OCR 等包含 base64 数据）
    const LARGE_BODY_FUNCTIONS = new Set([
      'upload-avatar',
      'doc-convert',
      'id-photo-segment-base64',
      'ai-photo-search',
      'photo-bg',
      'proxy-ai'
    ]);

    // 根据 YAML 元数据注册方法
    for (const method of methods) {
      const middlewares: any[] = [];
      if (LARGE_BODY_FUNCTIONS.has(funcName)) {
        middlewares.push(largeBodyParser);
      }
      switch (method) {
        case 'GET':
          app.get(`/${funcName}`, ...middlewares, handler);
          break;
        case 'POST':
          app.post(`/${funcName}`, ...middlewares, upload.any(), handler);
          break;
        case 'PUT':
          app.put(`/${funcName}`, ...middlewares, handler);
          break;
        case 'DELETE':
          app.delete(`/${funcName}`, ...middlewares, handler);
          break;
      }
    }

    console.log(`[route] ${methods.join('|')} /${funcName}`);
  }
}

// ==================== 启动 ====================

async function main() {
  console.log('='.repeat(50));
  console.log('EXAM-MASTER Standalone Server');
  console.log('='.repeat(50));

  // 注册云函数路由
  await registerFunctions();

  // 404 必须在所有路由注册之后
  app.use((_req, res) => {
    res.status(404).json({ code: 404, message: 'Not Found' });
  });

  const server = http.createServer(app);

  // 优雅关闭
  const shutdown = async (signal: string) => {
    console.log(`\n[shutdown] Received ${signal}, graceful shutdown...`);
    server.close(async () => {
      await closeDb();
      console.log('[shutdown] Server closed');
      process.exit(0);
    });
    // 强制关闭超时
    setTimeout(() => {
      console.error('[shutdown] Forced exit after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  server.listen(PORT, HOST, () => {
    console.log(`\n[server] Listening on http://${HOST}:${PORT}`);
    console.log(`[server] Health check: http://${HOST}:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
