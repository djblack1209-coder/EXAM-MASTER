/**
 * 首页动态数据接口
 *
 * 提供首页所需的动态数据（金句、公式、公告等）
 * 前端 home-data.js 中的 fetchHomeData() 会调用此接口
 *
 * 请求参数：无（公开接口，无需认证）
 *
 * 返回格式：
 * { code: 0, data: { quotes: [...], formulas: [...], announcements: [...] } }
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { success, serverError, generateRequestId, createLogger, checkRateLimit } from './_shared/api-response.js';

const db = cloud.database();
const logger = createLogger('[GetHomeData]');

// 内存缓存：避免每次请求都查库
let _cache: { data: any; expiry: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

// 默认金句（数据库为空时的 fallback）
const DEFAULT_QUOTES = [
  { text: '成功不是终点，失败也不是终结，唯有勇气才是永恒。', author: '丘吉尔' },
  { text: '天才是1%的灵感加上99%的汗水。', author: '爱迪生' },
  { text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '古训' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈' },
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '千里之行，始于足下。', author: '老子' },
  { text: '天行健，君子以自强不息。', author: '周易' },
  { text: '勤能补拙是良训，一分辛苦一分才。', author: '华罗庚' }
];

// 默认公式
const DEFAULT_FORMULAS = [
  { name: '勾股定理', formula: 'a² + b² = c²', category: '几何' },
  { name: '求根公式', formula: 'x = (-b ± √(b²-4ac)) / 2a', category: '代数' },
  { name: '三角函数', formula: 'sin²θ + cos²θ = 1', category: '三角' },
  { name: '导数公式', formula: "(xⁿ)' = nxⁿ⁻¹", category: '微积分' },
  { name: '积分公式', formula: '∫xⁿdx = xⁿ⁺¹/(n+1) + C', category: '微积分' }
];

export default async function (_ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('home');

  try {
    // 0. IP 限流防刷（公开接口，60次/分钟）
    const clientIp = _ctx?.headers?.['x-forwarded-for'] || _ctx?.ip || 'unknown';
    const rateLimit = checkRateLimit(`home:${clientIp}`, 60, 60000);
    if (!rateLimit.allowed) {
      logger.info(`[${requestId}] IP限流触发: ${clientIp}`);
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', data: null };
    }

    // 1. 检查内存缓存
    if (_cache && Date.now() < _cache.expiry) {
      logger.info(`[${requestId}] 命中缓存`);
      return success(_cache.data, '获取成功（缓存）');
    }

    // 2. 尝试从数据库获取动态数据
    let quotes = DEFAULT_QUOTES;
    let formulas = DEFAULT_FORMULAS;
    let announcements: any[] = [];

    try {
      // 尝试读取金句集合
      const quotesRes = await db.collection('home_quotes').where({ active: true }).limit(30).get();
      if (quotesRes.data && quotesRes.data.length > 0) {
        quotes = quotesRes.data.map((q: any) => ({
          text: q.text,
          author: q.author || '佚名'
        }));
      }
    } catch (_e) {
      // 集合不存在或查询失败，使用默认数据
      logger.info(`[${requestId}] 金句集合不可用，使用默认数据`);
    }

    try {
      // 尝试读取公告
      const announcementsRes = await db
        .collection('announcements')
        .where({ active: true })
        .orderBy('created_at', 'desc')
        .limit(5)
        .get();
      if (announcementsRes.data) {
        announcements = announcementsRes.data.map((a: any) => ({
          id: a._id,
          title: a.title,
          content: a.content,
          type: a.type || 'info',
          created_at: a.created_at
        }));
      }
    } catch (_e) {
      // 公告集合不存在，返回空数组
    }

    const responseData = {
      quotes,
      formulas,
      announcements,
      updatedAt: Date.now()
    };

    // 3. 写入缓存
    _cache = { data: responseData, expiry: Date.now() + CACHE_TTL };

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 首页数据获取成功，耗时: ${duration}ms`);

    return {
      ...success(responseData, '获取成功'),
      requestId,
      duration
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] 获取首页数据失败:`, err);

    return {
      ...serverError('获取首页数据失败'),
      requestId,
      duration
    };
  }
}
