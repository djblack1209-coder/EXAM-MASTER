// ============================================
// Exam-Master MongoDB 初始化脚本
// ============================================

// 切换到应用数据库
db = db.getSiblingDB('exam-master');

// 创建应用用户
// 注意：生产环境请通过环境变量 MONGO_APP_USER 和 MONGO_APP_PASSWORD 配置
db.createUser({
  user: process.env.MONGO_APP_USER || 'exam-master-app',
  pwd: process.env.MONGO_APP_PASSWORD || 'CHANGE_ME_IN_PRODUCTION',
  roles: [
    { role: 'readWrite', db: 'exam-master' }
  ]
});

// ==================== 创建集合和索引 ====================

// 用户集合
db.createCollection('users');
db.users.createIndex({ openid: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { sparse: true });
db.users.createIndex({ createdAt: -1 });

// 题目集合
db.createCollection('questions');
db.questions.createIndex({ subject: 1, chapter: 1 });
db.questions.createIndex({ difficulty: 1 });
db.questions.createIndex({ type: 1 });
db.questions.createIndex({ createdAt: -1 });
db.questions.createIndex({ 
  title: 'text', 
  content: 'text' 
}, { 
  weights: { title: 10, content: 5 },
  name: 'questions_text_search'
});

// 错题本集合
db.createCollection('mistake_book');
db.mistake_book.createIndex({ userId: 1, questionId: 1 }, { unique: true });
db.mistake_book.createIndex({ userId: 1, createdAt: -1 });
db.mistake_book.createIndex({ userId: 1, subject: 1 });

// 练习记录集合
db.createCollection('practice_records');
db.practice_records.createIndex({ userId: 1, createdAt: -1 });
db.practice_records.createIndex({ userId: 1, subject: 1 });
db.practice_records.createIndex({ createdAt: -1 }, { expireAfterSeconds: 7776000 }); // 90天过期

// 学习计划集合
db.createCollection('study_plans');
db.study_plans.createIndex({ userId: 1 });
db.study_plans.createIndex({ userId: 1, status: 1 });

// 好友关系集合
db.createCollection('friends');
db.friends.createIndex({ userId: 1, friendId: 1 }, { unique: true });
db.friends.createIndex({ userId: 1, status: 1 });

// 排行榜集合
db.createCollection('rankings');
db.rankings.createIndex({ type: 1, score: -1 });
db.rankings.createIndex({ userId: 1, type: 1 });
db.rankings.createIndex({ updatedAt: -1 });

// 学校信息集合
db.createCollection('schools');
db.schools.createIndex({ name: 1 });
db.schools.createIndex({ province: 1, city: 1 });
db.schools.createIndex({ is985: 1, is211: 1 });
db.schools.createIndex({ 
  name: 'text', 
  shortName: 'text' 
}, { 
  name: 'schools_text_search'
});

// ==================== 插入初始数据 ====================

// 系统配置
db.createCollection('system_config');
db.system_config.insertOne({
  key: 'app_version',
  value: '1.0.0',
  description: '应用版本号',
  updatedAt: new Date()
});

db.system_config.insertOne({
  key: 'maintenance_mode',
  value: false,
  description: '维护模式开关',
  updatedAt: new Date()
});

print('Exam-Master MongoDB 初始化完成！');
print('创建的集合: users, questions, mistake_book, practice_records, study_plans, friends, rankings, schools, system_config');
