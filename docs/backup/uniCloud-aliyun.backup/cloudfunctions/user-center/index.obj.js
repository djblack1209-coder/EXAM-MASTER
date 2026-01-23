'use strict';

/**
 * 用户中心云对象
 * 提供用户登录、信息管理等功能
 */

const db = uniCloud.database();
const userCollection = db.collection('uni-id-users');

// ⚠️ 微信小程序配置（硬编码）
// 注意：生产环境建议使用环境变量，当前硬编码仅用于快速调试
const WX_APPID = 'wx5bee888cf32215df';
const WX_SECRET_PLACEHOLDER

module.exports = {
	/**
	 * 微信小程序登录
	 * @param {string} code - 微信登录凭证 code（通过 uni.login 获取）
	 * @returns {Promise<Object>} 返回登录结果 { code, message, data: { _id, nickname, avatar, token } }
	 */
	async login(code) {
		try {
			if (!code) {
				return {
					code: 400,
					message: '登录凭证 code 不能为空',
					data: null
				};
			}
			
			// 调用微信接口换取 openid 和 session_key
			const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET_PLACEHOLDER
			
			const wxResponse = await uniCloud.httpclient.request(wxApiUrl, {
				method: 'GET',
				dataType: 'json',
				timeout: 10000
			});
			
			if (wxResponse.status !== 200 || !wxResponse.data) {
				return {
					code: 500,
					message: '微信登录接口调用失败',
					data: null
				};
			}
			
			const wxData = wxResponse.data;
			
			// 检查微信返回的错误
			if (wxData.errcode) {
				return {
					code: 400,
					message: `微信登录失败: ${wxData.errmsg || '未知错误'} (错误码: ${wxData.errcode})`,
					data: null
				};
			}
			
			const openid = wxData.openid;
			const session_key = wxData.session_key; // 可以保存用于后续解密用户信息
			
			if (!openid) {
				return {
					code: 500,
					message: '获取 openid 失败',
					data: null
				};
			}
			
			// 查询用户是否存在
			const userQuery = await userCollection.where({
				openid: openid
			}).get();
			
			let user = null;
			const now = Date.now();
			
			if (userQuery.data && userQuery.data.length > 0) {
				// 用户已存在，更新最后登录时间
				user = userQuery.data[0];
				await userCollection.doc(user._id).update({
					last_login_date: now
				});
				
				// 更新返回的用户信息
				user.last_login_date = now;
			} else {
				// 用户不存在，创建新用户
				const userIdSuffix = openid.slice(-4); // 取 openid 后4位作为ID后缀
				const defaultNickname = `备考同学${userIdSuffix}`;
				
				const newUser = {
					openid: openid,
					nickname: defaultNickname,
					avatar: '',
					status: 0,
					created_at: now,
					last_login_date: now
				};
				
				const createResult = await userCollection.add(newUser);
				
				if (createResult.id) {
					user = {
						_id: createResult.id,
						...newUser
					};
				} else {
					return {
						code: 500,
						message: '创建用户失败',
						data: null
					};
				}
			}
			
			// 生成 token（简化版：使用 _id 作为 token）
			// 生产环境建议使用 JWT 或其他安全方案
			const token = user._id;
			
			return {
				code: 200,
				message: '登录成功',
				data: {
					_id: user._id,
					openid: user.openid,
					nickname: user.nickname,
					avatar: user.avatar,
					token: token,
					created_at: user.created_at,
					last_login_date: user.last_login_date
				}
			};
		} catch (error) {
			console.error('登录失败:', error);
			return {
				code: 500,
				message: error.message || '登录失败',
				data: null
			};
		}
	},
	
	/**
	 * 更新用户信息
	 * @param {Object} userInfo - 用户信息
	 * @param {string} userInfo.nickname - 昵称（可选）
	 * @param {string} userInfo.avatar - 头像（可选）
	 * @returns {Promise<Object>} 返回更新结果
	 */
	async updateUserInfo(userInfo) {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid;
			if (!uid) {
				return {
					code: 401,
					message: '未登录，请先登录',
					data: null
				};
			}
			
			const updateData = {};
			if (userInfo.nickname !== undefined) {
				updateData.nickname = userInfo.nickname;
			}
			if (userInfo.avatar !== undefined) {
				updateData.avatar = userInfo.avatar;
			}
			
			if (Object.keys(updateData).length === 0) {
				return {
					code: 400,
					message: '没有需要更新的字段',
					data: null
				};
			}
			
			const result = await userCollection.doc(uid).update(updateData);
			
			if (result.updated === 0) {
				return {
					code: 404,
					message: '用户不存在或无权更新',
					data: null
				};
			}
			
			// 获取更新后的用户信息
			const userQuery = await userCollection.doc(uid).get();
			const updatedUser = userQuery.data && userQuery.data[0];
			
			return {
				code: 200,
				message: '更新成功',
				data: updatedUser
			};
		} catch (error) {
			console.error('更新用户信息失败:', error);
			return {
				code: 500,
				message: error.message || '更新用户信息失败',
				data: null
			};
		}
	},
	
	/**
	 * 获取当前用户信息
	 * @returns {Promise<Object>} 返回用户信息
	 */
	async getCurrentUser() {
		try {
			// TODO: 上线前必须开启严格身份校验
			// const uid = this.getUniIdToken()?.uid;
			// if (!uid) {
			// 	return { code: 401, message: '未登录，请先登录', data: null };
			// }
			
			// 临时方案：允许未登录用户（调试用）
			const uid = this.getUniIdToken()?.uid;
			if (!uid) {
				return {
					code: 401,
					message: '未登录，请先登录',
					data: null
				};
			}
			
			const userQuery = await userCollection.doc(uid).get();
			
			if (!userQuery.data || userQuery.data.length === 0) {
				return {
					code: 404,
					message: '用户不存在',
					data: null
				};
			}
			
			const user = userQuery.data[0];
			
			return {
				code: 200,
				message: '获取成功',
				data: {
					_id: user._id,
					openid: user.openid,
					nickname: user.nickname,
					avatar: user.avatar,
					created_at: user.created_at,
					last_login_date: user.last_login_date
				}
			};
		} catch (error) {
			console.error('获取用户信息失败:', error);
			return {
				code: 500,
				message: error.message || '获取用户信息失败',
				data: null
			};
		}
	}
};
