export default async function (ctx) {
  const { imageBase64 } = ctx.body

  // 参数校验
  if (!imageBase64) {
    return { code: 1, msg: '请提供图片数据' }
  }

  // 检查环境变量
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY

  if (!secretId || !secretKey) {
    console.error('[id-photo] 环境变量未配置')
    return { code: 500, msg: '服务配置错误，请联系管理员', detail: 'ENV_NOT_SET' }
  }

  try {
    console.log("[id-photo] 开始处理，图片大小:", imageBase64.length)

    // 正确的导入方式
    const tencentcloud = require("tencentcloud-sdk-nodejs")
    const BdaClient = tencentcloud.bda.v20200324.Client

    // 初始化腾讯云客户端
    const client = new BdaClient({
      credential: {
        secretId: secretId,
        secretKey: secretKey,
      },
      region: "ap-guangzhou",
      profile: {
        httpProfile: {
          endpoint: "bda.tencentcloudapi.com"
        }
      },
    })

    console.log("[id-photo] 调用腾讯云 API...")

    // 调用腾讯云人像分割接口
    const result = await client.SegmentPortraitPic({
      Image: imageBase64
    })

    // 获取返回的透明背景图 (Base64)
    const resultImageBase64 = result.ResultImage
    if (!resultImageBase64) {
      throw new Error('AI 处理失败，未返回图片')
    }

    console.log("[id-photo] 人像分割成功")

    // 直接返回 Base64
    return {
      code: 0,
      msg: 'success',
      success: true,
      data: {
        imageBase64: resultImageBase64,
        tip: '透明背景 PNG，前端可用 CSS 即时换色'
      }
    }

  } catch (err) {
    console.error("[id-photo] 处理失败:", err.message, err.code)

    let errorMsg = err.message || '服务器内部错误'
    let errorCode = err.code || 'UNKNOWN'

    // 常见错误提示
    if (errorCode === 'FailedOperation.ImageNotSupported') {
      errorMsg = '图片格式不支持，请上传 JPG/PNG 格式的证件照'
    } else if (errorCode === 'FailedOperation.NoFaceInPhoto') {
      errorMsg = '未检测到人脸，请上传正面免冠证件照'
    } else if (errorCode === 'FailedOperation.ImageSizeExceed') {
      errorMsg = '图片尺寸过大，请压缩后重试'
    } else if (errorCode === 'FailedOperation.ImageDecodeFailed') {
      errorMsg = '图片解码失败，请确保图片完整'
    }

    return {
      code: 500,
      msg: errorMsg,
      success: false,
      detail: errorCode
    }
  }
}
