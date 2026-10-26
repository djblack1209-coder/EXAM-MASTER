export const MODEL_BRANDS = Object.freeze({
  DeepSeek: { logo: '/static/brand/deepseek.svg', group: 'general' },
  智谱: { logo: '/static/brand/providers/zhipu-color.svg', group: 'general' },
  'Z.ai': { logo: '/static/brand/providers/zai.svg', group: 'general', mono: true },
  ModelScope: { logo: '/static/brand/providers/modelscope-color.svg', group: 'general' },
  SiliconFlow: { logo: '/static/brand/providers/siliconcloud-color.svg', group: 'general' },
  '通义千问（阿里云百炼）': { logo: '/static/brand/providers/qwen-color.svg', group: 'general' },
  '月之暗面 Kimi': { logo: '/static/brand/providers/moonshot.svg', group: 'general', mono: true },
  '豆包（火山方舟）': { logo: '/static/brand/providers/doubao-color.svg', group: 'general' },
  '百度文心（千帆）': { logo: '/static/brand/providers/wenxin-color.svg', group: 'general' },
  腾讯混元: { logo: '/static/brand/providers/hunyuan-color.svg', group: 'general' },
  MiniMax: { logo: '/static/brand/providers/minimax-color.svg', group: 'general' },
  阶跃星辰: { logo: '/static/brand/providers/stepfun-color.svg', group: 'general' },
  讯飞星火: { logo: '/static/brand/providers/spark-color.svg', group: 'general' },
  零一万物: { logo: '/static/brand/providers/yi-color.svg', group: 'general', mono: true },
  百川智能: { logo: '/static/brand/providers/baichuan-color.svg', group: 'general' },
  'Google Gemini': { logo: '/static/brand/google-g.svg', group: 'other' },
  Groq: { logo: '/static/brand/providers/groq.svg', group: 'other', mono: true },
  OpenRouter: { logo: '/static/brand/providers/openrouter-color.svg', group: 'other', mono: true },
  'Aion Labs': { logo: '/static/brand/providers/aionlabs-color.svg', group: 'other', mono: true },
  LLM7: { logo: '/static/brand/providers/llm7.png', group: 'other' },
  'Ollama Cloud': { logo: '/static/brand/providers/ollama.svg', group: 'other', mono: true },
  Mistral: { logo: '/static/brand/providers/mistral-color.svg', group: 'other' },
  'NVIDIA NIM': { logo: '/static/brand/providers/nvidia-color.svg', group: 'other' },
  'Hugging Face': { logo: '/static/brand/providers/huggingface-color.svg', group: 'other' },
  Cohere: { logo: '/static/brand/providers/cohere-color.svg', group: 'other' },
  Cerebras: { logo: '/static/brand/providers/cerebras-color.svg', group: 'other' },
  SambaNova: { logo: '/static/brand/providers/sambanova-color.svg', group: 'other' },
  'Kilo Gateway': { logo: '/static/brand/providers/kilocode.svg', group: 'other', mono: true }
});
export function modelBrand(provider) {
  return MODEL_BRANDS[provider] || { logo: '', group: 'other' };
}
