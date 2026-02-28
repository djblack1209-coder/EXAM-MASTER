/**
 * Laf 运行时包的本地 mock
 * nodemailer / tencentcloud-sdk-nodejs 等包仅在 Laf 云端可用，
 * 本地测试时通过 vitest resolve.alias 指向此文件。
 */
export function createTransport() {
  return {
    sendMail: () => Promise.reject(new Error('mock: nodemailer not available locally'))
  };
}

export default { createTransport };
