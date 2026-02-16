/**
 * AI服务测试脚本
 * 用于验证 lafService.proxyAI 的参数传递
 * 
 * 执行: node scripts/test-ai-service.js
 */

console.log('🧪 AI服务测试脚本\n');

// 模拟 lafService.proxyAI 的参数处理逻辑
function testProxyAI(action, payload) {
    console.log('📥 输入参数:');
    console.log('  action:', action);
    console.log('  payload:', JSON.stringify(payload, null, 2));

    // 前置参数校验
    if (!payload || typeof payload !== 'object') {
        console.log('❌ 参数错误: payload 必须是对象\n');
        return { code: -1, message: '参数错误' };
    }

    // 检查 content 字段
    if (payload.content !== undefined) {
        if (!payload.content || typeof payload.content !== 'string' || payload.content.trim() === '') {
            console.log('❌ 拦截: content 为空\n');
            return { code: -1, message: '输入内容不能为空' };
        }
        payload.content = payload.content.trim();
    }

    // 构建请求体
    const requestData = {
        action: action || 'chat',
        ...payload
    };

    console.log('📤 发送到后端的数据:');
    console.log(JSON.stringify(requestData, null, 2));
    console.log('✅ 参数校验通过\n');

    return { code: 0, data: requestData };
}

// 测试用例
console.log('='.repeat(60));
console.log('测试1: 正常调用（首页每日金句）');
console.log('='.repeat(60));
testProxyAI('chat', {
    content: '请生成一句简短的、充满力量的考研励志语录'
});

console.log('='.repeat(60));
console.log('测试2: 空字符串（应该被拦截）');
console.log('='.repeat(60));
testProxyAI('chat', {
    content: ''
});

console.log('='.repeat(60));
console.log('测试3: 只有空格（应该被拦截）');
console.log('='.repeat(60));
testProxyAI('chat', {
    content: '   '
});

console.log('='.repeat(60));
console.log('测试4: undefined（应该被拦截）');
console.log('='.repeat(60));
testProxyAI('chat', {
    content: undefined
});

console.log('='.repeat(60));
console.log('测试5: 没有 content 字段（可能是其他 action）');
console.log('='.repeat(60));
testProxyAI('generate_questions', {
    topic: '线性代数',
    count: 5
});

console.log('='.repeat(60));
console.log('测试完成！');
console.log('='.repeat(60));
