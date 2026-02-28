/**
 * 研招网院校数据爬取云函数 v2.0
 *
 * 功能：
 * 1. 从研招网(yz.chsi.com.cn)院校库页面爬取院校数据
 * 2. 解析 HTML 页面提取院校信息
 * 3. 支持按省份筛选
 * 4. 缓存机制：首次爬取后存入数据库，后续从数据库读取
 *
 * @version 2.0.0
 */

import cloud from '@lafjs/cloud';
import crypto from 'crypto';
import { validate, sanitizeString } from './_shared/validator';
import { createLogger, checkRateLimit } from './_shared/api-response';
const logger = createLogger('[SchoolCrawler]');

const db = cloud.database();
const _ = db.command;

// 研招网配置
const YANZHAO_CONFIG = {
  baseUrl: 'https://yz.chsi.com.cn',
  // 院校库页面
  schoolListUrl: '/sch/',
  schoolSearchUrl: '/sch/search.do',
  // 每页数量（研招网固定为20）
  pageSize: 20,
  // 总院校数量（约923所）
  totalSchools: 923,
  // 请求头
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: 'https://yz.chsi.com.cn/sch/'
  }
};

// 省份映射
const PROVINCE_MAP = {
  '11': '北京',
  '12': '天津',
  '13': '河北',
  '14': '山西',
  '15': '内蒙古',
  '21': '辽宁',
  '22': '吉林',
  '23': '黑龙江',
  '31': '上海',
  '32': '江苏',
  '33': '浙江',
  '34': '安徽',
  '35': '福建',
  '36': '江西',
  '37': '山东',
  '41': '河南',
  '42': '湖北',
  '43': '湖南',
  '44': '广东',
  '45': '广西',
  '46': '海南',
  '50': '重庆',
  '51': '四川',
  '52': '贵州',
  '53': '云南',
  '54': '西藏',
  '61': '陕西',
  '62': '甘肃',
  '63': '青海',
  '64': '宁夏',
  '65': '新疆',
  '81': '香港',
  '91': '澳门',
  '71': '台湾'
};

// 省份代码反向映射
const PROVINCE_CODE_MAP = Object.entries(PROVINCE_MAP).reduce(
  (acc, [code, name]) => {
    acc[name] = code;
    return acc;
  },
  {} as Record<string, string>
);

// 缓存集合名称
const CACHE_COLLECTION = 'crawler_schools';
// 缓存有效期（7天）
const CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;

export default async function (ctx: FunctionContext) {
  const startTime = Date.now();
  const requestId = `crawler_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, data } = ctx.body || {};

    // S003: 入口参数校验
    const entryValidation = validate(
      { action },
      {
        action: {
          required: true,
          type: 'string',
          maxLength: 50,
          enum: ['list', 'refresh', 'by_province', 'provinces', 'status', 'crawl_all']
        }
      }
    );
    if (!entryValidation.valid) {
      return { code: 400, success: false, message: entryValidation.errors[0], requestId };
    }

    logger.info(`[${requestId}] 爬虫API: action=${action}`);

    // [R2-P0] 接口级速率限制（尤其限制 refresh/crawl_all 这类高成本操作）
    const ipRaw = ctx.headers?.['x-real-ip'] || ctx.headers?.['x-forwarded-for'] || 'anonymous';
    const clientIp = String(Array.isArray(ipRaw) ? ipRaw[0] : ipRaw)
      .split(',')[0]
      .trim()
      .slice(0, 100);
    const rateConfig: Record<string, { limit: number; windowMs: number }> = {
      list: { limit: 60, windowMs: 60 * 1000 },
      by_province: { limit: 60, windowMs: 60 * 1000 },
      provinces: { limit: 60, windowMs: 60 * 1000 },
      status: { limit: 60, windowMs: 60 * 1000 },
      refresh: { limit: 3, windowMs: 10 * 60 * 1000 },
      crawl_all: { limit: 2, windowMs: 30 * 60 * 1000 }
    };
    const cfg = rateConfig[action as string] || { limit: 30, windowMs: 60 * 1000 };
    const rate = checkRateLimit(`crawler:${action}:${clientIp}`, cfg.limit, cfg.windowMs);
    if (!rate.allowed) {
      return { code: 429, success: false, message: '请求过于频繁，请稍后重试', requestId };
    }

    switch (action) {
      case 'list':
        return await getSchoolList(data, requestId);
      case 'refresh': {
        // [R2-P0] refresh 是写操作，需要管理员权限
        const refreshSecret = ctx.headers?.['x-admin-secret'] || data?.adminSecret;
        const expectedRefreshSecret = process.env.ADMIN_SECRET;
        if (
          !refreshSecret ||
          !expectedRefreshSecret ||
          typeof refreshSecret !== 'string' ||
          typeof expectedRefreshSecret !== 'string'
        ) {
          return { code: 403, success: false, message: '无权执行此操作', requestId };
        }
        const ra = Buffer.from(refreshSecret, 'utf8');
        const rb = Buffer.from(expectedRefreshSecret, 'utf8');
        if (ra.length !== rb.length || !crypto.timingSafeEqual(ra, rb)) {
          return { code: 403, success: false, message: '无权执行此操作', requestId };
        }
        return await refreshSchoolData(data, requestId);
      }
      case 'by_province':
        return await getSchoolsByProvince(data, requestId);
      case 'provinces':
        return await getProvinceStats(requestId);
      case 'status':
        return await getCrawlerStatus(requestId);
      case 'crawl_all': {
        // 管理员权限校验：crawl_all 是高危操作 — [R2-P1] timingSafeEqual 防时序攻击
        const adminSecret = ctx.headers?.['x-admin-secret'] || data?.adminSecret;
        const expectedSecret = process.env.ADMIN_SECRET;
        if (!adminSecret || !expectedSecret || typeof adminSecret !== 'string' || typeof expectedSecret !== 'string') {
          return { code: 403, success: false, message: '无权执行此操作', requestId };
        }
        const ca = Buffer.from(adminSecret, 'utf8');
        const cb = Buffer.from(expectedSecret, 'utf8');
        if (ca.length !== cb.length || !crypto.timingSafeEqual(ca, cb)) {
          return { code: 403, success: false, message: '无权执行此操作', requestId };
        }
        return await crawlAllSchools(requestId);
      }
      default:
        return { code: 400, success: false, message: `未知的 action: ${action}`, requestId };
    }
  } catch (error: unknown) {
    logger.error(`[${requestId}] 爬虫API异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取院校列表
 */
async function getSchoolList(data: Record<string, unknown>, requestId: string) {
  const { province } = data || {};
  // [R2-P1] pageSize/page 钳位防资源滥用
  const page = Math.max(1, Math.min(parseInt(data?.page as string) || 1, 100));
  const pageSize = Math.max(1, Math.min(parseInt(data?.pageSize as string) || 20, 100));

  const cacheValid = await checkCacheValid();

  if (cacheValid) {
    return await getSchoolsFromDB({ page, pageSize, province }, requestId);
  }

  // 缓存无效，从研招网爬取
  try {
    const schools = await crawlSchoolPage(province ? PROVINCE_CODE_MAP[province] : '', (page - 1) * pageSize);
    return {
      code: 0,
      data: {
        list: schools,
        total: YANZHAO_CONFIG.totalSchools,
        page,
        pageSize,
        source: 'crawler'
      },
      requestId
    };
  } catch (error: unknown) {
    logger.error(`[${requestId}] 爬取失败:`, error);
    return await getSchoolsFromDB({ page, pageSize, province }, requestId);
  }
}

/**
 * 从数据库读取院校数据
 */
async function getSchoolsFromDB(params: Record<string, unknown>, requestId: string) {
  const { page, pageSize, province } = params;

  const query: Record<string, unknown> = {};
  if (province) {
    query.province = province;
  }

  const skip = (page - 1) * pageSize;

  const [schools, countResult] = await Promise.all([
    db.collection(CACHE_COLLECTION).where(query).orderBy('code', 'asc').skip(skip).limit(pageSize).get(),
    db.collection(CACHE_COLLECTION).where(query).count()
  ]);

  return {
    code: 0,
    data: {
      list: schools.data || [],
      total: countResult.total || 0,
      page,
      pageSize,
      source: 'database'
    },
    requestId
  };
}

/**
 * 检查缓存是否有效
 */
async function checkCacheValid() {
  try {
    const meta = await db.collection('crawler_meta').where({ type: 'schools' }).getOne();

    if (!meta.data) {
      return false;
    }

    const lastUpdate = meta.data.lastUpdate || 0;
    const now = Date.now();

    if (now - lastUpdate > CACHE_EXPIRE_TIME) {
      return false;
    }

    const count = await db.collection(CACHE_COLLECTION).count();
    if (count.total < 100) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('检查缓存有效性失败:', error);
    return false;
  }
}

/**
 * 爬取院校页面（HTML解析）
 */
async function crawlSchoolPage(provinceCode: string, start: number = 0): Promise<Record<string, unknown>[]> {
  let url = `${YANZHAO_CONFIG.baseUrl}${YANZHAO_CONFIG.schoolSearchUrl}?start=${start}`;
  if (provinceCode) {
    url += `&ssdm=${provinceCode}`;
  }

  logger.info(`爬取页面: ${url}`);

  try {
    const response = await cloud.fetch({
      url: url,
      method: 'GET',
      headers: YANZHAO_CONFIG.headers
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = response.data as string;
    return parseSchoolHtml(html, provinceCode);
  } catch (error) {
    logger.error(`爬取页面失败:`, error);
    throw error;
  }
}

/**
 * 解析院校 HTML 页面
 */
function parseSchoolHtml(html: string, defaultProvinceCode: string = ''): Record<string, unknown>[] {
  const schools: Record<string, unknown>[] = [];

  // 匹配每个院校块
  // 格式: <div class="sch-item">...</div>
  const schItemRegex = /<div class="sch-item">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  // 更简单的方式：提取关键信息
  // 1. 院校代码：从 dwdm=10001 提取
  // 2. 院校名称：从 <a class="name js-yxk-yxmc...">院校名称</a> 提取
  // 3. 省份：从 ssdm=11 提取
  // 4. 标签：从 <span class="sch-tag">...</span> 提取

  // 提取所有院校代码和省份代码
  const dwdmRegex = /dwdm=(\d+)&ssdm=(\d+)/g;
  const nameRegex = /<a class="name js-yxk-yxmc[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/g;
  const tagRegex = /<span class="sch-tag">([^<]+)<\/span>/g;
  const departmentRegex = /<span class="item-depart-title">主管部门：<\/span>\s*([^<\n]+)/g;
  const hasYjsyRegex = /研究生院/g;
  const hasZhxRegex = /自划线/g;

  // 收集所有匹配
  const codes: Array<{ code: string; provinceCode: string }> = [];
  let match;

  while ((match = dwdmRegex.exec(html)) !== null) {
    codes.push({ code: match[1], provinceCode: match[2] });
  }

  const names: string[] = [];
  while ((match = nameRegex.exec(html)) !== null) {
    names.push(match[1].trim());
  }

  // 按院校块解析
  const schBlocks = html.split('<div class="sch-item">');

  for (let i = 1; i < schBlocks.length; i++) {
    const block = schBlocks[i];

    // 提取院校代码
    const codeMatch = block.match(/dwdm=(\d+)&ssdm=(\d+)/);
    if (!codeMatch) continue;

    const code = codeMatch[1];
    const provinceCode = codeMatch[2];

    // 提取院校名称
    const nameMatch = block.match(/<a class="name js-yxk-yxmc[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    if (!name) continue;

    // 提取标签
    const tags: string[] = [];
    // 检查多种可能的双一流标记格式
    const isDoubleFirstClass = block.includes('双一流') && block.includes('sch-tag');
    const hasGraduateSchool = block.includes('研究生院');
    const isSelfDetermined = block.includes('自划线');

    if (isDoubleFirstClass) tags.push('双一流');
    if (hasGraduateSchool) tags.push('研究生院');
    if (isSelfDetermined) tags.push('自划线');

    // 提取主管部门
    const deptMatch = block.match(/<span class="item-depart-title">主管部门：<\/span>\s*([^<\n]+)/);
    const department = deptMatch ? deptMatch[1].trim() : '';

    // 判断是否985/211（根据代码判断）
    const is985 = is985School(code);
    const is211 = is211School(code);

    if (is985) tags.push('985');
    if (is211) tags.push('211');

    schools.push({
      code,
      name,
      province: PROVINCE_MAP[provinceCode] || '',
      provinceCode,
      department,
      tags,
      type: '高校',
      is985,
      is211,
      isDoubleFirstClass,
      hasGraduateSchool,
      isSelfDetermined,
      crawledAt: Date.now()
    });
  }

  return schools;
}

/**
 * 判断是否985院校
 */
function is985School(code: string): boolean {
  const codes985 = [
    '10001',
    '10002',
    '10003',
    '10006',
    '10007',
    '10008',
    '10010',
    '10019',
    '10027',
    '10055',
    '10141',
    '10145',
    '10183',
    '10213',
    '10246',
    '10247',
    '10248',
    '10251',
    '10284',
    '10286',
    '10335',
    '10358',
    '10384',
    '10422',
    '10486',
    '10487',
    '10491',
    '10532',
    '10533',
    '10558',
    '10610',
    '10611',
    '10614',
    '10698',
    '10699',
    '10712',
    '10730',
    '91002',
    '91030'
  ];
  return codes985.includes(code);
}

/**
 * 判断是否211院校
 */
function is211School(code: string): boolean {
  // 真实的211院校代码列表（112所）
  const codes211 = [
    // 985院校（39所，都是211）
    '10001',
    '10002',
    '10003',
    '10006',
    '10007',
    '10019',
    '10027',
    '10034',
    '10055',
    '10056',
    '10141',
    '10145',
    '10183',
    '10213',
    '10246',
    '10247',
    '10248',
    '10269',
    '10284',
    '10286',
    '10335',
    '10358',
    '10384',
    '10422',
    '10423',
    '10486',
    '10487',
    '10532',
    '10533',
    '91002',
    '10558',
    '10561',
    '10610',
    '10614',
    '10611',
    '10698',
    '10699',
    '10712',
    '10730',
    // 非985的211院校（73所）
    '10004',
    '10005',
    '10008',
    '10010',
    '10011',
    '10013',
    '10026',
    '10030',
    '10033',
    '10036',
    '10043',
    '10053',
    '10054',
    '10051',
    '10052',
    '10058',
    '10140',
    '10151',
    '10184',
    '10200',
    '10217',
    '10225',
    '10226',
    '10251',
    '10255',
    '10264',
    '10268',
    '10271',
    '10272',
    '10280',
    '10285',
    '10287',
    '10288',
    '10290',
    '10294',
    '10295',
    '10307',
    '10319',
    '10357',
    '10359',
    '10386',
    '10403',
    '10425',
    '10459',
    '10491',
    '10497',
    '10504',
    '10511',
    '10520',
    '10530',
    '10542',
    '10559',
    '10574',
    '10593',
    '10589',
    '10613',
    '10626',
    '10651',
    '10657',
    '10673',
    '10697',
    '10701',
    '10710',
    '10718',
    '10736',
    '10743',
    '10749',
    '10755',
    '10759',
    '10126',
    '10694',
    '10080'
  ];
  return codes211.includes(code);
}

/**
 * 强制刷新院校数据
 */
async function refreshSchoolData(data: Record<string, unknown>, requestId: string) {
  const { province } = data || {};

  logger.info(`[${requestId}] 开始强制刷新院校数据`);

  try {
    const provinceCode = province ? PROVINCE_CODE_MAP[province] : '';
    const schools = await crawlSchoolPage(provinceCode, 0);

    // 更新到数据库
    for (const school of schools) {
      try {
        const existing = await db.collection(CACHE_COLLECTION).where({ code: school.code }).getOne();

        if (existing.data) {
          await db
            .collection(CACHE_COLLECTION)
            .doc(existing.data._id)
            .update({ ...school, updatedAt: Date.now() });
        } else {
          await db.collection(CACHE_COLLECTION).add({
            ...school,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      } catch (saveError) {
        logger.error(`保存院校 ${school.code} 失败:`, saveError);
      }
    }

    return {
      code: 0,
      data: {
        list: schools,
        total: schools.length,
        refreshed: schools.length
      },
      message: '刷新成功',
      requestId
    };
  } catch (error: unknown) {
    logger.error(`[${requestId}] 刷新失败:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId
    };
  }
}

/**
 * 按省份获取院校
 */
async function getSchoolsByProvince(data: Record<string, unknown>, requestId: string) {
  const { province } = data || {};
  // [R2-P1] pageSize/page 钳位防资源滥用
  const page = Math.max(1, Math.min(parseInt(data?.page as string) || 1, 100));
  const pageSize = Math.max(1, Math.min(parseInt(data?.pageSize as string) || 20, 100));

  if (!province) {
    return { code: 400, success: false, message: '缺少省份参数', requestId };
  }

  const cacheValid = await checkCacheValid();

  if (cacheValid) {
    const skip = (page - 1) * pageSize;

    const [schools, countResult] = await Promise.all([
      db.collection(CACHE_COLLECTION).where({ province }).orderBy('code', 'asc').skip(skip).limit(pageSize).get(),
      db.collection(CACHE_COLLECTION).where({ province }).count()
    ]);

    return {
      code: 0,
      data: {
        list: schools.data || [],
        total: countResult.total || 0,
        page,
        pageSize,
        province,
        source: 'database'
      },
      requestId
    };
  }

  // 从研招网爬取
  try {
    const provinceCode = PROVINCE_CODE_MAP[province];
    if (!provinceCode) {
      return { code: 400, success: false, message: '无效的省份名称', requestId };
    }

    const schools = await crawlSchoolPage(provinceCode, (page - 1) * pageSize);

    return {
      code: 0,
      data: {
        list: schools,
        total: schools.length,
        page,
        pageSize,
        province,
        source: 'crawler'
      },
      requestId
    };
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId
    };
  }
}

/**
 * 获取省份统计
 */
async function getProvinceStats(requestId: string) {
  const cacheValid = await checkCacheValid();

  if (cacheValid) {
    const result = await db
      .collection(CACHE_COLLECTION)
      .aggregate()
      .group({
        _id: '$province',
        count: { $sum: 1 },
        doubleFirstClass: {
          $sum: { $cond: ['$isDoubleFirstClass', 1, 0] }
        }
      })
      .sort({ count: -1 })
      .end();

    const provinces =
      (result.data as Record<string, unknown>[])?.map((p) => ({
        name: p._id,
        code: PROVINCE_CODE_MAP[p._id] || '',
        total: p.count,
        doubleFirstClass: p.doubleFirstClass
      })) || [];

    return {
      code: 0,
      data: {
        provinces,
        totalProvinces: provinces.length,
        source: 'database'
      },
      requestId
    };
  }

  // 返回静态省份列表
  const provinces = Object.entries(PROVINCE_MAP).map(([code, name]) => ({
    name,
    code
  }));

  return {
    code: 0,
    data: {
      provinces,
      totalProvinces: provinces.length,
      source: 'static'
    },
    requestId
  };
}

/**
 * 获取爬取状态
 */
async function getCrawlerStatus(requestId: string) {
  try {
    const [meta, count] = await Promise.all([
      db.collection('crawler_meta').where({ type: 'schools' }).getOne(),
      db.collection(CACHE_COLLECTION).count()
    ]);

    const lastUpdate = meta.data?.lastUpdate || 0;
    const now = Date.now();
    const isExpired = now - lastUpdate > CACHE_EXPIRE_TIME;

    return {
      code: 0,
      data: {
        totalCached: count.total || 0,
        expectedTotal: YANZHAO_CONFIG.totalSchools,
        lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
        isExpired,
        cacheExpireTime: CACHE_EXPIRE_TIME,
        status: count.total >= 900 ? 'complete' : count.total > 0 ? 'partial' : 'empty'
      },
      requestId
    };
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId
    };
  }
}

/**
 * 全量爬取所有院校
 */
async function crawlAllSchools(requestId: string) {
  logger.info(`[${requestId}] 开始全量爬取院校数据`);

  let crawledCount = 0;
  let errorCount = 0;
  const errors: unknown[] = [];

  try {
    // 按省份爬取
    const provinceCodes = Object.keys(PROVINCE_MAP);

    for (const provinceCode of provinceCodes) {
      try {
        logger.info(`[${requestId}] 爬取省份: ${PROVINCE_MAP[provinceCode]} (${provinceCode})`);

        let start = 0;
        let hasMore = true;

        while (hasMore) {
          try {
            const schools = await crawlSchoolPage(provinceCode, start);

            if (schools.length === 0) {
              hasMore = false;
              break;
            }

            // 保存到数据库
            for (const school of schools) {
              try {
                const existing = await db.collection(CACHE_COLLECTION).where({ code: school.code }).getOne();

                if (existing.data) {
                  await db
                    .collection(CACHE_COLLECTION)
                    .doc(existing.data._id)
                    .update({ ...school, updatedAt: Date.now() });
                } else {
                  await db.collection(CACHE_COLLECTION).add({
                    ...school,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  });
                }

                crawledCount++;
              } catch (saveError: unknown) {
                logger.error(`保存院校 ${school.code} 失败:`, saveError);
                errorCount++;
                errors.push({
                  code: school.code,
                  error: saveError instanceof Error ? saveError.message : String(saveError)
                });
              }
            }

            // 如果返回数量少于20，说明是最后一页
            if (schools.length < 20) {
              hasMore = false;
            } else {
              start += 20;
            }

            // 避免请求过快
            await sleep(300);
          } catch (pageError: unknown) {
            logger.error(`[${requestId}] 爬取省份 ${provinceCode} 第 ${start} 条失败:`, pageError);
            errorCount++;
            errors.push({
              province: provinceCode,
              start,
              error: pageError instanceof Error ? pageError.message : String(pageError)
            });
            hasMore = false;
          }
        }

        // 省份间隔
        await sleep(500);
      } catch (provinceError: unknown) {
        logger.error(`[${requestId}] 爬取省份 ${provinceCode} 失败:`, provinceError);
        errorCount++;
        errors.push({
          province: provinceCode,
          error: provinceError instanceof Error ? provinceError.message : String(provinceError)
        });
      }
    }

    // 更新爬取元数据
    const metaData = {
      type: 'schools',
      lastUpdate: Date.now(),
      totalCrawled: crawledCount,
      updatedAt: Date.now()
    };

    const existingMeta = await db.collection('crawler_meta').where({ type: 'schools' }).getOne();

    if (existingMeta.data) {
      await db.collection('crawler_meta').doc(existingMeta.data._id).update(metaData);
    } else {
      await db.collection('crawler_meta').add({
        ...metaData,
        createdAt: Date.now()
      });
    }

    logger.info(`[${requestId}] 全量爬取完成: 成功 ${crawledCount}, 失败 ${errorCount}`);

    return {
      code: 0,
      data: {
        crawledCount,
        errorCount,
        errors: errors.slice(0, 10),
        totalProvinces: provinceCodes.length
      },
      message: '全量爬取完成',
      requestId
    };
  } catch (error: unknown) {
    logger.error(`[${requestId}] 全量爬取异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      data: {
        crawledCount,
        errorCount
      },
      requestId
    };
  }
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
