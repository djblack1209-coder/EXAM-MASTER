/**
 * 拍照搜题云函数 - 智谱视觉AI + OCR 双路并行
 *
 * 功能：
 * 1. 接收图片（base64/URL）
 * 2. 并行调用智谱视觉AI识别题目
 * 3. 题库语义搜索匹配
 * 4. AI即时生成解析
 * 5. 结果缓存优化
 *
 * 环境变量要求：
 * - ZHIPU_API_KEY: 智谱AI API密钥
 *
 * @version 2.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { validate } from '../utils/validator';
import { createLogger, checkRateLimitDistributed, tooManyRequests } from './_shared/api-response';
import { verifyJWT } from './login';
import { extractBearerToken } from './_shared/auth';

const logger = createLogger('[AIPhotoSearch]');

// ==================== 环境变量检查 ====================
if (!process.env.ZHIPU_API_KEY) {
  logger.warn('[ai-photo-search] ⚠️ 缺少环境变量 ZHIPU_API_KEY，拍照搜题功能将不可用。请在后端控制台配置。');
}

// ==================== 配置 ====================
const CONFIG = {
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY || '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    visionModel: 'glm-4v-plus', // 视觉模型
    textModel: 'glm-4-flash' // 文本模型（用于生成解析）
  },
  timeout: {
    vision: 30000, // 视觉识别超时 30s
    search: 5000, // 搜索超时 5s
    generate: 20000 // 生成解析超时 20s
  },
  cache: {
    enabled: true,
    ttl: 3600 // 缓存1小时
  },
  maxImageSize: 10 * 1024 * 1024 // 最大 10MB
};

// 学科配置
const SUBJECTS = {
  math: { name: '数学', keywords: ['计算', '方程', '函数', '几何', '概率'] },
  chinese: { name: '语文', keywords: ['阅读', '作文', '古诗', '文言文'] },
  english: { name: '英语', keywords: ['grammar', 'vocabulary', 'reading'] },
  physics: { name: '物理', keywords: ['力学', '电学', '光学', '热学'] },
  chemistry: { name: '化学', keywords: ['元素', '反应', '有机', '无机'] },
  biology: { name: '生物', keywords: ['细胞', '遗传', '生态', '进化'] },
  politics: { name: '政治', keywords: ['哲学', '经济', '政治', '文化'] },
  history: { name: '历史', keywords: ['古代', '近代', '现代', '世界'] },
  geography: { name: '地理', keywords: ['自然', '人文', '区域', '环境'] }
};

const DISALLOWED_HOST_SUFFIXES = ['.internal', '.local', '.localhost'];

// ==================== 主入口 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  logger.info(`[${requestId}] 拍照搜题请求开始`);

  try {
    // [AUDIT FIX] JWT 认证 — 防止未登录用户消耗付费 AI API 额度
    const authToken = extractBearerToken(ctx.headers?.['authorization'] || ctx.headers?.Authorization);
    if (!authToken) {
      return { code: 401, success: false, message: '请先登录', requestId };
    }

    const payload = verifyJWT(authToken);
    if (!payload?.userId) {
      return { code: 401, success: false, message: 'token 无效或已过期', requestId };
    }
    const authUserId = payload.userId;

    // [AUDIT FIX] 速率限制 — 每用户每分钟最多 10 次拍照搜题
    const rateCheck = await checkRateLimitDistributed(`photo_search:${authUserId}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { ...tooManyRequests('操作过于频繁，请稍后再试'), requestId };
    }

    const { action, ...params } = ctx.body || {};
    // [AUDIT FIX] 使用 JWT 验证的 userId，忽略客户端传入的 userId
    params.userId = authUserId;

    // S003: 入口参数校验 — action 可选（默认走搜题），但如果提供了必须合法
    if (action) {
      const entryValidation = validate(
        { action },
        {
          action: {
            required: true,
            type: 'string',
            maxLength: 50,
            enum: ['search', 'recognize', 'generate_solution', 'get_subjects']
          }
        }
      );
      if (!entryValidation.valid) {
        return { code: 400, success: false, message: entryValidation.errors[0], requestId };
      }
    }

    // ==================== 安全检查：审核模式拦截 (CP-20260127-QA) ====================
    // 支持多种审计模式请求头，与 proxy-ai.js 保持一致
    const auditMode =
      ctx.headers?.['x-audit-mode'] === 'true' ||
      ctx.headers?.['x-exam-audit'] === 'true' ||
      ctx.headers?.['x-review-mode'] === 'true';

    if (auditMode) {
      logger.warn(`[${requestId}] [SECURITY] 审计模式拦截 - 拍照搜题功能在审核期间不可用`);
      return {
        code: 403,
        success: false,
        message: 'Function not available in audit mode',
        auditMode: true,
        requestId
      };
    }

    // 检查配置
    if (!CONFIG.zhipu.apiKey) {
      return {
        code: 500,
        success: false,
        message: '服务配置错误：缺少智谱AI API Key',
        requestId
      };
    }

    switch (action) {
      case 'search':
      case 'recognize':
        return await handlePhotoSearch(params, requestId);
      case 'generate_solution':
        return await generateSolution(params, requestId);
      case 'get_subjects':
        return getSubjects();
      default:
        // 默认执行搜题
        if (params.imageBase64 || params.imageUrl) {
          return await handlePhotoSearch(params, requestId);
        }
        return {
          code: 400,
          success: false,
          message: '未知操作，支持: search, recognize, generate_solution, get_subjects',
          requestId
        };
    }
  } catch (error) {
    logger.error(`[${requestId}] 拍照搜题异常:`, error);
    return {
      code: 500,
      success: false,
      message: '识别失败',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

// ==================== 获取支持的学科 ====================
function getSubjects() {
  return {
    code: 0,
    success: true,
    data: SUBJECTS
  };
}

// ==================== 拍照搜题主流程 ====================
async function handlePhotoSearch(params, requestId) {
  const {
    imageBase64,
    imageUrl,
    subject, // 学科（可选）
    context, // 上下文提示（可选）
    userId, // 用户ID（用于日志）
    searchOnly = false // 仅搜索，不生成解析
  } = params;

  // 参数校验
  if (!imageBase64 && !imageUrl) {
    return { code: 400, success: false, message: '缺少图片参数 imageBase64 或 imageUrl', requestId };
  }

  // 获取图片数据
  let imageData = imageBase64;
  if (!imageData && imageUrl) {
    logger.info(`[${requestId}] 从URL获取图片: ${imageUrl}`);
    try {
      imageData = await fetchImageAsBase64(imageUrl);
    } catch (error) {
      return {
        code: 400,
        success: false,
        message: error instanceof Error ? error.message : '图片地址无效或不可访问',
        requestId
      };
    }
  }

  // 检查图片大小
  const imageSize = Buffer.from(imageData, 'base64').length;
  if (imageSize > CONFIG.maxImageSize) {
    return {
      code: 400,
      success: false,
      message: `图片过大，最大支持 ${CONFIG.maxImageSize / 1024 / 1024}MB`,
      requestId
    };
  }

  logger.info(`[${requestId}] 图片大小: ${(imageSize / 1024).toFixed(2)}KB, 学科: ${subject || '自动识别'}`);

  // 检查缓存
  if (CONFIG.cache.enabled) {
    const cacheKey = `photo_search:${hashString(imageData.substring(0, 1000))}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info(`[${requestId}] 命中缓存`);
      return {
        code: 0,
        success: true,
        data: cached,
        cached: true,
        requestId
      };
    }
  }

  // 步骤1: 调用智谱视觉AI识别题目
  logger.info(`[${requestId}] 步骤1: 视觉AI识别题目...`);
  const recognitionResult = await recognizeQuestion(imageData, subject, context, requestId);

  if (!recognitionResult.success) {
    return recognitionResult;
  }

  const { questionText, questionType, options, detectedSubject, formulas, confidence } = recognitionResult.data;

  if (!questionText || questionText.trim() === '') {
    return {
      code: 400,
      success: false,
      message: '未能识别到题目内容，请确保图片清晰且包含完整题目',
      requestId
    };
  }

  logger.info(`[${requestId}] 识别结果: 题型=${questionType}, 学科=${detectedSubject}, 置信度=${confidence}`);

  // 步骤2: 题库搜索
  logger.info(`[${requestId}] 步骤2: 题库搜索...`);
  const matchedQuestions = await searchQuestionBank(questionText, detectedSubject || subject, requestId);
  logger.info(`[${requestId}] 匹配到 ${matchedQuestions.length} 道相似题目`);

  // 步骤3: 如果没有匹配且不是仅搜索模式，AI生成解析
  let aiSolution = null;
  if (matchedQuestions.length === 0 && !searchOnly) {
    logger.info(`[${requestId}] 步骤3: AI生成解析...`);
    aiSolution = await generateAISolution(questionText, options, detectedSubject || subject, requestId);
  }

  // 构建结果
  const result = {
    recognition: {
      questionText,
      questionType,
      options,
      subject: detectedSubject || subject,
      formulas,
      confidence
    },
    matchedQuestions,
    aiSolution,
    hasMatch: matchedQuestions.length > 0
  };

  // 写入缓存
  if (CONFIG.cache.enabled) {
    const cacheKey = `photo_search:${hashString(imageData.substring(0, 1000))}`;
    await setCache(cacheKey, result, CONFIG.cache.ttl);
  }

  // 记录使用日志
  await logUsage(userId, requestId, {
    subject: detectedSubject || subject,
    questionType,
    matchCount: matchedQuestions.length,
    hasAiSolution: !!aiSolution
  });

  return {
    code: 0,
    success: true,
    data: result,
    cached: false,
    requestId
  };
}

// ==================== 智谱视觉AI识别题目 ====================
async function recognizeQuestion(imageBase64, subject, context, requestId) {
  const subjectHint = subject ? `学科领域：${SUBJECTS[subject]?.name || subject}` : '请自动识别学科';
  const contextHint = context ? `上下文提示：${context}` : '';

  const prompt = `你是一个专业的题目识别助手。请仔细分析这张图片中的题目内容。

要求：
1. 完整提取题目文字，包括题干和所有选项（如有）
2. 识别数学公式，用LaTeX格式表示（如 $x^2 + y^2 = r^2$）
3. 判断题目类型（单选题/多选题/填空题/解答题/判断题）
4. 识别题目所属学科
5. 如果图片模糊，尽量根据上下文智能补全
${subjectHint}
${contextHint}

请以JSON格式输出，格式如下：
{
  "questionText": "完整的题目文本",
  "questionType": "单选题/多选题/填空题/解答题/判断题",
  "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"],
  "subject": "数学/语文/英语/物理/化学/生物/政治/历史/地理",
  "formulas": ["公式1", "公式2"],
  "confidence": 0.95
}

注意：
- options 字段仅在选择题时填写，其他题型为空数组
- formulas 字段存放识别到的数学公式
- confidence 为识别置信度，0-1之间`;

  try {
    const response = await cloud.fetch({
      url: CONFIG.zhipu.baseUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.zhipu.apiKey}`
      },
      data: {
        model: CONFIG.zhipu.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      },
      timeout: CONFIG.timeout.vision
    });

    const content = response.data?.choices?.[0]?.message?.content || '';

    // 解析JSON响应
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: {
            questionText: parsed.questionText || '',
            questionType: parsed.questionType || '解答题',
            options: parsed.options || [],
            detectedSubject: parsed.subject,
            formulas: parsed.formulas || [],
            confidence: parsed.confidence || 0.7
          }
        };
      }
    } catch (parseError) {
      logger.warn(`[${requestId}] JSON解析失败，使用原始文本`);
    }

    // 解析失败，返回原始文本
    return {
      success: true,
      data: {
        questionText: content,
        questionType: '解答题',
        options: [],
        detectedSubject: null,
        formulas: [],
        confidence: 0.5
      }
    };
  } catch (error) {
    logger.error(`[${requestId}] 视觉AI识别失败:`, error);
    return {
      success: false,
      code: 500,
      message: '题目识别失败，请稍后重试',
      requestId
    };
  }
}

// ==================== 题库搜索 ====================
async function searchQuestionBank(questionText, subject, requestId) {
  const db = cloud.database();

  // 提取关键词
  const keywords = extractKeywords(questionText);

  if (keywords.length === 0) {
    logger.info(`[${requestId}] 未提取到有效关键词`);
    return [];
  }

  logger.info(`[${requestId}] 搜索关键词: ${keywords.slice(0, 5).join(', ')}`);

  try {
    // 构建查询条件
    const query: Record<string, unknown> = {
      $or: keywords.slice(0, 8).map((kw) => ({
        question: { $regex: escapeRegex(kw), $options: 'i' }
      }))
    };

    // 如果指定了学科，添加学科过滤
    if (subject && SUBJECTS[subject]) {
      query.category = { $regex: SUBJECTS[subject].name, $options: 'i' };
    }

    const result = await db.collection('questions').where(query).limit(5).get();

    // 计算相似度并排序
    const questions = (result.data || [])
      .map((q) => ({
        ...q,
        similarity: calculateSimilarity(questionText, q.question)
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return questions;
  } catch (error) {
    logger.error(`[${requestId}] 题库搜索失败:`, error);
    return [];
  }
}

// ==================== AI生成解析 ====================
async function generateAISolution(questionText, options, subject, requestId) {
  const subjectName = SUBJECTS[subject]?.name || subject || '综合';

  const optionsText = options?.length > 0 ? `\n选项：\n${options.join('\n')}` : '';

  const prompt = `你是一位专业的${subjectName}老师，请为以下题目提供详细的解答。

题目：
${questionText}${optionsText}

请按以下JSON格式输出：
{
  "answer": "最终答案（选择题写选项字母，填空题写答案，解答题写结论）",
  "analysis": {
    "思路": "解题思路说明",
    "步骤": ["步骤1：...", "步骤2：...", "步骤3：..."],
    "关键点": ["考点1", "考点2"]
  },
  "difficulty": 3,
  "tips": "解题技巧或注意事项",
  "relatedKnowledge": ["相关知识点1", "相关知识点2"],
  "commonMistakes": ["易错点1", "易错点2"]
}

注意：
- difficulty 为难度等级，1-5分
- 解答要详细、准确、易懂
- 如果是选择题，要说明为什么选这个答案，其他选项为什么不对`;

  try {
    const response = await cloud.fetch({
      url: CONFIG.zhipu.baseUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.zhipu.apiKey}`
      },
      data: {
        model: CONFIG.zhipu.textModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      },
      timeout: CONFIG.timeout.generate
    });

    const content = response.data?.choices?.[0]?.message?.content || '';

    // 解析JSON
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      logger.warn(`[${requestId}] 解析JSON失败`);
    }

    // 返回简化结构
    return {
      answer: '请参考解析',
      analysis: {
        思路: content,
        步骤: [],
        关键点: []
      },
      difficulty: 3,
      tips: '',
      relatedKnowledge: [],
      commonMistakes: []
    };
  } catch (error) {
    logger.error(`[${requestId}] AI生成解析失败:`, error);
    return null;
  }
}

// ==================== 单独生成解析接口 ====================
async function generateSolution(params, requestId) {
  const { questionText, options, subject } = params;

  if (!questionText) {
    return { code: 400, success: false, message: '缺少题目内容 questionText', requestId };
  }

  logger.info(`[${requestId}] 生成解析: ${questionText.substring(0, 50)}...`);

  const solution = await generateAISolution(questionText, options, subject, requestId);

  if (!solution) {
    return {
      code: 500,
      success: false,
      message: '生成解析失败',
      requestId
    };
  }

  return {
    code: 0,
    success: true,
    data: solution,
    requestId
  };
}

// ==================== 辅助函数 ====================

/**
 * 提取关键词
 */
function extractKeywords(text) {
  return text
    .replace(/[A-D]\.\s*/g, '') // 移除选项标记
    .replace(/[，。？！、：；""''（）\[\]【】\n\r]/g, ' ') // 移除标点
    .replace(/\$[^$]+\$/g, ' ') // 移除LaTeX公式
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 20) // 过滤过短或过长的词
    .filter((w) => !/^\d+$/.test(w)) // 过滤纯数字
    .slice(0, 15);
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 计算文本相似度（简化版）
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));

  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * 字符串哈希
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 获取远程图片
 */
async function fetchImageAsBase64(url) {
  const parsed = await assertSafeRemoteImageUrl(url);

  try {
    try {
      const headResponse = await cloud.fetch({
        url: parsed.toString(),
        method: 'HEAD',
        timeout: 8000,
        maxContentLength: CONFIG.maxImageSize,
        maxBodyLength: CONFIG.maxImageSize
      });
      validateImageResponseHeaders(headResponse?.headers, false);
    } catch {
      // 部分图床不支持 HEAD，降级到 GET 再做严格校验
    }

    const response = await cloud.fetch({
      url: parsed.toString(),
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: CONFIG.maxImageSize,
      maxBodyLength: CONFIG.maxImageSize
    });

    validateImageResponseHeaders(response?.headers, true);

    const rawData = response?.data;
    const buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData || []);
    if (buffer.length === 0) {
      throw new Error('图片内容为空');
    }
    if (buffer.length > CONFIG.maxImageSize) {
      throw new Error(`图片过大，最大支持 ${CONFIG.maxImageSize / 1024 / 1024}MB`);
    }

    return buffer.toString('base64');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('获取图片失败');
  }
}

async function assertSafeRemoteImageUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('图片地址格式无效');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('仅支持 HTTPS 图片地址');
  }
  if (parsed.username || parsed.password) {
    throw new Error('图片地址不合法');
  }

  const normalizedHost = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(normalizedHost)) {
    throw new Error('不允许访问内部网络地址');
  }

  if (isIP(normalizedHost)) {
    if (isPrivateIpAddress(normalizedHost)) {
      throw new Error('不允许访问内部网络地址');
    }
    return parsed;
  }

  let resolved: { address: string }[] = [];
  try {
    resolved = await lookup(normalizedHost, { all: true, verbatim: true });
  } catch {
    throw new Error('图片地址不可访问');
  }

  if (!resolved.length) {
    throw new Error('图片地址不可访问');
  }

  const hasPrivateAddress = resolved.some((item) => isPrivateIpAddress(item.address));
  if (hasPrivateAddress) {
    throw new Error('不允许访问内部网络地址');
  }

  return parsed;
}

function normalizeHostname(hostname: string): string {
  const lowered = String(hostname || '')
    .trim()
    .toLowerCase();
  if (lowered.startsWith('[') && lowered.endsWith(']')) {
    return lowered.slice(1, -1);
  }
  return lowered;
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname) {
    return true;
  }

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' ||
    DISALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return true;
  }

  if (hostname === '::1' || hostname === '::') {
    return true;
  }

  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    return isPrivateIPv4(address);
  }
  if (ipVersion === 6) {
    return isPrivateIPv6(address);
  }
  return true;
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map((item) => Number.parseInt(item, 10));
  if (parts.length !== 4 || parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
    return true;
  }

  const [a, b] = parts;

  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIPv6(address: string): boolean {
  const lowered = address.toLowerCase();

  if (lowered === '::1' || lowered === '::') return true;
  if (lowered.startsWith('fe80:')) return true;
  if (lowered.startsWith('fc') || lowered.startsWith('fd')) return true;

  if (lowered.startsWith('::ffff:')) {
    const mappedIpv4 = lowered.slice(7);
    if (isIP(mappedIpv4) === 4) {
      return isPrivateIPv4(mappedIpv4);
    }
  }

  return false;
}

function validateImageResponseHeaders(headers: unknown, strictContentType: boolean): void {
  const contentType = getHeaderValue(headers, 'content-type').toLowerCase();
  if (strictContentType) {
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('图片地址不是有效的图片资源');
    }
  } else if (contentType && !contentType.startsWith('image/')) {
    throw new Error('图片地址不是有效的图片资源');
  }

  const contentLengthRaw = getHeaderValue(headers, 'content-length');
  if (!contentLengthRaw) {
    return;
  }

  const contentLength = Number.parseInt(contentLengthRaw, 10);
  if (Number.isFinite(contentLength) && contentLength > CONFIG.maxImageSize) {
    throw new Error(`图片过大，最大支持 ${CONFIG.maxImageSize / 1024 / 1024}MB`);
  }
}

function getHeaderValue(headers: unknown, headerName: string): string {
  if (!headers) {
    return '';
  }

  const responseHeaders = headers as {
    get?: (name: string) => unknown;
    [key: string]: unknown;
  };

  if (typeof responseHeaders.get === 'function') {
    return normalizeHeaderValue(responseHeaders.get(headerName));
  }

  for (const [key, value] of Object.entries(responseHeaders)) {
    if (key.toLowerCase() === headerName.toLowerCase()) {
      return normalizeHeaderValue(value);
    }
  }

  return '';
}

function normalizeHeaderValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value) && value.length > 0) {
    return normalizeHeaderValue(value[0]);
  }
  return '';
}

/**
 * 获取缓存
 */
async function getCache(key) {
  try {
    const db = cloud.database();
    const result = await db
      .collection('ai_cache')
      .where({
        key,
        expireAt: { $gt: Date.now() }
      })
      .getOne();
    return result.data?.value || null;
  } catch (e) {
    return null;
  }
}

/**
 * 设置缓存
 */
async function setCache(key, value, ttl) {
  try {
    const db = cloud.database();

    // 删除旧缓存
    await db.collection('ai_cache').where({ key }).remove();

    // 写入新缓存
    await db.collection('ai_cache').add({
      key,
      value,
      expireAt: Date.now() + ttl * 1000,
      createdAt: Date.now()
    });
  } catch (e) {
    logger.error('缓存写入失败:', e);
  }
}

/**
 * 记录使用日志
 */
async function logUsage(userId, requestId, data) {
  try {
    const db = cloud.database();
    await db.collection('ai_usage_logs').add({
      userId: userId || 'anonymous',
      requestId,
      action: 'photo_search',
      ...data,
      createdAt: Date.now()
    });
  } catch (e) {
    // 忽略日志错误
  }
}
