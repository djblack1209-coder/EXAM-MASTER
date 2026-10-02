/**
 * 全局类型声明 — 解决 TS2307/TS2304 错误
 */

// Laf 云函数 SDK 类型声明
declare module '@lafjs/cloud' {
  const cloud: {
    database(): any;
    fetch: any;
    storage: any;
    res: any;
  };
  export default cloud;
}

// 外部依赖类型声明（避免 TS2307）
declare module 'nodemailer' {
  const nodemailer: any;
  export default nodemailer;
  export function createTransport(options: any): any;
}

declare module 'tencentcloud-sdk-nodejs' {
  const sdk: any;
  export default sdk;
}

declare module 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client' {
  const Client: any;
  export { Client };
}
