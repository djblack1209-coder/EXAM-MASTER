// Test credentials are accepted only by an explicitly isolated, loopback-only runtime.
export const DEV_TEST =
  ['dev', 'test'].includes(process.env.YOZI_BUILD_CHANNEL || '') &&
  ['development', 'test'].includes(process.env.NODE_ENV || '') &&
  process.env.HOST === '127.0.0.1' &&
  process.env.DB_NAME === 'yozi_dev_test' &&
  /^mongodb:\/\/127\.0\.0\.1(?::\d+)?\/yozi_dev_test$/.test(process.env.MONGODB_URI || '');
