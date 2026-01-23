'use strict';

/**
 * 生成邀请码云函数
 * 基于用户ID生成唯一邀请码，并关联存储
 */

const crypto = require('crypto');

// 生成唯一邀请码
const generateCode = (userId) => {
  // 使用用户ID、时间戳和随机数生成基础字符串
  const baseStr = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // 使用SHA-256哈希
  const hash = crypto.createHash('sha256').update(baseStr).digest('hex');
  
  // 截取前8位并转换为大写
  return hash.substring(0, 8).toUpperCase();
};

exports.main = async (event, context) => {
  try {
    // 获取用户ID
    const { userId } = event;
    
    // 验证必要参数
    if (!userId) {
      return {
        code: 400,
        message: '参数错误：userId 不能为空',
        data: null
      };
    }
    
    // 获取数据库实例
    const db = uniCloud.database();
    const inviteCodeCollection = db.collection('invite_codes');
    
    // 检查用户是否已有邀请码
    const existingCode = await inviteCodeCollection.where({
      userId: userId,
      isUsed: false
    }).get();
    
    // 如果已有未使用的邀请码，直接返回
    if (existingCode.data && existingCode.data.length > 0) {
      return {
        code: 200,
        message: '邀请码已存在',
        data: {
          inviteCode: existingCode.data[0].inviteCode,
          createdAt: existingCode.data[0].createdAt
        }
      };
    }
    
    // 生成新的邀请码
    const inviteCode = generateCode(userId);
    
    // 存储邀请码
    const result = await inviteCodeCollection.add({
      userId: userId,
      inviteCode: inviteCode,
      createdAt: Date.now(),
      isUsed: false,
      usedBy: null,
      usedAt: null
    });
    
    // 返回结果
    return {
      code: 200,
      message: '邀请码生成成功',
      data: {
        inviteCode: inviteCode,
        createdAt: Date.now()
      }
    };
    
  } catch (error) {
    console.error('generate-invite-code 错误:', error);
    
    return {
      code: 500,
      message: error.message || '服务器内部错误',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
};