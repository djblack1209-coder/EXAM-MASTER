'use strict';

/**
 * 错题本云对象
 * 提供错题数据的 CRUD 操作
 */

const db = uniCloud.database();
const dbCmd = db.command;
const mistakeCollection = db.collection('exam-mistakes');

module.exports = {
	/**
	 * 添加错题
	 * @param {Object} data - 错题数据
	 * @param {string} data.question_content - 题目内容
	 * @param {Array} data.options - 选项列表
	 * @param {string} data.user_answer - 用户答案
	 * @param {string} data.correct_answer - 正确答案
	 * @param {string} data.analysis - AI解析（可选）
	 * @param {Array} data.tags - 标签列表（可选）
	 * @returns {Promise<Object>} 返回添加结果
	 */
	async add(data) {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid || 'tourist';
			
			// 构建错题数据
			const mistakeData = {
				user_id: uid,
				question_content: data.question_content || '',
				options: data.options || [],
				user_answer: data.user_answer || '',
				correct_answer: data.correct_answer || '',
				analysis: data.analysis || '',
				tags: data.tags || [],
				is_mastered: false,
				wrong_count: data.wrong_count || 1,
				last_practice_time: null
			};
			
			// 验证必填字段
			if (!mistakeData.question_content || !mistakeData.correct_answer) {
				return {
					code: 400,
					message: '题目内容和正确答案为必填项',
					data: null
				};
			}
			
			// 插入数据（Schema 会自动校验和填充 user_id、created_at）
			const result = await mistakeCollection.add(mistakeData);
			
			return {
				code: 200,
				message: '添加成功',
				data: {
					id: result.id,
					...mistakeData
				}
			};
		} catch (error) {
			console.error('添加错题失败:', error);
			return {
				code: 500,
				message: error.message || '添加错题失败',
				data: null
			};
		}
	},
	
	/**
	 * 分页获取错题列表
	 * @param {number} page - 页码（从1开始）
	 * @param {number} limit - 每页数量
	 * @param {Object} filters - 筛选条件（可选）
	 * @param {boolean} filters.is_mastered - 是否已掌握（可选）
	 * @returns {Promise<Object>} 返回错题列表
	 */
	async get(page = 1, limit = 20, filters = {}) {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid || 'tourist';
			
			// 构建查询条件
			let query = mistakeCollection.where({
				user_id: uid
			});
			
			// 应用筛选条件
			if (filters.is_mastered !== undefined) {
				query = query.where({
					is_mastered: filters.is_mastered
				});
			}
			
			// 分页查询，按创建时间倒序
			const skip = (page - 1) * limit;
			const result = await query
				.orderBy('created_at', 'desc')
				.skip(skip)
				.limit(limit)
				.get();
			
			// 获取总数
			const countResult = await mistakeCollection
				.where({
					user_id: uid,
					...(filters.is_mastered !== undefined ? { is_mastered: filters.is_mastered } : {})
				})
				.count();
			
			return {
				code: 200,
				message: '获取成功',
				data: {
					list: result.data || [],
					total: countResult.total || 0,
					page: page,
					limit: limit,
					hasMore: result.data.length === limit
				}
			};
		} catch (error) {
			console.error('获取错题列表失败:', error);
			return {
				code: 500,
				message: error.message || '获取错题列表失败',
				data: null
			};
		}
	},
	
	/**
	 * 删除错题
	 * @param {string} id - 错题ID
	 * @returns {Promise<Object>} 返回删除结果
	 */
	async remove(id) {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid || 'tourist';
			
			if (!id) {
				return {
					code: 400,
					message: '错题ID不能为空',
					data: null
				};
			}
			
			// 删除数据（Schema 权限会自动校验 user_id）
			const result = await mistakeCollection.doc(id).remove();
			
			if (result.deleted === 0) {
				return {
					code: 404,
					message: '错题不存在或无权删除',
					data: null
				};
			}
			
			return {
				code: 200,
				message: '删除成功',
				data: { id }
			};
		} catch (error) {
			console.error('删除错题失败:', error);
			return {
				code: 500,
				message: error.message || '删除错题失败',
				data: null
			};
		}
	},
	
	/**
	 * 更新掌握状态
	 * @param {string} id - 错题ID
	 * @param {boolean} is_mastered - 是否已掌握
	 * @returns {Promise<Object>} 返回更新结果
	 */
	async updateStatus(id, is_mastered) {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid || 'tourist';
			
			if (!id) {
				return {
					code: 400,
					message: '错题ID不能为空',
					data: null
				};
			}
			
			// 更新数据（Schema 权限会自动校验 user_id）
			const updateData = {
				is_mastered: Boolean(is_mastered),
				last_practice_time: Date.now()
			};
			
			const result = await mistakeCollection.doc(id).update(updateData);
			
			if (result.updated === 0) {
				return {
					code: 404,
					message: '错题不存在或无权更新',
					data: null
				};
			}
			
			return {
				code: 200,
				message: '更新成功',
				data: { id, ...updateData }
			};
		} catch (error) {
			console.error('更新错题状态失败:', error);
			return {
				code: 500,
				message: error.message || '更新错题状态失败',
				data: null
			};
		}
	},
	
	/**
	 * 批量更新错题（用于同步本地数据）
	 * @param {Array} mistakes - 错题数组
	 * @returns {Promise<Object>} 返回批量操作结果
	 */
	async batchAdd(mistakes) {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid || 'tourist';
			
			if (!Array.isArray(mistakes) || mistakes.length === 0) {
				return {
					code: 400,
					message: '错题数据不能为空',
					data: null
				};
			}
			
			// 批量插入数据
			const mistakeDataList = mistakes.map(mistake => ({
				user_id: uid,
				question_content: mistake.question_content || mistake.question || '',
				options: mistake.options || [],
				user_answer: mistake.user_answer || mistake.userChoice || '',
				correct_answer: mistake.correct_answer || mistake.answer || '',
				analysis: mistake.analysis || mistake.desc || '',
				tags: mistake.tags || [],
				is_mastered: mistake.is_mastered || false,
				wrong_count: mistake.wrong_count || 1,
				last_practice_time: mistake.last_practice_time || null
			}));
			
			const result = await mistakeCollection.add(mistakeDataList);
			
			return {
				code: 200,
				message: '批量添加成功',
				data: {
					ids: result.ids || [],
					count: mistakeDataList.length
				}
			};
		} catch (error) {
			console.error('批量添加错题失败:', error);
			return {
				code: 500,
				message: error.message || '批量添加错题失败',
				data: null
			};
		}
	}
};
