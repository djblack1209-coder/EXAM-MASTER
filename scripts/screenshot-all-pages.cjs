/**
 * 微信小程序全页面自动截图脚本
 * 使用 miniprogram-automator 连接微信开发者工具
 * 自动导航到每个页面并截取截图
 */
const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

// 所有页面列表
const TAB_PAGES = ['pages/index/index', 'pages/practice/index', 'pages/school/index', 'pages/profile/index'];

const NORMAL_PAGES = [
  // 启动页
  'pages/splash/index',
  // 登录相关
  'pages/login/index',
  'pages/login/onboarding',
  // 刷题子包
  'pages/practice-sub/question-bank',
  'pages/practice-sub/import-data',
  'pages/practice-sub/rank',
  'pages/practice-sub/pk-battle',
  'pages/practice-sub/do-quiz',
  'pages/practice-sub/file-manager',
  'pages/practice-sub/mock-exam',
  'pages/practice-sub/diagnosis-report',
  'pages/practice-sub/smart-review',
  'pages/practice-sub/error-clusters',
  'pages/practice-sub/sprint-mode',
  // 择校子包
  'pages/school-sub/detail',
  'pages/school-sub/ai-consult',
  // 设置
  'pages/settings/index',
  'pages/settings/privacy',
  'pages/settings/terms',
  // 社交
  'pages/social/friend-list',
  'pages/social/friend-profile',
  // 聊天
  'pages/chat/chat',
  // 错题
  'pages/mistake/index',
  // 收藏
  'pages/favorite/index',
  // 学习计划
  'pages/plan/index',
  'pages/plan/create',
  'pages/plan/adaptive',
  // 学习详情
  'pages/study-detail/index',
  // 工具
  'pages/tools/photo-search',
  'pages/tools/id-photo',
  'pages/tools/doc-convert',
  'pages/tools/focus-timer',
  // 知识图谱
  'pages/knowledge-graph/index',
  'pages/knowledge-graph/mastery',
  // AI 课堂
  'pages/ai-classroom/index',
  'pages/ai-classroom/classroom'
];

// 把页面路径转为文件名
function pageToFilename(pagePath) {
  return pagePath.replace(/\//g, '_');
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshotPage(mp, pagePath, isTab) {
  const filename = pageToFilename(pagePath);
  const filepath = path.join(SCREENSHOT_DIR, `${filename}.png`);

  try {
    if (isTab) {
      await mp.switchTab('/' + pagePath);
    } else {
      await mp.reLaunch('/' + pagePath);
    }
    // 等待页面渲染
    await delay(2000);

    // 截取当前视图
    await mp.screenshot({ path: filepath });
    console.log(`✅ ${pagePath} → ${filename}.png`);

    // 尝试获取页面高度，判断是否需要滚动截图
    const page = await mp.currentPage();
    try {
      const scrollInfo = await page.evaluate(() => {
        // 获取页面滚动高度
        const query = wx.createSelectorQuery();
        return new Promise((resolve) => {
          query
            .selectViewport()
            .scrollOffset((res) => {
              resolve({
                scrollTop: res ? res.scrollTop : 0
              });
            })
            .exec();
        });
      });

      // 尝试向下滚动截取更多内容
      const scrollPositions = [500, 1000, 1500];
      for (let i = 0; i < scrollPositions.length; i++) {
        try {
          await mp.pageScrollTo({ scrollTop: scrollPositions[i], duration: 300 });
          await delay(800);

          // 检查是否真的滚动了（页面够长）
          const afterScroll = await page.evaluate(() => {
            return new Promise((resolve) => {
              const query = wx.createSelectorQuery();
              query
                .selectViewport()
                .scrollOffset((res) => {
                  resolve(res ? res.scrollTop : 0);
                })
                .exec();
            });
          });

          if (afterScroll > 10) {
            const scrollFilepath = path.join(SCREENSHOT_DIR, `${filename}_scroll${i + 1}.png`);
            await mp.screenshot({ path: scrollFilepath });
            console.log(`  📸 ${pagePath} (滚动${scrollPositions[i]}px) → ${filename}_scroll${i + 1}.png`);
          } else {
            break; // 页面不够长，停止滚动
          }
        } catch (scrollErr) {
          break; // 滚动失败，跳过
        }
      }

      // 滚动回顶部
      try {
        await mp.pageScrollTo({ scrollTop: 0, duration: 0 });
      } catch (e) {}
    } catch (evalErr) {
      // evaluate 失败不影响主截图
    }

    return true;
  } catch (err) {
    console.log(`❌ ${pagePath} → 失败: ${err.message}`);
    return false;
  }
}

async function main() {
  // 确保截图目录存在
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('🔗 正在连接微信开发者工具...');
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  console.log('✅ 连接成功\n');

  const results = { success: [], failed: [] };

  // 1. 先截取 Tab 页面
  console.log('=== Tab 页面 ===');
  for (const page of TAB_PAGES) {
    const ok = await screenshotPage(mp, page, true);
    (ok ? results.success : results.failed).push(page);
  }

  // 2. 截取普通页面
  console.log('\n=== 普通页面 ===');
  for (const page of NORMAL_PAGES) {
    const ok = await screenshotPage(mp, page, false);
    (ok ? results.success : results.failed).push(page);
  }

  // 汇总
  console.log('\n========== 截图汇总 ==========');
  console.log(`✅ 成功: ${results.success.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log('失败页面:');
    results.failed.forEach((p) => console.log(`  - ${p}`));
  }

  mp.disconnect();
  console.log('\n🏁 截图任务完成');
}

main().catch((err) => {
  console.error('脚本错误:', err);
  process.exit(1);
});
