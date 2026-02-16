// common/zhipu.js
import { getApiKey } from './config.js'

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export const chatWithAI = (messages) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: API_URL,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: "glm-4", // 使用智谱 GLM-4 模型
        messages: messages
      },
      success: (res) => {
        if (res.data && res.data.choices && res.data.choices.length > 0) {
          resolve(res.data.choices[0].message.content);
        } else {
          reject('No response from AI');
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};
