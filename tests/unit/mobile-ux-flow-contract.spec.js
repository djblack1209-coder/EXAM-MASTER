import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function registeredRoutes() {
  const pagesConfig = JSON.parse(readSource('src/pages.json'));
  const routes = new Set((pagesConfig.pages || []).map((page) => `/${page.path}`));
  for (const pkg of pagesConfig.subPackages || []) {
    for (const page of pkg.pages || []) {
      routes.add(`/${pkg.root}/${page.path}`);
    }
  }
  return routes;
}

function literalPageRoutes(source) {
  return Array.from(source.matchAll(/['"`](\/pages\/[^'"`\s,)]+)['"`]/g), (match) => match[1].split('?')[0]).filter(
    (route) => !route.includes('${')
  );
}

function templateBlock(source) {
  return source.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '';
}

function visibleTemplateText(source) {
  return templateBlock(source)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function vueFilesUnder(relativeDir) {
  const dir = path.join(root, relativeDir);
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...vueFilesUnder(relativePath));
    } else if (entry.name.endsWith('.vue')) {
      files.push(relativePath);
    }
  }
  return files;
}

const userFacingFiles = [
  'src/pages/index/index.vue',
  'src/pages/practice/index.vue',
  'src/pages/practice-sub/question-bank.vue',
  'src/pages/practice-sub/do-quiz.vue',
  'src/pages/practice-sub/sprint-mode.vue',
  'src/pages/practice-sub/components/quiz-result/quiz-result.vue',
  'src/pages/practice-sub/components/quiz-result/TutorFeedbackCard.vue',
  'src/pages/login/index.vue',
  'src/pages/login/onboarding.vue',
  'src/pages/profile/index.vue',
  'src/components/common/EmptyState.vue',
  'src/composables/useNavigation.js',
  'src/composables/usePracticeNavigation.js',
  'src/services/mobile-shell-contract.js',
  'src/pages/practice-sub/composables/ai-generation-mixin.js',
  'src/pages/practice-sub/composables/learning-stats-mixin.js',
  'src/pages/practice-sub/utils/practice-mode-manager.js',
  'src/components/business/practice/QuizManageModal.vue'
];

const forbiddenInternalTerms = [
  '题源',
  '清洗',
  '证据门禁',
  '发布链路',
  '发布状态',
  '发布台',
  'RESOURCE',
  'PIPELINE',
  'PUBLIC COURSE',
  'Source Manifest',
  'source gated',
  'release ready',
  '来源校验',
  'hash',
  'PUBLIC BETA',
  'DEMO MODE',
  'TRAINING READY',
  'TODAY CLEAR',
  'FSRS复习',
  'PAST EXAM',
  'START PATH',
  'DAILY RHYTHM',
  'KNOWLEDGE MAP',
  'AI Tutor',
  'AI 推荐',
  'AI建议'
];

const forbiddenVisibleTemplateTerms = [
  'START PATH',
  'DAILY RHYTHM',
  'KNOWLEDGE MAP',
  'AI Tutor',
  'AI 推荐',
  'AI建议',
  'AI ',
  'E2E',
  'Mock',
  'FSRS',
  'ROI',
  'Top 5',
  '高 ROI',
  '后端',
  '接口',
  '缓存',
  '算法',
  '清洗',
  '门禁',
  'PIPELINE',
  'RESOURCE'
];

describe('mobile user-facing UX flow contracts', () => {
  it('keeps production-facing copy focused on user actions rather than internal processing terms', () => {
    const violations = [];

    for (const file of userFacingFiles) {
      const source = readSource(file);
      for (const term of forbiddenInternalTerms) {
        if (source.includes(term)) violations.push(`${file}: ${term}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps visible page text free of internal implementation, testing, and model labels', () => {
    const violations = [];
    const files = [...vueFilesUnder('src/pages'), ...vueFilesUnder('src/components')];

    for (const file of files) {
      const visibleText = visibleTemplateText(readSource(file));
      for (const term of forbiddenVisibleTemplateTerms) {
        if (visibleText.includes(term)) violations.push(`${file}: ${term}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the home page calm, actionable, and linked to the knowledge map', () => {
    const source = readSource('src/pages/index/index.vue');

    expect(source).toContain('先用示例题熟悉节奏，再围绕知识图谱推进复习。');
    expect(source).toContain('nextActionCards');
    expect(source).toContain('openKnowledgeMap');
    expect(source).toContain("storageService.save('practice_preferred_mode', 'knowledge_graph')");
    expect(source).toContain('今日计划');
    expect(source).toContain('今日重点');
    expect(source).toContain("{ id: 'today', label: '今日' }");
    expect(source).toContain("{ id: 'bank', label: '题库' }");
    expect(source).toContain("{ id: 'review', label: '复习' }");
    expect(source).not.toContain('knowledge-node-label');
  });

  it('renders a zoomable Xmind-style knowledge graph with atomic nodes hidden behind dots', () => {
    const source = readSource('src/pages/practice/index.vue');

    expect(source).toContain('knowledge-system-canvas');
    expect(source).toContain('knowledge-system-scroll');
    expect(source).toContain('knowledge-map-controls');
    expect(source).toContain('zoomKnowledgeGraph');
    expect(source).toContain('knowledge-atom-dot');
    expect(source).toContain('<text v-if="!node.atomic" class="knowledge-system-label">{{ node.label }}</text>');
    expect(source).toContain('selectKnowledgeGraphNode(node)');
    expect(source).toContain('knowledge-node-detail');
    expect(source).toContain('点一下末端小点查看细节');
    expect(source).toContain('consumePreferredMode');
    expect(source).toContain('currentPracticeSectionTitle()');
    expect(source).toContain("if (this.isKnowledgeGraphMode) return majorLabelFromProfile(this.knowledgeGraphProfile);");
    expect(source).toContain('currentPracticeSectionMeta()');
    expect(source).toContain("`${this.knowledgeGraphModel.tracks.length} 条主线`");
    expect(source).toContain('buildNodePathText(node, rootLabel, graph.tracks)');
    expect(source).toContain("if (trackId === 'law_illegal') return '专业课';");
  });

  it('keeps no-bank and empty-bank recovery paths honest without dead-end loops', () => {
    const home = readSource('src/pages/index/index.vue');
    const practice = readSource('src/pages/practice/index.vue');
    const doQuiz = readSource('src/pages/practice-sub/do-quiz.vue');
    const navigation = readSource('src/composables/useNavigation.js');
    const practiceNavigation = readSource('src/composables/usePracticeNavigation.js');
    const emptyState = readSource('src/components/common/EmptyState.vue');

    expect(home).toContain("startGuestDemoPractice({ destination: 'quiz' })");
    expect(practice).toContain("startGuestDemoPractice({ destination: 'quiz' })");
    expect(practice).toContain("uni.showToast({ title: '当前暂无可练题', icon: 'none' })");
    expect(doQuiz).toContain('当前没有可训练题。可以先查看题库，或体验示例题熟悉流程。');
    expect(doQuiz).toContain('confirm-text="查看题库"');
    expect(navigation).toContain('当前暂无可练题');
    expect(practiceNavigation).toContain("toast.info('当前暂无可练题，请查看题库')");
    expect(emptyState).toContain('查看可练题目');
  });

  it('lets law-illegal users configure a professional track that can feed the graph root', () => {
    const onboarding = readSource('src/pages/login/onboarding.vue');

    expect(onboarding).toContain('法律非法学');
    expect(onboarding).toContain("major: selectedTracks.value.includes('law_illegal') ? '法律非法学' : ''");
    expect(onboarding).toContain("subject === 'professional'");
  });

  it('keeps onboarding concise and avoids misleading map previews for professional tracks', () => {
    const onboarding = readSource('src/pages/login/onboarding.vue');

    expect(onboarding).toContain('备考路径');
    expect(onboarding).toContain('每日强度');
    expect(onboarding).toContain('知识图谱');
    expect(onboarding).toContain('selectedPreviewNodes');
    expect(onboarding).toContain("id: 'law-subject'");
    expect(onboarding).toContain("label: '专业课'");
    expect(onboarding).not.toContain('<text class="eyebrow">START PATH</text>');
    expect(onboarding).not.toContain('<text class="eyebrow">DAILY RHYTHM</text>');
    expect(onboarding).not.toContain('<text class="eyebrow">KNOWLEDGE MAP</text>');
    expect(onboarding).not.toContain("{ id: 'c', label: '高数'");
  });

  it('keeps question-bank browsing user-facing and simple', () => {
    const source = readSource('src/pages/practice-sub/question-bank.vue');

    expect(source).toContain('考研题库');
    expect(source).toContain('可练题目会按科目分类显示');
    expect(source).toContain('可练题量');
    expect(source).toContain('科目分类');
    expect(source).toContain('暂无可练题；可以先去刷题中心体验示例题');
  });

  it('keeps smart review copy benefit-led rather than algorithm-led', () => {
    const template = templateBlock(readSource('src/pages/practice-sub/smart-review.vue'));

    expect(template).toContain('先补最容易忘的内容');
    expect(template).toContain('正在整理今日复习');
    expect(template).not.toContain('FSRS');
    expect(template).not.toContain('算法');
    expect(template).not.toContain('AI 诊断');
  });

  it('keeps core visible navigation targets registered in pages.json', () => {
    const routes = registeredRoutes();
    const misses = userFacingFiles.flatMap((file) =>
      literalPageRoutes(readSource(file))
        .filter((route) => !routes.has(route))
        .map((route) => `${file} -> ${route}`)
    );

    expect(misses).toEqual([]);
  });
});
