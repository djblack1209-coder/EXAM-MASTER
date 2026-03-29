/**
 * @lafjs/cloud 兼容层 — 让 Laf 云函数在独立 Express 服务器上运行
 *
 * 提供与 Laf SDK 相同的 API 接口:
 *   - cloud.database() → MongoDB driver wrapper
 *   - cloud.fetch()    → axios-compatible HTTP client
 *   - cloud.storage    → 本地文件存储 (替代 S3)
 *   - cloud.res        → Express response (用于 SSE)
 *
 * 不实现 (项目未使用): cloud.shared, cloud.getToken(), cloud.env
 */

import { MongoClient, Db, Collection, ObjectId, Document } from 'mongodb';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

// ==================== MongoDB 连接管理 ====================

// 安全加固: 生产环境必须配置 MONGODB_URI，禁止回退到无认证的本地数据库
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  const msg = '[FATAL] 环境变量 MONGODB_URI 未配置。生产环境禁止使用默认值，请在 .env 中设置 MONGODB_URI';
  console.error(msg);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
  // 仅开发环境允许回退
  console.warn('[DEV] 使用开发环境默认数据库连接: mongodb://localhost:27017/exam-master');
}
const RESOLVED_MONGODB_URI = MONGODB_URI || 'mongodb://localhost:27017/exam-master';
const DB_NAME = process.env.DB_NAME || 'exam-master';

let _client: MongoClient | null = null;
let _db: Db | null = null;

async function getDb(): Promise<Db> {
  if (_db) return _db;
  _client = new MongoClient(RESOLVED_MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000
  });
  await _client.connect();
  _db = _client.db(DB_NAME);
  console.log(`[cloud-shim] MongoDB connected: ${DB_NAME}`);
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
}

// ==================== db.command 操作符 ====================

// 标记符号，区分普通对象和操作符
const OP_SYMBOL = Symbol('__laf_op__');

interface OpValue {
  [OP_SYMBOL]: true;
  $op: string;
  $val: any;
}

function makeOp(op: string, val: any): OpValue {
  return { [OP_SYMBOL]: true, $op: op, $val: val };
}

function isOp(v: any): v is OpValue {
  return v && v[OP_SYMBOL] === true;
}

/** 将 Laf query 对象转换为 MongoDB query */
function translateQuery(query: Record<string, any>): Record<string, any> {
  // CRITICAL: 处理顶层逻辑操作符 — _.or([...]) / _.and([...]) 直接传入 where()
  if (isOp(query)) {
    if (query.$op === 'or') return { $or: (query.$val as any[]).map((q) => translateQuery(q)) };
    if (query.$op === 'and') return { $and: (query.$val as any[]).map((q) => translateQuery(q)) };
    // 其他顶层操作符不太可能出现在 where() 中
    return { [`$${query.$op}`]: query.$val };
  }

  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(query)) {
    if (isOp(val)) {
      if (val.$op === '__multi__') {
        // 处理 _.gte(x).and(_.lte(y)) 合并结果
        result[key] = val.$val;
      } else if (val.$op === 'or') {
        result[key] = { $or: val.$val };
      } else if (val.$op === 'and') {
        result[key] = { $and: val.$val };
      } else {
        result[key] = { [`$${val.$op}`]: val.$val };
      }
    } else if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      !(val instanceof ObjectId) &&
      !(val instanceof Date) &&
      !(val instanceof RegExp)
    ) {
      const nested: Record<string, any> = {};
      let hasOps = false;
      for (const [k2, v2] of Object.entries(val)) {
        if (isOp(v2)) {
          nested[`$${v2.$op}`] = v2.$val;
          hasOps = true;
        } else {
          nested[k2] = v2;
        }
      }
      result[key] = hasOps ? nested : val;
    } else {
      // 自动将 _id 字符串转回 ObjectId（normalizeDoc 输出的 _id 是字符串）
      if (key === '_id' && typeof val === 'string' && /^[a-fA-F0-9]{24}$/.test(val)) {
        result[key] = new ObjectId(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/** 将 Laf update 对象转换为 MongoDB update */
function translateUpdate(data: Record<string, any>): Record<string, any> {
  const $set: Record<string, any> = {};
  const $inc: Record<string, any> = {};
  const $push: Record<string, any> = {};
  const $unset: Record<string, any> = {};

  for (const [key, val] of Object.entries(data)) {
    if (isOp(val)) {
      switch (val.$op) {
        case 'inc':
          $inc[key] = val.$val;
          break;
        case 'set':
          $set[key] = val.$val;
          break;
        case 'push':
          if (val.$val && val.$val.each) {
            $push[key] = { $each: val.$val.each, ...(val.$val.slice !== undefined ? { $slice: val.$val.slice } : {}) };
          } else {
            $push[key] = val.$val;
          }
          break;
        case 'remove':
          $unset[key] = '';
          break;
        default:
          $set[key] = val;
      }
    } else {
      $set[key] = val;
    }
  }

  const update: Record<string, any> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($inc).length) update.$inc = $inc;
  if (Object.keys($push).length) update.$push = $push;
  if (Object.keys($unset).length) update.$unset = $unset;

  return Object.keys(update).length ? update : { $set: data };
}

const command = {
  gt: (val: number) => makeOp('gt', val),
  gte: (val: number) => makeOp('gte', val),
  lt: (val: number) => makeOp('lt', val),
  lte: (val: number) => makeOp('lte', val),
  eq: (val: any) => makeOp('eq', val),
  neq: (val: any) => makeOp('ne', val),
  in: (arr: any[]) => makeOp('in', arr),
  nin: (arr: any[]) => makeOp('nin', arr),
  exists: (bool: boolean) => makeOp('exists', bool),
  all: (arr: any[]) => makeOp('all', arr),
  or: (conditions: any[]) => makeOp('or', conditions),
  and: (...conditions: any[]) => {
    if (conditions.length === 1 && isOp(conditions[0])) {
      return conditions[0];
    }
    return makeOp('and', conditions);
  },
  inc: (val: number) => makeOp('inc', val),
  set: (val: any) => makeOp('set', val),
  push: (val: any) => makeOp('push', val),
  remove: () => makeOp('remove', null)
};

// 让 gt/gte/lt/lte 返回的对象也有 .and() 方法
for (const fn of ['gt', 'gte', 'lt', 'lte'] as const) {
  const original = command[fn];
  (command as any)[fn] = (val: number) => {
    const op = original(val);
    (op as any).and = (other: OpValue) => {
      // 合并为 MongoDB 格式: { $gte: x, $lte: y }
      return {
        [OP_SYMBOL]: true,
        $op: '__multi__',
        $val: { [`$${op.$op}`]: op.$val, [`$${other.$op}`]: other.$val }
      } as OpValue;
    };
    return op;
  };
}

// ==================== Collection Wrapper ====================

class QueryBuilder {
  private col: Collection;
  private filter: Record<string, any>;
  private _skip = 0;
  private _limit = 0;
  private _sort: Record<string, 1 | -1> = {};
  private _projection: Record<string, any> | null = null;

  constructor(col: Collection, filter: Record<string, any>) {
    this.col = col;
    this.filter = translateQuery(filter);
  }

  skip(n: number) {
    this._skip = n;
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }
  orderBy(field: string, direction: 'asc' | 'desc') {
    this._sort[field] = direction === 'asc' ? 1 : -1;
    return this;
  }
  field(projection: Record<string, any> | string[]) {
    if (Array.isArray(projection)) {
      this._projection = Object.fromEntries(projection.map((f) => [f, 1]));
    } else {
      this._projection = projection;
    }
    return this;
  }

  async get(): Promise<{ data: any[] }> {
    let cursor = this.col.find(this.filter);
    if (this._projection) cursor = cursor.project(this._projection);
    if (Object.keys(this._sort).length) cursor = cursor.sort(this._sort);
    if (this._skip) cursor = cursor.skip(this._skip);
    if (this._limit) cursor = cursor.limit(this._limit);
    const data = await cursor.toArray();
    // Laf 使用 _id 字符串，MongoDB 使用 ObjectId
    return { data: data.map(normalizeDoc) };
  }

  async getOne(): Promise<{ data: any | null }> {
    // 使用 find().sort().limit(1) 代替 findOne()，以支持 orderBy 排序
    const opts: any = {};
    if (this._projection) opts.projection = this._projection;
    let cursor = this.col.find(this.filter, opts);
    if (Object.keys(this._sort).length) cursor = cursor.sort(this._sort);
    cursor = cursor.limit(1);
    const docs = await cursor.toArray();
    const doc = docs[0] || null;
    return { data: doc ? normalizeDoc(doc) : null };
  }

  async count(): Promise<{ total: number }> {
    const total = await this.col.countDocuments(this.filter);
    return { total };
  }

  async update(data: Record<string, any>): Promise<{ updated: number; matched: number; upsertId: any }> {
    const update = translateUpdate(data);
    const result = await this.col.updateMany(this.filter, update);
    return { updated: result.modifiedCount, matched: result.matchedCount, upsertId: result.upsertedId };
  }

  async remove(options?: { multi?: boolean }): Promise<{ deleted: number }> {
    // Laf SDK 的 .where().remove() 默认删除所有匹配文档 (deleteMany)
    // 仅在显式传入 { multi: false } 时才使用 deleteOne
    if (options?.multi === false) {
      const result = await this.col.deleteOne(this.filter);
      return { deleted: result.deletedCount };
    }
    const result = await this.col.deleteMany(this.filter);
    return { deleted: result.deletedCount };
  }
}

class DocRef {
  private col: Collection;
  private id: string;

  constructor(col: Collection, id: string) {
    this.col = col;
    this.id = id;
  }

  private getFilter() {
    try {
      return { _id: new ObjectId(this.id) as any };
    } catch {
      return { _id: this.id as any };
    }
  }

  async get(): Promise<{ data: any | null }> {
    const doc = await this.col.findOne(this.getFilter());
    return { data: doc ? normalizeDoc(doc) : null };
  }

  async update(data: Record<string, any>): Promise<{ updated: number; matched: number; upsertId: any }> {
    const update = translateUpdate(data);
    const result = await this.col.updateOne(this.getFilter(), update);
    return { updated: result.modifiedCount, matched: result.matchedCount, upsertId: result.upsertedId };
  }

  async remove(): Promise<{ deleted: number }> {
    const result = await this.col.deleteOne(this.getFilter());
    return { deleted: result.deletedCount };
  }
}

class AggregateBuilder {
  private col: Collection;
  private pipeline: Document[];

  constructor(col: Collection, pipeline?: Document[]) {
    this.col = col;
    this.pipeline = pipeline || [];
  }

  match(query: Record<string, any>) {
    this.pipeline.push({ $match: translateQuery(query) });
    return this;
  }

  sample(opts: { size: number }) {
    this.pipeline.push({ $sample: opts });
    return this;
  }

  group(spec: Record<string, any>) {
    this.pipeline.push({ $group: spec });
    return this;
  }

  unwind(fieldPath: string | { path: string; preserveNullAndEmptyArrays?: boolean }) {
    this.pipeline.push({ $unwind: fieldPath });
    return this;
  }

  sort(spec: Record<string, 1 | -1>) {
    this.pipeline.push({ $sort: spec });
    return this;
  }

  project(spec: Record<string, any>) {
    this.pipeline.push({ $project: spec });
    return this;
  }

  addFields(spec: Record<string, any>) {
    this.pipeline.push({ $addFields: spec });
    return this;
  }

  limit(n: number) {
    this.pipeline.push({ $limit: n });
    return this;
  }

  skip(n: number) {
    this.pipeline.push({ $skip: n });
    return this;
  }

  async end(): Promise<{ data: any[] }> {
    const data = await this.col.aggregate(this.pipeline).toArray();
    return { data: data.map(normalizeDoc) };
  }
}

class CollectionWrapper {
  private col: Collection;

  constructor(col: Collection) {
    this.col = col;
  }

  where(query: Record<string, any>) {
    return new QueryBuilder(this.col, query);
  }

  doc(id: string) {
    return new DocRef(this.col, id);
  }

  async add(data: any): Promise<{ id: string; insertedCount?: number }> {
    if (Array.isArray(data)) {
      const items = data.map((d) => ({ ...d, _id: d._id || new ObjectId() }));
      const result = await this.col.insertMany(items);
      return { id: String(result.insertedIds[0]), insertedCount: result.insertedCount };
    }
    const doc = { ...data, _id: data._id || new ObjectId() };
    const result = await this.col.insertOne(doc);
    return { id: String(result.insertedId), insertedCount: 1 };
  }

  aggregate(pipeline?: Document[]) {
    return new AggregateBuilder(this.col, pipeline);
  }
}

function normalizeDoc(doc: any): any {
  if (!doc) return doc;
  if (doc._id instanceof ObjectId) {
    doc._id = doc._id.toHexString();
  }
  return doc;
}

// ==================== Database Wrapper ====================

class DatabaseWrapper {
  command = command;

  /**
   * Laf SDK 兼容的 RegExp 工厂方法
   * 用法: db.RegExp({ regexp: 'pattern', options: 'i' })
   */
  RegExp(opts: { regexp: string; options?: string }): RegExp {
    return new globalThis.RegExp(opts.regexp, opts.options || '');
  }

  collection(name: string): CollectionWrapper {
    // 懒获取，getDb() 在第一次调用时连接
    const getCol = async () => {
      const db = await getDb();
      return db.collection(name);
    };
    // 返回一个代理对象，所有方法都是异步的
    return new Proxy({} as CollectionWrapper, {
      get: (_target, prop) => {
        if (prop === 'where') {
          return (query: Record<string, any>) => {
            const builder = {
              _query: query,
              _skip: 0,
              _limit: 0,
              _sort: {} as Record<string, 1 | -1>,
              _projection: null as Record<string, any> | null,
              where(additionalQuery: Record<string, any>) {
                this._query = { ...this._query, ...additionalQuery };
                return this;
              },
              skip(n: number) {
                this._skip = n;
                return this;
              },
              limit(n: number) {
                this._limit = n;
                return this;
              },
              orderBy(field: string, dir: 'asc' | 'desc') {
                this._sort[field] = dir === 'asc' ? 1 : -1;
                return this;
              },
              field(proj: Record<string, any> | string[]) {
                if (Array.isArray(proj)) {
                  this._projection = Object.fromEntries(proj.map((f) => [f, 1]));
                } else {
                  this._projection = proj;
                }
                return this;
              },
              async get() {
                const col = await getCol();
                const qb = new QueryBuilder(col, this._query);
                if (this._skip) qb.skip(this._skip);
                if (this._limit) qb.limit(this._limit);
                if (this._projection) qb.field(this._projection);
                for (const [k, v] of Object.entries(this._sort)) qb.orderBy(k, v === 1 ? 'asc' : 'desc');
                return qb.get();
              },
              async getOne() {
                const col = await getCol();
                const qb = new QueryBuilder(col, this._query);
                if (this._projection) qb.field(this._projection);
                for (const [k, v] of Object.entries(this._sort)) qb.orderBy(k, v === 1 ? 'asc' : 'desc');
                return qb.getOne();
              },
              async count() {
                const col = await getCol();
                return new QueryBuilder(col, this._query).count();
              },
              async update(data: any) {
                const col = await getCol();
                return new QueryBuilder(col, this._query).update(data);
              },
              async remove(opts?: { multi?: boolean }) {
                const col = await getCol();
                return new QueryBuilder(col, this._query).remove(opts);
              }
            };
            return builder;
          };
        }
        if (prop === 'doc') {
          return (id: string) => ({
            async get() {
              const col = await getCol();
              return new DocRef(col, id).get();
            },
            async update(data: any) {
              const col = await getCol();
              return new DocRef(col, id).update(data);
            },
            async remove() {
              const col = await getCol();
              return new DocRef(col, id).remove();
            }
          });
        }
        if (prop === 'add') {
          return async (data: any) => {
            const col = await getCol();
            return new CollectionWrapper(col).add(data);
          };
        }
        // ---- collection-level shortcuts (bare collection without .where()) ----
        if (prop === 'count') {
          return async () => {
            const col = await getCol();
            const total = await col.countDocuments({});
            return { total };
          };
        }
        if (prop === 'get') {
          return async () => {
            const col = await getCol();
            const data = await col.find({}).toArray();
            return { data: data.map(normalizeDoc) };
          };
        }
        if (prop === 'aggregate') {
          return (pipeline?: Document[]) => {
            const stages: Document[] = pipeline || [];
            const builder = {
              match(q: Record<string, any>) {
                stages.push({ $match: translateQuery(q) });
                return builder;
              },
              sample(opts: { size: number }) {
                stages.push({ $sample: opts });
                return builder;
              },
              group(spec: Record<string, any>) {
                stages.push({ $group: spec });
                return builder;
              },
              unwind(fieldPath: string | { path: string; preserveNullAndEmptyArrays?: boolean }) {
                stages.push({ $unwind: fieldPath });
                return builder;
              },
              sort(spec: Record<string, 1 | -1>) {
                stages.push({ $sort: spec });
                return builder;
              },
              project(spec: Record<string, any>) {
                stages.push({ $project: spec });
                return builder;
              },
              addFields(spec: Record<string, any>) {
                stages.push({ $addFields: spec });
                return builder;
              },
              limit(n: number) {
                stages.push({ $limit: n });
                return builder;
              },
              skip(n: number) {
                stages.push({ $skip: n });
                return builder;
              },
              async end() {
                const col = await getCol();
                const data = await col.aggregate(stages).toArray();
                return { data: data.map(normalizeDoc) };
              }
            };
            return builder;
          };
        }
        return undefined;
      }
    });
  }
}

// ==================== cloud.fetch() — axios 兼容 ====================

async function cloudFetch(config: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  responseType?: string;
  maxContentLength?: number;
  maxBodyLength?: number;
}): Promise<{ data: any; status: number; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timeoutId = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : null;

  try {
    const fetchOpts: RequestInit = {
      method: (config.method || 'GET').toUpperCase(),
      headers: config.headers || {},
      signal: controller.signal
    };

    if (config.data && fetchOpts.method !== 'GET' && fetchOpts.method !== 'HEAD') {
      if (typeof config.data === 'object' && !(config.data instanceof Buffer)) {
        fetchOpts.body = JSON.stringify(config.data);
        if (!(fetchOpts.headers as Record<string, string>)['Content-Type']) {
          (fetchOpts.headers as Record<string, string>)['Content-Type'] = 'application/json';
        }
      } else {
        fetchOpts.body = config.data;
      }
    }

    const response = await fetch(config.url, fetchOpts);
    const respHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      respHeaders[key] = val;
    });

    let data: any;
    if (config.responseType === 'arraybuffer') {
      data = Buffer.from(await response.arrayBuffer());
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return { data, status: response.status, headers: respHeaders };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ==================== cloud.storage — 本地文件存储 ====================

const STORAGE_DIR = process.env.STORAGE_DIR || '/app/storage';

const storage = {
  bucket(_name: string) {
    return {
      async putObject(key: string, buffer: Buffer, options: { ContentType: string }) {
        const filePath = path.join(STORAGE_DIR, key);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, buffer);
        // 可选：写入 meta 文件记录 content-type
        await fs.promises.writeFile(filePath + '.meta', JSON.stringify({ contentType: options.ContentType }));
      },
      async getObjectUrl(key: string) {
        // 返回相对 URL，由 Express 提供静态文件服务
        return `/storage/${key}`;
      }
    };
  }
};

// ==================== cloud.fetch 短写法支持 ====================
// 为 cloudFetch 函数附加 .get() / .post() / .put() / .delete() / .head() / .patch() 方法
// 兼容 axios 风格短写法，例如 cloud.fetch.get(url) 或 cloud.fetch.post(url, data)

type CloudFetchConfig = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  responseType?: string;
  maxContentLength?: number;
  maxBodyLength?: number;
};
type CloudFetchResult = Promise<{ data: any; status: number; headers: Record<string, string> }>;

interface CloudFetchFn {
  (config: CloudFetchConfig): CloudFetchResult;
  get(url: string, config?: Omit<CloudFetchConfig, 'url' | 'method'>): CloudFetchResult;
  post(url: string, data?: any, config?: Omit<CloudFetchConfig, 'url' | 'method' | 'data'>): CloudFetchResult;
  put(url: string, data?: any, config?: Omit<CloudFetchConfig, 'url' | 'method' | 'data'>): CloudFetchResult;
  delete(url: string, config?: Omit<CloudFetchConfig, 'url' | 'method'>): CloudFetchResult;
  head(url: string, config?: Omit<CloudFetchConfig, 'url' | 'method'>): CloudFetchResult;
  patch(url: string, data?: any, config?: Omit<CloudFetchConfig, 'url' | 'method' | 'data'>): CloudFetchResult;
}

// 把短写法方法挂到 cloudFetch 函数上
const fetchWithShortcuts = cloudFetch as CloudFetchFn;

fetchWithShortcuts.get = (url, config = {}) => cloudFetch({ ...config, url, method: 'GET' });

fetchWithShortcuts.post = (url, data?, config = {}) => cloudFetch({ ...config, url, method: 'POST', data });

fetchWithShortcuts.put = (url, data?, config = {}) => cloudFetch({ ...config, url, method: 'PUT', data });

fetchWithShortcuts.delete = (url, config = {}) => cloudFetch({ ...config, url, method: 'DELETE' });

fetchWithShortcuts.head = (url, config = {}) => cloudFetch({ ...config, url, method: 'HEAD' });

fetchWithShortcuts.patch = (url, data?, config = {}) => cloudFetch({ ...config, url, method: 'PATCH', data });

// ==================== cloud 主对象 ====================

// 使用 AsyncLocalStorage 隔离每个请求的 response 对象，避免并发竞态
const responseStorage = new AsyncLocalStorage<http.ServerResponse>();

export function setCurrentResponse(res: http.ServerResponse) {
  // 向后兼容：仍然保留全局引用作为最后的 fallback
  _fallbackRes = res;
}

let _fallbackRes: http.ServerResponse | null = null;

export function runWithResponse<T>(res: http.ServerResponse, fn: () => T): T {
  return responseStorage.run(res, fn);
}

const cloud = {
  database: () => new DatabaseWrapper(),
  fetch: fetchWithShortcuts,
  storage,
  get res() {
    // 优先从 AsyncLocalStorage 获取当前请求的 response
    return responseStorage.getStore() || _fallbackRes;
  }
};

export default cloud;
export { getDb, ObjectId };
