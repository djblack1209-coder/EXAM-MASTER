'use strict';

/**
 * 验证邀请码云函数
 * 处理新用户通过邀请链接注册的逻辑
 */

exports.main = async (event, context) => {
  try {
    // 获取邀请码和新用户ID
    const { inviteCode, newUserId } = event;
    
    // 验证必要参数
    if (!inviteCode || !newUserId) {
      return {
        code: 400,
        message: '参数错误：inviteCode 和 newUserId 不能为空',
        data: null
      };
    }
    
    // 获取数据库实例
    const db = uniCloud.database();
    const inviteCodeCollection = db.collection('invite_codes');
    const userCollection = db.collection('users');
    
    // 查询邀请码是否存在且未使用
    const inviteCodeInfo = await inviteCodeCollection.where({
      inviteCode: inviteCode,
      isUsed: false
    }).get();
    
    if (!inviteCodeInfo.data || inviteCodeInfo.data.length === 0) {
      return {
        code: 404,
        message: '邀请码无效或已被使用',
        data: null
      };
    }
    
    const inviteInfo = inviteCodeInfo.data[0];
    const inviterId = inviteInfo.userId;
    
    // 更新邀请码状态为已使用
    await inviteCodeCollection.doc(inviteInfo._id).update({
      isUsed: true,
      usedBy: newUserId,
      usedAt: Date.now()
    });
    
    // 为邀请人和被邀请人添加奖励（这里可以根据业务需求自定义奖励逻辑）
    // 例如：增加积分、解锁高级功能等
    
    // 1. 为邀请人添加奖励
    await userCollection.where({
      userId: inviterId
    }).update({
      $inc: {
        inviteCount: 1,
        points: 100 // 邀请奖励100积分
      }
    });
    
    // 2. 为被邀请人添加奖励
    await userCollection.where({
      userId: newUserId
    }).update({
      $set: {
        isInvited: true,
        inviterId: inviterId
      },
      $inc: {
        points: 50 // 被邀请奖励50积分
      }
    });
    
    // 返回成功结果
    return {
      code: 200,
      message: '邀请码验证成功，奖励已发放',
      data: {
        inviteCode: inviteCode,
        inviterId: inviterId,
        newUserId: newUserId
      }
    };
    
  } catch (error) {
    console.error('验证邀请码错误:', error);
    
    return {
      code: 500,
      message: error.message || '服务器内部错误',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
};