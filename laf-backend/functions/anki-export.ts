/**
 * Anki .apkg 文件导出云函数
 *
 * 将 EXAM-MASTER 题库中的题目导出为 Anki 兼容的 .apkg 文件。
 * 支持按题库 ID 导出整个题库，或按题目 ID 列表导出指定题目。
 *
 * .apkg 结构：ZIP 压缩包，内含 collection.anki21（SQLite）和 media 映射文件。
 * SQLite 表：col（元数据）、notes（笔记）、cards（卡片）、revlog（复习日志）、graves（墓地）。
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import {
  success,
  badRequest,
  unauthorized,
  notFound,
  serverError,
  generateRequestId,
  createLogger,
  wrapResponse
} from './_shared/api-response';

const db = cloud.database();
const logger = createLogger('[AnkiExport]');

// ==================== 常量 ====================

/** 单次导出最大题目数 */
const MAX_EXPORT_QUESTIONS = 5000;

/** MongoDB 查询分片大小 */
const QUERY_BATCH_SIZE = 100;

/** Anki 字段分隔符 */
const ANKI_FIELD_SEPARATOR = '\x1f';

/** Anki 模型 ID（固定，导出用） */
const MODEL_ID = 1704000000000;

/** Anki 牌组 ID（固定，导出用） */
const DECK_ID = 1704000000001;

/** Anki 牌组配置 ID */
const DCONF_ID = 1;

// ==================== 类型定义 ====================

interface ExportQuestion {
  _id: string;
  question: string;
  answer?: string;
  analysis?: string;
  options?: Array<{ label: string; content: string }>;
  type?: string;
  tags?: string[];
  category?: string;
  difficulty?: string;
  anki_meta?: {
    note_id?: number;
    ease_factor?: number;
    interval?: number;
    reps?: number;
    due?: number;
  };
}

// ==================== 主函数 ====================

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('anki-exp');

  try {
    // ---- 认证 ----
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return wrapResponse(unauthorized('请先登录'), requestId, startTime);
    }
    const { userId } = authResult;

    logger.info(`[${requestId}] 用户 ${userId} 发起 Anki 导出请求`);

    // ---- 参数解析 ----
    const { bankId, questionIds, deckName: customDeckName } = ctx.body || {};

    if (!bankId && (!Array.isArray(questionIds) || questionIds.length === 0)) {
      return wrapResponse(badRequest('请提供 bankId（题库 ID）或 questionIds（题目 ID 列表）'), requestId, startTime);
    }

    if (Array.isArray(questionIds) && questionIds.length > MAX_EXPORT_QUESTIONS) {
      return wrapResponse(
        badRequest(`题目数量 (${questionIds.length}) 超过单次导出上限 ${MAX_EXPORT_QUESTIONS}`),
        requestId,
        startTime
      );
    }

    // ---- 查询题目 ----
    let questions: ExportQuestion[];
    let exportDeckName: string;

    if (bankId) {
      // 按题库导出：先验证题库归属
      const bankResult = await db.collection('question_banks').doc(bankId).get();
      const bank = bankResult.data;

      if (!bank) {
        return wrapResponse(notFound('题库不存在'), requestId, startTime);
      }

      // 允许导出自己的题库或公共题库
      if (bank.user_id && bank.user_id !== userId && !bank.is_public) {
        return wrapResponse(badRequest('无权导出该题库'), requestId, startTime);
      }

      exportDeckName = customDeckName || bank.name || '导出牌组';
      questions = await queryQuestionsByBankId(bankId, requestId);
    } else {
      // 按题目 ID 列表导出
      exportDeckName = customDeckName || '导出牌组';
      questions = await queryQuestionsByIds(questionIds, requestId);
    }

    if (questions.length === 0) {
      return wrapResponse(badRequest('没有找到可导出的题目'), requestId, startTime);
    }

    if (questions.length > MAX_EXPORT_QUESTIONS) {
      questions = questions.slice(0, MAX_EXPORT_QUESTIONS);
      logger.warn(`[${requestId}] 题目数量超过上限，已截断到 ${MAX_EXPORT_QUESTIONS} 条`);
    }

    logger.info(`[${requestId}] 查询到 ${questions.length} 道题目，牌组名称="${exportDeckName}"`);

    // ---- 构建 SQLite 数据库 ----
    let sqliteData: Uint8Array;
    try {
      sqliteData = await buildAnkiDatabase(questions, exportDeckName, requestId);
    } catch (e) {
      logger.error(`[${requestId}] SQLite 数据库构建失败:`, e);
      return wrapResponse(serverError('Anki 数据库构建失败', String(e)), requestId, startTime);
    }

    logger.info(`[${requestId}] SQLite 数据库构建完成: ${(sqliteData.length / 1024).toFixed(1)} KB`);

    // ---- 打包 .apkg (ZIP) ----
    let apkgBase64: string;
    try {
      apkgBase64 = await packageApkg(sqliteData, requestId);
    } catch (e) {
      logger.error(`[${requestId}] .apkg 打包失败:`, e);
      return wrapResponse(serverError('.apkg 文件打包失败', String(e)), requestId, startTime);
    }

    // ---- 生成文件名 ----
    const safeFileName = sanitizeFileName(exportDeckName) + '.apkg';

    logger.info(
      `[${requestId}] 导出完成: ${questions.length} 题, 文件=${safeFileName}, base64长度=${apkgBase64.length}, 耗时 ${Date.now() - startTime}ms`
    );

    return wrapResponse(
      success(
        {
          fileData: apkgBase64,
          fileName: safeFileName,
          questionCount: questions.length,
          deckName: exportDeckName
        },
        `导出完成: ${questions.length} 道题目`
      ),
      requestId,
      startTime
    );
  } catch (err) {
    logger.error(`[${requestId}] Anki 导出异常:`, err);
    return wrapResponse(serverError('导出失败，请稍后重试'), requestId, startTime);
  }
}

// ==================== 数据查询 ====================

/**
 * 按题库 ID 批量查询题目
 */
async function queryQuestionsByBankId(bankId: string, requestId: string): Promise<ExportQuestion[]> {
  const allQuestions: ExportQuestion[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore && allQuestions.length < MAX_EXPORT_QUESTIONS) {
    const result = await db
      .collection('questions')
      .where({
        question_bank_id: bankId,
        is_active: true
      })
      .orderBy('created_at', 'asc')
      .skip(skip)
      .limit(QUERY_BATCH_SIZE)
      .get();

    const batch = result.data || [];
    allQuestions.push(...batch);

    if (batch.length < QUERY_BATCH_SIZE) {
      hasMore = false;
    } else {
      skip += QUERY_BATCH_SIZE;
    }

    if (allQuestions.length > 0 && allQuestions.length % 500 === 0) {
      logger.info(`[${requestId}] 查询进度: ${allQuestions.length} 条`);
    }
  }

  return allQuestions;
}

/**
 * 按题目 ID 列表批量查询题目
 */
async function queryQuestionsByIds(questionIds: string[], requestId: string): Promise<ExportQuestion[]> {
  const allQuestions: ExportQuestion[] = [];

  // 分批查询，避免单次查询过大
  for (let i = 0; i < questionIds.length; i += QUERY_BATCH_SIZE) {
    const batchIds = questionIds.slice(i, i + QUERY_BATCH_SIZE);
    const _ = db.command;

    const result = await db
      .collection('questions')
      .where({
        _id: _.in(batchIds),
        is_active: true
      })
      .get();

    allQuestions.push(...(result.data || []));

    if (i + QUERY_BATCH_SIZE < questionIds.length) {
      logger.info(
        `[${requestId}] 查询进度: ${Math.min(i + QUERY_BATCH_SIZE, questionIds.length)}/${questionIds.length}`
      );
    }
  }

  return allQuestions;
}

// ==================== SQLite 构建 ====================

/**
 * 构建 Anki 兼容的 SQLite 数据库
 */
async function buildAnkiDatabase(
  questions: ExportQuestion[],
  deckName: string,
  requestId: string
): Promise<Uint8Array> {
  const initSqlJs = (await import('sql.js')).default ?? (await import('sql.js'));
  const SQL = await initSqlJs();
  const sqlDb = new SQL.Database();

  try {
    // ---- 创建表结构 ----
    createAnkiSchema(sqlDb);

    // ---- 填充 col 表（元数据） ----
    insertCollectionData(sqlDb, deckName);

    // ---- 填充 notes 和 cards 表 ----
    const now = Math.floor(Date.now() / 1000);
    let noteCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        const noteId = now * 1000 + i + 1; // 毫秒级时间戳 + 偏移，确保唯一
        const cardId = noteId + 100000000; // 卡片 ID 偏移，避免冲突

        // 构建正面（题目）和背面（答案）
        const front = buildFrontContent(question);
        const back = buildBackContent(question);

        if (!front.trim()) {
          continue; // 跳过空白题目
        }

        // 构建 guid（6字节随机字符串）
        const guid = generateGuid(noteId);

        // 构建标签字符串（Anki 格式：首尾空格，空格分隔）
        const tags = buildAnkiTags(question);

        // 计算 sflds（排序字段 = 正面纯文本）
        const sflds = stripHtml(front).substring(0, 200);

        // 计算 csum（校验和 = sflds 的 SHA1 前 8 位十六进制转十进制）
        const csum = computeChecksum(sflds);

        // 字段内容：正面 + 分隔符 + 背面
        const flds = front + ANKI_FIELD_SEPARATOR + back;

        // 插入 note
        sqlDb.run(
          `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sflds, csum, flags, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [noteId, guid, MODEL_ID, now, -1, tags, flds, sflds, csum, 0, '']
        );

        // 插入 card（新卡片状态）
        const due = i + 1; // 新卡片 due = 顺序位置
        sqlDb.run(
          `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [cardId, noteId, DECK_ID, 0, now, -1, 0, 0, due, 0, 0, 0, 0, 0, 0, 0, 0, '']
        );

        noteCount++;
      } catch (e) {
        logger.warn(`[${requestId}] 题目 ${question._id} 处理失败，已跳过:`, e);
      }
    }

    logger.info(`[${requestId}] SQLite 填充完成: ${noteCount}/${questions.length} 笔记`);

    // 导出为 Uint8Array
    return sqlDb.export();
  } finally {
    sqlDb.close();
  }
}

/**
 * 创建 Anki SQLite 表结构
 */
function createAnkiSchema(sqlDb: any): void {
  sqlDb.run(`
    CREATE TABLE col (
      id    integer primary key,
      crt   integer not null,
      mod   integer not null,
      scm   integer not null,
      ver   integer not null,
      dty   integer not null,
      usn   integer not null,
      ls    integer not null,
      conf  text not null,
      models text not null,
      decks text not null,
      dconf text not null,
      tags  text not null
    )
  `);

  sqlDb.run(`
    CREATE TABLE notes (
      id    integer primary key,
      guid  text not null,
      mid   integer not null,
      mod   integer not null,
      usn   integer not null,
      tags  text not null,
      flds  text not null,
      sflds text not null,
      csum  integer not null,
      flags integer not null,
      data  text not null
    )
  `);

  sqlDb.run(`
    CREATE TABLE cards (
      id    integer primary key,
      nid   integer not null,
      did   integer not null,
      ord   integer not null,
      mod   integer not null,
      usn   integer not null,
      type  integer not null,
      queue integer not null,
      due   integer not null,
      ivl   integer not null,
      factor integer not null,
      reps  integer not null,
      lapses integer not null,
      left  integer not null,
      odue  integer not null,
      odid  integer not null,
      flags integer not null,
      data  text not null
    )
  `);

  sqlDb.run(`
    CREATE TABLE revlog (
      id      integer primary key,
      cid     integer not null,
      usn     integer not null,
      ease    integer not null,
      ivl     integer not null,
      lastIvl integer not null,
      factor  integer not null,
      time    integer not null,
      type    integer not null
    )
  `);

  sqlDb.run(`
    CREATE TABLE graves (
      usn  integer not null,
      oid  integer not null,
      type integer not null
    )
  `);

  // 创建索引（Anki 标准索引）
  sqlDb.run('CREATE INDEX ix_notes_usn ON notes (usn)');
  sqlDb.run('CREATE INDEX ix_notes_csum ON notes (csum)');
  sqlDb.run('CREATE INDEX ix_cards_usn ON cards (usn)');
  sqlDb.run('CREATE INDEX ix_cards_nid ON cards (nid)');
  sqlDb.run('CREATE INDEX ix_cards_sched ON cards (did, queue, due)');
  sqlDb.run('CREATE INDEX ix_revlog_usn ON revlog (usn)');
  sqlDb.run('CREATE INDEX ix_revlog_cid ON revlog (cid)');
}

/**
 * 插入 col 表数据（牌组配置、模型定义等）
 */
function insertCollectionData(sqlDb: any, deckName: string): void {
  const now = Math.floor(Date.now() / 1000);

  // 模型定义（Basic: Front / Back）
  const models: Record<string, any> = {
    [MODEL_ID]: {
      id: MODEL_ID,
      name: 'EXAM-MASTER Basic',
      type: 0, // 标准模型
      mod: now,
      usn: -1,
      sortf: 0,
      did: DECK_ID,
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: '{{Front}}',
          afmt: '{{FrontSide}}<hr id=answer>{{Back}}',
          bqfmt: '',
          bafmt: '',
          did: null,
          bfont: '',
          bsize: 0
        }
      ],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] }
      ],
      css: '.card {\n  font-family: arial;\n  font-size: 20px;\n  text-align: center;\n  color: black;\n  background-color: white;\n}\n',
      latexPre:
        '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      latexsvg: false,
      req: [[0, 'any', [0]]]
    }
  };

  // 牌组定义
  const decks: Record<string, any> = {
    '1': {
      id: 1,
      mod: now,
      name: 'Default',
      usn: -1,
      lrnToday: [0, 0],
      revToday: [0, 0],
      newToday: [0, 0],
      timeToday: [0, 0],
      collapsed: false,
      browserCollapsed: false,
      desc: '',
      dyn: 0,
      conf: DCONF_ID,
      extendNew: 10,
      extendRev: 50
    },
    [DECK_ID]: {
      id: DECK_ID,
      mod: now,
      name: deckName,
      usn: -1,
      lrnToday: [0, 0],
      revToday: [0, 0],
      newToday: [0, 0],
      timeToday: [0, 0],
      collapsed: false,
      browserCollapsed: false,
      desc: `Exported from EXAM-MASTER`,
      dyn: 0,
      conf: DCONF_ID,
      extendNew: 10,
      extendRev: 50
    }
  };

  // 牌组配置
  const dconf: Record<string, any> = {
    [DCONF_ID]: {
      id: DCONF_ID,
      mod: 0,
      name: 'Default',
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: false,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 0],
        order: 1,
        perDay: 20
      },
      rev: {
        bury: false,
        ease4: 1.3,
        ivlFct: 1,
        maxIvl: 36500,
        perDay: 200,
        hardFactor: 1.2
      },
      lapse: {
        delays: [10],
        leechAction: 1,
        leechFails: 8,
        minInt: 1,
        mult: 0
      }
    }
  };

  // 集合配置
  const conf = {
    activeDecks: [1],
    curDeck: DECK_ID,
    newSpread: 0,
    collapseTime: 1200,
    timeLim: 0,
    estTimes: true,
    dueCounts: true,
    curModel: MODEL_ID,
    nextPos: 1,
    sortType: 'noteFld',
    sortBackwards: false,
    addToCur: true
  };

  sqlDb.run(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      now, // crt: 创建时间
      now, // mod: 修改时间
      now * 1000, // scm: schema 修改时间（毫秒）
      11, // ver: schema 版本
      0, // dty: dirty flag
      0, // usn: update sequence number
      0, // ls: last sync
      JSON.stringify(conf),
      JSON.stringify(models),
      JSON.stringify(decks),
      JSON.stringify(dconf),
      JSON.stringify({})
    ]
  );
}

// ==================== 内容构建 ====================

/**
 * 构建 Anki 卡片正面内容（题目）
 */
function buildFrontContent(question: ExportQuestion): string {
  const parts: string[] = [];

  // 题目类型标识
  if (question.type) {
    parts.push(`<div style="color:#888;font-size:12px;margin-bottom:8px;">[${escapeHtml(question.type)}]</div>`);
  }

  // 题目正文
  parts.push(`<div>${escapeHtml(question.question || '')}</div>`);

  // 选择题选项
  if (Array.isArray(question.options) && question.options.length > 0) {
    parts.push('<div style="text-align:left;margin-top:12px;">');
    for (const opt of question.options) {
      if (opt && (opt.label || opt.content)) {
        const label = escapeHtml(opt.label || '');
        const content = escapeHtml(opt.content || '');
        parts.push(`<div style="margin:4px 0;">${label}. ${content}</div>`);
      }
    }
    parts.push('</div>');
  }

  return parts.join('\n');
}

/**
 * 构建 Anki 卡片背面内容（答案 + 解析）
 */
function buildBackContent(question: ExportQuestion): string {
  const parts: string[] = [];

  // 答案
  const answer = question.answer || '';
  if (answer) {
    parts.push(`<div><b>答案：</b>${escapeHtml(answer)}</div>`);
  }

  // 解析（仅当与答案不同时展示）
  const analysis = question.analysis || '';
  if (analysis && analysis !== answer) {
    parts.push(`<div style="margin-top:8px;"><b>解析：</b>${escapeHtml(analysis)}</div>`);
  }

  // 难度
  if (question.difficulty) {
    const difficultyMap: Record<string, string> = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    };
    const label = difficultyMap[question.difficulty] || question.difficulty;
    parts.push(`<div style="color:#888;font-size:12px;margin-top:8px;">难度：${escapeHtml(label)}</div>`);
  }

  return parts.join('\n') || '<div>（无答案）</div>';
}

/**
 * 构建 Anki 格式标签字符串
 * Anki 标签格式：" tag1 tag2 tag3 "（首尾有空格）
 */
function buildAnkiTags(question: ExportQuestion): string {
  const tagParts: string[] = [];

  // 题目标签
  if (Array.isArray(question.tags)) {
    for (const tag of question.tags) {
      if (typeof tag === 'string' && tag.trim()) {
        // Anki 标签不能包含空格，用下划线替换
        tagParts.push(tag.trim().replace(/\s+/g, '_'));
      }
    }
  }

  // 分类作为标签
  if (question.category && typeof question.category === 'string') {
    tagParts.push(`category::${question.category.trim().replace(/\s+/g, '_')}`);
  }

  if (tagParts.length === 0) {
    return '';
  }

  return ' ' + tagParts.join(' ') + ' ';
}

// ==================== 工具函数 ====================

/**
 * 生成 Anki GUID（10 字符 base91 编码）
 */
function generateGuid(seed: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  let guid = '';
  let n = seed;
  for (let i = 0; i < 10; i++) {
    guid += chars[Math.abs(n) % chars.length];
    n = Math.floor(n / chars.length) + (i + 1) * 31;
  }
  return guid;
}

/**
 * 计算 Anki 校验和（sflds 的 SHA1 前 8 位十六进制转 32 位整数）
 */
function computeChecksum(sflds: string): number {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha1').update(sflds, 'utf8').digest('hex');
  // 取前 8 位十六进制，转为 32 位无符号整数
  return parseInt(hash.substring(0, 8), 16);
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

/**
 * 从 HTML 内容中提取纯文本（简易实现，与 anki-import 保持一致）
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(div|p|li|ul|ol|h[1-6]|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 文件名安全化处理
 */
function sanitizeFileName(name: string): string {
  if (!name) return 'export';
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // 移除非法字符
      .replace(/_{2,}/g, '_') // 合并连续下划线
      .replace(/^_|_$/g, '') // 去掉首尾下划线
      .substring(0, 100) || // 限制长度
    'export'
  );
}

// ==================== ZIP 打包 ====================

/**
 * 将 SQLite 数据库打包为 .apkg 格式的 ZIP
 * 返回 base64 编码字符串
 */
async function packageApkg(sqliteData: Uint8Array, requestId: string): Promise<string> {
  const JSZipModule = (await import('jszip')).default ?? (await import('jszip'));
  const zip = new (JSZipModule as any)();

  // Anki 21+ 使用 collection.anki21
  zip.file('collection.anki21', sqliteData);

  // media 文件（空 JSON 对象，无媒体资源）
  zip.file('media', '{}');

  // 生成 ZIP 并转为 base64
  const zipBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  logger.info(`[${requestId}] ZIP 打包完成: ${(zipBuffer.length / 1024).toFixed(1)} KB`);

  return Buffer.from(zipBuffer).toString('base64');
}
