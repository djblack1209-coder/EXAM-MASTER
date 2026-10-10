import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import fixture from '../fixtures/docling-page.json';
import {
  validMaterialLayout,
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import { parseConnectedMaterial, testMaterialConnector } from '@/services/learning/material-connector.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { pendingUploadJournal } from '@/services/learning/pending-upload-journal.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import MaterialLayout from '@/components/business/learning/material-layout.vue';
import LearningPage from '@/pages/learning/index.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const storageId = 'b'.repeat(32),
  contract = 'yozi-docling-page-v1';
const cap = () => ({
  available: true,
  contract,
  status: 'files_verified',
  runtime: 'macos_connector',
  recognitionState: 'not_tested',
  maxBytes: 10485760,
  maxPagesPerRequest: 1,
  dataFlow: 'authorized_local_connector',
  extraCloudCost: 0
});
const connection = () => ({
  endpoint: 'http://127.0.0.1:8765/parse',
  allowedOrigins: ['http://127.0.0.1:8765'],
  consent: true,
  token: 'TEST_ONLY_DOCLING_CLIENT_32_CHARACTER_TOKEN',
  capabilities: { docling: cap(), uploadRecovery: { available: true, contract: 'wenli-upload-v1', storageId } }
});
const clone = (value) => JSON.parse(JSON.stringify(value));
// Recorded Docling output from Yozi's original synthetic PDF. Only its preview
// bitmap is replaced by a tiny placeholder; tests do not claim visual accuracy.
function material(page = 2, total = 2, ocr = false) {
  const value = clone(fixture);
  value.recognitionAllowed = ocr;
  value.totalPages = total;
  value.nextPage = page < total ? page + 1 : null;
  const s = value.segments[0];
  s.page = page;
  s.id = `page-${page}`;
  s.location.page = page;
  s.method = ocr ? 'docling_rapidocr' : 'docling_structure';
  s.blocks.forEach((block) => {
    block.page = page;
  });
  return value;
}
const input = (extra = {}) => ({
  fileId: fixture.fingerprint,
  storageId,
  startPage: 2,
  size: 0,
  recognitionEngine: 'docling',
  allowRecognition: false,
  ...extra
});
const response = (data) => ({ ok: true, text: async () => JSON.stringify({ success: true, data }) });
let store;
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.materialConnection = connection();
});
afterEach(() => {
  store.$dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('recorded layout retains table cells, formula original and picture children through domain, sync normalization and restore', () => {
  const value = material();
  expect(validMaterialLayout(value)).toBe(true);
  store.commit('material.add', { material: value });
  const operation = store.state.events.find((event) => event.type === 'material.add');
  const saved = applyLearningOperation(
    emptyLearningState('guest'),
    normalizePrivateSyncOperation(clone(operation))
  ).state;
  expect(saved.materials[0].segments[0].blocks).toEqual(value.segments[0].blocks);
  expect(saved.attempts).toEqual([]);
  expect(saved.reviews).toEqual([]);
  const restored = prepareLearningRestore(emptyLearningState('guest'), store.exportData());
  expect(restored.state.materials[0].segments[0].content).toContain('x != 1');
  expect(restored.state.materials[0].segments[0].blocks).toEqual(value.segments[0].blocks);
});
it.each([
  'grading',
  'review',
  'source',
  'page',
  'overlap',
  'missing_cell',
  'false_table',
  'outside',
  'nan',
  'formula',
  'words',
  'duplicate',
  'remote_preview'
])('invalid %s is rejected before any learning state is written', (field) => {
  const value = material(),
    segment = value.segments[0],
    table = segment.blocks.find((b) => b.kind === 'table');
  if (field === 'grading') value.gradingAuthority = true;
  if (field === 'review') segment.reviewRequired = false;
  if (field === 'source') segment.sourceSha256 = 'a'.repeat(64);
  if (field === 'page') table.page = 1;
  if (field === 'overlap') table.cells[1] = clone(table.cells[0]);
  if (field === 'missing_cell') table.cells.pop();
  if (field === 'false_table') segment.blocks.find((b) => b.id.startsWith('#/texts/')).kind = 'table';
  if (field === 'outside') table.bbox[2] = 20000;
  if (field === 'nan') table.bbox[0] = NaN;
  if (field === 'formula') segment.blocks.find((b) => b.kind === 'formula').rawText = 'changed';
  if (field === 'words') segment.words[0].role = 'answer_key';
  if (field === 'duplicate') segment.blocks.push(clone(table));
  if (field === 'remote_preview') segment.preview = 'https://untrusted.invalid/private';
  expect(validMaterialLayout(value)).toBe(false);
  const before = store.exportData();
  expect(() => store.commit('material.add', { material: value })).toThrow();
  expect(store.exportData()).toBe(before);
});
it.each(['missing', 'accuracy', 'runtime', 'pages', 'cost'])('capability %s does not enable uploads', async (kind) => {
  const value = cap();
  if (kind === 'accuracy') value.recognitionState = 'accuracy_verified';
  if (kind === 'runtime') value.runtime = 'cloud';
  if (kind === 'pages') value.maxPagesPerRequest = 5;
  if (kind === 'cost') value.extraCloudCost = 1;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response({ version: 'v3', ocrEngines: { docling: kind === 'missing' ? undefined : value } }))
  );
  const checked = await testMaterialConnector(connection(), { platform: 'h5' });
  expect(checked.ocrEngines.docling.available).toBe(false);
});
it('one-page progress is saved in order, stops at four pages, and preserves false OCR on every request', async () => {
  const batches = [],
    progress = [],
    requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return response(material(body.startPage, 7));
    })
  );
  const result = await parseConnectedMaterial(connection(), input({ startPage: 1 }), {
    platform: 'h5',
    onBatch: (value) => batches.push(value),
    onProgress: (value) => progress.push(value.completed)
  });
  expect(result.nextPage).toBe(5);
  expect(result.pagesPerAction).toBe(4);
  expect(progress).toEqual([1, 2, 3, 4]);
  expect(batches).toHaveLength(4);
  expect(
    requests.every((body) => body.ocrEngine === 'docling' && body.allowOCR === false && body.storageId === storageId)
  ).toBe(true);
  expect(batches[0].original.storageId).toBe(storageId);
});
it.each(['target', 'backward', 'skip', 'ocr', 'size'])(
  'wrong %s receipt is rejected without saving the batch',
  async (field) => {
    const value = material(2, 5);
    if (field === 'target') {
      value.fingerprint = 'a'.repeat(64);
    }
    if (field === 'backward') value.nextPage = 2;
    if (field === 'skip') value.nextPage = 4;
    if (field === 'ocr') value.recognitionAllowed = true;
    if (field === 'size') value.original.byteLength = 0;
    const batch = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(value))
    );
    await expect(
      parseConnectedMaterial(connection(), input(), { platform: 'h5', onBatch: batch })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(batch).not.toHaveBeenCalled();
  }
);
it('changed storage and missing OCR decision are refused before sending, with the seven-field journal unchanged', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  for (const extra of [{ storageId: 'c'.repeat(32) }, { allowRecognition: undefined }])
    await expect(parseConnectedMaterial(connection(), input(extra), { platform: 'h5' })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  const [entry] = pendingUploadJournal.add(
    {
      id: 'upload_docling_pending',
      connectorOrigin: 'http://127.0.0.1:8765',
      storageId,
      size: 4357,
      recognitionAllowed: false,
      recognitionEngine: 'docling'
    },
    'guest'
  );
  expect(Object.keys(entry)).toHaveLength(7);
  expect(entry.recognitionEngine).toBe('docling');
});
it('cancel during second page keeps first saved page, does not save late response, and can resume', async () => {
  let resolve,
    requestCount = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_, options) => {
      requestCount++;
      const body = JSON.parse(options.body);
      if (requestCount === 1) return response(material(body.startPage, 2));
      return new Promise((done) => {
        resolve = () => done(response(material(2, 2)));
      });
    })
  );
  const pending = store.importFile(input({ startPage: 1 }));
  const rejected = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  expect(store.state.materials[0].segments).toHaveLength(1);
  store.cancelMaterial();
  resolve();
  await rejected;
  expect(store.state.materials[0].nextPage).toBe(2);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(material(2, 2)))
  );
  await store.importFile(input({ materialId: store.state.materials[0].id }));
  expect(store.state.materials).toHaveLength(1);
  expect(store.state.materials[0].segments.map((s) => s.page)).toEqual([1, 2]);
  expect(store.state.attempts).toEqual([]);
  expect(store.state.reviews).toEqual([]);
});
it('preview region and cell selection are drafts, raw formula preserved, and source change clears region selection', async () => {
  const value = material(),
    before = JSON.stringify(value),
    segment = value.segments[0];
  const wrapper = mount(MaterialLayout, { props: { segment } });
  try {
    const table = segment.blocks.findIndex((b) => b.kind === 'table');
    await wrapper.get(`[data-test="layout-region-${table}"]`).trigger('tap');
    await wrapper.get('[data-test="layout-cell-5"]').trigger('tap');
    expect(wrapper.get('[data-test="layout-cell-5"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="layout-highlight"]').attributes('style')).toContain('left:');
    const formula = segment.blocks.findIndex((b) => b.kind === 'formula');
    await wrapper.get(`[data-test="layout-region-${formula}"]`).trigger('tap');
    expect(wrapper.get('[data-test="layout-raw-text"]').text()).toContain('x != 1');
    expect(wrapper.text()).toContain('上下标');
    expect(JSON.stringify(value)).toBe(before);
    await wrapper.setProps({ segment: clone(segment) });
    expect(wrapper.get('[data-test="layout-region-0"]').attributes('aria-pressed')).toBe('true');
  } finally {
    wrapper.unmount();
  }
});
it('page offers layout without enabling OCR, changing choices writes no facts, unavailable capability disables it', async () => {
  const before = store.exportData(),
    wrapper = mount(LearningPage);
  try {
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '资料')
      .trigger('tap');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '解析设置')
      .trigger('tap');
    await wrapper.get('[data-test="docling-choice"]').trigger('tap');
    expect(wrapper.get('[data-test="docling-choice"]').attributes('aria-pressed')).toBe('true');
    expect(store.exportData()).toBe(before);
    store.materialConnection.capabilities.docling.available = false;
    await flushPromises();
    expect(wrapper.get('[data-test="docling-choice"]').attributes('disabled')).toBeDefined();
  } finally {
    wrapper.unmount();
  }
});
it('page picker follows saved batches while the selected page and edited draft remain unchanged', async () => {
  store.commit('material.add', { material: material(1) });
  const wrapper = mount(LearningPage);
  const button = (name) => wrapper.findAll('button').find((b) => b.text().trim() === name);
  try {
    await button('资料').trigger('tap');
    await button('用此资料练习').trigger('tap');
    await wrapper.get('textarea[aria-label="题目"]').setValue('保留正在编辑的草稿');
    store.commit('material.add', { material: material(2) });
    await flushPromises();
    expect(button('第 2 页')).toBeDefined();
    expect(wrapper.get('textarea[aria-label="题目"]').element.value).toBe('保留正在编辑的草稿');
    expect(wrapper.get('[data-test="material-layout"]').text()).toContain('第 1 页');
    await button('第 2 页').trigger('tap');
    expect(wrapper.get('[data-test="material-layout"]').text()).toContain('第 2 页');
    expect(store.state.attempts).toHaveLength(0);
    expect(store.state.reviews).toHaveLength(0);
  } finally {
    wrapper.unmount();
  }
});
