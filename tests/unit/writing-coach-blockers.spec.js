import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { storageService } from '@/services/storageService.js';
import { resolveSkippedProfile, COACH_EXAMS } from '@/services/learning/coach-profile.js';
import { parsePastedMaterial } from '@/services/learning/material-intake.js';

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn(),
  onHide: vi.fn(),
  onLoad: vi.fn(),
  onBackPress: vi.fn()
}));

const TOKEN = 'synthetic-blocker-session-token';
const paused = new Promise(() => {});

vi.mock('@/services/api/domains/learning.api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateLearningTurn: vi.fn(() => paused),
    fetchLearningModels: vi.fn(async () => ({
      success: true,
      data: {
        platformEnabled: true,
        presets: [],
        models: [
          {
            id: 'synthetic-model',
            provider: 'synthetic',
            model: 'synthetic-model',
            source: 'platform',
            configured: true,
            capabilities: { structured: true }
          }
        ]
      }
    }))
  };
});

function freshStore() {
  uni.clearStorageSync();
  storageService.save('EXAM_USER_ID', 'synthetic-blocker-owner', true);
  storageService.save('EXAM_TOKEN', TOKEN, true);
  setActivePinia(createPinia());
  const store = useConversationLearningStore();
  store.startCoach('考研英语二写作');
  store.sharingAllowed = true;
  return store;
}

const material = (text) => parsePastedMaterial(text, `m_${Math.random().toString(36).slice(2, 8)}`);

beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});

describe('跳过建档保留已明确的考试类型', () => {
  it('英语二被保留，不被改写成英语一', () => {
    expect(resolveSkippedProfile({ exam: 'english2' }).exam).toBe('english2');
  });

  it('英语一同样保留', () => {
    expect(resolveSkippedProfile({ exam: 'english1' }).exam).toBe('english1');
  });

  it('从未选择、从未推断时回落英语一，并补齐其余默认值', () => {
    const profile = resolveSkippedProfile({ exam: '', minutes: '25', foundation: '写了点东西' });
    expect(profile).toEqual({
      exam: 'english1',
      deadline: `${new Date().getFullYear()}-12-22`,
      minutes: 25,
      foundation: null,
      subjects: [],
      track: 'kaoyan-english-writing'
    });
  });

  it('跳过时保留用户已点选的准备方向', () => {
    expect(resolveSkippedProfile({ subject: 'gongkao_shenlun', subjects: ['kaoyan_math'] }).subjects).toEqual([
      'gongkao_shenlun',
      'kaoyan_math'
    ]);
  });

  it('非法准备方向被丢弃，不写进档案', () => {
    expect(resolveSkippedProfile({ subject: 'made-up', subjects: ['also-made-up'] }).subjects).toEqual([]);
  });

  it('非法考试类型回落英语一，不把脏值写进档案', () => {
    expect(resolveSkippedProfile({ exam: 'english3' }).exam).toBe('english1');
    expect(COACH_EXAMS).toContain(resolveSkippedProfile({}).exam);
  });

  it('未传参数也不崩', () => {
    expect(resolveSkippedProfile().exam).toBe('english1');
  });
});

describe('资料保存与绑定是一个整体', () => {
  it('没有在建档案时拒绝，且一个版本都不推进', () => {
    const store = useConversationLearningStore();
    const materialsBefore = store.state.materials.length;
    const revisionBefore = store.state.revision;
    expect(() => store.attachMaterial(material('浮力是竖直向上的'))).toThrow('请回到当前带练');
    // revision 只在真的写入后才前进，是「一笔都没写」的直接证据。
    expect(store.state.revision).toBe(revisionBefore);
    expect(store.state.materials.length).toBe(materialsBefore);
  });

  it('正常路径：资料已保存且已绑定到当前带练', () => {
    const store = freshStore();
    const before = store.state.materials.length;
    const id = store.attachMaterial(material('均衡价格由供给与需求共同决定')).id;
    expect(store.state.materials.length).toBe(before + 1);
    expect(store.active.coach.materialIds).toContain(id);
  });

  it('粘贴入口同样一次完成保存与绑定', () => {
    const store = freshStore();
    const before = store.state.materials.length;
    store.attachText('光合作用把光能转成化学能');
    expect(store.state.materials.length).toBe(before + 1);
    expect(store.active.coach.materialIds).toHaveLength(1);
  });

  it('同一份资料再传一次只绑定一次，且绑的是已存在的规范 id', () => {
    const store = freshStore();
    const text = '一次函数图像是一条直线';
    const sealed = { ...parsePastedMaterial(text, 'm_dup_first') };
    sealed.fingerprint = 'synthetic-fingerprint';
    const first = store.attachMaterial(JSON.parse(JSON.stringify(sealed)));
    const twice = { ...JSON.parse(JSON.stringify(sealed)), id: 'm_dup_second' };
    const second = store.attachMaterial(twice);
    expect(second.id).toBe(first.id);
    expect(store.active.coach.materialIds).toEqual([first.id]);
    expect(store.state.materials.filter((m) => m.fingerprint === 'synthetic-fingerprint')).toHaveLength(1);
  });

  it('模型请求在途时导入资料：整笔拒绝，不留「已保存未绑定」的半写入', async () => {
    const store = freshStore();
    store.coachSave('profile', {
      profile: { exam: 'english2', deadline: '2026-12-22', minutes: 25 }
    });
    store.modelId = 'synthetic-model';
    store.models = [
      {
        id: 'synthetic-model',
        provider: 'synthetic',
        model: 'synthetic-model',
        source: 'platform',
        configured: true,
        capabilities: {}
      }
    ];
    const pending = store.requestCoach('diagnostic');
    for (let i = 0; i < 12; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.busy).toBe(true);

    const materialsBefore = store.state.materials.length;
    const revisionBefore = store.state.revision;
    const boundBefore = [...store.active.coach.materialIds];
    expect(() => store.attachMaterial(material('需求曲线向右下方倾斜'))).toThrow('请回到当前带练，等待请求结束');

    // 关键：版本未推进、没有新增资料、也没有产生未绑定的孤儿资料。
    expect(store.state.revision).toBe(revisionBefore);
    expect(store.state.materials.length).toBe(materialsBefore);
    expect(store.active.coach.materialIds).toEqual(boundBefore);
    pending.catch(() => {});
  });
});
