/**
 * Laf 运行时包的本地 mock
 * tencentcloud-sdk-nodejs 仅在 Laf 云端可用。
 */
const MockClient = class {
  constructor() {
    /* mock */
  }
};

export default {
  bda: {
    v20200324: {
      Client: MockClient
    }
  }
};
