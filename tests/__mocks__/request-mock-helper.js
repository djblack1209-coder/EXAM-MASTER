/**
 * 请求层 Mock Helper
 *
 * 解决问题：vi.spyOn(lafService, 'request') 无法拦截 API 函数内部
 * 通过 import 获取的 request 引用。
 *
 * 使用方法：
 *   import { mockRequest, getRequestMock } from '../__mocks__/request-mock-helper.js';
 *   mockRequest(vi);  // 在文件顶层调用
 *
 *   // 在测试中设置返回值：
 *   const request = getRequestMock();
 *   request.mockResolvedValue({ code: 0, success: true, data: {...} });
 */
let _requestMock = null;

export function mockRequest(vi) {
  vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
    const original = await importOriginal();
    const mockFn = vi.fn().mockResolvedValue({ code: 0, success: true, data: {} });
    _requestMock = mockFn;
    return {
      ...original,
      request: mockFn
    };
  });
}

export function getRequestMock() {
  return _requestMock;
}
