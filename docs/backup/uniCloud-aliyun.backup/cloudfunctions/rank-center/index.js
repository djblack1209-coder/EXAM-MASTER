'use strict';
const db = uniCloud.database();
const collection = db.collection('exam-rank'); // 对应你刚才创建的表名

exports.main = async (event, context) => {
  const { action, uid, nickName, avatarUrl, score } = event;
  
  // 1. 上传/更新分数
  if (action === 'update_score') {
    // 查询当前用户是否已存在
    const userRecord = await collection.where({ _id: uid }).get();
    
    if (userRecord.data && userRecord.data.length > 0) {
      // 如果新分数更高，才更新
      const oldScore = userRecord.data[0].score || 0;
      if (score > oldScore) {
        await collection.doc(uid).update({
          score: score,
          nickName: nickName,
          avatarUrl: avatarUrl,
          updatedAt: Date.now()
        });
        return { code: 0, msg: '分数已刷新', newRecord: true };
      }
      return { code: 0, msg: '未破纪录', newRecord: false };
    } else {
      // 新用户，直接插入 (指定 _id 为 uid，方便查找)
      await collection.doc(uid).set({
        nickName: nickName,
        avatarUrl: avatarUrl,
        score: score,
        updatedAt: Date.now()
      });
      return { code: 0, msg: '新纪录上榜', newRecord: true };
    }
  }
  
  // 2. 获取排行榜 (取全网前 50 名)
  if (action === 'get_rank') {
    const res = await collection
      .orderBy('score', 'desc') // 按分数降序
      .limit(50)
      .get();
    return { code: 0, data: res.data };
  }
  
  return { code: 400, msg: 'Unknown Action' };
};