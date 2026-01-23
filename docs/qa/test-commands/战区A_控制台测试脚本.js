/**
 * 战区A：核心刷题链路 - 控制台测试脚本
 * 使用方法：在微信开发者工具控制台中复制粘贴执行
 */

// ==================== 测试阶段1：题库准备 ====================

console.log('🎯 战区A测试开始 - 核心刷题链路验证');
console.log('');

// TEST-A1.1 检查题库数据结构
console.log('📋 TEST-A1.1: 检查题库数据结构');
const existingBank = uni.getStorageSync('v30_bank');
console.log('当前题库数量:', existingBank?.length || 0);

if (!existingBank || existingBank.length === 0) {
  console.log('⚠️ 题库为空，开始注入Mock数据...');
  
  const mockQuestions = [
    {
      id: 'q1',
      question: '马克思主义哲学的直接理论来源是（）',
      options: ['A. 古希腊罗马哲学', 'B. 17世纪英国哲学', 'C. 18世纪法国哲学', 'D. 德国古典哲学'],
      answer: 'D',
      desc: '马克思主义哲学的直接理论来源是德国古典哲学，特别是黑格尔的辩证法和费尔巴哈的唯物主义。',
      category: '马原',
      type: '单选题'
    },
    {
      id: 'q2',
      question: '实践的基本特征包括（）',
      options: ['A. 客观物质性', 'B. 自觉能动性', 'C. 社会历史性', 'D. 以上都是'],
      answer: 'D',
      desc: '实践具有客观物质性、自觉能动性和社会历史性三个基本特征。',
      category: '马原',
      type: '单选题'
    },
    {
      id: 'q3',
      question: '毛泽东思想形成的时代背景是（）',
      options: ['A. 帝国主义战争与无产阶级革命', 'B. 和平与发展', 'C. 经济全球化', 'D. 信息革命'],
      answer: 'A',
      desc: '毛泽东思想形成于帝国主义战争与无产阶级革命的时代，这是其重要的时代背景。',
      category: '毛中特',
      type: '单选题'
    },
    {
      id: 'q4',
      question: '社会主义核心价值观的基本内容包括（）',
      options: ['A. 富强、民主、文明、和谐', 'B. 自由、平等、公正、法治', 'C. 爱国、敬业、诚信、友善', 'D. 以上都是'],
      answer: 'D',
      desc: '社会主义核心价值观包括国家层面（富强、民主、文明、和谐）、社会层面（自由、平等、公正、法治）和个人层面（爱国、敬业、诚信、友善）。',
      category: '思修',
      type: '单选题'
    },
    {
      id: 'q5',
      question: '中国共产党成立的时间是（）',
      options: ['A. 1919年', 'B. 1921年', 'C. 1927年', 'D. 1949年'],
      answer: 'B',
      desc: '中国共产党成立于1921年7月23日，标志着中国革命进入新的历史阶段。',
      category: '史纲',
      type: '单选题'
    }
  ];
  
  uni.setStorageSync('v30_bank', mockQuestions);
  console.log('✅ Mock题库已注入，共', mockQuestions.length, '道题');
  console.log('题目列表:');
  mockQuestions.forEach((q, i) => {
    console.log(`  ${i+1}. [${q.category}] ${q.question.substring(0, 30)}... (答案: ${q.answer})`);
  });
} else {
  console.log('✅ 题库已存在，共', existingBank.length, '道题');
  console.log('题目列表:');
  existingBank.slice(0, 5).forEach((q, i) => {
    console.log(`  ${i+1}. [${q.category || '未分类'}] ${q.question?.substring(0, 30) || '题目内容'}... (答案: ${q.answer || 'N/A'})`);
  });
}

console.log('');
console.log('✅ TEST-A1.1 完成');
console.log('');

// ==================== 准备测试环境 ====================

console.log('🧹 清空错题本，准备新测试...');
uni.removeStorageSync('mistake_book');
console.log('✅ 错题本已清空');
console.log('');

// ==================== 测试指引 ====================

console.log('📖 接下来的测试步骤：');
console.log('');
console.log('【阶段2：刷题流程验证】');
console.log('1. 点击底部 TabBar "练习" 图标');
console.log('2. 进入练习页面，点击"开始刷题"');
console.log('3. 进入 do-quiz.vue 页面');
console.log('4. 故意答错第1题（选择A，正确答案是D）');
console.log('5. 观察AI解析动画和结果弹窗');
console.log('6. 点击"继续挑战"，答对第2题（选择D）');
console.log('7. 观察正确答案的反馈');
console.log('');
console.log('【验证脚本】在答题过程中，可随时执行以下命令检查状态：');
console.log('');
console.log('// 检查错题数量');
console.log('const mistakes = uni.getStorageSync("mistake_book") || [];');
console.log('console.log("当前错题数量:", mistakes.length);');
console.log('');
console.log('// 查看第一条错题详情');
console.log('if (mistakes.length > 0) {');
console.log('  console.log("第一条错题:", {');
console.log('    题目: mistakes[0].question?.substring(0, 30) + "...",');
console.log('    用户答案: mistakes[0].user_answer || mistakes[0].userChoice,');
console.log('    正确答案: mistakes[0].correct_answer || mistakes[0].answer,');
console.log('    错误次数: mistakes[0].wrong_count || mistakes[0].wrongCount,');
console.log('    同步状态: mistakes[0].sync_status');
console.log('  });');
console.log('}');
console.log('');
console.log('🎯 准备完成！请开始手动测试，我将等待您的反馈。');
