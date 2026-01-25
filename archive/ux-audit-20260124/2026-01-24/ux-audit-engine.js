/**
 * UX 审计引擎 - 五维深度体验分析
 * 基于产品体验官终极提示词
 */

const fs = require('fs');
const path = require('path');

// 审计配置
const AUDIT_CONFIG = {
    projectRoot: path.resolve(__dirname, '../..'),
    outputDir: path.resolve(__dirname),
    dimensions: {
        D1: '功能可用性审计',
        D2: '用户体验情绪曲线',
        D3: '加载性能与动画优化',
        D4: '功能布局与信息架构',
        D5: '增长与盈利策略'
    }
};

// 维度1: 功能可用性审计
class FunctionalityAuditor {
    constructor() {
        this.issues = {
            blocking: [],    // 🔴 阻塞级Bug
            friction: [],    // 🟡 体验摩擦
            optimization: [] // 🟢 优化建议
        };
    }

    async audit() {
        console.log('\n🔍 [维度1] 功能可用性审计...\n');

        // 分析核心页面
        await this.auditPages();

        // 分析服务层
        await this.auditServices();

        // 分析状态管理
        await this.auditStores();

        return this.generateReport();
    }

    async auditPages() {
        const pagesDir = path.join(AUDIT_CONFIG.projectRoot, 'src/pages');
        const criticalPages = [
            'practice/do-quiz.vue',      // 答题页面
            'practice/index.vue',        // 刷题首页
            'mistake/index.vue',         // 错题本
            'practice/pk-battle.vue',    // PK对战
            'chat/index.vue',            // AI助教
            'school/index.vue'           // 择校分析
        ];

        for (const page of criticalPages) {
            const filePath = path.join(pagesDir, page);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                this.analyzePage(page, content);
            }
        }
    }

    analyzePage(pageName, content) {
        const lines = content.split('\n');

        // 检测1: 缺少加载状态
        if (!content.includes('loading') && !content.includes('isLoading')) {
            this.issues.friction.push({
                page: pageName,
                issue: '缺少加载状态管理',
                impact: '用户在等待时无反馈，体验差',
                solution: '添加 loading 状态和骨架屏',
                clineTask: `添加加载状态到 ${pageName}`
            });
        }

        // 检测2: 缺少错误处理
        const hasTryCatch = content.includes('try') && content.includes('catch');
        const hasErrorHandling = content.includes('error') || content.includes('Error');
        if (!hasTryCatch && !hasErrorHandling) {
            this.issues.blocking.push({
                page: pageName,
                issue: '缺少错误处理机制',
                impact: '异常时应用崩溃或白屏',
                solution: '添加 try-catch 和错误提示',
                clineTask: `添加错误处理到 ${pageName}`
            });
        }

        // 检测3: 超时处理
        if (content.includes('request') || content.includes('lafService')) {
            if (!content.includes('timeout') && !content.includes('setTimeout')) {
                this.issues.friction.push({
                    page: pageName,
                    issue: '网络请求缺少超时处理',
                    impact: '网络慢时用户长时间等待',
                    solution: '添加请求超时和降级方案',
                    clineTask: `添加超时处理到 ${pageName}`
                });
            }
        }

        // 检测4: 空状态处理
        if (!content.includes('empty') && !content.includes('暂无数据')) {
            this.issues.optimization.push({
                page: pageName,
                issue: '可能缺少空状态提示',
                impact: '数据为空时显示空白',
                solution: '添加空状态组件',
                clineTask: `添加空状态到 ${pageName}`
            });
        }
    }

    async auditServices() {
        const servicesDir = path.join(AUDIT_CONFIG.projectRoot, 'src/services');
        const services = ['lafService.js', 'storageService.js', 'socialService.js'];

        for (const service of services) {
            const filePath = path.join(servicesDir, service);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                this.analyzeService(service, content);
            }
        }
    }

    analyzeService(serviceName, content) {
        // 检测: API 错误重试机制
        if (!content.includes('retry') && !content.includes('重试')) {
            this.issues.optimization.push({
                service: serviceName,
                issue: '缺少请求重试机制',
                impact: '网络波动时请求失败率高',
                solution: '添加自动重试逻辑（最多3次）',
                clineTask: `添加重试机制到 ${serviceName}`
            });
        }

        // 检测: 请求缓存
        if (serviceName === 'lafService.js' && !content.includes('cache')) {
            this.issues.optimization.push({
                service: serviceName,
                issue: '缺少请求缓存',
                impact: '重复请求浪费流量和时间',
                solution: '添加请求缓存层',
                clineTask: `添加缓存机制到 ${serviceName}`
            });
        }
    }

    async auditStores() {
        const storesDir = path.join(AUDIT_CONFIG.projectRoot, 'src/stores/modules');
        const stores = ['user.js', 'study.js', 'app.js'];

        for (const store of stores) {
            const filePath = path.join(storesDir, store);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                this.analyzeStore(store, content);
            }
        }
    }

    analyzeStore(storeName, content) {
        // 检测: 状态持久化
        if (!content.includes('persist') && !content.includes('storage')) {
            this.issues.optimization.push({
                store: storeName,
                issue: '状态未持久化',
                impact: '刷新后数据丢失',
                solution: '添加状态持久化',
                clineTask: `添加持久化到 ${storeName}`
            });
        }
    }

    generateReport() {
        const report = {
            dimension: 'D1 - 功能可用性审计',
            summary: {
                blocking: this.issues.blocking.length,
                friction: this.issues.friction.length,
                optimization: this.issues.optimization.length,
                total: this.issues.blocking.length + this.issues.friction.length + this.issues.optimization.length
            },
            issues: this.issues,
            priority: this.calculatePriority()
        };

        return report;
    }

    calculatePriority() {
        const allIssues = [
            ...this.issues.blocking.map(i => ({ ...i, level: 'blocking', score: 10 })),
            ...this.issues.friction.map(i => ({ ...i, level: 'friction', score: 5 })),
            ...this.issues.optimization.map(i => ({ ...i, level: 'optimization', score: 2 }))
        ];

        return allIssues
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Top 10
    }
}

// 维度2: 用户体验情绪曲线
class EmotionJourneyMapper {
    constructor() {
        this.journeys = {
            newUser: [],
            activeUser: [],
            paidUser: []
        };
    }

    async audit() {
        console.log('\n😊 [维度2] 用户体验情绪曲线分析...\n');

        // 分析新用户旅程
        this.analyzeNewUserJourney();

        // 分析活跃用户旅程
        this.analyzeActiveUserJourney();

        // 分析付费用户旅程
        this.analyzePaidUserJourney();

        return this.generateReport();
    }

    analyzeNewUserJourney() {
        // 新用户核心任务: 注册 → 首次刷题
        this.journeys.newUser = [
            {
                step: '启动应用',
                page: 'splash/index.vue',
                expectedTime: '2s',
                emotionScore: 8,
                touchpoints: ['启动动画', '品牌展示'],
                potentialIssues: ['启动时间过长', '动画卡顿']
            },
            {
                step: '微信授权登录',
                page: 'index/index.vue',
                expectedTime: '3s',
                emotionScore: 7,
                touchpoints: ['授权弹窗', '用户信息获取'],
                potentialIssues: ['授权失败无提示', '等待时间长']
            },
            {
                step: '查看首页',
                page: 'index/index.vue',
                expectedTime: '5s',
                emotionScore: 6,
                touchpoints: ['学习统计', '功能入口'],
                potentialIssues: ['数据为空显示空白', '功能入口不明显']
            },
            {
                step: '进入刷题模块',
                page: 'practice/index.vue',
                expectedTime: '2s',
                emotionScore: 7,
                touchpoints: ['题库选择', '开始刷题按钮'],
                potentialIssues: ['题库为空', '按钮不明显']
            },
            {
                step: '上传题库',
                page: 'practice/import-data.vue',
                expectedTime: '30s',
                emotionScore: 3,
                touchpoints: ['文件选择', '上传进度', '解析结果'],
                potentialIssues: ['无进度提示', '上传失败无反馈', '等待时间长']
            },
            {
                step: '开始答题',
                page: 'practice/do-quiz.vue',
                expectedTime: '10s',
                emotionScore: 9,
                touchpoints: ['题目展示', '答案选择', '提交反馈'],
                potentialIssues: ['题目加载慢', '提交无反馈']
            }
        ];
    }

    analyzeActiveUserJourney() {
        // 活跃用户核心任务: 每日PK对战
        this.journeys.activeUser = [
            {
                step: '打开应用',
                page: 'index/index.vue',
                expectedTime: '1s',
                emotionScore: 8,
                touchpoints: ['每日数据', '打卡提示'],
                potentialIssues: ['数据未更新']
            },
            {
                step: '进入PK模式',
                page: 'practice/pk-battle.vue',
                expectedTime: '2s',
                emotionScore: 7,
                touchpoints: ['PK入口', '匹配按钮'],
                potentialIssues: ['入口不明显']
            },
            {
                step: '匹配对手',
                page: 'practice/pk-battle.vue',
                expectedTime: '5s',
                emotionScore: 4,
                touchpoints: ['匹配动画', '对手信息'],
                potentialIssues: ['匹配时间长', '动画单调', '匹配失败']
            },
            {
                step: 'PK对战',
                page: 'practice/pk-battle.vue',
                expectedTime: '60s',
                emotionScore: 9,
                touchpoints: ['实时进度', '答题反馈', '对手状态'],
                potentialIssues: ['网络延迟', '状态不同步']
            },
            {
                step: '查看结果',
                page: 'practice/pk-battle.vue',
                expectedTime: '10s',
                emotionScore: 8,
                touchpoints: ['胜负结果', '积分变化', '排行榜'],
                potentialIssues: ['结果延迟', '积分未更新']
            }
        ];
    }

    analyzePaidUserJourney() {
        // 付费用户核心任务: 购买会员 → 使用特权
        this.journeys.paidUser = [
            {
                step: '查看会员特权',
                page: 'settings/index.vue',
                expectedTime: '5s',
                emotionScore: 7,
                touchpoints: ['特权列表', '价格展示'],
                potentialIssues: ['特权不清晰', '价格不明显']
            },
            {
                step: '发起支付',
                page: 'settings/index.vue',
                expectedTime: '10s',
                emotionScore: 8,
                touchpoints: ['支付方式', '支付确认'],
                potentialIssues: ['支付流程复杂', '支付失败']
            },
            {
                step: '支付完成',
                page: 'settings/index.vue',
                expectedTime: '3s',
                emotionScore: 9,
                touchpoints: ['支付成功提示', '特权激活'],
                potentialIssues: ['特权延迟生效', '无成功提示']
            },
            {
                step: '使用特权功能',
                page: 'mistake/index.vue',
                expectedTime: '5s',
                emotionScore: 5,
                touchpoints: ['错题导出', 'AI深度解析'],
                potentialIssues: ['特权未生效', '功能入口难找']
            }
        ];
    }

    generateReport() {
        const report = {
            dimension: 'D2 - 用户体验情绪曲线',
            journeys: this.journeys,
            emotionLowPoints: this.findEmotionLowPoints(),
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    findEmotionLowPoints() {
        const allSteps = [
            ...this.journeys.newUser,
            ...this.journeys.activeUser,
            ...this.journeys.paidUser
        ];

        return allSteps
            .filter(step => step.emotionScore < 5)
            .sort((a, b) => a.emotionScore - b.emotionScore)
            .map(step => ({
                step: step.step,
                page: step.page,
                emotionScore: step.emotionScore,
                issues: step.potentialIssues,
                priority: step.emotionScore < 3 ? 'P0' : 'P1'
            }));
    }

    generateRecommendations() {
        const lowPoints = this.findEmotionLowPoints();
        return lowPoints.map(point => ({
            issue: point.step,
            currentScore: point.emotionScore,
            targetScore: 8,
            actions: [
                '添加加载状态和进度提示',
                '优化等待时间（<3秒）',
                '添加友好的错误提示',
                '提供降级方案'
            ],
            clineTask: `优化 ${point.page} 的用户体验`
        }));
    }
}

// 维度3: 加载性能与动画优化
class PerformanceAuditor {
    constructor() {
        this.metrics = {
            loadingTimes: [],
            animations: [],
            networkRequests: []
        };
    }

    async audit() {
        console.log('\n⚡ [维度3] 加载性能与动画优化分析...\n');

        // 分析页面加载
        await this.analyzePageLoading();

        // 分析动画效果
        await this.analyzeAnimations();

        // 分析网络请求
        await this.analyzeNetworkRequests();

        return this.generateReport();
    }

    async analyzePageLoading() {
        const pagesDir = path.join(AUDIT_CONFIG.projectRoot, 'src/pages');
        const pages = this.getAllVueFiles(pagesDir);

        for (const page of pages) {
            const content = fs.readFileSync(page, 'utf-8');
            const relativePath = path.relative(AUDIT_CONFIG.projectRoot, page);

            // 检测: 是否有骨架屏
            const hasSkeleton = content.includes('skeleton') || content.includes('base-skeleton');

            // 检测: 是否有加载状态
            const hasLoading = content.includes('loading') || content.includes('base-loading');

            // 检测: 数据预加载
            const hasPreload = content.includes('onLoad') || content.includes('onShow');

            this.metrics.loadingTimes.push({
                page: relativePath,
                hasSkeleton,
                hasLoading,
                hasPreload,
                recommendation: !hasSkeleton && !hasLoading ? '添加骨架屏或加载动画' : '优化已有加载状态'
            });
        }
    }

    async analyzeAnimations() {
        const stylesDir = path.join(AUDIT_CONFIG.projectRoot, 'src/styles');
        const styleFiles = fs.readdirSync(stylesDir).filter(f => f.endsWith('.scss'));

        for (const file of styleFiles) {
            const content = fs.readFileSync(path.join(stylesDir, file), 'utf-8');

            // 检测动画定义
            const animations = content.match(/@keyframes\s+(\w+)/g) || [];
            const transitions = content.match(/transition:\s*([^;]+)/g) || [];

            this.metrics.animations.push({
                file,
                animationCount: animations.length,
                transitionCount: transitions.length,
                hasEasing: content.includes('cubic-bezier') || content.includes('ease'),
                recommendation: !content.includes('cubic-bezier') ? '使用贝塞尔曲线优化动画' : '动画配置良好'
            });
        }
    }

    async analyzeNetworkRequests() {
        const servicesDir = path.join(AUDIT_CONFIG.projectRoot, 'src/services');
        const services = ['lafService.js', 'storageService.js'];

        for (const service of services) {
            const filePath = path.join(servicesDir, service);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');

                // 统计API调用
                const apiCalls = (content.match(/async\s+\w+\s*\(/g) || []).length;

                // 检测并发控制
                const hasQueue = content.includes('queue') || content.includes('Promise.all');

                // 检测缓存
                const hasCache = content.includes('cache') || content.includes('缓存');

                this.metrics.networkRequests.push({
                    service,
                    apiCallCount: apiCalls,
                    hasQueue,
                    hasCache,
                    recommendation: !hasCache ? '添加请求缓存' : '网络层配置良好'
                });
            }
        }
    }

    getAllVueFiles(dir) {
        let files = [];
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                files = files.concat(this.getAllVueFiles(fullPath));
            } else if (item.endsWith('.vue')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    generateReport() {
        const report = {
            dimension: 'D3 - 加载性能与动画优化',
            metrics: this.metrics,
            summary: {
                pagesWithSkeleton: this.metrics.loadingTimes.filter(p => p.hasSkeleton).length,
                pagesWithLoading: this.metrics.loadingTimes.filter(p => p.hasLoading).length,
                totalAnimations: this.metrics.animations.reduce((sum, a) => sum + a.animationCount, 0),
                servicesWithCache: this.metrics.networkRequests.filter(s => s.hasCache).length
            },
            recommendations: this.generatePerformanceRecommendations()
        };

        return report;
    }

    generatePerformanceRecommendations() {
        const recommendations = [];

        // 加载优化建议
        const pagesNeedingSkeleton = this.metrics.loadingTimes.filter(p => !p.hasSkeleton && !p.hasLoading);
        if (pagesNeedingSkeleton.length > 0) {
            recommendations.push({
                type: '加载优化',
                priority: 'P1',
                issue: `${pagesNeedingSkeleton.length} 个页面缺少加载状态`,
                solution: '添加骨架屏组件',
                clineTask: '批量添加骨架屏到关键页面',
                affectedPages: pagesNeedingSkeleton.map(p => p.page)
            });
        }

        // 动画优化建议
        const stylesNeedingEasing = this.metrics.animations.filter(a => !a.hasEasing);
        if (stylesNeedingEasing.length > 0) {
            recommendations.push({
                type: '动画优化',
                priority: 'P2',
                issue: `${stylesNeedingEasing.length} 个样式文件使用线性动画`,
                solution: '使用贝塞尔曲线优化动画流畅度',
                clineTask: '优化动画曲线配置',
                affectedFiles: stylesNeedingEasing.map(s => s.file)
            });
        }

        // 网络优化建议
        const servicesNeedingCache = this.metrics.networkRequests.filter(s => !s.hasCache);
        if (servicesNeedingCache.length > 0) {
            recommendations.push({
                type: '网络优化',
                priority: 'P1',
                issue: `${servicesNeedingCache.length} 个服务层缺少缓存`,
                solution: '添加请求缓存层，减少重复请求',
                clineTask: '实现请求缓存机制',
                affectedServices: servicesNeedingCache.map(s => s.service)
            });
        }

        return recommendations;
    }
}

// 主执行函数
async function runAudit() {
    console.log('🚀 启动 UX 审计引擎...\n');
    console.log('📅 执行时间:', new Date().toLocaleString('zh-CN'));
    console.log('📂 项目路径:', AUDIT_CONFIG.projectRoot);
    console.log('📊 输出目录:', AUDIT_CONFIG.outputDir);
    console.log('\n' + '='.repeat(60) + '\n');

    const results = {};

    // 执行维度1审计
    const d1Auditor = new FunctionalityAuditor();
    results.D1 = await d1Auditor.audit();

    // 执行维度2审计
    const d2Auditor = new EmotionJourneyMapper();
    results.D2 = await d2Auditor.audit();

    // 执行维度3审计
    const d3Auditor = new PerformanceAuditor();
    results.D3 = await d3Auditor.audit();

    // 生成综合报告
    generateComprehensiveReport(results);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ UX 审计完成！');
    console.log(`📄 报告已生成: ${AUDIT_CONFIG.outputDir}/ux-audit-report.md\n`);
}

// 生成综合报告
function generateComprehensiveReport(results) {
    let report = '# UX 审计综合报告\n\n';
    report += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    report += `**项目**: EXAM-MASTER (考研备考小程序)\n\n`;
    report += '---\n\n';

    // 维度1报告
    report += '## 维度1: 功能可用性审计\n\n';
    report += `### 问题统计\n\n`;
    report += `- 🔴 阻塞级Bug: ${results.D1.summary.blocking}\n`;
    report += `- 🟡 体验摩擦: ${results.D1.summary.friction}\n`;
    report += `- 🟢 优化建议: ${results.D1.summary.optimization}\n`;
    report += `- **总计**: ${results.D1.summary.total}\n\n`;

    if (results.D1.priority.length > 0) {
        report += '### Top 10 优先级问题\n\n';
        results.D1.priority.forEach((issue, index) => {
            const emoji = issue.level === 'blocking' ? '🔴' : issue.level === 'friction' ? '🟡' : '🟢';
            report += `${index + 1}. ${emoji} **${issue.page || issue.service || issue.store}**\n`;
            report += `   - 问题: ${issue.issue}\n`;
            report += `   - 影响: ${issue.impact}\n`;
            report += `   - 解决方案: ${issue.solution}\n`;
            report += `   - Cline任务: \`${issue.clineTask}\`\n\n`;
        });
    }

    // 维度2报告
    report += '## 维度2: 用户体验情绪曲线\n\n';
    report += '### 情绪低谷点\n\n';
    if (results.D2.emotionLowPoints.length > 0) {
        results.D2.emotionLowPoints.forEach((point, index) => {
            report += `${index + 1}. **${point.step}** (情绪分: ${point.emotionScore}/10)\n`;
            report += `   - 页面: ${point.page}\n`;
            report += `   - 问题: ${point.issues.join(', ')}\n`;
            report += `   - 优先级: ${point.priority}\n\n`;
        });
    } else {
        report += '✅ 未发现明显情绪低谷点\n\n';
    }

    // 维度3报告
    report += '## 维度3: 加载性能与动画优化\n\n';
    report += '### 性能指标\n\n';
    report += `- 有骨架屏的页面: ${results.D3.summary.pagesWithSkeleton}\n`;
    report += `- 有加载状态的页面: ${results.D3.summary.pagesWithLoading}\n`;
    report += `- 动画总数: ${results.D3.summary.totalAnimations}\n`;
    report += `- 有缓存的服务: ${results.D3.summary.servicesWithCache}\n\n`;

    if (results.D3.recommendations.length > 0) {
        report += '### 优化建议\n\n';
        results.D3.recommendations.forEach((rec, index) => {
            report += `${index + 1}. **${rec.type}** (${rec.priority})\n`;
            report += `   - 问题: ${rec.issue}\n`;
            report += `   - 解决方案: ${rec.solution}\n`;
            report += `   - Cline任务: \`${rec.clineTask}\`\n\n`;
        });
    }

    // 保存报告
    const reportPath = path.join(AUDIT_CONFIG.outputDir, 'ux-audit-report.md');
    fs.writeFileSync(reportPath, report, 'utf-8');

    // 保存JSON数据
    const jsonPath = path.join(AUDIT_CONFIG.outputDir, 'ux-audit-data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
}

// 执行审计
runAudit().catch(console.error);
