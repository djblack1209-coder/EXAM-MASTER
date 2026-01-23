// utils/qa.js - UniApp 增强版
let logQueue = [];
const isDev = true; 

export const qa = {
  log(type, msg, expect = null) {
    if (!isDev) return;
    if (logQueue.length > 200) logQueue.shift();
    let data = msg;
    if (type === 'RESPONSE' && msg.body && typeof msg.body === 'string') {
      data = { ...msg, body: msg.body.slice(0, 512) + '...(truncated)' };
    }
    const entry = { time: Date.now(), type, data, expect, page: getCurrentPages().pop()?.route };
    logQueue.push(entry);
    const app = getApp();
    if (app) app.globalData = { ...app.globalData, qaLogs: logQueue };
    console.log(`[QA] ${type}:`, data);
  },
  clear() {
    logQueue = [];
    if (getApp()) getApp().globalData.qaLogs = [];
    console.clear();
  },
  getLogs() { 
    const app = getApp();
    return (app && app.globalData.qaLogs) || logQueue; 
  }
};

// 网络请求拦截器 - uni-app 版本
export const injectInterceptor = () => {
  // 拦截 uni.request
  const originRequest = uni.request;
  uni.request = function (options) {
    const { url, method = 'GET' } = options;
    qa.log('REQUEST_SEND', { url, method });
    const _fail = options.fail;
    options.fail = function (err) { 
      qa.log('REQUEST_FAIL', { url, err }); 
      return _fail?.call(this, err); 
    };
    const _success = options.success;
    options.success = function (res) { 
      qa.log('RESPONSE', { 
        url, 
        statusCode: res.statusCode, 
        body: JSON.stringify(res.data).slice(0, 512) 
      }); 
      return _success?.call(this, res); 
    };
    return originRequest.call(this, options);
  };
  
  // 拦截 uniCloud.callFunction
  const originCallFunction = uniCloud.callFunction;
  uniCloud.callFunction = function (options) {
    const { name } = options;
    qa.log('CLOUDFUNCTION_CALL', { name });
    const _fail = options.fail;
    options.fail = function (err) { 
      qa.log('CLOUDFUNCTION_FAIL', { name, err }); 
      return _fail?.call(this, err); 
    };
    const _success = options.success;
    options.success = function (res) { 
      qa.log('CLOUDFUNCTION_RESPONSE', { 
        name, 
        success: res.success,
        result: JSON.stringify(res.result).slice(0, 512)
      }); 
      return _success?.call(this, res); 
    };
    return originCallFunction.call(this, options);
  };
  
  // 同时拦截微信原生 wx.request（兼容性）
  if (typeof wx !== 'undefined' && wx.request) {
    const originWxRequest = wx.request;
    Object.defineProperty(wx, 'request', {
      configurable: true, 
      writable: true,
      value: function (options) {
        const { url, method = 'GET' } = options;
        qa.log('REQUEST_SEND', { url, method });
        const _success = options.success;
        options.success = function (res) { 
          qa.log('RESPONSE', { 
            url, 
            statusCode: res.statusCode, 
            body: JSON.stringify(res.data).slice(0, 512) 
          }); 
          return _success?.call(this, res); 
        };
        return originWxRequest.call(this, options);
      }
    });
  }
};

// 【核心修复】同时 Hook Page 和 Component
export const hookSetData = () => {
  const hookMethod = (config) => {
    if (config.__qaHooked) return;
    config.__qaHooked = true;
    const _setData = config.setData;
    if (typeof _setData === 'function') {
      // 拦截 setData
      config.setData = function (data, cb) { 
        qa.log('SETDATA', data); 
        return _setData.call(this, data, cb); 
      };
    }
  };

  // Hook Page 构造器
  if (typeof Page !== 'undefined') {
    const originalPage = Page;
    Page = function (config) {
      hookMethod(config);
      return originalPage(config);
    };
  }

  // Hook Component 构造器（UniApp 核心）
  if (typeof Component !== 'undefined') {
    const originalComponent = Component;
    Component = function (config) {
      // UniApp 页面通常作为组件运行，且 methods 也就是组件的方法
      if (config.methods) {
        hookMethod(config.methods);
      }
      // 有些写法直接挂在 config 上
      hookMethod(config);
      // 如果 config 有 lifetimes，也需要 hook
      if (config.lifetimes && config.lifetimes.attached) {
        const originalAttached = config.lifetimes.attached;
        config.lifetimes.attached = function() {
          hookMethod(this);
          return originalAttached.call(this);
        };
      }
      return originalComponent(config);
    };
  }
};
