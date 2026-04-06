/**
 * EXAM-MASTER PM2 生态系统配置
 *
 * 部署到 /opt/apps/exam-master/backend/ 后执行:
 *   pm2 start ecosystem.config.cjs
 *
 * 注意: 此文件应与服务器上的配置保持同步
 *
 * 内存策略 (2核2G服务器):
 *   V8 堆上限 512MB < PM2 RSS 阈值 800MB
 *   → GC 在 512MB 时强制回收，RSS 通常不超过 600MB
 *   → PM2 800M 阈值仅作为最后安全网
 */
module.exports = {
  apps: [
    {
      name: 'exam-master',
      script: './standalone/server.js',
      cwd: '/opt/apps/exam-master/backend',
      instances: 1, // 2核2G服务器用单实例（避免内存竞争）
      exec_mode: 'fork',
      node_args: '--max-old-space-size=512',

      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },

      // 日志
      error_file: '/opt/apps/exam-master/logs/error.log',
      out_file: '/opt/apps/exam-master/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // 自动重启 — 指数退避策略（避免疯狂重启导致日志爆炸）
      max_memory_restart: '800M',
      exp_backoff_restart_delay: 1000, // 指数退避: 1s → 2s → 4s → ... 最大 15s
      max_restarts: 15,
      min_uptime: '30s', // 30秒内崩溃才计入重启计数器

      // 监听文件变化（生产环境关闭）
      watch: false,

      // 优雅关闭
      kill_timeout: 8000,    // 给进程 8 秒优雅关闭（含 MongoDB 连接释放）
      listen_timeout: 10000,
      shutdown_with_message: true
    }
  ]
};
