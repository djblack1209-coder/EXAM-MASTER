/**
 * 文档转换云函数 - 使用 CloudConvert API
 *
 * 支持的转换类型：
 * - PDF 转图片 (pdf2img)
 * - 图片转 PDF (img2pdf)
 * - Word 转 PDF (word2pdf)
 * - PDF 转 Word (pdf2word)
 * - Excel 转 PDF (excel2pdf)
 * - PPT 转 PDF (ppt2pdf)
 *
 * 环境变量要求：
 * - CLOUDCONVERT_API_KEY: CloudConvert API 密钥
 *
 * @version 2.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud';
import { validate, sanitizeString } from '../utils/validator';
import { createLogger } from './_shared/api-response';
import { verifyJWT } from './login';

const logger = createLogger('[DocConvert]');

// ==================== 配置 ====================
const CONFIG = {
  cloudConvert: {
    apiKey: process.env.CLOUDCONVERT_API_KEY,
    baseUrl: 'https://api.cloudconvert.com/v2',
    sandbox: false // 生产环境设为 false
  },
  timeout: {
    upload: 60000, // 上传超时 60s
    convert: 120000, // 转换超时 120s
    download: 60000 // 下载超时 60s
  },
  maxFileSize: 100 * 1024 * 1024, // 最大 100MB
  supportedFormats: {
    pdf2img: { input: ['pdf'], output: ['jpg', 'png', 'webp'], desc: 'PDF转图片' },
    img2pdf: { input: ['jpg', 'jpeg', 'png', 'webp', 'gif'], output: ['pdf'], desc: '图片转PDF' },
    word2pdf: { input: ['doc', 'docx', 'odt', 'rtf'], output: ['pdf'], desc: 'Word转PDF' },
    pdf2word: { input: ['pdf'], output: ['docx'], desc: 'PDF转Word' },
    excel2pdf: { input: ['xls', 'xlsx', 'ods'], output: ['pdf'], desc: 'Excel转PDF' },
    ppt2pdf: { input: ['ppt', 'pptx', 'odp'], output: ['pdf'], desc: 'PPT转PDF' }
  }
};

// ==================== 主入口 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // 调试日志：打印所有可能的参数来源
  logger.info(`[${requestId}] 文档转换请求开始`);
  logger.info(`[${requestId}] ctx.body:`, JSON.stringify(ctx.body || {}).substring(0, 200));
  logger.info(`[${requestId}] ctx.query:`, JSON.stringify(ctx.query || {}).substring(0, 200));
  logger.info(`[${requestId}] ctx.request?.body:`, JSON.stringify(ctx.request?.body || {}).substring(0, 200));
  logger.info(`[${requestId}] ctx.params:`, JSON.stringify(ctx.params || {}).substring(0, 200));

  try {
    // [C1-FIX] 鉴权：文档转换消耗付费API配额，必须验证用户身份
    const token = ctx.headers?.authorization || ctx.headers?.token || ctx.body?.token;
    if (!token) {
      return { code: 401, success: false, message: '未登录，请先登录', requestId };
    }
    const payload = verifyJWT(token.replace('Bearer ', ''));
    if (!payload || !payload.userId) {
      return { code: 401, success: false, message: '登录已过期，请重新登录', requestId };
    }
    logger.info(`[${requestId}] 用户已验证: ${payload.userId}`);

    // 兼容多种参数传递方式（Laf / Sealos / 不同版本）
    let body = ctx.body || ctx.request?.body || ctx.query || ctx.params || {};

    // 如果 body 是字符串，尝试解析为 JSON
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        logger.error(`[${requestId}] body 解析失败:`, e.message);
      }
    }

    // 如果 body 为空对象，尝试从其他来源获取
    if (!body || Object.keys(body).length === 0) {
      // 尝试 ctx.request.body
      if (ctx.request && ctx.request.body && Object.keys(ctx.request.body).length > 0) {
        body = ctx.request.body;
      }
      // 尝试 ctx.query
      else if (ctx.query && Object.keys(ctx.query).length > 0) {
        body = ctx.query;
      }
    }

    const { action, ...params } = body;

    logger.info(`[${requestId}] 最终 action:`, action);
    logger.info(`[${requestId}] 最终 params keys:`, Object.keys(params));

    // S003: 入口参数校验
    const entryValidation = validate(
      { action },
      {
        action: {
          required: true,
          type: 'string',
          maxLength: 50,
          enum: ['convert', 'get_status', 'get_types', 'get_result']
        }
      }
    );
    if (!entryValidation.valid) {
      return { code: 400, success: false, message: entryValidation.errors[0], requestId };
    }

    // 检查 API Key
    if (!CONFIG.cloudConvert.apiKey) {
      return {
        code: 500,
        success: false,
        message: '服务配置错误：缺少 CloudConvert API Key',
        requestId
      };
    }

    switch (action) {
      case 'convert':
        return await handleConvert(params, requestId);
      case 'get_status':
        return await getJobStatus(params, requestId);
      case 'get_types':
        return getConvertTypes();
      case 'get_result':
        return await getConvertResult(params, requestId);
      default:
        return {
          code: 400,
          success: false,
          message: '未知操作，支持: convert, get_status, get_types, get_result',
          requestId
        };
    }
  } catch (error) {
    logger.error(`[${requestId}] 文档转换异常:`, error);
    return {
      code: 500,
      success: false,
      message: error.message || '转换失败',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

// ==================== 获取支持的转换类型 ====================
function getConvertTypes() {
  return {
    code: 0,
    success: true,
    data: CONFIG.supportedFormats
  };
}

// ==================== 处理文档转换 ====================
async function handleConvert(params, requestId) {
  const {
    convertType, // 转换类型：pdf2img, word2pdf 等
    fileBase64, // 文件 Base64 数据
    fileName, // 原始文件名
    outputFormat, // 输出格式（可选）
    options = {} // 额外选项
  } = params;

  // 参数校验
  if (!convertType) {
    return { code: 400, success: false, message: '缺少转换类型 convertType', requestId };
  }

  if (!CONFIG.supportedFormats[convertType]) {
    return {
      code: 400,
      success: false,
      message: `不支持的转换类型: ${convertType}，支持: ${Object.keys(CONFIG.supportedFormats).join(', ')}`,
      requestId
    };
  }

  if (!fileBase64) {
    return { code: 400, success: false, message: '缺少文件数据 fileBase64', requestId };
  }

  // 检查文件大小
  const fileSize = Buffer.from(fileBase64, 'base64').length;
  if (fileSize > CONFIG.maxFileSize) {
    return {
      code: 400,
      success: false,
      message: `文件过大，最大支持 ${CONFIG.maxFileSize / 1024 / 1024}MB`,
      requestId
    };
  }

  logger.info(`[${requestId}] 开始转换: ${convertType}, 文件大小: ${(fileSize / 1024).toFixed(2)}KB`);

  try {
    // 1. 创建转换任务
    const job = await createConvertJob(convertType, fileBase64, fileName, outputFormat, options, requestId);

    if (!job.success) {
      return job;
    }

    // 2. 等待转换完成并获取结果
    const result = await waitForJobComplete(job.data.jobId, requestId);

    return result;
  } catch (error) {
    logger.error(`[${requestId}] 转换失败:`, error);
    return {
      code: 500,
      success: false,
      message: `转换失败: ${error.message}`,
      requestId
    };
  }
}

// ==================== 创建 CloudConvert 转换任务 ====================
async function createConvertJob(convertType, fileBase64, fileName, outputFormat, options, requestId) {
  const formatConfig = CONFIG.supportedFormats[convertType];
  const inputFormat = getFileExtension(fileName) || formatConfig.input[0];
  const targetFormat = outputFormat || formatConfig.output[0];

  logger.info(`[${requestId}] 创建任务: ${inputFormat} -> ${targetFormat}`);

  // 构建任务配置
  const tasks = {
    'import-file': {
      operation: 'import/base64',
      file: fileBase64,
      filename: fileName || `file.${inputFormat}`
    },
    'convert-file': {
      operation: 'convert',
      input: ['import-file'],
      output_format: targetFormat,
      ...buildConvertOptions(convertType, options)
    },
    'export-file': {
      operation: 'export/url',
      input: ['convert-file'],
      inline: false,
      archive_multiple_files: convertType === 'pdf2img' // PDF转图片可能有多页
    }
  };

  try {
    const response = await cloud.fetch({
      url: `${CONFIG.cloudConvert.baseUrl}/jobs`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.cloudConvert.apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        tasks,
        tag: requestId
      },
      timeout: CONFIG.timeout.upload
    });

    if (response.status !== 200 && response.status !== 201) {
      logger.error(`[${requestId}] CloudConvert 创建任务失败:`, response.data);
      return {
        code: 500,
        success: false,
        message: `创建任务失败: ${response.data?.message || '未知错误'}`,
        requestId
      };
    }

    const jobData = response.data?.data;
    logger.info(`[${requestId}] 任务创建成功, jobId: ${jobData?.id}`);

    return {
      code: 0,
      success: true,
      data: {
        jobId: jobData?.id,
        status: jobData?.status
      },
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 创建任务异常:`, error);
    throw error;
  }
}

// ==================== 等待任务完成 ====================
async function waitForJobComplete(jobId, requestId, maxWait = 120000) {
  const startTime = Date.now();
  const pollInterval = 2000; // 2秒轮询一次

  logger.info(`[${requestId}] 等待任务完成: ${jobId}`);

  while (Date.now() - startTime < maxWait) {
    try {
      const response = await cloud.fetch({
        url: `${CONFIG.cloudConvert.baseUrl}/jobs/${jobId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${CONFIG.cloudConvert.apiKey}`
        },
        timeout: 10000
      });

      const job = response.data?.data;
      const status = job?.status;

      logger.info(`[${requestId}] 任务状态: ${status}`);

      if (status === 'finished') {
        // 获取导出任务的结果
        const exportTask = job.tasks?.find((t) => t.operation === 'export/url' && t.status === 'finished');

        if (exportTask?.result?.files?.length > 0) {
          const files = exportTask.result.files.map((f) => ({
            filename: f.filename,
            url: f.url,
            size: f.size
          }));

          return {
            code: 0,
            success: true,
            data: {
              jobId,
              status: 'completed',
              files,
              // 如果只有一个文件，直接返回 URL
              downloadUrl: files.length === 1 ? files[0].url : null
            },
            message: '转换成功',
            requestId
          };
        }
      }

      if (status === 'error') {
        const errorTask = job.tasks?.find((t) => t.status === 'error');
        return {
          code: 500,
          success: false,
          message: `转换失败: ${errorTask?.message || '未知错误'}`,
          requestId
        };
      }

      // 继续等待
      await sleep(pollInterval);
    } catch (error) {
      logger.error(`[${requestId}] 查询状态失败:`, error);
      // 继续重试
      await sleep(pollInterval);
    }
  }

  return {
    code: 408,
    success: false,
    message: '转换超时，请稍后重试',
    data: { jobId },
    requestId
  };
}

// ==================== 获取任务状态 ====================
async function getJobStatus(params, requestId) {
  const { jobId } = params;

  if (!jobId) {
    return { code: 400, success: false, message: '缺少任务ID jobId', requestId };
  }

  try {
    const response = await cloud.fetch({
      url: `${CONFIG.cloudConvert.baseUrl}/jobs/${jobId}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CONFIG.cloudConvert.apiKey}`
      },
      timeout: 10000
    });

    const job = response.data?.data;

    return {
      code: 0,
      success: true,
      data: {
        jobId,
        status: job?.status,
        progress: calculateProgress(job),
        tasks: job?.tasks?.map((t) => ({
          name: t.name,
          operation: t.operation,
          status: t.status,
          progress: t.progress
        }))
      },
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 查询状态失败:`, error);
    return {
      code: 500,
      success: false,
      message: `查询失败: ${error.message}`,
      requestId
    };
  }
}

// ==================== 获取转换结果 ====================
async function getConvertResult(params, requestId) {
  const { jobId, downloadFile = false } = params;

  if (!jobId) {
    return { code: 400, success: false, message: '缺少任务ID jobId', requestId };
  }

  try {
    const response = await cloud.fetch({
      url: `${CONFIG.cloudConvert.baseUrl}/jobs/${jobId}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CONFIG.cloudConvert.apiKey}`
      },
      timeout: 10000
    });

    const job = response.data?.data;

    if (job?.status !== 'finished') {
      return {
        code: 202,
        success: false,
        message: '任务尚未完成',
        data: { status: job?.status },
        requestId
      };
    }

    const exportTask = job.tasks?.find((t) => t.operation === 'export/url' && t.status === 'finished');
    const files = exportTask?.result?.files || [];

    // 如果需要下载文件内容
    if (downloadFile && files.length > 0) {
      const downloadedFiles = await Promise.all(
        files.map(async (f) => {
          try {
            const fileResponse = await cloud.fetch({
              url: f.url,
              method: 'GET',
              responseType: 'arraybuffer',
              timeout: CONFIG.timeout.download
            });
            return {
              filename: f.filename,
              base64: Buffer.from(fileResponse.data).toString('base64'),
              size: f.size
            };
          } catch (e) {
            logger.error(`下载文件失败: ${f.filename}`, e);
            return {
              filename: f.filename,
              url: f.url,
              error: '下载失败'
            };
          }
        })
      );

      return {
        code: 0,
        success: true,
        data: {
          jobId,
          files: downloadedFiles
        },
        requestId
      };
    }

    return {
      code: 0,
      success: true,
      data: {
        jobId,
        files: files.map((f) => ({
          filename: f.filename,
          url: f.url,
          size: f.size
        }))
      },
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 获取结果失败:`, error);
    return {
      code: 500,
      success: false,
      message: `获取结果失败: ${error.message}`,
      requestId
    };
  }
}

// ==================== 辅助函数 ====================

/**
 * 构建转换选项
 */
function buildConvertOptions(convertType, options) {
  const opts = {};

  switch (convertType) {
    case 'pdf2img':
      opts.page_range = options.pageRange || '1-'; // 默认所有页
      opts.pixel_density = options.dpi || 150; // DPI
      opts.width = options.width; // 宽度
      opts.height = options.height; // 高度
      break;

    case 'img2pdf':
      opts.page_size = options.pageSize || 'a4';
      opts.margin_top = options.marginTop || 0;
      opts.margin_bottom = options.marginBottom || 0;
      opts.margin_left = options.marginLeft || 0;
      opts.margin_right = options.marginRight || 0;
      break;

    case 'word2pdf':
    case 'excel2pdf':
    case 'ppt2pdf':
      // 使用默认选项
      break;

    case 'pdf2word':
      opts.engine = options.engine || 'libreoffice'; // 或 'solidframework'
      break;
  }

  // 移除 undefined 值
  return Object.fromEntries(Object.entries(opts).filter(([_, v]) => v !== undefined));
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename) {
  if (!filename) return null;
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : null;
}

/**
 * 计算任务进度
 */
function calculateProgress(job) {
  if (!job?.tasks?.length) return 0;

  const totalProgress = job.tasks.reduce((sum, task) => {
    if (task.status === 'finished') return sum + 100;
    if (task.status === 'processing') return sum + (task.progress || 50);
    return sum;
  }, 0);

  return Math.round(totalProgress / job.tasks.length);
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
