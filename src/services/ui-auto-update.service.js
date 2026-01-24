/**
 * UI自动更新服务
 * 实现数据变更 → UI刷新 → 自动测试 → 自动提交的完整流程
 */

class UIAutoUpdateService {
    constructor() {
        this.pendingUpdates = [];
        this.autoCommit = process.env.NODE_ENV === 'development';
        this.autoTest = true;
        this.updateQueue = [];
        this.isProcessing = false;
    }

    /**
     * 核心方法：数据变更 → UI自动刷新
     * @param {string} key - 数据键名
     * @param {any} newData - 新数据
     * @param {Object} options - 配置选项
     */
    async updateAndRefresh(key, newData, options = {}) {
        const {
            skipTest = false,
            skipCommit = false,
            description = `更新 ${key}`
        } = options;

        console.log(`[UI Auto Update] 开始更新: ${key}`);

        try {
            // 1. 更新数据（Vue响应式自动处理UI刷新）
            const storageService = await import('./storageService.js');
            await storageService.default.save(key, newData);

            console.log(`[UI Auto Update] ✅ 数据已更新，Vue自动刷新UI`);

            // 2. 记录更新历史
            this.recordUpdate(key, newData, description);

            // 3. 触发自动化测试（可选）
            if (this.autoTest && !skipTest) {
                await this.runVisualTests(key);
            }

            // 4. 自动提交Git（开发环境，可选）
            if (this.autoCommit && !skipCommit) {
                await this.autoCommitToGit(key, description);
            }

            return { success: true, key, timestamp: Date.now() };

        } catch (error) {
            console.error(`[UI Auto Update] ❌ 更新失败:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 批量更新（队列处理）
     */
    async batchUpdate(updates) {
        console.log(`[UI Auto Update] 批量更新 ${updates.length} 项`);

        this.updateQueue.push(...updates);

        if (!this.isProcessing) {
            await this.processQueue();
        }
    }

    /**
     * 处理更新队列
     */
    async processQueue() {
        this.isProcessing = true;

        while (this.updateQueue.length > 0) {
            const update = this.updateQueue.shift();
            await this.updateAndRefresh(
                update.key,
                update.data,
                update.options || {}
            );

            // 避免过快更新
            await this.delay(100);
        }

        this.isProcessing = false;
    }

    /**
     * 运行视觉回归测试
     */
    async runVisualTests(key) {
        console.log(`[UI Auto Update] 🧪 运行视觉测试: ${key}`);

        // 在Node.js环境中执行
        if (typeof window === 'undefined') {
            try {
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);

                const { stdout, stderr } = await execPromise(
                    'npx playwright test --config=playwright.visual.config.js --grep="核心页面"'
                );

                console.log(`[UI Auto Update] ✅ 视觉测试通过`);
                return { passed: true, output: stdout };

            } catch (error) {
                console.warn(`[UI Auto Update] ⚠️ 视觉测试失败:`, error.message);
                return { passed: false, error: error.message };
            }
        } else {
            console.log(`[UI Auto Update] ℹ️ 浏览器环境，跳过测试`);
            return { passed: true, skipped: true };
        }
    }

    /**
     * 自动提交到Git
     */
    async autoCommitToGit(key, description) {
        console.log(`[UI Auto Update] 📝 自动提交Git: ${description}`);

        // 仅在Node.js环境中执行
        if (typeof window === 'undefined') {
            try {
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);

                // 检查是否有变更
                const { stdout: status } = await execPromise('git status --short');

                if (status.trim()) {
                    await execPromise(`git add .`);
                    await execPromise(`git commit -m "auto-ui: ${description}"`);

                    console.log(`[UI Auto Update] ✅ Git提交成功: ${description}`);
                    return { committed: true };
                } else {
                    console.log(`[UI Auto Update] ℹ️ 无变更，跳过提交`);
                    return { committed: false, reason: 'no changes' };
                }

            } catch (error) {
                console.warn(`[UI Auto Update] ⚠️ Git提交失败:`, error.message);
                return { committed: false, error: error.message };
            }
        } else {
            console.log(`[UI Auto Update] ℹ️ 浏览器环境，跳过Git操作`);
            return { committed: false, skipped: true };
        }
    }

    /**
     * 记录更新历史
     */
    recordUpdate(key, data, description) {
        const record = {
            key,
            description,
            timestamp: Date.now(),
            dataSize: JSON.stringify(data).length
        };

        this.pendingUpdates.push(record);

        // 保留最近100条记录
        if (this.pendingUpdates.length > 100) {
            this.pendingUpdates.shift();
        }

        console.log(`[UI Auto Update] 📊 更新记录已保存:`, record);
    }

    /**
     * 获取更新历史
     */
    getUpdateHistory(limit = 10) {
        return this.pendingUpdates.slice(-limit).reverse();
    }

    /**
     * 清空更新历史
     */
    clearHistory() {
        this.pendingUpdates = [];
        console.log(`[UI Auto Update] 🗑️ 更新历史已清空`);
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 配置自动化选项
     */
    configure(options) {
        if (options.autoCommit !== undefined) {
            this.autoCommit = options.autoCommit;
        }
        if (options.autoTest !== undefined) {
            this.autoTest = options.autoTest;
        }

        console.log(`[UI Auto Update] ⚙️ 配置已更新:`, {
            autoCommit: this.autoCommit,
            autoTest: this.autoTest
        });
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            autoCommit: this.autoCommit,
            autoTest: this.autoTest,
            pendingUpdates: this.pendingUpdates.length,
            queueLength: this.updateQueue.length,
            isProcessing: this.isProcessing
        };
    }
}

// 导出单例
export const uiAutoUpdater = new UIAutoUpdateService();

// 默认导出
export default uiAutoUpdater;
