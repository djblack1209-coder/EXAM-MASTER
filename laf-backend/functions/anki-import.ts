/**
 * Anki .apkg 文件导入云函数
 *
 * 解析 Anki 牌组文件（.apkg），提取笔记和卡片数据，
 * 映射为 EXAM-MASTER 题库格式并批量写入 MongoDB。
 *
 * .apkg 结构：ZIP 压缩包，内含 collection.anki2（SQLite）和媒体文件。
 * SQLite 表：col（元数据）、notes（笔记）、cards（卡片）。
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  createLogger,
  wrapResponse,
  sanitizeString,
  checkRateLimitDistributed,
  tooManyRequests
} from './_shared/api-response.js';

const db = cloud.database();
const logger = createLogger('[AnkiImport]');

// ==================== 常量 ====================

/** 单次导入最大文件大小：50 MB（base64 编码后约 67 MB） */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** 单次导入最大笔记数 */
const MAX_NOTES = 5000;

/** MongoDB 批量写入分片大小 */
const BATCH_SIZE = 50;

/** Anki 字段分隔符 */
const ANKI_FIELD_SEPARATOR = '\x1f';

// ==================== 类型定义 ====================

interface AnkiNote {
  id: number;
  mid: number;
  flds: string;
  tags: string;
}

interface AnkiCard {
  id: number;
  nid: number;
  did: number;
  type: number;
  ivl: number;
  factor: number;
  due: number;
  reps: number;
}

interface AnkiModel {
  name: string;
  flds: Array<{ name: string; ord: number }>;
  type: number; // 0=Standard, 1=Cloze
}

interface AnkiDeck {
  name: string;
}

interface ParsedAnkiData {
  notes: AnkiNote[];
  cards: AnkiCard[];
  models: Record<string, AnkiModel>;
  decks: Record<string, AnkiDeck>;
}

// ==================== 主函数 ====================

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('anki');

  try {
    // ---- 认证 ----
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return wrapResponse(unauthorized('请先登录'), requestId, startTime);
    }
    const { userId } = authResult;

    // 频率限制：5次/5分钟/用户（I/O密集型操作）
    const rateLimitResult = await checkRateLimitDistributed(`anki_import_${userId}`, 5, 300000);
    if (!rateLimitResult.allowed) {
      return wrapResponse(tooManyRequests('请求过于频繁，请稍后再试'), requestId, startTime);
    }

    logger.info(`[${requestId}] 用户 ${userId} 发起 Anki 导入请求`);

    // ---- 获取文件数据 ----
    const fileBuffer = resolveFileBuffer(ctx);
    if (!fileBuffer) {
      return wrapResponse(
        badRequest('缺少文件数据，请通过 fileData（base64）或 Buffer 上传 .apkg 文件'),
        requestId,
        startTime
      );
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      return wrapResponse(
        badRequest(`文件过大，最大支持 ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`),
        requestId,
        startTime
      );
    }

    logger.info(`[${requestId}] 文件大小: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

    // ---- 解压 .apkg ----
    const JSZip = (await import('jszip')).default ?? (await import('jszip'));
    let zip: any;
    try {
      zip = await JSZip.loadAsync(fileBuffer);
    } catch (e) {
      logger.error(`[${requestId}] ZIP 解压失败:`, e);
      return wrapResponse(badRequest('无法解压文件，请确认上传的是有效的 .apkg 文件'), requestId, startTime);
    }

    // ---- 定位 SQLite 数据库 ----
    const sqliteFileName = findSqliteFile(zip);
    if (!sqliteFileName) {
      return wrapResponse(
        badRequest('.apkg 中未找到 Anki 数据库文件（collection.anki2 或 collection.anki21）'),
        requestId,
        startTime
      );
    }

    const sqliteBuffer = await zip.file(sqliteFileName).async('uint8array');
    logger.info(`[${requestId}] 解压 SQLite 文件: ${sqliteFileName} (${(sqliteBuffer.length / 1024).toFixed(1)} KB)`);

    // ---- 解析 SQLite ----
    let parsedData: ParsedAnkiData;
    try {
      parsedData = await parseSqliteDatabase(sqliteBuffer, requestId);
    } catch (e) {
      logger.error(`[${requestId}] SQLite 解析失败:`, e);
      return wrapResponse(serverError('Anki 数据库解析失败'), requestId, startTime);
    }

    const { notes, cards, models, decks } = parsedData;

    if (notes.length === 0) {
      return wrapResponse(badRequest('牌组中没有任何笔记/卡片'), requestId, startTime);
    }

    if (notes.length > MAX_NOTES) {
      return wrapResponse(badRequest(`笔记数量 (${notes.length}) 超过单次导入上限 ${MAX_NOTES}`), requestId, startTime);
    }

    // ---- 确定牌组名称 ----
    const deckName = resolveDeckName(cards, decks, ctx);
    logger.info(`[${requestId}] 解析完成: ${notes.length} 笔记, ${cards.length} 卡片, 牌组="${deckName}"`);

    // ---- 创建题库 ----
    const now = Date.now();
    const questionBankDoc = {
      name: deckName,
      description: `从 Anki 牌组 "${deckName}" 导入`,
      source: 'anki_import',
      user_id: userId,
      question_count: 0, // 稍后更新
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const bankInsertResult = await db.collection('question_banks').add(questionBankDoc);
    const questionBankId = bankInsertResult.id;
    logger.info(`[${requestId}] 题库已创建: ${questionBankId}`);

    // ---- 映射并批量插入题目 ----
    const stats = await insertQuestions({
      notes,
      cards,
      models,
      decks,
      deckName,
      questionBankId,
      userId,
      requestId,
      now
    });

    // ---- 更新题库题目计数 ----
    await db.collection('question_banks').doc(questionBankId).update({
      question_count: stats.imported,
      updated_at: Date.now()
    });

    logger.info(
      `[${requestId}] 导入完成: ${stats.imported} 题成功, ${stats.skipped} 题跳过, 耗时 ${Date.now() - startTime}ms`
    );

    return wrapResponse(
      success(
        {
          questionBankId,
          deckName,
          totalNotes: notes.length,
          totalCards: cards.length,
          imported: stats.imported,
          skipped: stats.skipped,
          modelCount: Object.keys(models).length,
          deckCount: Object.keys(decks).length
        },
        `导入完成: ${stats.imported} 题成功, ${stats.skipped} 题跳过`
      ),
      requestId,
      startTime
    );
  } catch (err) {
    logger.error(`[${requestId}] Anki 导入异常:`, err);
    return wrapResponse(serverError('导入失败，请稍后重试'), requestId, startTime);
  }
}

// ==================== 文件解析 ====================

/**
 * 从请求上下文中提取文件 Buffer
 * 支持 base64 字符串 (ctx.body.fileData) 或直接 Buffer
 */
function resolveFileBuffer(ctx: any): Buffer | null {
  const { fileData } = ctx.body || {};

  // base64 字符串
  if (typeof fileData === 'string' && fileData.length > 0) {
    try {
      // 移除可能的 data URI 前缀
      const raw = fileData.replace(/^data:[^;]+;base64,/, '');
      return Buffer.from(raw, 'base64');
    } catch {
      return null;
    }
  }

  // Buffer / Uint8Array（某些 Laf 版本直接传 Buffer）
  if (Buffer.isBuffer(fileData)) {
    return fileData;
  }
  if (fileData instanceof Uint8Array) {
    return Buffer.from(fileData);
  }

  // ctx.files（multipart/form-data）
  if (ctx.files?.file?.data) {
    return Buffer.isBuffer(ctx.files.file.data) ? ctx.files.file.data : Buffer.from(ctx.files.file.data);
  }

  return null;
}

/**
 * 在 ZIP 中查找 SQLite 数据库文件
 * Anki 2.0 使用 collection.anki2，Anki 2.1+ 使用 collection.anki21
 */
function findSqliteFile(zip: any): string | null {
  const candidates = ['collection.anki21', 'collection.anki2'];
  for (const name of candidates) {
    if (zip.file(name)) {
      return name;
    }
  }
  // 回退：查找任何 .anki2/.anki21 文件
  const files = Object.keys(zip.files);
  return files.find((f) => /\.anki2[1]?$/.test(f) && !zip.files[f].dir) || null;
}

// ==================== SQLite 解析 ====================

/**
 * 使用 sql.js 解析 Anki SQLite 数据库，提取所有相关表数据
 */
async function parseSqliteDatabase(sqliteBuffer: Uint8Array, requestId: string): Promise<ParsedAnkiData> {
  const initSqlJs = (await import('sql.js')).default ?? (await import('sql.js'));
  const SQL = await initSqlJs();
  const sqlDb = new SQL.Database(sqliteBuffer);

  try {
    // ---- col 表：获取模型和牌组定义 ----
    const models = parseModels(sqlDb, requestId);
    const decks = parseDecks(sqlDb, requestId);

    // ---- notes 表 ----
    const notes = queryNotes(sqlDb);
    logger.info(`[${requestId}] 读取 ${notes.length} 条笔记`);

    // ---- cards 表 ----
    const cards = queryCards(sqlDb);
    logger.info(`[${requestId}] 读取 ${cards.length} 张卡片`);

    return { notes, cards, models, decks };
  } finally {
    sqlDb.close();
  }
}

function parseModels(sqlDb: any, requestId: string): Record<string, AnkiModel> {
  const models: Record<string, AnkiModel> = {};
  try {
    const colResult = sqlDb.exec('SELECT models FROM col LIMIT 1');
    if (colResult.length > 0 && colResult[0].values.length > 0) {
      const modelsJson = JSON.parse(colResult[0].values[0][0] as string);
      for (const [mid, model] of Object.entries(modelsJson)) {
        const m = model as any;
        models[mid] = {
          name: m.name || 'Unknown',
          flds: Array.isArray(m.flds) ? m.flds.map((f: any) => ({ name: f.name || '', ord: f.ord ?? 0 })) : [],
          type: m.type || 0 // 0=Standard, 1=Cloze
        };
      }
    }
  } catch (e) {
    logger.warn(`[${requestId}] 解析 models 失败，使用默认值:`, e);
  }
  return models;
}

function parseDecks(sqlDb: any, requestId: string): Record<string, AnkiDeck> {
  const decks: Record<string, AnkiDeck> = {};
  try {
    const colResult = sqlDb.exec('SELECT decks FROM col LIMIT 1');
    if (colResult.length > 0 && colResult[0].values.length > 0) {
      const decksJson = JSON.parse(colResult[0].values[0][0] as string);
      for (const [did, deck] of Object.entries(decksJson)) {
        decks[did] = { name: (deck as any).name || 'Default' };
      }
    }
  } catch (e) {
    logger.warn(`[${requestId}] 解析 decks 失败，使用默认值:`, e);
  }
  return decks;
}

function queryNotes(sqlDb: any): AnkiNote[] {
  const result = sqlDb.exec('SELECT id, mid, flds, tags FROM notes');
  if (result.length === 0) return [];

  return result[0].values.map((row: any[]) => ({
    id: row[0] as number,
    mid: row[1] as number,
    flds: row[2] as string,
    tags: row[3] as string
  }));
}

function queryCards(sqlDb: any): AnkiCard[] {
  const result = sqlDb.exec('SELECT id, nid, did, type, ivl, factor, due, reps FROM cards');
  if (result.length === 0) return [];

  return result[0].values.map((row: any[]) => ({
    id: row[0] as number,
    nid: row[1] as number,
    did: row[2] as number,
    type: row[3] as number,
    ivl: row[4] as number,
    factor: row[5] as number,
    due: row[6] as number,
    reps: row[7] as number
  }));
}

// ==================== 数据映射与写入 ====================

/**
 * 确定导入的牌组名称
 * 优先使用请求中指定的名称，否则从 decks 中取第一个非 Default 的
 */
function resolveDeckName(cards: AnkiCard[], decks: Record<string, AnkiDeck>, ctx: any): string {
  // 客户端显式指定
  const customName = ctx.body?.deckName;
  if (typeof customName === 'string' && customName.trim()) {
    return sanitizeString(customName.trim(), 200);
  }

  // 从卡片中找出最常见的 deck ID
  const deckIdFreq: Record<string, number> = {};
  for (const card of cards) {
    const did = String(card.did);
    deckIdFreq[did] = (deckIdFreq[did] || 0) + 1;
  }

  // 按频率排序，优先选择非 Default 的牌组
  const sortedDids = Object.entries(deckIdFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([did]) => did);

  for (const did of sortedDids) {
    const deck = decks[did];
    if (deck && deck.name !== 'Default' && deck.name !== 'default') {
      return deck.name;
    }
  }

  // 回退：取任何非 Default 牌组名
  for (const deck of Object.values(decks)) {
    if (deck.name !== 'Default' && deck.name !== 'default') {
      return deck.name;
    }
  }

  return 'Anki 导入牌组';
}

/**
 * 将 Anki card.type 映射为应用题目类型
 *   0 = new      → 'anki_new'     (新卡)
 *   1 = learning  → 'anki_learning' (学习中)
 *   2 = review    → 'anki_review'  (复习)
 *   3 = relearn   → 'anki_relearn' (重新学习)
 */
function mapCardType(ankiType: number): string {
  const typeMap: Record<number, string> = {
    0: 'anki_new',
    1: 'anki_learning',
    2: 'anki_review',
    3: 'anki_relearn'
  };
  return typeMap[ankiType] || 'anki_new';
}

/**
 * 根据 Anki 卡片间隔推断难度
 */
function inferDifficulty(card: AnkiCard): string {
  if (card.type === 0 || card.reps === 0) return 'medium'; // 新卡默认中等
  if (card.ivl > 60) return 'easy'; // 间隔 > 60 天：掌握良好
  if (card.ivl > 14) return 'medium'; // 间隔 > 14 天：中等
  return 'hard'; // 间隔短：较难
}

/**
 * 从 HTML 内容中提取纯文本（简易实现）
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
 * 检测并解析 Anki Cloze 填空题
 * Cloze 格式: {{c1::answer::hint}} 或 {{c1::answer}}
 */
function parseCloze(text: string): {
  isCloze: boolean;
  clozes: Array<{ index: number; answer: string; hint: string }>;
  displayText: string;
} {
  const clozePattern = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;
  const matches = [...text.matchAll(clozePattern)];

  if (matches.length === 0) {
    return { isCloze: false, clozes: [], displayText: text };
  }

  const clozes = matches.map((m) => ({
    index: parseInt(m[1]),
    answer: m[2].trim(),
    hint: m[3]?.trim() || ''
  }));

  // 生成显示文本：将 cloze 替换为 [___] 占位符
  const displayText = text.replace(clozePattern, (_, idx, _answer, hint) => {
    return hint ? `[${hint}]` : `[填空${idx}]`;
  });

  return { isCloze: true, clozes, displayText };
}

/**
 * 批量构建题目文档并写入 MongoDB
 */
async function insertQuestions(params: {
  notes: AnkiNote[];
  cards: AnkiCard[];
  models: Record<string, AnkiModel>;
  decks: Record<string, AnkiDeck>;
  deckName: string;
  questionBankId: string;
  userId: string;
  requestId: string;
  now: number;
}): Promise<{ imported: number; skipped: number }> {
  const { notes, cards, models, decks, deckName, questionBankId, userId, requestId, now } = params;

  // 构建 noteId → cards 映射
  const cardsByNoteId = new Map<number, AnkiCard[]>();
  for (const card of cards) {
    const existing = cardsByNoteId.get(card.nid) || [];
    existing.push(card);
    cardsByNoteId.set(card.nid, existing);
  }

  const collection = db.collection('questions');
  let imported = 0;
  let skipped = 0;

  // 分批处理
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);
    const docs: any[] = [];

    for (const note of batch) {
      try {
        const fields = note.flds.split(ANKI_FIELD_SEPARATOR);
        const front = stripHtml(fields[0] || '').substring(0, 5000);
        const back = stripHtml(fields[1] || '').substring(0, 10000);

        // 跳过空白卡片
        if (!front.trim()) {
          skipped++;
          continue;
        }

        // 解析标签（Anki 用空格分隔，首尾有空格）
        const tags = note.tags
          .trim()
          .split(/\s+/)
          .filter((t: string) => t.length > 0)
          .slice(0, 20);

        // 获取该笔记对应的第一张卡片的信息
        const noteCards = cardsByNoteId.get(note.id) || [];
        const primaryCard = noteCards[0];

        // 获取牌组名称
        const cardDeckName = primaryCard ? decks[String(primaryCard.did)]?.name || deckName : deckName;

        // 获取模型名称
        const modelName = models[String(note.mid)]?.name || 'Unknown';

        // 获取模型字段名称
        const model = models[String(note.mid)];
        const fieldNames = model?.flds?.sort((a, b) => a.ord - b.ord).map((f) => f.name) || [];

        // 构建额外字段信息（超过前2个字段的内容）
        const extraFields: Record<string, string> = {};
        for (let fi = 2; fi < fields.length && fi < fieldNames.length; fi++) {
          const val = stripHtml(fields[fi] || '').substring(0, 2000);
          if (val.trim()) {
            extraFields[fieldNames[fi] || `field_${fi}`] = val;
          }
        }

        // 检测 Cloze 填空题（通过模型类型或字段内容中的 cloze 语法）
        const isClozeModel = model?.type === 1;
        const clozeResult = parseCloze(front);

        let questionType = '问答';
        let questionContent = sanitizeString(front, 5000);
        let questionAnswer = back;
        let questionOptions: string[] = [];

        if (clozeResult.isCloze || isClozeModel) {
          questionType = '填空';
          if (clozeResult.isCloze) {
            questionContent = sanitizeString(clozeResult.displayText, 5000);
            // 答案为所有 cloze 的内容，用分号分隔
            questionAnswer = clozeResult.clozes.map((c) => c.answer).join('；');
            // 将每个 cloze 的答案作为 option 存储（方便前端渲染）
            questionOptions = clozeResult.clozes.map((c) => c.answer);
          }
        }

        const doc: Record<string, any> = {
          question: questionContent,
          answer: questionAnswer,
          analysis: back, // Anki 背面同时作为解析
          options: questionOptions,
          type: questionType,
          category: cardDeckName.split('::')[0] || '综合', // Anki 子牌组用 :: 分隔
          sub_category: cardDeckName.includes('::') ? cardDeckName.split('::').slice(1).join(' > ') : null,
          difficulty: primaryCard ? inferDifficulty(primaryCard) : 'medium',
          tags,
          knowledge_points: [],
          source: 'Anki 导入',
          question_bank_id: questionBankId,
          user_id: userId,

          // Anki 元数据
          anki_meta: {
            note_id: note.id,
            model_id: note.mid,
            model_name: modelName,
            card_type: primaryCard ? mapCardType(primaryCard.type) : 'anki_new',
            interval: primaryCard?.ivl || 0,
            ease_factor: primaryCard?.factor || 0,
            due: primaryCard?.due || 0,
            reps: primaryCard?.reps || 0,
            deck_path: cardDeckName,
            field_names: fieldNames,
            card_count: noteCards.length,
            ...(Object.keys(extraFields).length > 0 ? { extra_fields: extraFields } : {})
          },

          total_attempts: 0,
          correct_attempts: 0,
          is_active: true,
          is_premium: false,
          review_status: 'approved',
          created_at: now,
          updated_at: now
        };

        docs.push(doc);
      } catch (e) {
        logger.warn(`[${requestId}] 笔记 ${note.id} 处理失败，已跳过:`, e);
        skipped++;
      }
    }

    // 批量写入
    if (docs.length > 0) {
      const results = await Promise.allSettled(docs.map((doc) => collection.add(doc)));
      for (const result of results) {
        if (result.status === 'fulfilled') {
          imported++;
        } else {
          logger.warn(`[${requestId}] 写入失败:`, result.reason);
          skipped++;
        }
      }
    }

    // 每批次间短暂 log
    if (i + BATCH_SIZE < notes.length) {
      logger.info(
        `[${requestId}] 进度: ${Math.min(i + BATCH_SIZE, notes.length)}/${notes.length} (已导入 ${imported}, 跳过 ${skipped})`
      );
    }
  }

  return { imported, skipped };
}
