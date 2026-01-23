const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
// 注意：需确保 npm i miniprogram-automator pixelmatch pngjs -D 已执行
// 若无视觉相关库，脚本会自动降级运行
let pixelmatch, PNG;
try { 
  pixelmatch = require('pixelmatch'); 
  PNG = require('pngjs').PNG; 
} catch (e) {
  console.warn('视觉对比库未安装，将跳过视觉审计');
}

async function run() {
  const isClear = process.argv.includes('--clear');
  // 支持自定义端口：--port 56649 或环境变量
  const portIndex = process.argv.indexOf('--port');
  const port = portIndex > -1 && process.argv[portIndex + 1] 
    ? parseInt(process.argv[portIndex + 1]) 
    : (process.env.WX_PORT ? parseInt(process.env.WX_PORT) : 9420);
  
  let shadow;
  try {
    console.log(`>> 🔌 正在连接开发者工具端口 ${port}...`);
    // 使用 wsEndpoint 连接方式
    shadow = await automator.connect({ 
      wsEndpoint: `ws://localhost:${port}`
    });
    console.log(`>> ✅ 连接成功！`);
  } catch (e) {
    console.error(`❌ 无法连接到端口 ${port}`);
    console.error(`错误详情: ${e.message}`);
    console.error("请确认：");
    console.error("1. 开发者工具已启动");
    console.error("2. 服务端口已开启（当前配置：56649）");
    console.error("3. 防火墙未阻止本地连接");
    process.exit(1);
  }

  if (isClear) {
    // 清空日志
    try {
      await shadow.evaluate(() => {
        if (typeof getApp === 'function') {
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.qaLogs = [];
          }
        }
        if (typeof console !== 'undefined' && console.clear) {
          console.clear();
        }
      });
    } catch (e) {
      console.warn('清空日志失败，继续执行:', e.message);
    }
    
    // 清空旧截图
    if (fs.existsSync('./test/')) {
      try {
        fs.readdirSync('./test/').filter(f => f.startsWith('error_')).forEach(f => {
          try {
            fs.unlinkSync(path.join('./test/', f));
          } catch (e) {}
        });
      } catch (e) {}
    }
    console.log(">> 🚀 环境已净空");
  } else {
    // 收集日志
    let logs = [];
    try {
      logs = await shadow.evaluate(() => {
        if (typeof getApp === 'function') {
          const app = getApp();
          if (app && app.globalData && app.globalData.qaLogs) {
            return app.globalData.qaLogs;
          }
        }
        return [];
      });
    } catch (e) {
      console.warn('获取日志失败:', e.message);
    }
    
    // 收集存储信息
    let storage = [];
    try {
      storage = await shadow.evaluate(() => {
        try {
          const info = uni.getStorageInfoSync();
          return info.keys.map(k => ({ 
            key: k, 
            value: typeof uni.getStorageSync(k) === 'object' 
              ? JSON.stringify(uni.getStorageSync(k)).slice(0, 200) 
              : String(uni.getStorageSync(k)).slice(0, 200)
          }));
        } catch (e) {
          return [];
        }
      });
    } catch (e) {
      console.warn('获取存储信息失败:', e.message);
    }
    
    // 获取当前页面路径
    let currentPath = '';
    try {
      const currentPage = await shadow.currentPage();
      currentPath = currentPage ? currentPage.path : '';
    } catch (e) {
      console.warn('获取当前页面失败:', e.message);
    }
    
    const data = { logs, storage, currentPath };

    // 视觉审计逻辑
    const baselinePath = './test/baseline.png';
    if (pixelmatch && fs.existsSync(baselinePath)) {
      try {
        const screenshot = await shadow.screenshot();
        const curr = PNG.sync.read(screenshot);
        const base = PNG.sync.read(fs.readFileSync(baselinePath));
        // 简单容错处理：尺寸需一致
        if (curr.width === base.width && curr.height === base.height) {
          const diff = new PNG({ width: base.width, height: base.height });
          const pxDiff = pixelmatch(curr.data, base.data, diff.data, base.width, base.height, { threshold: 0.1 });
          data.visualDiffRatio = pxDiff / (base.width * base.height);
        }
      } catch (e) {
        console.warn('视觉对比失败:', e.message);
      }
    }

    // 异常截图
    const hasError = logs.some(l => 
      l.type.includes('FAIL') || 
      (l.data && l.data.statusCode && l.data.statusCode >= 400) ||
      (l.type === 'REQUEST_FAIL') ||
      (l.type === 'CLOUDFUNCTION_FAIL')
    );
    if (hasError) {
      try {
        const snapPath = `./test/error_${Date.now()}.png`;
        await shadow.screenshot({ path: snapPath });
        console.log(`>> 📸 发现异常，已截图: ${snapPath}`);
      } catch (e) {
        console.warn('截图失败:', e.message);
      }
    }

    // 确保目录存在
    if (!fs.existsSync('./test')) {
      fs.mkdirSync('./test', { recursive: true });
    }
    
    // 写入审计报告
    fs.writeFileSync('./test/timeline.json', JSON.stringify(data, null, 2));
    console.log(">> 📥 审计报告已生成: ./test/timeline.json");
    console.log(`>> 📊 日志条数: ${logs.length}, 存储项: ${storage.length}`);
  }
  
  await shadow.disconnect();
}

run().catch(err => {
  console.error('审计脚本执行失败:', err);
  process.exit(1);
});
