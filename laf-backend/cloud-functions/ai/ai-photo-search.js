/**
 * 拍照搜题云函数 - OCR + AI 双路并行
 * 
 * 功能：
 * 1. 接收图片（base64/URL）
 * 2. 并行调用智谱视觉AI + OCR
 * 3. 结果融合与校验
 * 4. 题库语义搜索
 * 5. AI即时生成解析
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud'

// 配置
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const CONFIG = {
  zhipu: {
    apiKey: process.env.AI_PROVIDER_KEY_PLACEHOLDER
    visionModel: 'glm-4v-plus',
    textModel: 'glm-4.5-air',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  },
  timeout: {
    vision: 15000,
    ocr: 10000,
    search: 5000
  },
  cache: {
    ttl: 3600 // 1小时
  }
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[${requestId}] 拍照搜题请求开始`)
  
  try {
    // 1. 参数校验
    const { imageBase64, imageUrl, subject, context, userId } = ctx.body || {}
    
    if (!imageBase64 && !imageUrl) {
      return {
        code: 400,
        success: false,
        message: '缺少图片参数',
        requestId
      }
    }
    
    // 2. 获取图片数据
    let imageData = imageBase64
    if (!imageData && imageUrl) {
      imageData = await fetchImageAsBase64(imageUrl)
    }
    
    // 3. 检查缓存
    const cacheKey = `photo_search:${hashImage(imageData)}`
    const cached = await getCache(cacheKey)
    if (cached) {
      console.log(`[${requestId}] 命中缓存`)
      return {
        code: 0,
        success: true,
        data: cached,
        cached: true,
        duration: Date.now() - startTime,
        requestId
      }
    }
    
    // 4. 并行调用视觉AI和OCR
    console.log(`[${requestId}] 开始并行识别...`)
    const [visionResult, ocrResult] = await Promise.allSettled([
      callZhipuVision(imageData, subject, context),
      callOCR(imageData)
    ])
    
    console.log(`[${requestId}] 视觉AI状态: ${visionResult.status}, OCR状态: ${ocrResult.status}`)
    
    // 5. 结果融合
    const recognizedText = mergeRecognitionResults(visionResult, ocrResult)
    
    if (!recognizedText || recognizedText.trim() === '') {
      return {
        code: 500,
        success: false,
        message: '题目识别失败，请确保图片清晰',
        requestId,
        duration: Date.now() - startTime
      }
    }
    
    console.log(`[${requestId}] 识别文本长度: ${recognizedText.length}`)
    
    // 6. 题库搜索
    const matchedQuestions = await searchQuestionBank(recognizedText, subject)
    console.log(`[${requestId}] 匹配题目数: ${matchedQuestions.length}`)
    
    // 7. 若未匹配，AI生成解析
    let aiGenerated = null
    if (matchedQuestions.length === 0) {
      console.log(`[${requestId}] 未匹配题库，AI生成解析`)
      aiGenerated = await generateAISolution(recognizedText, subject)
    }
    
    // 8. 构建响应
    const result = {
      recognizedText,
      questions: matchedQuestions,
      aiGenerated,
      confidence: calculateConfidence(visionResult, ocrResult),
      recognitionSources: {
        vision: visionResult.status === 'fulfilled',
        ocr: ocrResult.status === 'fulfilled'
      }
    }
    
    // 9. 写入缓存
    await setCache(cacheKey, result, CONFIG.cache.ttl)
    
    // 10. 记录使用日志
    await logUsage(userId, requestId, {
      subject,
      textLength: recognizedText.length,
      matchCount: matchedQuestions.length,
      hasAiGenerated: !!aiGenerated,
      duration: Date.now() - startTime
    })
    
    console.log(`[${requestId}] 拍照搜题完成，耗时: ${Date.now() - startTime}ms`)
    
    return {
      code: 0,
      success: true,
      data: result,
      cached: false,
      duration: Date.now() - startTime,
      requestId
    }
    
  } catch (error) {
    console.error(`[${requestId}] 拍照搜题异常:`, error)
    return {
      code: 500,
      success: false,
      message: error.message || '识别失败',
      requestId,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 调用智谱视觉AI
 */
async function callZhipuVision(imageBase64, subject, context) {
  const prompt = `请识别这张图片中的题目内容。

要求：
1. 完整提取题目文字，包括题干、选项（如有）
2. 识别数学公式，用LaTeX格式表示
3. 如果图片模糊，基于上下文"${context || ''}"智能补全
4. 学科领域：${subject || '综合'}

输出格式（JSON）：
{
  "question": "完整题目文本",
  "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
  "formulas": ["公式1", "公式2"],
  "questionType": "单选/多选/填空/解答",
  "subject": "学科",
  "confidence": 0.95
}`

  try {
    const response = await cloud.fetch({
      url: CONFIG.zhipu.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.zhipu.apiKey}`
      },
      data: {
        model: CONFIG.zhipu.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image_url', 
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      timeout: CONFIG.timeout.vision
    })
    
    const content = response.data?.choices?.[0]?.message?.content || ''
    
    // 尝试解析JSON
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      // 解析失败，返回原始文本
      console.warn('视觉AI JSON解析失败，返回原始文本')
    }
    
    return { question: content, confidence: 0.7 }
  } catch (error) {
    console.error('智谱视觉AI调用失败:', error.message)
    throw error
  }
}

/**
 * 调用OCR服务
 * 这里使用智谱的视觉模型作为OCR备用
 * 实际生产环境建议接入专业OCR服务（百度/腾讯）
 */
async function callOCR(imageBase64) {
  try {
    const response = await cloud.fetch({
      url: CONFIG.zhipu.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.zhipu.apiKey}`
      },
      data: {
        model: CONFIG.zhipu.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: '请提取图片中的所有文字，保持原有格式和换行。只输出文字内容，不要添加任何解释。如果有数学公式，用LaTeX格式表示。' 
              },
              { 
                type: 'image_url', 
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      },
      timeout: CONFIG.timeout.ocr
    })
    
    return {
      text: response.data?.choices?.[0]?.message?.content || '',
      confidence: 0.8
    }
  } catch (error) {
    console.error('OCR调用失败:', error.message)
    throw error
  }
}

/**
 * 融合识别结果
 */
function mergeRecognitionResults(visionResult, ocrResult) {
  let text = ''
  
  // 优先使用视觉AI的结构化结果
  if (visionResult.status === 'fulfilled' && visionResult.value?.question) {
    text = visionResult.value.question
    
    // 如果有选项，拼接
    if (visionResult.value.options?.length > 0) {
      text += '\n' + visionResult.value.options.join('\n')
    }
  }
  
  // 如果视觉AI失败或结果为空，使用OCR结果
  if (!text && ocrResult.status === 'fulfilled' && ocrResult.value?.text) {
    text = ocrResult.value.text
  }
  
  // 如果两者都有结果，进行智能选择
  if (visionResult.status === 'fulfilled' && ocrResult.status === 'fulfilled') {
    const visionText = visionResult.value?.question || ''
    const ocrText = ocrResult.value?.text || ''
    
    // 如果OCR结果明显更长（可能更完整），使用OCR结果
    if (ocrText.length > visionText.length * 1.5 && ocrText.length > 50) {
      text = ocrText
    }
    
    // 如果视觉AI有结构化数据（选项等），优先使用视觉AI
    if (visionResult.value?.options?.length > 0) {
      text = visionText + '\n' + visionResult.value.options.join('\n')
    }
  }
  
  return text.trim()
}

/**
 * 题库搜索
 */
async function searchQuestionBank(text, subject) {
  const db = cloud.database()
  
  // 提取关键词（简化版）
  const keywords = text
    .replace(/[A-D]\./g, '')  // 移除选项标记
    .replace(/[，。？！、：；""''（）\[\]【】]/g, ' ')  // 移除标点
    .split(/\s+/)
    .filter(w => w.length > 2 && w.length < 20)  // 过滤过短或过长的词
    .slice(0, 10)  // 最多10个关键词
  
  if (keywords.length === 0) {
    console.log('未提取到有效关键词')
    return []
  }
  
  console.log('搜索关键词:', keywords.join(', '))
  
  // 构建查询条件
  const query = {
    $or: keywords.map(kw => ({
      question: { $regex: kw, $options: 'i' }
    }))
  }
  
  if (subject) {
    query.category = subject
  }
  
  try {
    const result = await db.collection('questions')
      .where(query)
      .limit(5)
      .get()
    
    return result.data || []
  } catch (e) {
    console.error('题库搜索失败:', e)
    return []
  }
}

/**
 * AI生成解析
 */
async function generateAISolution(questionText, subject) {
  const prompt = `你是一位专业的考研辅导老师。请为以下题目提供详细解析。

题目：
${questionText}

学科：${subject || '综合'}

请按以下格式输出（JSON）：
{
  "analysis": {
    "steps": ["解题步骤1", "解题步骤2", "..."],
    "keyPoints": ["考点1", "考点2"],
    "tips": "解题技巧"
  },
  "answer": "参考答案",
  "difficulty": 3,
  "relatedTopics": ["相关知识点1", "相关知识点2"],
  "commonMistakes": ["易错点1", "易错点2"]
}`

  try {
    const response = await cloud.fetch({
      url: CONFIG.zhipu.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.zhipu.apiKey}`
      },
      data: {
        model: CONFIG.zhipu.textModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2000
      }
    })
    
    const content = response.data?.choices?.[0]?.message?.content || ''
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('AI解析JSON解析失败')
    }
    
    // 解析失败，返回简化结构
    return { 
      analysis: { 
        steps: [content],
        keyPoints: [],
        tips: ''
      }, 
      answer: '请参考解析',
      difficulty: 3,
      relatedTopics: [],
      commonMistakes: []
    }
  } catch (error) {
    console.error('AI解析生成失败:', error.message)
    return null
  }
}

/**
 * 计算置信度
 */
function calculateConfidence(visionResult, ocrResult) {
  let confidence = 0.5
  
  if (visionResult.status === 'fulfilled') {
    confidence += 0.3
    if (visionResult.value?.confidence) {
      confidence = Math.max(confidence, visionResult.value.confidence)
    }
  }
  
  if (ocrResult.status === 'fulfilled') {
    confidence += 0.2
  }
  
  return Math.min(0.95, confidence)
}

/**
 * 图片哈希（用于缓存key）
 */
function hashImage(base64) {
  // 简化版：取前1000字符的hash
  const sample = base64.substring(0, 1000)
  let hash = 0
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * 获取缓存
 */
async function getCache(key) {
  try {
    const db = cloud.database()
    const result = await db.collection('ai_cache')
      .where({ key, expireAt: { $gt: Date.now() } })
      .getOne()
    return result.data?.value || null
  } catch (e) {
    console.warn('缓存读取失败:', e.message)
    return null
  }
}

/**
 * 设置缓存
 */
async function setCache(key, value, ttl) {
  try {
    const db = cloud.database()
    
    // 先删除旧缓存
    await db.collection('ai_cache')
      .where({ key })
      .remove()
    
    // 写入新缓存
    await db.collection('ai_cache').add({
      key,
      value,
      expireAt: Date.now() + ttl * 1000,
      createdAt: Date.now()
    })
  } catch (e) {
    console.error('缓存写入失败:', e)
  }
}

/**
 * 获取远程图片
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await cloud.fetch({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 10000
    })
    return Buffer.from(response.data).toString('base64')
  } catch (error) {
    console.error('获取远程图片失败:', error.message)
    throw new Error('获取图片失败')
  }
}

/**
 * 记录使用日志
 */
async function logUsage(userId, requestId, data) {
  try {
    const db = cloud.database()
    await db.collection('ai_usage_logs').add({
      userId: userId || 'anonymous',
      requestId,
      action: 'photo_search',
      ...data,
      createdAt: Date.now()
    })
  } catch (e) {
    console.error('日志记录失败:', e)
  }
}
