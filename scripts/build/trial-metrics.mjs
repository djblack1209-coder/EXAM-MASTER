import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { trialMetrics } from '../../laf-backend/functions/_shared/learning-trial-metrics.js';

export async function runTrialMetrics(env = process.env) {
  const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const { requireAdminAccess } = await import(
    pathToFileURL(path.join(root, 'laf-backend/standalone/dist/functions/_shared/admin-auth.js'))
  );
  const auth = requireAdminAccess({ headers: { authorization: `Bearer ${env.TRIAL_METRICS_ADMIN_JWT || ''}` } });
  if (!auth.ok || auth.mode !== 'jwt') throw new Error('只有已验证的管理员可运行统计');
  if (!env.TRIAL_METRICS_SALT || env.TRIAL_METRICS_SALT.length < 24) throw new Error('请配置独立的指标匿名化盐');
  // 只接本机数据库；在服务器本机运行或通过已有受保护通道转发，不提供公网指标端点。
  if (!/^mongodb:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//.test(env.MONGODB_URI || ''))
    throw new Error('统计仅允许明确的本机 MongoDB 地址');
  const require = createRequire(path.join(root, 'laf-backend/standalone/package.json'));
  const { MongoClient } = require('mongodb'),
    client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(env.DB_NAME || 'exam-master');
    const states = await db
      .collection('learning_states')
      .find(
        {},
        {
          projection: {
            _id: 0,
            user_id: 1,
            trialFacts: 1,
            'state.format': 1,
            'state.conversations.coach.startedDay': 1,
            'state.conversations.coach.days.day': 1,
            'state.conversations.coach.days.completed': 1,
            'state.conversations.coach.days.answers.at': 1,
            'state.conversations.coach.days.rewrites.at': 1,
            'state.conversations.coach.library.reviews.at': 1,
            'state.conversations.coach.survey.answer': 1
          }
        }
      )
      .toArray();
    const accounts = await db
      .collection('learning_accounts')
      .find(
        { user_id: { $not: /^__platform_day_v1:/ } },
        { projection: { _id: 0, user_id: 1, 'calls.at': 1, 'calls.actualCost': 1, 'calls.costStatus': 1 } }
      )
      .toArray();
    return trialMetrics(states, accounts, { salt: env.TRIAL_METRICS_SALT });
  } finally {
    await client.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runTrialMetrics()
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch(() => {
      process.stderr.write('统计未执行：请核对后端构建、管理员身份及本机数据库配置。\n');
      process.exitCode = 1;
    });
}
