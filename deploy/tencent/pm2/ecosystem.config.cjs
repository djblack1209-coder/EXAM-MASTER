/**
 * EXAM-MASTER PM2 生态系统配置
 *
 * 部署到 /opt/apps/exam-master/backend/ 后执行:
 *   pm2 start ecosystem.config.cjs
 *
 * 注意: 此文件应与服务器上的配置保持同步
 */
module.exports = {
  apps: [
    {
      name: 'exam-master',
      script: './standalone/server.js',
      cwd: '/opt/apps/exam-master/backend',
      instances: 1, // 2核2G服务器用单实例（避免内存竞争）
      exec_mode: 'fork',
      node_args: '--max-old-space-size=1024',

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

      // 自动重启
      max_memory_restart: '800M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',

      // 监听文件变化（生产环境关闭）
      watch: false,

      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true
    }
  ]
};
