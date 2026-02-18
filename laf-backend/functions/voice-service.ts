/**
 * 语音服务云函数 - 智谱 AI 语音接口
 * 
 * 云函数名称：voice-service
 * 
 * 功能：
 * 1. speech_to_text (STT) - 语音转文字，使用 GLM-ASR-2512
 * 2. text_to_speech (TTS) - 文字转语音，使用 GLM-TTS
 * 
 * 请求参数：
 * - action: string (必填) - 操作类型: 'speech_to_text' | 'text_to_speech'
 * 
 * STT 参数：
 * - audioBase64: string (必填) - 音频文件 Base64 编码
 * - audioFormat: string (可选) - 音频格式，默认 'mp3'
 * - hotwords: array (可选) - 热词列表，提升识别率
 * 
 * TTS 参数：
 * - text: string (必填) - 要转换的文本
 * - voice: string (可选) - 音色，默认 'tongtong'
 * - speed: number (可选) - 语速 0.5-2，默认 1.0
 * - volume: number (可选) - 音量 0-10，默认 1.0
 * 
 * 返回格式：
 * { code: 0, success: true, data: {...}, message: 'success' }
 * 
 * 环境变量要求：
 * - AI_PROVIDER_KEY_PLACEHOLDER
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud'
import { validate } from '../utils/validator'
import { success, badRequest, serverError, generateRequestId, wrapResponse } from './_shared/api-response'

// 环境变量配置
const AI_PROVIDER_KEY_PLACEHOLDER
const ZHIPU_STT_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions'
const ZHIPU_TTS_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/speech'

// TTS 音色配置
const VOICE_OPTIONS = {
  'tongtong': '彤彤（默认，温柔女声）',
  'chuichui': '锤锤（活泼男声）',
  'xiaochen': '小陈（专业男声）',
  'jam': 'Jam（动物圈）',
  'kazi': 'Kazi（动物圈）',
  'douji': 'Douji（动物圈）',
  'luodo': 'Luodo（动物圈）'
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = generateRequestId('voice')

  console.log(`[${requestId}] 语音服务请求开始`)

  try {
    const { action } = ctx.body || {}

    // S003: 入口参数校验
    const entryValidation = validate({ action }, {
      action: { required: true, type: 'string', maxLength: 50, enum: ['speech_to_text', 'stt', 'text_to_speech', 'tts', 'get_voices'] }
    })
    if (!entryValidation.valid) {
      return wrapResponse(badRequest(entryValidation.errors[0]), requestId, startTime)
    }

    console.log(`[${requestId}] action: ${action}`)

    let result

    switch (action) {
      case 'speech_to_text':
      case 'stt':
        result = await handleSTT(ctx.body, requestId)
        break

      case 'text_to_speech':
      case 'tts':
        result = await handleTTS(ctx.body, requestId)
        break

      case 'get_voices':
        result = success(VOICE_OPTIONS, '获取音色列表成功')
        break

      default:
        result = badRequest(`不支持的操作类型: ${action}`)
    }

    const duration = Date.now() - startTime
    console.log(`[${requestId}] 语音服务完成，耗时: ${duration}ms`)

    return wrapResponse(result, requestId, startTime)

  } catch (error) {
    console.error(`[${requestId}] 语音服务异常:`, error)

    return wrapResponse(serverError(error.message || '语音服务异常', error.message), requestId, startTime)
  }
}

/**
 * 处理语音转文字 (STT)
 * 使用智谱 GLM-ASR-2512 模型
 */
async function handleSTT(params, requestId) {
  const {
    audioBase64,
    audioFormat = 'mp3',
    hotwords = [],
    prompt = ''
  } = params

  if (!audioBase64) {
    return badRequest('参数错误: audioBase64 不能为空')
  }

  console.log(`[${requestId}] STT 请求: audioSize=${audioBase64.length}, format=${audioFormat}`)

  try {
    // 智谱 ASR API 支持 file_base64 参数
    const requestBody = {
      model: 'glm-asr-2512',
      file_base64: audioBase64,
      stream: false
    }

    // 添加热词（提升考研专业术语识别率）
    if (hotwords && hotwords.length > 0) {
      requestBody.hotwords = hotwords.slice(0, 100) // 最多100个热词
    }

    // 添加上下文提示
    if (prompt) {
      requestBody.prompt = prompt.substring(0, 8000) // 最多8000字
    }

    console.log(`[${requestId}] 调用智谱 ASR API...`)

    const response = await cloud.fetch({
      url: ZHIPU_STT_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_PROVIDER_KEY_PLACEHOLDER
      },
      data: requestBody,
      timeout: 30000 // 30秒超时
    })

    const data = response.data

    if (data.error) {
      console.error(`[${requestId}] STT 错误:`, data.error)
      return serverError(`语音识别失败: ${data.error.message || '未知错误'}`)
    }

    const text = data.text || ''
    console.log(`[${requestId}] STT 成功: textLength=${text.length}`)

    return success({
      text: text,
      model: data.model || 'glm-asr-2512'
    }, '语音识别成功')

  } catch (error) {
    console.error(`[${requestId}] STT 异常:`, error)
    return serverError(`语音识别异常: ${error.message}`)
  }
}

/**
 * 处理文字转语音 (TTS)
 * 使用智谱 GLM-TTS 模型
 */
async function handleTTS(params, requestId) {
  const {
    text,
    voice = 'tongtong',
    speed = 1.0,
    volume = 1.0,
    format = 'wav'
  } = params

  if (!text || text.trim() === '') {
    return badRequest('参数错误: text 不能为空')
  }

  // 文本长度限制
  const trimmedText = text.trim().substring(0, 1024)

  console.log(`[${requestId}] TTS 请求: textLength=${trimmedText.length}, voice=${voice}`)

  try {
    const requestBody = {
      model: 'glm-tts',
      input: trimmedText,
      voice: voice,
      response_format: format,
      speed: Math.max(0.5, Math.min(2, speed)),
      volume: Math.max(0.1, Math.min(10, volume)),
      stream: false
    }

    console.log(`[${requestId}] 调用智谱 TTS API...`)

    const response = await cloud.fetch({
      url: ZHIPU_TTS_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_PROVIDER_KEY_PLACEHOLDER
      },
      data: requestBody,
      timeout: 30000, // 30秒超时
      responseType: 'arraybuffer' // 返回二进制数据
    })

    // 检查是否返回错误
    if (response.headers['content-type']?.includes('application/json')) {
      // 如果返回 JSON，说明是错误响应
      const errorData = JSON.parse(Buffer.from(response.data).toString())
      console.error(`[${requestId}] TTS 错误:`, errorData)
      return serverError(`语音合成失败: ${errorData.error?.message || '未知错误'}`)
    }

    // 将音频数据转为 Base64
    const audioBase64 = Buffer.from(response.data).toString('base64')

    console.log(`[${requestId}] TTS 成功: audioSize=${audioBase64.length}`)

    return success({
      audioBase64: audioBase64,
      format: format,
      voice: voice,
      mimeType: format === 'wav' ? 'audio/wav' : 'audio/pcm'
    }, '语音合成成功')

  } catch (error) {
    console.error(`[${requestId}] TTS 异常:`, error)
    return serverError(`语音合成异常: ${error.message}`)
  }
}
