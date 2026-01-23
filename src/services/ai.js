/**
 * AI 服务层
 * 负责与智谱 AI 的交互
 */

import { AI_CONFIG } from '../../common/config.js'

/**
 * 智谱 AI 请求封装
 */
class AIService {
  /**
   * 通用请求方法
   */
  request(endpoint, data, options = {}) {
    return new Promise((resolve, reject) => {
      const apiKey = AI_CONFIG.getApiKey ? AI_CONFIG.getApiKey() : AI_CONFIG.apiKey
      if (!apiKey) {
        reject(new Error('未配置智谱AI Key'))
        return
      }
      uni.request({
        url: `${AI_CONFIG.baseURL}${endpoint}`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...options.header
        },
        data,
        timeout: options.timeout || AI_CONFIG.timeout,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data)
          } else {
            console.error('AI 请求失败：', res)
            uni.showToast({
              title: 'AI 服务异常',
              icon: 'none'
            })
            reject(res)
          }
        },
        fail: (err) => {
          console.error('AI 请求错误：', err)
          uni.showToast({
            title: '网络请求失败',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  }

  /**
   * 聊天对话（流式）
   * @param {Array} messages - 消息列表
   * @param {Object} options - 配置选项
   */
  async chat(messages, options = {}) {
    try {
      const data = {
        model: options.model || AI_CONFIG.model,
        messages,
        stream: options.stream !== undefined ? options.stream : false,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9,
        max_tokens: options.max_tokens || 2000
      }

      const response = await this.request('/chat/completions', data, options)
      return response
    } catch (error) {
      console.error('AI 对话失败：', error)
      throw error
    }
  }

  /**
   * 生成题目
   * @param {String} subject - 学科
   * @param {String} topic - 主题
   * @param {String} difficulty - 难度
   */
  async generateQuestion(subject, topic, difficulty = 'medium') {
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的考研题目生成助手，擅长生成高质量的考研练习题。'
      },
      {
        role: 'user',
        content: `请为我生成一道${subject}学科，关于${topic}的${difficulty}难度考研题目。
        
要求：
1. 题目要有实际价值，贴近考研真题风格
2. 提供4个选项（单选题）
3. 给出正确答案
4. 提供详细的解析

请以 JSON 格式返回，格式如下：
{
  "question": "题目内容",
  "options": ["A选项", "B选项", "C选项", "D选项"],
  "answer": "正确答案（A/B/C/D）",
  "explanation": "详细解析"
}`
      }
    ]

    try {
      const response = await this.chat(messages)
      
      // 解析 AI 返回的内容
      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content
        // 尝试解析 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }
      
      throw new Error('AI 返回格式错误')
    } catch (error) {
      console.error('生成题目失败：', error)
      throw error
    }
  }

  /**
   * 分析答题情况
   * @param {Object} question - 题目
   * @param {String} userAnswer - 用户答案
   */
  async analyzeAnswer(question, userAnswer) {
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的考研辅导老师，擅长分析学生的答题情况并给出改进建议。'
      },
      {
        role: 'user',
        content: `题目：${question.question}
        
选项：
${question.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')}

正确答案：${question.answer}
用户答案：${userAnswer}

请分析用户的答题情况，如果答错了，请指出可能的错误原因和改进建议。`
      }
    ]

    try {
      const response = await this.chat(messages)
      
      if (response.choices && response.choices.length > 0) {
        return response.choices[0].message.content
      }
      
      throw new Error('AI 返回格式错误')
    } catch (error) {
      console.error('分析答题失败：', error)
      throw error
    }
  }

  /**
   * 生成学习建议
   * @param {Object} studyData - 学习数据
   */
  async generateStudyAdvice(studyData) {
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的考研学习顾问，根据学生的学习情况给出针对性的学习建议。'
      },
      {
        role: 'user',
        content: `学生的学习情况如下：
- 总题目数：${studyData.totalQuestions}
- 已完成题目数：${studyData.completedQuestions}
- 正确题目数：${studyData.correctQuestions}
- 正确率：${studyData.accuracy}%
- 学习天数：${studyData.studyDays}天

请根据以上数据，给出具体的学习建议和改进方向。`
      }
    ]

    try {
      const response = await this.chat(messages)
      
      if (response.choices && response.choices.length > 0) {
        return response.choices[0].message.content
      }
      
      throw new Error('AI 返回格式错误')
    } catch (error) {
      console.error('生成学习建议失败：', error)
      throw error
    }
  }
}

// 创建实例并导出
const aiService = new AIService()

export default aiService
