<template>
    <view class="container">
        <view class="debug-info">
            <text class="title">调试信息</text>

            <view class="section">
                <text class="label">1. import.meta.env 测试:</text>
                <text class="value">{{ importMetaEnv }}</text>
            </view>

            <view class="section">
                <text class="label">2. lafService 加载状态:</text>
                <text class="value">{{ lafServiceStatus }}</text>
            </view>

            <view class="section">
                <text class="label">3. stores 加载状态:</text>
                <text class="value">{{ storesStatus }}</text>
            </view>

            <view class="section">
                <text class="label">4. 错误信息:</text>
                <text class="value error">{{ errorMessage }}</text>
            </view>
        </view>

        <button @tap="testLafService" class="test-btn">测试 lafService</button>
        <button @tap="testStores" class="test-btn">测试 Stores</button>
        <button @tap="goHome" class="test-btn primary">返回首页</button>
    </view>
</template>

<script>
export default {
    data() {
        return {
            importMetaEnv: 'checking...',
            lafServiceStatus: 'checking...',
            storesStatus: 'checking...',
            errorMessage: '无错误'
        }
    },

    onLoad() {
        this.checkEnvironment();
    },

    methods: {
        checkEnvironment() {
            // 检查 import.meta.env
            try {
                if (typeof import.meta !== 'undefined' && import.meta.env) {
                    this.importMetaEnv = JSON.stringify(import.meta.env, null, 2);
                } else {
                    this.importMetaEnv = 'import.meta.env 未定义';
                }
            } catch (e) {
                this.importMetaEnv = '错误: ' + e.message;
                this.errorMessage = 'import.meta.env 错误: ' + e.message;
            }

            // 检查 lafService
            try {
                const { lafService } = require('../../services/lafService.js');
                if (lafService) {
                    this.lafServiceStatus = '✅ 加载成功';
                } else {
                    this.lafServiceStatus = '❌ 加载失败';
                }
            } catch (e) {
                this.lafServiceStatus = '❌ 错误: ' + e.message;
                this.errorMessage = 'lafService 错误: ' + e.message;
            }

            // 检查 stores
            try {
                const stores = require('../../stores/index.js');
                if (stores) {
                    this.storesStatus = '✅ 加载成功';
                } else {
                    this.storesStatus = '❌ 加载失败';
                }
            } catch (e) {
                this.storesStatus = '❌ 错误: ' + e.message;
                this.errorMessage = 'stores 错误: ' + e.message;
            }
        },

        testLafService() {
            try {
                const { lafService } = require('../../services/lafService.js');
                console.log('lafService:', lafService);
                uni.showToast({
                    title: 'lafService 可用',
                    icon: 'success'
                });
            } catch (e) {
                console.error('lafService 错误:', e);
                uni.showToast({
                    title: 'lafService 错误: ' + e.message,
                    icon: 'none',
                    duration: 3000
                });
            }
        },

        testStores() {
            try {
                const stores = require('../../stores/index.js');
                console.log('stores:', stores);
                uni.showToast({
                    title: 'Stores 可用',
                    icon: 'success'
                });
            } catch (e) {
                console.error('stores 错误:', e);
                uni.showToast({
                    title: 'Stores 错误: ' + e.message,
                    icon: 'none',
                    duration: 3000
                });
            }
        },

        goHome() {
            uni.switchTab({
                url: '/src/pages/index/index'
            });
        }
    }
}
</script>

<style scoped>
.container {
    padding: 20px;
    background: #f5f5f5;
    min-height: 100vh;
}

.debug-info {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
}

.title {
    font-size: 20px;
    font-weight: bold;
    color: #333;
    display: block;
    margin-bottom: 20px;
}

.section {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #eee;
}

.section:last-child {
    border-bottom: none;
}

.label {
    font-size: 14px;
    color: #666;
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
}

.value {
    font-size: 13px;
    color: #333;
    display: block;
    background: #f9f9f9;
    padding: 12px;
    border-radius: 8px;
    word-break: break-all;
    white-space: pre-wrap;
    font-family: monospace;
}

.value.error {
    color: #ff5722;
    background: #ffebee;
}

.test-btn {
    width: 100%;
    height: 50px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 16px;
    color: #333;
}

.test-btn.primary {
    background: #37B24D;
    color: white;
    border: none;
}
</style>
